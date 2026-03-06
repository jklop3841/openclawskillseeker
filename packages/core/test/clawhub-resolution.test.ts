import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { resolveClawhub, buildClawhubInvocation } from "../src/index.js";

test("resolveClawhub prefers explicit binary path", async () => {
  const resolution = await resolveClawhub({
    clawhubBin: "C:\\tools\\clawhub.exe",
    env: {},
    runner: async () => ({ code: 1, stdout: "", stderr: "" })
  });

  assert.equal(resolution.mode, "explicit-path");
  assert.equal(resolution.command, "C:\\tools\\clawhub.exe");
});

test("resolveClawhub uses environment binary path", async () => {
  const resolution = await resolveClawhub({
    env: { CLAWHUB_BIN: "D:\\bin\\clawhub.cmd" },
    runner: async () => ({ code: 1, stdout: "", stderr: "" })
  });

  assert.equal(resolution.mode, "env");
  assert.equal(resolution.command, "D:\\bin\\clawhub.cmd");
});

test("resolveClawhub falls back to PATH", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ocsc-clawhub-path-"));
  try {
    const binName = process.platform === "win32" ? "clawhub.cmd" : "clawhub";
    const binaryPath = path.join(tempRoot, binName);
    const content =
      process.platform === "win32" ? "@echo off\r\necho clawhub\r\n" : "#!/bin/sh\necho clawhub\n";
    await fs.writeFile(binaryPath, content, "utf8");
    if (process.platform !== "win32") {
      await fs.chmod(binaryPath, 0o755);
    }

    const resolution = await resolveClawhub({
      env: { ...process.env, PATH: `${tempRoot}${path.delimiter}${process.env.PATH ?? ""}` },
      runner: async () => ({ code: 1, stdout: "", stderr: "" })
    });

    assert.equal(resolution.mode, "path");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("resolveClawhub forms WSL invocation", async () => {
  const resolution = await resolveClawhub({
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
  });

  if (process.platform === "win32") {
    assert.equal(resolution.mode, "wsl");
    const invocation = buildClawhubInvocation(resolution, ["search", "calendar"]);
    assert.equal(invocation.command, "wsl");
    assert.deepEqual(invocation.args.slice(0, 2), ["bash", "-lc"]);
  } else {
    assert.equal(resolution.mode, "not-found");
  }
});
