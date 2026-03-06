import path from "node:path";
import {
  SnapshotManifestSchema,
  type AppState,
  type SnapshotManifest
} from "@openclaw-skill-center/shared";
import { copyPath, ensureDir, pathExists, writeJsonFile } from "./fs.js";
import type { AppPaths } from "./paths.js";

export class SnapshotService {
  constructor(private readonly paths: AppPaths) {}

  async createSnapshot(input: {
    operation: SnapshotManifest["operation"];
    packId?: string;
    copiedPackRoots: string[];
    configPath: string;
    state: AppState;
    notes?: string[];
  }) {
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const id = `${stamp}-${input.operation}`;
    const snapshotDir = path.join(this.paths.snapshotsDir, id);
    const packBackupDir = path.join(snapshotDir, "packs");
    const configBackupPath = path.join(snapshotDir, "openclaw.json");
    const stateBackupPath = path.join(snapshotDir, "state.json");

    await ensureDir(snapshotDir);

    if (await pathExists(input.configPath)) {
      await copyPath(input.configPath, configBackupPath);
    }

    for (const packRoot of input.copiedPackRoots) {
      if (await pathExists(packRoot)) {
        const target = path.join(packBackupDir, path.basename(packRoot));
        await copyPath(packRoot, target);
      }
    }

    await writeJsonFile(stateBackupPath, input.state);

    const manifest = SnapshotManifestSchema.parse({
      id,
      createdAt: new Date().toISOString(),
      operation: input.operation,
      packId: input.packId,
      configPath: input.configPath,
      copiedPackRoots: input.copiedPackRoots,
      statePath: stateBackupPath,
      snapshotDir,
      notes: input.notes ?? []
    });

    await writeJsonFile(path.join(snapshotDir, "manifest.json"), manifest);
    return manifest;
  }
}
