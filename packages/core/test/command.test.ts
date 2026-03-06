import test from "node:test";
import assert from "node:assert/strict";
import { buildSpawnInvocation } from "../src/index.js";

test("Windows .cmd path uses cmd.exe wrapper", () => {
  const invocation = buildSpawnInvocation(
    "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\clawhub.cmd",
    ["search", "calendar"],
    "win32"
  );

  assert.equal(invocation.command, "cmd.exe");
  assert.deepEqual(invocation.args, [
    "/d",
    "/s",
    "/c",
    "C:\\Users\\Administrator\\AppData\\Roaming\\npm\\clawhub.cmd",
    "search",
    "calendar"
  ]);
});

test("Windows normal binary path is unchanged", () => {
  const invocation = buildSpawnInvocation(
    "C:\\tools\\clawhub.exe",
    ["search", "calendar"],
    "win32"
  );

  assert.equal(invocation.command, "C:\\tools\\clawhub.exe");
  assert.deepEqual(invocation.args, ["search", "calendar"]);
});

test("Non-Windows normal binary path is unchanged", () => {
  const invocation = buildSpawnInvocation(
    "/usr/local/bin/clawhub",
    ["search", "calendar"],
    "linux"
  );

  assert.equal(invocation.command, "/usr/local/bin/clawhub");
  assert.deepEqual(invocation.args, ["search", "calendar"]);
});
