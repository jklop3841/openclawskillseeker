import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

test("demo docs align with calendar and demo-safe golden path", async () => {
  const readme = await fs.readFile(path.join(root, "README.md"), "utf8");
  const demoGuide = await fs.readFile(path.join(root, "docs", "DEMO.md"), "utf8");

  for (const content of [readme, demoGuide]) {
    assert.equal(content.includes("validate-skill calendar"), true);
    assert.equal(content.includes("install-skill calendar"), true);
    assert.equal(content.includes("verify-pack-layout"), true);
    assert.equal(content.includes("demo-safe"), true);
    assert.equal(content.includes("--clawhub-bin"), true);
  }
});
