import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { afterEach, describe } from "node:test";
import assert from "node:assert/strict";
import { DoctorService, getAppPaths } from "../src/index.js";

const tempRoots: string[] = [];

async function makeTempRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-doctor-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("DoctorService", () => {
  test("detects config and workspace paths", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    await fs.mkdir(paths.openClawWorkspacePath, { recursive: true });
    await fs.mkdir(path.dirname(paths.openClawConfigPath), { recursive: true });
    await fs.writeFile(paths.openClawConfigPath, "{}\n", "utf8");

    const report = await new DoctorService(paths).run();
    assert.equal(report.openClawConfigPath, paths.openClawConfigPath);
    assert.equal(report.snapshotRoot, paths.snapshotsDir);
    assert.equal(report.defaultPackRoot, paths.packsRoot);
    assert.equal(report.checks.find((check) => check.name === "openclaw-config")?.ok, true);
    assert.equal(report.checks.find((check) => check.name === "openclaw-workspace")?.ok, true);
  });

  test("reports explicit-path mode", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const report = await new DoctorService(paths, {
      clawhubBin: "C:\\tools\\clawhub.exe",
      runner: async () => ({ code: 1, stdout: "", stderr: "" })
    }).run();

    assert.equal(report.clawhubResolutionMode, "explicit-path");
    assert.equal(report.resolvedClawhubCommand, "C:\\tools\\clawhub.exe");
  });

  test("reports env mode", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const report = await new DoctorService(paths, {
      env: { CLAWHUB_BIN: "D:\\bin\\clawhub.cmd" },
      runner: async () => ({ code: 1, stdout: "", stderr: "" })
    }).run();

    assert.equal(report.clawhubResolutionMode, "env");
    assert.equal(report.resolvedClawhubCommand, "D:\\bin\\clawhub.cmd");
  });

  test("reports wsl mode when enabled and available", async () => {
    const root = await makeTempRoot();
    const paths = getAppPaths(root);
    const report = await new DoctorService(paths, {
      useWsl: true,
      runner: async (_command, args) => {
        if (args[2] === "printf __OCSC_WSL_OK__") {
          return { code: 0, stdout: "__OCSC_WSL_OK__", stderr: "" };
        }

        if (args[2] === "command -v clawhub") {
          return { code: 0, stdout: "/usr/local/bin/clawhub", stderr: "" };
        }

        return { code: 1, stdout: "", stderr: "" };
      }
    }).run();

    if (process.platform === "win32") {
      assert.equal(report.clawhubResolutionMode, "wsl");
      assert.equal(report.wslAvailable, true);
    } else {
      assert.equal(report.clawhubResolutionMode, "not-found");
    }
  });
});
