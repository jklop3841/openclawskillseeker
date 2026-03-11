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
});
