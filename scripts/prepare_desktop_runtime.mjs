import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const releaseDir = path.resolve("apps", "desktop", "release");
const unpackedDir = path.join(releaseDir, "win-unpacked");
const desktopExeName = "OpenClaw-Exoskeleton.exe";
const targetPort = 47221;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

async function killImage(imageName) {
  await run("taskkill", ["/IM", imageName, "/T", "/F"]).catch(() => undefined);
}

async function killPid(pid) {
  await run("taskkill", ["/PID", String(pid), "/T", "/F"]).catch(() => undefined);
}

async function killPortOwner(port) {
  const result = await run("netstat", ["-ano"]);
  const lines = `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter((line) => line.includes(`:${port}`) && line.includes("LISTENING"));

  const pids = new Set();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = Number(parts.at(-1));
    if (Number.isFinite(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  for (const pid of pids) {
    await killPid(pid);
  }
}

async function removeWithRetries(targetPath, attempts = 10) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function main() {
  await killImage(desktopExeName);
  await killPortOwner(targetPort);

  if (fs.existsSync(unpackedDir)) {
    await removeWithRetries(unpackedDir);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
