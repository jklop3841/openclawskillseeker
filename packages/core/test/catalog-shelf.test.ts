import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

test("featured shelf UI references curated packs and skills", async () => {
  const appSource = await fs.readFile(path.join(root, "apps", "web", "src", "client", "App.tsx"), "utf8");

  for (const value of ["demo-safe", "knowledge-work", "delivery-engine", "business-ops"]) {
    assert.equal(appSource.includes(value), true);
  }

  for (const value of ["calendar", "research-first-decider", "product-brief-writer", "doc-systematizer"]) {
    assert.equal(appSource.includes(value), true);
  }

  assert.equal(appSource.includes("local curated"), true);
  assert.equal(appSource.includes("Install and attach Calendar"), true);
  assert.equal(appSource.includes("Use as current mode"), true);
  assert.equal(appSource.includes("Add to current mode"), true);
  assert.equal(appSource.includes("Remove pack"), true);
  assert.equal(appSource.includes("Use this skill only"), true);
  assert.equal(appSource.includes("enabled by pack"), true);
  assert.equal(appSource.includes("Search library"), true);
  assert.equal(appSource.includes("Show active only"), true);
  assert.equal(appSource.includes("Start from the task you need right now"), true);
  assert.equal(appSource.includes("Do this next"), true);
  assert.equal(appSource.includes("One focused mode, one restart, one prompt."), true);
  assert.equal(appSource.includes("Start recommended task"), true);
  assert.equal(appSource.includes("Copy next ask"), true);
  assert.equal(appSource.includes("Your next three steps"), true);
  assert.equal(appSource.includes("Paper Factory spotlight"), true);
  assert.equal(appSource.includes("Start Paper Factory mode"), true);
  assert.equal(appSource.includes("Copy paper ask"), true);
  assert.equal(appSource.includes("Now active for this kind of work"), true);
  assert.equal(appSource.includes("ready to test"), true);
  assert.equal(appSource.includes("choose one mode"), true);
  assert.equal(appSource.includes("Research and write a plan"), true);
  assert.equal(appSource.includes("Ship a change"), true);
  assert.equal(appSource.includes("Handle support or operations"), true);
  assert.equal(appSource.includes("Start this task mode"), true);
  assert.equal(appSource.includes("Copy sample ask"), true);
  assert.equal(appSource.includes("Mode library"), true);
  assert.equal(appSource.includes("The current mode is already live. Open this library when you want to switch context or use a narrower override."), true);
  assert.equal(appSource.includes("Mode library at a glance"), true);
  assert.equal(appSource.includes("When to use single-skill tools"), true);
  assert.equal(appSource.includes("Single-skill tools"), true);
  assert.equal(appSource.includes("How the mode library works"), true);
  assert.equal(appSource.includes("Only the currently active mode is exposed to OpenClaw"), true);
  assert.equal(appSource.includes("Test the current active set in OpenClaw"), true);
  assert.equal(appSource.includes("Restart OpenClaw so it reloads the current active set"), true);
  assert.equal(appSource.includes("Why the managed active set stays small"), true);
  assert.equal(appSource.includes("Switch back to previous mode"), true);
  assert.equal(appSource.includes("Research and planning"), true);
  assert.equal(appSource.includes("Build and ship"), true);
  assert.equal(appSource.includes("Support and operations"), true);
  assert.equal(appSource.includes("Paper Factory"), true);
  assert.equal(appSource.includes("Current scenario"), true);
  assert.equal(appSource.includes("Active now"), true);
  assert.equal(appSource.includes("Copy active path"), true);
  assert.equal(appSource.includes("Current mode test ask copied"), true);
  assert.equal(appSource.includes("Latest action details"), true);
  assert.equal(appSource.includes("This keeps the last activation, result, and troubleshooting details in one place."), true);
});
