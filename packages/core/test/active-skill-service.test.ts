import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ActiveSkillService } from "../src/active-skill-service.js";
import { ConfigService } from "../src/config-service.js";
import { getAppPaths } from "../src/paths.js";
import { SnapshotService } from "../src/snapshot-service.js";
import { ReportService } from "../src/report-service.js";
import { PackService } from "../src/pack-service.js";

test("active skill service copies a local curated skill into the managed active-skills root", async () => {
  const baseHome = await fs.mkdtemp(path.join(os.tmpdir(), "active-skill-service-"));
  const paths = getAppPaths(baseHome);

  await fs.mkdir(path.dirname(paths.openClawConfigPath), { recursive: true });
  await fs.writeFile(paths.openClawConfigPath, "{\n  \"skills\": { \"load\": { \"extraDirs\": [] } }\n}\n", "utf8");

  const snapshots = new SnapshotService(paths);
  const config = new ConfigService(paths, snapshots);
  const reports = new ReportService(paths);
  const packs = new PackService(paths, {} as never, snapshots, reports, config);
  const service = new ActiveSkillService(paths, config, packs);

  const result = await service.activateSkill("research-first-decider", {
    installedPacks: [],
    snapshots: [],
    activeSkillSlugs: [],
    activePackIds: []
  });

  assert.equal(result.result.success, true);
  assert.deepEqual(result.state.activeSkillSlugs, ["research-first-decider"]);
  assert.equal(
    await fileExists(path.join(paths.activeSkillsRoot, "skills", "research-first-decider", "SKILL.md")),
    true
  );
  assert.equal(await fileExists(path.join(paths.activeSkillsRoot, ".clawhub", "lock.json")), true);

  const configText = await fs.readFile(paths.openClawConfigPath, "utf8");
  const parsed = JSON.parse(configText) as { skills?: { load?: { extraDirs?: string[] } } };
  assert.equal(Array.isArray(parsed.skills?.load?.extraDirs), true);
  assert.equal(parsed.skills?.load?.extraDirs?.some((value) => value.endsWith(path.join("active-skills", "skills"))), true);
});

async function fileExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
