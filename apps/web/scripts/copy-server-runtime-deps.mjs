import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "..", "..", "..");
const sourceNodeModules = path.join(workspaceRoot, "node_modules");
const targetNodeModules = path.resolve(scriptDir, "..", "dist", "server", "node_modules");

const seedPackages = ["express", "json5", "pino", "zod"];
const visited = new Set();

function packageDir(packageName) {
  if (packageName.startsWith("@")) {
    const [scope, name] = packageName.split("/");
    return path.join(sourceNodeModules, scope, name);
  }

  return path.join(sourceNodeModules, packageName);
}

function packageJsonPath(packageName) {
  return path.join(packageDir(packageName), "package.json");
}

function enqueuePackage(packageName, queue) {
  if (!packageName || visited.has(packageName)) {
    return;
  }

  const manifestPath = packageJsonPath(packageName);
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  visited.add(packageName);
  queue.push(packageName);
}

function copyPackage(packageName) {
  const from = packageDir(packageName);
  const to = packageDir(packageName).replace(sourceNodeModules, targetNodeModules);

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    dereference: true
  });
}

function main() {
  fs.rmSync(targetNodeModules, { recursive: true, force: true });
  fs.mkdirSync(targetNodeModules, { recursive: true });

  const queue = [];
  for (const pkg of seedPackages) {
    enqueuePackage(pkg, queue);
  }

  while (queue.length > 0) {
    const packageName = queue.shift();
    if (!packageName) {
      continue;
    }

    copyPackage(packageName);

    const manifest = JSON.parse(fs.readFileSync(packageJsonPath(packageName), "utf8"));
    const deps = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.optionalDependencies ?? {})
    };

    for (const dependencyName of Object.keys(deps)) {
      enqueuePackage(dependencyName, queue);
    }
  }
}

main();
