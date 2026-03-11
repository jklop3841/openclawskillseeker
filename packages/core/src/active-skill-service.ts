import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { loadLocalCatalog } from "@openclaw-skill-center/catalog";
import {
  ManagedLibraryActivationSchema,
  type AppState,
  type CatalogPack,
  type CatalogSkill,
  type ManagedLibraryActivation
} from "@openclaw-skill-center/shared";
import { ensureDir, pathExists, removePath, writeJsonFile } from "./fs.js";
import { createLogger } from "./logger.js";
import { type AppPaths } from "./paths.js";
import { PackService } from "./pack-service.js";
import { saveState } from "./state.js";
import { ConfigService } from "./config-service.js";

type PackSummary = {
  id: string;
  name: string;
  description: string;
  skillCount: number;
  skills: string[];
};

type SkillSummary = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
};

export class ActiveSkillService {
  private readonly logger = createLogger("active-skill-service");

  constructor(
    private readonly paths: AppPaths,
    private readonly configService: ConfigService,
    private readonly packService: PackService
  ) {}

  listManagedLibrary() {
    const catalog = loadLocalCatalog();
    const localSkills = catalog.skills.filter((skill) => skill.curated && skill.sourceType === "local");
    const localSkillSet = new Set(localSkills.map((skill) => skill.slug));
    const localPacks = catalog.packs.filter((pack) => pack.skills.every((slug) => localSkillSet.has(slug)));

    return {
      packs: localPacks.map((pack): PackSummary => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        skillCount: pack.skills.length,
        skills: pack.skills
      })),
      skills: localSkills.map((skill): SkillSummary => ({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        tags: skill.tags
      }))
    };
  }

  async activateSkill(slug: string, state: AppState) {
    const catalog = loadLocalCatalog();
    const skill = catalog.skills.find((entry) => entry.slug === slug && entry.curated && entry.sourceType === "local");
    if (!skill) {
      throw new Error(`Local curated skill not found: ${slug}`);
    }

    const mergedSkills = [...new Set([...state.activeSkillSlugs, slug])];
    return this.syncSelection(
      {
        mode: "skill",
        targetId: slug,
        selectedSkillSlugs: mergedSkills,
        selectedPackIds: state.activePackIds
      },
      state
    );
  }

  async activatePack(packId: string, state: AppState) {
    const catalog = loadLocalCatalog();
    const localSkills = new Set(catalog.skills.filter((skill) => skill.curated && skill.sourceType === "local").map((skill) => skill.slug));
    const pack = catalog.packs.find((entry) => entry.id === packId && entry.skills.every((slug) => localSkills.has(slug)));
    if (!pack) {
      throw new Error(`Local curated pack not found: ${packId}`);
    }

    const mergedSkills = [...new Set([...state.activeSkillSlugs, ...pack.skills])];
    const mergedPacks = [...new Set([...state.activePackIds, packId])];
    return this.syncSelection(
      {
        mode: "pack",
        targetId: packId,
        selectedSkillSlugs: mergedSkills,
        selectedPackIds: mergedPacks
      },
      state
    );
  }

  async deactivateAll(state: AppState) {
    return this.syncSelection(
      {
        mode: "deactivate-all",
        targetId: "all",
        selectedSkillSlugs: [],
        selectedPackIds: []
      },
      state
    );
  }

  private async syncSelection(
    input: {
      mode: ManagedLibraryActivation["mode"];
      targetId: string;
      selectedSkillSlugs: string[];
      selectedPackIds: string[];
    },
    state: AppState
  ): Promise<{ result: ManagedLibraryActivation; state: AppState }> {
    const selectedSkills = this.getSelectedLocalSkills(input.selectedSkillSlugs);
    const activeRoot = this.paths.activeSkillsRoot;
    const skillsDir = path.join(activeRoot, "skills");

    this.logger.info(
      {
        mode: input.mode,
        targetId: input.targetId,
        activeSkillCount: selectedSkills.length,
        activeRoot
      },
      "Syncing managed active skills"
    );

    await removePath(activeRoot);
    await ensureDir(skillsDir);

    for (const skill of selectedSkills) {
      const sourcePath = this.resolveLocalSkillSource(skill);
      if (!(await pathExists(sourcePath))) {
        throw new Error(`Skill source missing: ${skill.slug}`);
      }

      await fs.cp(sourcePath, path.join(skillsDir, skill.slug), { recursive: true, force: true });
      await writeJsonFile(path.join(skillsDir, skill.slug, ".clawhub", "origin.json"), {
        slug: skill.slug,
        sourceType: "local-managed",
        sourcePath,
        activatedAt: new Date().toISOString()
      });
    }

    await writeJsonFile(path.join(activeRoot, ".clawhub", "lock.json"), {
      managedBy: "openclaw-skill-center",
      activatedAt: new Date().toISOString(),
      skills: selectedSkills.map((skill) => skill.slug)
    });

    let nextState: AppState = {
      ...state,
      activeSkillSlugs: selectedSkills.map((skill) => skill.slug),
      activePackIds: input.selectedPackIds
    };

    let configPatch;
    if (selectedSkills.length > 0) {
      const patched = await this.configService.patchExtraDir(skillsDir, nextState, { dryRun: false });
      nextState = patched.state;
      configPatch = patched.result;
    }

    await saveState(this.paths, nextState);
    const verify = await this.packService.verifyPackLayout(activeRoot, { verbose: true });
    const success = selectedSkills.length === 0 ? true : verify.ok;

    return {
      result: ManagedLibraryActivationSchema.parse({
        mode: input.mode,
        targetId: input.targetId,
        activeSkillSlugs: nextState.activeSkillSlugs,
        activePackIds: nextState.activePackIds,
        activeRoot,
        success,
        configPatch,
        verify,
        userSummary: this.buildUserSummary(input.mode, input.targetId, nextState.activeSkillSlugs, activeRoot, success),
        nextStep:
          selectedSkills.length === 0
            ? "All managed skills were removed. Restart OpenClaw if it is currently running."
            : "Restart OpenClaw, then ask it to use one of the active skills."
      }),
      state: nextState
    };
  }

  private getSelectedLocalSkills(slugs: string[]) {
    const catalog = loadLocalCatalog();
    const localSkills = new Map(
      catalog.skills
        .filter((skill) => skill.curated && skill.sourceType === "local")
        .map((skill) => [skill.slug, skill])
    );

    return slugs
      .map((slug) => localSkills.get(slug))
      .filter((skill): skill is CatalogSkill => Boolean(skill));
  }

  private resolveLocalSkillSource(skill: CatalogSkill) {
    const sourcePath = skill.sourceRef?.path;
    if (!sourcePath) {
      throw new Error(`Skill source path missing for ${skill.slug}`);
    }

    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    const candidates = [
      path.resolve(process.cwd(), sourcePath),
      path.resolve(process.cwd(), "..", "..", sourcePath),
      resourcesPath ? path.join(resourcesPath, "curated", sourcePath) : null
    ].filter((candidate): candidate is string => Boolean(candidate));

    const resolved = candidates.find((candidate) => existsSync(candidate));

    if (!resolved) {
      throw new Error(`Unable to resolve local skill source for ${skill.slug}`);
    }

    return resolved;
  }

  private buildUserSummary(
    mode: ManagedLibraryActivation["mode"],
    targetId: string,
    activeSkillSlugs: string[],
    activeRoot: string,
    success: boolean
  ) {
    const prefix =
      mode === "deactivate-all"
        ? "Managed skills were cleared."
        : mode === "pack"
          ? `Activated pack: ${targetId}`
          : `Activated skill: ${targetId}`;

    return [
      prefix,
      `Active skills: ${activeSkillSlugs.length > 0 ? activeSkillSlugs.join(", ") : "none"}`,
      `Managed OpenClaw path: ${path.join(activeRoot, "skills")}`,
      success
        ? "Verification passed. Restart OpenClaw to refresh its skill list."
        : "Verification did not pass. Review the advanced details before using these skills."
    ];
  }
}
