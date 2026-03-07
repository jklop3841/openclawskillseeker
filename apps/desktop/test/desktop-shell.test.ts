import test from "node:test";
import assert from "node:assert/strict";
import { createWindowOptions, resolveDesktopIcon, resolveWebServerEntry, resolveWebUrl } from "../src/window.js";

test("desktop shell resolves built web server entry", () => {
  const entry = resolveWebServerEntry("D:\\AI\\backlup\\apps\\desktop\\dist");
  assert.equal(
    entry,
    "D:\\AI\\backlup\\apps\\web\\dist\\server\\server.js"
  );
});

test("desktop shell resolves local web url", () => {
  assert.equal(resolveWebUrl(), "http://127.0.0.1:47221");
});

test("desktop shell creates browser window options", () => {
  const options = createWindowOptions(
    "D:\\AI\\backlup\\apps\\desktop\\dist\\preload.js",
    "D:\\AI\\backlup\\apps\\desktop\\assets\\app-icon.png"
  );
  assert.equal(options.title, "OpenClaw机械外骨骼");
  assert.equal(options.webPreferences.contextIsolation, true);
  assert.equal(options.webPreferences.nodeIntegration, false);
});

test("desktop shell resolves icon path", () => {
  const icon = resolveDesktopIcon("D:\\AI\\backlup\\apps\\desktop\\dist");
  assert.equal(icon, "D:\\AI\\backlup\\apps\\desktop\\assets\\app-icon.png");
});
