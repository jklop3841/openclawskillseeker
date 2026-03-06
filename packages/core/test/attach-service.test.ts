import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { AttachService } from "../src/attach-service.js";
import { getAppPaths } from "../src/paths.js";

test("AttachService runs one-click calendar flow", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-attach-"));
  const paths = getAppPaths(root);

  let patchedExtraDir = "";

  const doctor = {
    run: async () => ({
      clawhubFound: true,
      openClawConfigPath: paths.openClawConfigPath,
      clawhubResolutionMode: "explicit-path",
      isWsl: false,
      platform: "win32"
    })
  } as any;

  const packs = {
    installSkill: async () => ({
      state: { installedPacks: [], snapshots: [] },
      installReport: {
        installed: [{ slug: "calendar", decision: "install", reason: "Installed successfully." }],
        skipped: [],
        failedPermanent: [],
        failedRetriable: [],
        reasons: []
      }
    }),
    verifyPackLayout: async (targetDir: string) => ({
      targetDir,
      skillsDir: path.join(targetDir, "skills"),
      rootExists: true,
      skillsDirExists: true,
      skillEntries: ["calendar"],
      lockFilePath: path.join(targetDir, ".clawhub", "lock.json"),
      lockFileExists: true,
      skillDetails: [
        {
          slug: "calendar",
          skillRoot: path.join(targetDir, "skills", "calendar"),
          skillMdExists: true,
          originJsonExists: true
        }
      ],
      ok: true,
      findings: []
    })
  } as any;

  const config = {
    patchExtraDir: async (extraDir: string, state: unknown) => {
      patchedExtraDir = extraDir;
      return {
        state,
        result: {
          configPath: paths.openClawConfigPath,
          extraDir,
          dryRun: false,
          changed: true,
          diffSummary: [`Add ${extraDir} to skills.load.extraDirs`]
        }
      };
    }
  } as any;

  const service = new AttachService(paths, doctor, packs, config);
  const outcome = await service.attachCalendar({ installedPacks: [], snapshots: [] });

  assert.equal(outcome.result.success, true);
  assert.equal(outcome.result.packId, "skill:calendar");
  assert.equal(outcome.result.environmentMode, "windows");
  assert.equal(patchedExtraDir, path.join(paths.packsRoot, "calendar", "skills"));
  assert.deepEqual(
    outcome.result.stages.map((stage) => stage.status),
    ["success", "success", "success", "success"]
  );
  assert.equal(outcome.result.userSummary.some((line) => line.includes("Installed: calendar")), true);
  assert.equal(outcome.result.nextStep.includes("Restart OpenClaw"), true);

  await fs.rm(root, { recursive: true, force: true });
});

test("AttachService maps suspicious skip to user-facing failure", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-attach-"));
  const paths = getAppPaths(root);
  const doctor = {
    run: async () => ({
      clawhubFound: true,
      openClawConfigPath: paths.openClawConfigPath,
      clawhubResolutionMode: "explicit-path",
      isWsl: false,
      platform: "win32"
    })
  } as any;
  const packs = {
    installSkill: async () => ({
      state: { installedPacks: [], snapshots: [] },
      installReport: {
        installed: [],
        skipped: [{ slug: "calendar", decision: "skip-suspicious", reason: "flagged suspicious" }],
        failedPermanent: [],
        failedRetriable: [],
        reasons: []
      }
    }),
    verifyPackLayout: async (targetDir: string) => ({
      targetDir,
      skillsDir: path.join(targetDir, "skills"),
      rootExists: false,
      skillsDirExists: false,
      skillEntries: [],
      ok: false,
      findings: ["skills directory does not exist."]
    })
  } as any;
  const config = {
    patchExtraDir: async () => {
      throw new Error("should not patch");
    }
  } as any;

  const service = new AttachService(paths, doctor, packs, config);
  const outcome = await service.attachCalendar({ installedPacks: [], snapshots: [] });

  assert.equal(outcome.result.success, false);
  assert.equal(outcome.result.failureCategory, "suspicious-skipped");
  assert.equal(outcome.result.stages[1]?.status, "failed");
  assert.equal(outcome.result.nextStep.includes("reviewed skill"), true);

  await fs.rm(root, { recursive: true, force: true });
});

test("AttachService selects WSL-style extraDir when running in WSL mode", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-attach-"));
  const paths = {
    ...getAppPaths(root),
    packsRoot: "D:\\packs"
  };
  let patchedExtraDir = "";
  const doctor = {
    run: async () => ({
      clawhubFound: true,
      openClawConfigPath: "/home/test/.openclaw/openclaw.json",
      clawhubResolutionMode: "wsl",
      isWsl: true,
      platform: "linux"
    })
  } as any;
  const packs = {
    installSkill: async () => ({
      state: { installedPacks: [], snapshots: [] },
      installReport: {
        installed: [{ slug: "calendar", decision: "install", reason: "Installed successfully." }],
        skipped: [],
        failedPermanent: [],
        failedRetriable: [],
        reasons: []
      }
    }),
    verifyPackLayout: async (targetDir: string) => ({
      targetDir,
      skillsDir: path.join(targetDir, "skills"),
      rootExists: true,
      skillsDirExists: true,
      skillEntries: ["calendar"],
      ok: true,
      findings: []
    })
  } as any;
  const config = {
    patchExtraDir: async (extraDir: string, state: unknown) => {
      patchedExtraDir = extraDir;
      return {
        state,
        result: {
          configPath: "/home/test/.openclaw/openclaw.json",
          extraDir,
          dryRun: false,
          changed: true,
          diffSummary: []
        }
      };
    }
  } as any;

  const service = new AttachService(paths as any, doctor, packs, config);
  const outcome = await service.attachCalendar({ installedPacks: [], snapshots: [] });

  assert.equal(outcome.result.environmentMode, "wsl");
  assert.equal(patchedExtraDir, "/mnt/d/packs/calendar/skills");

  await fs.rm(root, { recursive: true, force: true });
});
