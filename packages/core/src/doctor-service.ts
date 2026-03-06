import os from "node:os";
import { DoctorReportSchema, type DoctorCheck } from "@openclaw-skill-center/shared";
import { pathExists } from "./fs.js";
import { getAppPaths, type AppPaths } from "./paths.js";
import { createLogger } from "./logger.js";
import { resolveClawhub, type ClawhubResolutionOptions } from "./clawhub-resolution.js";

export class DoctorService {
  private readonly logger = createLogger("doctor-service");

  constructor(
    private readonly paths: AppPaths = getAppPaths(),
    private readonly clawhubOptions: ClawhubResolutionOptions = {}
  ) {}

  async run() {
    this.logger.info({ paths: this.paths }, "Running doctor checks");
    const clawhubResolution = await resolveClawhub(this.clawhubOptions);
    const wslProbe = await resolveClawhub({ ...this.clawhubOptions, probeWsl: true });
    const clawhubBinary = clawhubResolution.clawhubPath;
    const checks: DoctorCheck[] = [
      {
        name: "node",
        ok: Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10) >= 22,
        summary: `Node ${process.versions.node}`,
        details: { required: ">=22.0.0" }
      },
      {
        name: "openclaw-config",
        ok: await pathExists(this.paths.openClawConfigPath),
        summary: this.paths.openClawConfigPath,
        details: {}
      },
      {
        name: "openclaw-workspace",
        ok: await pathExists(this.paths.openClawWorkspacePath),
        summary: this.paths.openClawWorkspacePath,
        details: {}
      },
      {
        name: "clawhub",
        ok: clawhubResolution.found,
        summary: clawhubBinary ?? `clawhub not found via ${clawhubResolution.mode}`,
        details: {
          mode: clawhubResolution.mode,
          command: clawhubResolution.displayCommand
        }
      },
      {
        name: "wsl",
        ok: process.platform === "linux" ? this.isWsl() || !this.isWindowsHost() : true,
        summary: this.isWsl() ? "Running inside WSL" : "Not running inside WSL",
        details: {
          recommendation:
            process.platform === "win32" ? "Prefer WSL2 for OpenClaw itself on Windows." : "WSL check passed."
        }
      }
    ];

    const report = DoctorReportSchema.parse({
      generatedAt: new Date().toISOString(),
      platform: process.platform,
      isWsl: this.isWsl(),
      checks,
      clawhubFound: clawhubResolution.found,
      clawhubResolutionMode: clawhubResolution.mode,
      resolvedClawhubCommand: clawhubResolution.displayCommand,
      wslAvailable: wslProbe.wslAvailable,
      openClawConfigPath: this.paths.openClawConfigPath,
      openClawWorkspacePath: this.paths.openClawWorkspacePath,
      clawhubBinary,
      nodeVersion: process.versions.node,
      sidecarHome: this.paths.sidecarHome,
      snapshotRoot: this.paths.snapshotsDir,
      defaultPackRoot: this.paths.packsRoot
    });

    this.logger.info({ checks: report.checks.length }, "Doctor checks completed");
    return report;
  }

  private isWsl() {
    return Boolean(process.env.WSL_DISTRO_NAME) || os.release().toLowerCase().includes("microsoft");
  }

  private isWindowsHost() {
    return process.platform === "win32";
  }
}
