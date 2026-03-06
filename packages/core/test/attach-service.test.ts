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
      clawhubResolutionMode: "explicit-path"
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
  assert.equal(patchedExtraDir, path.join(paths.packsRoot, "calendar", "skills"));
  assert.equal(outcome.result.userSummary.some((line) => line.includes("Installed: calendar")), true);
  assert.equal(outcome.result.nextStep.includes("Restart OpenClaw"), true);

  await fs.rm(root, { recursive: true, force: true });
});
