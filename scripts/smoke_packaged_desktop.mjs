import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const exePath = path.resolve("apps", "desktop", "release", "win-unpacked", "OpenClaw-Exoskeleton.exe");
const healthUrl = "http://127.0.0.1:47221/api/health";
const timeoutMs = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHealth() {
  const response = await fetch(healthUrl);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`Health endpoint returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Unexpected health content type: ${contentType || "unknown"}`);
  }

  return JSON.parse(bodyText);
}

async function killTree(pid) {
  if (!pid) {
    return;
  }

  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    killer.on("close", () => resolve(undefined));
    killer.on("error", () => resolve(undefined));
  });
}

async function killExistingDesktopProcesses() {
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/IM", "OpenClaw-Exoskeleton.exe", "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    killer.on("close", () => resolve(undefined));
    killer.on("error", () => resolve(undefined));
  });
}

async function killPortOwner(port) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn("netstat", ["-ano"], { windowsHide: true });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", () => resolve(stdout));
  });

  const pids = new Set(
    String(result)
      .split(/\r?\n/)
      .filter((line) => line.includes(`:${port}`) && line.includes("LISTENING"))
      .map((line) => Number(line.trim().split(/\s+/).at(-1)))
      .filter((pid) => Number.isFinite(pid) && pid > 0)
  );

  for (const pid of pids) {
    await killTree(pid);
  }
}

async function main() {
  if (!fs.existsSync(exePath)) {
    throw new Error(`Packaged desktop executable not found: ${exePath}`);
  }

  await killExistingDesktopProcesses();
  await killPortOwner(47221);
  await sleep(1000);

  const child = spawn(exePath, [], {
    stdio: "ignore",
    windowsHide: true,
    detached: false
  });

  const startedAt = Date.now();
  let lastError = null;

  try {
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const body = await fetchHealth();
        if (body?.ok !== true || body?.service !== "openclaw-skill-center-web") {
          throw new Error("Health response did not match packaged desktop service.");
        }
        console.log(JSON.stringify({
          ok: true,
          exePath,
          healthUrl,
          body
        }, null, 2));
        return;
      } catch (error) {
        lastError = error;
        await sleep(500);
      }
    }

    throw new Error(
      `Timed out waiting for packaged desktop health endpoint. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  } finally {
    await killTree(child.pid);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
