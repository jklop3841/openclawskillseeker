import os from "node:os";
import path from "node:path";

export interface AppPaths {
  homeDir: string;
  sidecarHome: string;
  reportsDir: string;
  snapshotsDir: string;
  statePath: string;
  activeSkillsRoot: string;
  openClawDir: string;
  openClawConfigPath: string;
  openClawWorkspacePath: string;
  packsRoot: string;
}

function fromWslMount(input: string): string {
  const match = input.match(/^\/mnt\/([a-z])\/(.*)$/i);
  if (!match) {
    return input;
  }

  const [, drive, rest] = match;
  return `${drive.toUpperCase()}:\\${rest.replaceAll("/", "\\")}`;
}

export function normalizeUserPath(input: string): string {
  const expandedHome = input.startsWith("~") ? path.join(os.homedir(), input.slice(1)) : input;
  if (process.platform === "win32") {
    return path.normalize(fromWslMount(expandedHome));
  }

  return path.normalize(expandedHome);
}

export function getAppPaths(baseHome = os.homedir()): AppPaths {
  const homeDir = normalizeUserPath(baseHome);
  const sidecarHome = path.join(homeDir, ".openclaw-skill-center");
  const openClawDir = path.join(homeDir, ".openclaw");

  return {
    homeDir,
    sidecarHome,
    reportsDir: path.join(sidecarHome, "reports"),
    snapshotsDir: path.join(sidecarHome, "snapshots"),
    statePath: path.join(sidecarHome, "state.json"),
    activeSkillsRoot: path.join(sidecarHome, "active-skills"),
    openClawDir,
    openClawConfigPath: path.join(openClawDir, "openclaw.json"),
    openClawWorkspacePath: path.join(openClawDir, "workspace"),
    packsRoot: path.join(sidecarHome, "packs")
  };
}
