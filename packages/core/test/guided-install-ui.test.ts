import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

test("guided install UI keeps onboarding states and success CTA copy", async () => {
  const appSource = await fs.readFile(path.join(root, "apps", "web", "src", "client", "App.tsx"), "utf8");

  for (const value of ["环境准备向导", "ready", "needs attention", "blocked"]) {
    assert.equal(appSource.includes(value), true);
  }

  assert.equal(appSource.includes("Install and attach Calendar"), true);
  assert.equal(appSource.includes("请检查你当前是否已加载 calendar skill"), true);
  assert.equal(appSource.includes("先把官方 clawhub 安装好"), true);
  assert.equal(appSource.includes("自动修复建议"), true);
  assert.equal(appSource.includes("Retry environment check"), true);
});
