import fs from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs.js";
import type { AppPaths } from "./paths.js";

export class ReportService {
  constructor(private readonly paths: AppPaths) {}

  async writeReport(type: "install" | "update" | "rollback", title: string, body: string) {
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const filePath = path.join(this.paths.reportsDir, `${stamp}-${type}.md`);
    await ensureDir(this.paths.reportsDir);
    const content = `# ${title}\n\nGenerated: ${new Date().toISOString()}\n\n${body}\n`;
    await fs.writeFile(filePath, content, "utf8");
    return filePath;
  }
}
