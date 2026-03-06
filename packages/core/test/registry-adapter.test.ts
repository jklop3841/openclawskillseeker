import test from "node:test";
import assert from "node:assert/strict";
import { RegistryAdapter, buildSpawnInvocation } from "../src/index.js";

test("RegistryAdapter forms official clawhub search command", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const adapter = new RegistryAdapter("D:\\work", {
    clawhubBin: "clawhub",
    runner: async (command, args, options) => {
      calls.push({ command, args, cwd: options?.cwd });
      return { code: 0, stdout: "ok", stderr: "" };
    }
  });

  await adapter.search("calendar", 5);
  assert.deepEqual(calls[0], {
    command: "clawhub",
    args: ["search", "calendar", "--limit", "5"],
    cwd: "D:\\work"
  });
});

test("RegistryAdapter falls back when inspect is unavailable", async () => {
  const calls: Array<{ command: string; args: string[]; cwd?: string }> = [];
  const adapter = new RegistryAdapter("D:\\work", {
    clawhubBin: "clawhub",
    runner: async (command, args, options) => {
      calls.push({ command, args, cwd: options?.cwd });
      if (args[0] === "inspect") {
        return { code: 1, stdout: "", stderr: "unknown command inspect" };
      }

      return { code: 0, stdout: "search result", stderr: "" };
    }
  });

  const result = await adapter.inspect("calendar");
  assert.equal(result.ok, true);
  assert.deepEqual(calls.map((call) => call.args), [
    ["inspect", "calendar"],
    ["search", "calendar", "--limit", "1"]
  ]);
});

test("RegistryAdapter install command is compatible with Windows .cmd execution path", () => {
  const invocation = buildSpawnInvocation(
    "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\clawhub.cmd",
    ["install", "calendar", "--workdir", "D:\\temp\\pack", "--dir", "skills", "--no-input"],
    "win32"
  );

  assert.equal(invocation.command, "cmd.exe");
  assert.deepEqual(invocation.args, [
    "/d",
    "/s",
    "/c",
    "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\clawhub.cmd",
    "install",
    "calendar",
    "--workdir",
    "D:\\temp\\pack",
    "--dir",
    "skills",
    "--no-input"
  ]);
});

test("RegistryAdapter install can append force explicitly", async () => {
  const calls: string[][] = [];
  const adapter = new RegistryAdapter("D:\\work", {
    clawhubBin: "clawhub",
    runner: async (_command, args) => {
      calls.push(args);
      return { code: 0, stdout: "ok", stderr: "" };
    }
  });

  await adapter.install("calendar", "D:\\work", "skills", undefined, { force: true });
  assert.deepEqual(calls[0], [
    "install",
    "calendar",
    "--workdir",
    "D:\\work",
    "--dir",
    "skills",
    "--no-input",
    "--force"
  ]);
});
