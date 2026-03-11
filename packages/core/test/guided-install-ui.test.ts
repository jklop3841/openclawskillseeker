import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

test("guided install UI keeps onboarding states and success CTA copy", async () => {
  const appSource = await fs.readFile(path.join(root, "apps", "web", "src", "client", "App.tsx"), "utf8");

  for (const value of ["Choose your current starting point", "ready", "needs attention", "blocked"]) {
    assert.equal(appSource.includes(value), true);
  }

  assert.equal(appSource.includes("Install and attach Calendar"), true);
  assert.equal(appSource.includes("Please check whether the calendar skill is loaded."), true);
  assert.equal(appSource.includes("Install or launch OpenClaw first"), true);
  assert.equal(appSource.includes("Repair guidance"), true);
  assert.equal(appSource.includes("Retry environment check"), true);
  assert.equal(appSource.includes("I already have OpenClaw / ClawX"), true);
  assert.equal(appSource.includes("I have OpenClaw, but I still need clawhub"), true);
  assert.equal(appSource.includes("I still need OpenClaw / ClawX"), true);
  assert.equal(appSource.includes("Keep a large curated library in one place"), true);
  assert.equal(appSource.includes("Use as current mode"), true);
  assert.equal(appSource.includes("Use this skill only"), true);
  assert.equal(appSource.includes("Recent changes"), true);
  assert.equal(appSource.includes("Current mode:"), true);
  assert.equal(appSource.includes("Apply again"), true);
});
