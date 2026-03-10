import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");

test("guided install UI keeps onboarding states and success CTA copy", async () => {
  const appSource = await fs.readFile(path.join(root, "apps", "web", "src", "client", "App.tsx"), "utf8");

  for (const value of ["先选你当前的情况", "ready", "needs attention", "blocked"]) {
    assert.equal(appSource.includes(value), true);
  }

  assert.equal(appSource.includes("Install and attach Calendar"), true);
  assert.equal(appSource.includes("请检查你当前是否已加载 calendar skill"), true);
  assert.equal(appSource.includes("先安装或启动 OpenClaw / ClawX"), true);
  assert.equal(appSource.includes("自动修复建议"), true);
  assert.equal(appSource.includes("Retry environment check"), true);
  assert.equal(appSource.includes("我已经装了 OpenClaw / ClawX"), true);
  assert.equal(appSource.includes("我已经有 OpenClaw，但缺少技能安装器"), true);
  assert.equal(appSource.includes("我还没有 OpenClaw / ClawX"), true);
});
