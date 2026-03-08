import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const targetDir = path.resolve(scriptDir, "..", "dist", "server");
const targetPath = path.join(targetDir, "package.json");

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(
  targetPath,
  `${JSON.stringify({ type: "module" }, null, 2)}\n`,
  "utf8"
);
