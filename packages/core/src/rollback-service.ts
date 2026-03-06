import fs from "node:fs/promises";
import path from "node:path";
import { RollbackVerifySchema, type AppState } from "@openclaw-skill-center/shared";
import { copyPath, ensureDir, pathExists, removePath, writeJsonFile } from "./fs.js";
import { createLogger } from "./logger.js";
import { ReportService } from "./report-service.js";
import type { AppPaths } from "./paths.js";

export class RollbackService {
  private readonly logger = createLogger("rollback-service");

  constructor(
    private readonly paths: AppPaths,
    private readonly reports: ReportService
  ) {}

  async rollback(snapshotId: string, currentState: AppState) {
    this.logger.info({ snapshotId }, "Rolling back snapshot");
    const snapshot = currentState.snapshots.find((entry) => entry.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Unknown snapshot: ${snapshotId}`);
    }

    const manifestPath = path.join(snapshot.snapshotDir, "manifest.json");
    if (!(await pathExists(manifestPath))) {
      throw new Error(`Snapshot manifest missing: ${manifestPath}`);
    }

    const packsBackupDir = path.join(snapshot.snapshotDir, "packs");
    const restoredPackRoots: Array<{ path: string; restored: boolean }> = [];
    for (const packRoot of snapshot.copiedPackRoots) {
      await removePath(packRoot);
      const backupPath = path.join(packsBackupDir, path.basename(packRoot));
      if (await pathExists(backupPath)) {
        await copyPath(backupPath, packRoot);
        restoredPackRoots.push({ path: packRoot, restored: true });
      } else {
        restoredPackRoots.push({ path: packRoot, restored: false });
      }
    }

    const configBackupPath = path.join(snapshot.snapshotDir, "openclaw.json");
    let configRestored = false;
    if (await pathExists(configBackupPath)) {
      await ensureDir(path.dirname(snapshot.configPath));
      await copyPath(configBackupPath, snapshot.configPath);
      configRestored = true;
    }

    const backupState = JSON.parse(await fs.readFile(snapshot.statePath, "utf8")) as AppState;
    await writeJsonFile(this.paths.statePath, backupState);
    const verify = RollbackVerifySchema.parse({
      stateRestored: true,
      configRestored,
      restoredPackRoots
    });

    const reportPath = await this.reports.writeReport(
      "rollback",
      `OpenClaw Skill Center rollback report: ${snapshotId}`,
      [
        `Restored snapshot: ${snapshotId}`,
        `Original operation: ${snapshot.operation}`,
        `Pack roots restored: ${snapshot.copiedPackRoots.join(", ") || "none"}`,
        `Config restored: ${snapshot.configPath}`,
        "",
        "Verify:",
        `- state restored: ${verify.stateRestored}`,
        `- config restored: ${verify.configRestored}`,
        ...verify.restoredPackRoots.map((entry) => `- ${entry.path}: ${entry.restored}`)
      ].join("\n")
    );

    this.logger.info({ snapshotId, reportPath, verify }, "Rollback completed");
    return { snapshot, reportPath, state: backupState, verify };
  }
}
