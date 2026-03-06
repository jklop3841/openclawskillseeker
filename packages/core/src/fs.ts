import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(target: string) {
  await fs.mkdir(target, { recursive: true });
}

export async function pathExists(target: string) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await pathExists(filePath))) {
    return fallback;
  }

  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function copyPath(source: string, destination: string) {
  await ensureDir(path.dirname(destination));
  await fs.cp(source, destination, { recursive: true, force: true });
}

export async function removePath(target: string) {
  await fs.rm(target, { recursive: true, force: true });
}
