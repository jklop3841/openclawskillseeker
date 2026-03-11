import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { loadLocalCatalog } from "@openclaw-skill-center/catalog";
import {
  ManagedLibraryActivationSchema,
  type AppState,
  type CatalogSkill,
  type ManagedLibraryActivation,
  type ManagedLibrarySnapshot
} from "@openclaw-skill-center/shared";
import { ensureDir, pathExists, removePath, writeJsonFile } from "./fs.js";
import { createLogger } from "./logger.js";
import { type AppPaths } from "./paths.js";
import { PackService } from "./pack-service.js";
import { saveState } from "./state.js";
import { ConfigService } from "./config-service.js";

export class ActiveSkillService {
  private readonly logger = createLogger("active-skill-service");

  constructor(
    private readonly paths: AppPaths,
    private readonly configService: ConfigService,
    private readonly packService: PackService
  ) {}

  listManagedLibrary(state: AppState): ManagedLibrarySnapshot {
    const catalog = loadLocalCatalog();
    const localSkills = catalog.skills.filter((skill) => skill.curated && skill.sourceType === "local");
    const localSkillSet = new Set(localSkills.map((skill) => skill.slug));
    const localPacks = catalog.packs.filter((pack) => pack.skills.every((slug) => localSkillSet.has(slug)));
    const activePackIds = new Set(state.activePackIds);
    const manualSkillSlugs = new Set(state.manualSkillSlugs ?? []);
    const packManagedSkills = new Set(
      localPacks.filter((pack) => activePackIds.has(pack.id)).flatMap((pack) => pack.skills)
    );

    return {
      packs: localPacks.map((pack) => ({
        id: pack.id,
        name: pack.name,
        description: pack.description,
        skillCount: pack.skills.length,
        skills: pack.skills,
        category: pack.category,
        audience: pack.audience,
        outcome: pack.outcome,
        active: activePackIds.has(pack.id)
      })),
      skills: localSkills.map((skill) => ({
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        tags: skill.tags,
        active: state.activeSkillSlugs.includes(skill.slug),
        activationSource: manualSkillSlugs.has(skill.slug) && packManagedSkills.has(skill.slug)
          ? "both"
          : manualSkillSlugs.has(skill.slug)
            ? "manual"
            : packManagedSkills.has(skill.slug)
              ? "pack"
              : "inactive"
      }))
      ,
      activeSkillSlugs: state.activeSkillSlugs,
      activePackIds: state.activePackIds,
      manualSkillSlugs: state.manualSkillSlugs ?? [],
      currentModeTitle: this.describeCurrentMode(state, localPacks),
      currentModeSummary: this.describeCurrentModeSummary(state, localPacks),
      recentActions: (state.managedHistory ?? []).slice(0, 5).map((entry) => ({
        at: entry.at,
        label: this.describeHistoryEntry(entry, localPacks),
        activeSkillSlugs: entry.activeSkillSlugs
      }))
    };
  }

  async activateSkill(slug: string, state: AppState) {
    const catalog = loadLocalCatalog();
    const skill = catalog.skills.find((entry) => entry.slug === slug && entry.curated && entry.sourceType === "local");
    if (!skill) {
      throw new Error(`Local curated skill not found: ${slug}`);
    }

    const mergedSkills = [...new Set([...(state.manualSkillSlugs ?? []), slug])];
    return this.syncSelection(
      {
        mode: "skill",
        targetId: slug,
        manualSkillSlugs: mergedSkills,
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

    const mergedPacks = [...new Set([...state.activePackIds, packId])];
    return this.syncSelection(
      {
        mode: "pack",
        targetId: packId,
        manualSkillSlugs: state.manualSkillSlugs ?? [],
        selectedPackIds: mergedPacks
      },
      state
    );
  }

  async switchToSkill(slug: string, state: AppState) {
    const catalog = loadLocalCatalog();
    const skill = catalog.skills.find((entry) => entry.slug === slug && entry.curated && entry.sourceType === "local");
    if (!skill) {
      throw new Error(`Local curated skill not found: ${slug}`);
    }

    return this.syncSelection(
      {
        mode: "switch-skill",
        targetId: slug,
        manualSkillSlugs: [slug],
        selectedPackIds: []
      },
      state
    );
  }

  async switchToPack(packId: string, state: AppState) {
    const catalog = loadLocalCatalog();
    const localSkills = new Set(catalog.skills.filter((skill) => skill.curated && skill.sourceType === "local").map((skill) => skill.slug));
    const pack = catalog.packs.find((entry) => entry.id === packId && entry.skills.every((slug) => localSkills.has(slug)));
    if (!pack) {
      throw new Error(`Local curated pack not found: ${packId}`);
    }

    return this.syncSelection(
      {
        mode: "switch-pack",
        targetId: packId,
        manualSkillSlugs: [],
        selectedPackIds: [packId]
      },
      state
    );
  }

  async deactivateSkill(slug: string, state: AppState) {
    const nextManualSkills = (state.manualSkillSlugs ?? []).filter((entry) => entry !== slug);
    return this.syncSelection(
      {
        mode: "skill",
        targetId: slug,
        manualSkillSlugs: nextManualSkills,
        selectedPackIds: state.activePackIds
      },
      state
    );
  }

  async deactivatePack(packId: string, state: AppState) {
    const nextPackIds = state.activePackIds.filter((entry) => entry !== packId);
    return this.syncSelection(
      {
        mode: "pack",
        targetId: packId,
        manualSkillSlugs: state.manualSkillSlugs ?? [],
        selectedPackIds: nextPackIds
      },
      state
    );
  }

  async deactivateAll(state: AppState) {
    return this.syncSelection(
      {
        mode: "deactivate-all",
        targetId: "all",
        manualSkillSlugs: [],
        selectedPackIds: []
      },
      state
    );
  }

  private async syncSelection(
    input: {
      mode: ManagedLibraryActivation["mode"];
      targetId: string;
      manualSkillSlugs: string[];
      selectedPackIds: string[];
    },
    state: AppState
  ): Promise<{ result: ManagedLibraryActivation; state: AppState }> {
    const selectedSkills = this.getSelectedLocalSkills(
      this.expandSelectedSkills(input.manualSkillSlugs, input.selectedPackIds)
    );
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
      manualSkillSlugs: input.manualSkillSlugs,
      activeSkillSlugs: selectedSkills.map((skill) => skill.slug),
      activePackIds: input.selectedPackIds,
      managedHistory: [
        {
          at: new Date().toISOString(),
          mode: input.mode,
          targetId: input.targetId,
          activeSkillSlugs: selectedSkills.map((skill) => skill.slug)
        },
        ...(state.managedHistory ?? [])
      ].slice(0, 12)
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

  private expandSelectedSkills(manualSkillSlugs: string[], selectedPackIds: string[]) {
    const catalog = loadLocalCatalog();
    const localSkills = new Set(catalog.skills.filter((skill) => skill.curated && skill.sourceType === "local").map((skill) => skill.slug));
    const activePackSkills = catalog.packs
      .filter((pack) => selectedPackIds.includes(pack.id))
      .flatMap((pack) => pack.skills)
      .filter((slug) => localSkills.has(slug));

    return [...new Set([...manualSkillSlugs, ...activePackSkills])];
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
        : mode === "switch-pack"
          ? `Switched active mode to pack: ${targetId}`
          : mode === "switch-skill"
            ? `Switched active mode to skill: ${targetId}`
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

  private describeCurrentMode(state: AppState, localPacks: Array<{ id: string; name: string; skills: string[] }>) {
    if (state.activePackIds.length === 1 && (state.manualSkillSlugs ?? []).length === 0) {
      const pack = localPacks.find((entry) => entry.id === state.activePackIds[0]);
      return pack ? `Current mode: ${pack.name}` : `Current mode: ${state.activePackIds[0]}`;
    }

    if (state.activePackIds.length === 0 && (state.manualSkillSlugs ?? []).length === 1) {
      return `Current mode: ${state.manualSkillSlugs[0]}`;
    }

    if (state.activeSkillSlugs.length === 0) {
      return "Current mode: none";
    }

    return "Current mode: custom mix";
  }

  private describeCurrentModeSummary(state: AppState, localPacks: Array<{ id: string; name: string; skills: string[] }>) {
    if (state.activePackIds.length === 1 && (state.manualSkillSlugs ?? []).length === 0) {
      const pack = localPacks.find((entry) => entry.id === state.activePackIds[0]);
      if (pack) {
        return `OpenClaw currently reads the ${pack.name} pack with ${pack.skills.length} curated skills.`;
      }
    }

    if (state.activePackIds.length === 0 && (state.manualSkillSlugs ?? []).length === 1) {
      return `OpenClaw currently reads one directly enabled skill: ${state.manualSkillSlugs[0]}.`;
    }

    if (state.activeSkillSlugs.length === 0) {
      return "No managed skills are currently active for OpenClaw.";
    }

    return `OpenClaw currently reads a custom active set of ${state.activeSkillSlugs.length} curated skills.`;
  }

  private describeHistoryEntry(
    entry: { mode: ManagedLibraryActivation["mode"]; targetId: string },
    localPacks: Array<{ id: string; name: string; skills: string[] }>
  ) {
    if (entry.mode === "deactivate-all") {
      return "Cleared all managed skills";
    }

    if (entry.mode === "switch-pack" || entry.mode === "pack") {
      const pack = localPacks.find((candidate) => candidate.id === entry.targetId);
      return `${entry.mode === "switch-pack" ? "Switched to" : "Added"} pack ${pack?.name ?? entry.targetId}`;
    }

    return `${entry.mode === "switch-skill" ? "Switched to" : "Added"} skill ${entry.targetId}`;
  }
}
