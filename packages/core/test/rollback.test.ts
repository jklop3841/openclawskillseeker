import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ReportService,
  RollbackService,
  SnapshotService,
  getAppPaths
} from "../src/index.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-rollback-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("RollbackService", () => {
  test("restores pack data from snapshot", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const packRoot = path.join(paths.packsRoot, "safe-starter");
    await fs.mkdir(packRoot, { recursive: true });
    await fs.writeFile(path.join(packRoot, "marker.txt"), "before", "utf8");

    const state = { installedPacks: [], snapshots: [] };
    const snapshots = new SnapshotService(paths);
    const snapshot = await snapshots.createSnapshot({
      operation: "install",
      configPath: paths.openClawConfigPath,
      copiedPackRoots: [packRoot],
      state,
      notes: []
    });

    await fs.writeFile(path.join(packRoot, "marker.txt"), "after", "utf8");
    const rollback = new RollbackService(paths, new ReportService(paths));
    const result = await rollback.rollback(snapshot.id, {
      installedPacks: [],
      snapshots: [snapshot]
    });

    const content = await fs.readFile(path.join(packRoot, "marker.txt"), "utf8");
    assert.equal(content, "before");
    assert.deepEqual(result.state.snapshots, []);
  });
});
