import fs from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import {
  ConfigPatchResultSchema,
  type AppState,
  type ConfigPatchResult
} from "@openclaw-skill-center/shared";
import { ensureDir, pathExists } from "./fs.js";
import { createLogger } from "./logger.js";
import { getAppPaths, type AppPaths } from "./paths.js";
import { SnapshotService } from "./snapshot-service.js";
import { saveState } from "./state.js";

export class ConfigService {
  private readonly logger = createLogger("config-service");

  constructor(
    private readonly paths: AppPaths = getAppPaths(),
    private readonly snapshotService = new SnapshotService(paths)
  ) {}

  async patchExtraDir(
    extraDir: string,
    state: AppState,
    options: { dryRun?: boolean; configPath?: string } = {}
  ): Promise<{ result: ConfigPatchResult; state: AppState; before: string; after: string }> {
    const dryRun = options.dryRun ?? false;
    const configPath = options.configPath ?? this.paths.openClawConfigPath;
    this.logger.info({ extraDir, dryRun, configPath }, "Patching OpenClaw config");
    const raw = (await pathExists(configPath)) ? await fs.readFile(configPath, "utf8") : "{}";
    const parsed = JSON5.parse(raw) as Record<string, unknown>;
    const next = this.withExtraDir(parsed, extraDir);
    const nextText = `${JSON.stringify(next, null, 2)}\n`;
    const changed = JSON.stringify(parsed) !== JSON.stringify(next);
    const diffSummary = this.buildDiffSummary(parsed, next, extraDir);

    if (dryRun) {
      const result = ConfigPatchResultSchema.parse({
        configPath,
        extraDir,
        dryRun: true,
        changed,
        diffSummary
      });

      this.logger.info({ configPath }, "Config patch dry run completed");
      return { result, state, before: raw, after: nextText };
    }

    const snapshot = await this.snapshotService.createSnapshot({
      operation: "config-patch",
      configPath,
      copiedPackRoots: [],
      state,
      notes: [`Patch skills.load.extraDirs with ${extraDir}`]
    });

    await ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, nextText, "utf8");

    const nextState: AppState = {
      ...state,
      snapshots: [...state.snapshots, snapshot]
    };

    await saveState(this.paths, nextState);

    const result = ConfigPatchResultSchema.parse({
      configPath,
      extraDir,
      dryRun: false,
      changed,
      backupSnapshotId: snapshot.id,
      diffSummary
    });

    this.logger.info({ configPath, snapshotId: snapshot.id }, "Config patch completed");
    return { result, state: nextState, before: raw, after: nextText };
  }

  private withExtraDir(current: Record<string, unknown>, extraDir: string) {
    const skills = ((current.skills as Record<string, unknown> | undefined) ?? {});
    const load = ((skills.load as Record<string, unknown> | undefined) ?? {});
    const existing = Array.isArray(load.extraDirs) ? [...(load.extraDirs as string[])] : [];

    if (!existing.includes(extraDir)) {
      existing.push(extraDir);
    }

    return {
      ...current,
      skills: {
        ...skills,
        load: {
          ...load,
          extraDirs: existing
        }
      }
    };
  }

  private buildDiffSummary(before: Record<string, unknown>, after: Record<string, unknown>, extraDir: string) {
    const beforeDirs = this.readExtraDirs(before);
    const afterDirs = this.readExtraDirs(after);
    const summary: string[] = [];

    if (!beforeDirs.includes(extraDir) && afterDirs.includes(extraDir)) {
      summary.push(`Add ${extraDir} to skills.load.extraDirs`);
    }

    if (beforeDirs.length === 0 && afterDirs.length > 0) {
      summary.push("Create skills.load.extraDirs");
    }

    if (summary.length === 0) {
      summary.push("No config changes required");
    }

    return summary;
  }

  private readExtraDirs(current: Record<string, unknown>) {
    const skills = (current.skills as Record<string, unknown> | undefined) ?? {};
    const load = (skills.load as Record<string, unknown> | undefined) ?? {};
    return Array.isArray(load.extraDirs) ? [...(load.extraDirs as string[])] : [];
  }
}
