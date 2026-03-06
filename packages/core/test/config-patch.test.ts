import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import { ConfigService, SnapshotService, getAppPaths } from "../src/index.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-config-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("ConfigService", () => {
  test("dry-run reports config diff without writing", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const configPath = path.join(root, "openclaw.test.json");
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, "{ skills: { load: { extraDirs: [\"a\"] } } }\n", "utf8");

    const service = new ConfigService(paths, new SnapshotService(paths));
    const patched = await service.patchExtraDir("b", { installedPacks: [], snapshots: [] }, { dryRun: true, configPath });
    const content = await fs.readFile(configPath, "utf8");

    assert.equal(patched.result.dryRun, true);
    assert.equal(patched.result.configPath, configPath);
    assert.equal(patched.state.snapshots.length, 0);
    assert.match(patched.result.diffSummary.join("\n"), /Add b to skills\.load\.extraDirs/);
    assert.equal(content, "{ skills: { load: { extraDirs: [\"a\"] } } }\n");
  });

  test("appends extraDirs safely", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    await fs.mkdir(path.dirname(paths.openClawConfigPath), { recursive: true });
    await fs.writeFile(paths.openClawConfigPath, "{ skills: { load: { extraDirs: [\"a\"] } } }\n", "utf8");

    const service = new ConfigService(paths, new SnapshotService(paths));
    const patched = await service.patchExtraDir("b", { installedPacks: [], snapshots: [] }, { dryRun: false });
    const content = await fs.readFile(paths.openClawConfigPath, "utf8");

    assert.equal(patched.result.changed, true);
    assert.equal(patched.state.snapshots.length, 1);
    assert.match(content, /"a"/);
    assert.match(content, /"b"/);
  });
});
