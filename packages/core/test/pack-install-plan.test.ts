import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ConfigService,
  PackService,
  RegistryAdapter,
  ReportService,
  SnapshotService,
  buildInstallPlan,
  getAppPaths
} from "../src/index.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-pack-plan-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("buildInstallPlan", () => {
  test("allows only curated catalog skills", () => {
    const plan = buildInstallPlan({
      pack: {
        id: "pack",
        name: "Pack",
        description: "desc",
        skills: ["safe", "missing"],
        patchOpenClawConfig: true,
        notes: []
      },
      catalogSkills: [
        {
          slug: "safe",
          name: "Safe",
          description: "desc",
          trustLevel: "official",
          curated: true,
          free: true,
          tags: []
        }
      ],
      packsRoot: path.join("root", "packs"),
      patchConfig: true
    });

    assert.deepEqual(plan.allowedSkills, ["safe"]);
    assert.deepEqual(plan.blockedSkills, ["missing"]);
  });

  test("dry-run install does not write targetDir", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "custom-pack-root");
    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        if (args[0] === "inspect") {
          return { code: 0, stdout: `${args[1]}\nSafety: benign`, stderr: "" };
        }

        throw new Error("install should not be called during dry-run");
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.installPack("ops-basics", { installedPacks: [], snapshots: [] }, {
      dryRun: true,
      targetDir
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.plan.installRoot, targetDir);
    assert.ok(Array.isArray(result.installReport.skipped));
    assert.ok(Array.isArray(result.installReport.failedRetriable));
    await assert.rejects(fs.access(targetDir));
  });

  test("suspicious skill is skipped by default", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "suspicious-pack");
    const paths = getAppPaths(root);
    const calls: string[][] = [];
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        calls.push(args);
        if (args[0] === "inspect" && args[1] === "agent-self-assessment") {
          return { code: 0, stdout: "agent-self-assessment\nSafety: suspicious", stderr: "" };
        }

        if (args[0] === "inspect") {
          return { code: 0, stdout: `${args[1]}\nSafety: benign`, stderr: "" };
        }

        return { code: 0, stdout: "installed", stderr: "" };
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.installPack("ops-basics", { installedPacks: [], snapshots: [] }, {
      targetDir
    });

    assert.equal(result.installReport.skipped.some((entry) => entry.slug === "agent-self-assessment"), true);
    assert.equal(result.installReport.installed.some((entry) => entry.slug === "calendar"), true);
    assert.equal(calls.some((args) => args[0] === "install" && args.includes("agent-self-assessment")), false);
  });

  test("suspicious skill is installed only with explicit allow flag", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "allowed-pack");
    const paths = getAppPaths(root);
    const calls: string[][] = [];
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        calls.push(args);
        if (args[0] === "inspect") {
          return { code: 0, stdout: `${args[1]}\nSafety: suspicious`, stderr: "" };
        }

        return { code: 0, stdout: "installed", stderr: "" };
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.installPack("ops-basics", { installedPacks: [], snapshots: [] }, {
      targetDir,
      allowSuspicious: true
    });

    assert.equal(result.installReport.installed.length > 0, true);
    assert.equal(calls.some((args) => args[0] === "install" && args.includes("--force")), true);
  });

  test("rate limit install is retried and reported as retriable", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "retry-pack");
    const paths = getAppPaths(root);
    let installAttempts = 0;
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        if (args[0] === "inspect") {
          return { code: 0, stdout: `${args[1]}\nSafety: benign`, stderr: "" };
        }

        installAttempts += 1;
        return { code: 1, stdout: "", stderr: "Rate limit exceeded" };
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config, [0, 0]);

    const result = await service.installPack("demo-safe", { installedPacks: [], snapshots: [] }, {
      targetDir
    });

    assert.equal(installAttempts, 3);
    assert.equal(result.installReport.failedRetriable.length, 1);
    assert.equal(result.installReport.failedRetriable[0]?.slug, "calendar");
    assert.equal(result.installReport.failedPermanent.length, 0);
  });

  test("single skill install succeeds without retries when upstream succeeds", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "calendar-pack");
    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        if (args[0] === "inspect") {
          return { code: 0, stdout: "calendar\nSummary: Calendar management", stderr: "" };
        }

        await fs.mkdir(path.join(targetDir, "skills", "calendar"), { recursive: true });
        await fs.writeFile(path.join(targetDir, "skills", "calendar", "SKILL.md"), "# Calendar\n", "utf8");
        return { code: 0, stdout: "installed", stderr: "" };
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config, [0, 0]);

    const result = await service.installSkill("calendar", { installedPacks: [], snapshots: [] }, {
      targetDir
    });
    const verify = await service.verifyPackLayout(targetDir);

    assert.equal(result.plan.packId, "skill:calendar");
    assert.equal(result.installReport.installed.length, 1);
    assert.equal(result.installReport.failedRetriable.length, 0);
    assert.equal(verify.ok, true);
    assert.deepEqual(verify.skillEntries, ["calendar"]);
  });

  test("verify pack layout empty dir is strict false", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "empty-pack");
    await fs.mkdir(path.join(targetDir, "skills"), { recursive: true });

    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      runner: async () => ({ code: 0, stdout: "", stderr: "" })
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.verifyPackLayout(targetDir);
    assert.equal(result.ok, false);
    assert.equal(result.findings.includes("no skills installed"), true);
    assert.equal(result.findings.includes("no SKILL.md found"), true);
  });

  test("verify pack layout validates skill structure", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "verified-pack");
    const skillDir = path.join(targetDir, "skills", "audit-trail");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Audit Trail\n", "utf8");

    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      runner: async () => ({ code: 0, stdout: "", stderr: "" })
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.verifyPackLayout(targetDir);
    assert.equal(result.ok, true);
    assert.deepEqual(result.skillEntries, ["audit-trail"]);
  });

  test("verify pack layout verbose shows lock and origin metadata", async () => {
    const root = await makeTempRoot();
    const targetDir = path.join(root, "verbose-pack");
    const skillDir = path.join(targetDir, "skills", "calendar");
    await fs.mkdir(path.join(targetDir, ".clawhub"), { recursive: true });
    await fs.writeFile(path.join(targetDir, ".clawhub", "lock.json"), "{}", "utf8");
    await fs.mkdir(path.join(skillDir, ".clawhub"), { recursive: true });
    await fs.writeFile(path.join(skillDir, "SKILL.md"), "# Calendar\n", "utf8");
    await fs.writeFile(path.join(skillDir, ".clawhub", "origin.json"), "{}", "utf8");

    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      runner: async () => ({ code: 0, stdout: "", stderr: "" })
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.verifyPackLayout(targetDir, { verbose: true });
    assert.equal(result.ok, true);
    assert.equal(result.lockFileExists, true);
    assert.equal(result.skillDetails?.[0]?.slug, "calendar");
    assert.equal(result.skillDetails?.[0]?.skillMdExists, true);
    assert.equal(result.skillDetails?.[0]?.originJsonExists, true);
  });

  test("validate skill detects not found slug", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async () => ({ code: 1, stdout: "", stderr: "Skill not found" })
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.validateSkill("missing-skill");
    assert.equal(result.exists, false);
    assert.equal(result.rawStatus.includes("Skill not found"), true);
  });

  test("validate pack reports live valid slugs only", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const registry = new RegistryAdapter(root, {
      clawhubBin: "clawhub",
      runner: async (_command, args) => {
        if (args[0] === "inspect" && args[1] === "calendar") {
          return { code: 0, stdout: "calendar\nSummary: Calendar management", stderr: "" };
        }

        return { code: 1, stdout: "", stderr: "Skill not found" };
      }
    });
    const snapshots = new SnapshotService(paths);
    const reports = new ReportService(paths);
    const config = new ConfigService(paths, snapshots);
    const service = new PackService(paths, registry, snapshots, reports, config);

    const result = await service.validatePack("demo-safe");
    assert.deepEqual(result.valid.map((entry) => entry.slug), ["calendar"]);
    assert.deepEqual(result.notFound, []);
  });
});
