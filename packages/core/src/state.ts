import { AppStateSchema, type AppState } from "@openclaw-skill-center/shared";
import { readJsonFile, writeJsonFile } from "./fs.js";
import type { AppPaths } from "./paths.js";

const emptyState: AppState = {
  installedPacks: [],
  snapshots: [],
  manualSkillSlugs: [],
  activeSkillSlugs: [],
  activePackIds: [],
  managedHistory: []
};

export async function loadState(paths: AppPaths): Promise<AppState> {
  const state = await readJsonFile(paths.statePath, emptyState);
  return AppStateSchema.parse(state);
}

export async function saveState(paths: AppPaths, state: AppState) {
  await writeJsonFile(paths.statePath, state);
}
