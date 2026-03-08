import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(scriptDir, "..", "dist", "server");

const replacements = new Map([
  ["@openclaw-skill-center/shared", path.join(serverRoot, "packages", "shared", "src", "index.js")],
  ["@openclaw-skill-center/catalog", path.join(serverRoot, "packages", "catalog", "src", "index.js")],
  ["@openclaw-skill-center/core", path.join(serverRoot, "packages", "core", "src", "index.js")]
]);

function toPosixRelative(fromFile, toFile) {
  const relativePath = path.relative(path.dirname(fromFile), toFile).replace(/\\/g, "/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function rewriteFile(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [specifier, target] of replacements.entries()) {
    if (!content.includes(specifier)) {
      continue;
    }

    const replacement = toPosixRelative(filePath, target);
    content = content.split(specifier).join(replacement);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

function walk(dirPath) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (entry.name.endsWith(".js") || entry.name.endsWith(".d.ts")) {
      rewriteFile(entryPath);
    }
  }
}

walk(serverRoot);
