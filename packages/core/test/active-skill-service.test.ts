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
    manualSkillSlugs: [],
    activeSkillSlugs: [],
    activePackIds: []
  });

  assert.equal(result.result.success, true);
  assert.deepEqual(result.state.manualSkillSlugs, ["research-first-decider"]);
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

test("active skill service can activate and deactivate a managed pack while preserving direct skill enables", async () => {
  const baseHome = await fs.mkdtemp(path.join(os.tmpdir(), "active-pack-service-"));
  const paths = getAppPaths(baseHome);

  await fs.mkdir(path.dirname(paths.openClawConfigPath), { recursive: true });
  await fs.writeFile(paths.openClawConfigPath, "{\n  \"skills\": { \"load\": { \"extraDirs\": [] } }\n}\n", "utf8");

  const snapshots = new SnapshotService(paths);
  const config = new ConfigService(paths, snapshots);
  const reports = new ReportService(paths);
  const packs = new PackService(paths, {} as never, snapshots, reports, config);
  const service = new ActiveSkillService(paths, config, packs);

  const activatedPack = await service.activatePack("knowledge-work", {
    installedPacks: [],
    snapshots: [],
    manualSkillSlugs: [],
    activeSkillSlugs: [],
    activePackIds: []
  });

  assert.equal(activatedPack.result.success, true);
  assert.deepEqual(activatedPack.state.activePackIds, ["knowledge-work"]);
  assert.equal(activatedPack.state.activeSkillSlugs.includes("research-first-decider"), true);

  const addedManual = await service.activateSkill("bug-triage-investigator", activatedPack.state);
  assert.equal(addedManual.state.manualSkillSlugs.includes("bug-triage-investigator"), true);
  assert.equal(addedManual.state.activeSkillSlugs.includes("bug-triage-investigator"), true);

  const deactivatedPack = await service.deactivatePack("knowledge-work", addedManual.state);
  assert.deepEqual(deactivatedPack.state.activePackIds, []);
  assert.deepEqual(deactivatedPack.state.manualSkillSlugs, ["bug-triage-investigator"]);
  assert.deepEqual(deactivatedPack.state.activeSkillSlugs, ["bug-triage-investigator"]);

  const library = service.listManagedLibrary(deactivatedPack.state);
  const bugSkill = library.skills.find((entry) => entry.slug === "bug-triage-investigator");
  const knowledgePack = library.packs.find((entry) => entry.id === "knowledge-work");
  assert.equal(bugSkill?.activationSource, "manual");
  assert.equal(knowledgePack?.active, false);
});

async function fileExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
