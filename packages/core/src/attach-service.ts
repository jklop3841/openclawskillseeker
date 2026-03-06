import path from "node:path";
import {
  AttachFlowResultSchema,
  type AppState,
  type AttachFlowResult
} from "@openclaw-skill-center/shared";
import { ConfigService } from "./config-service.js";
import { DoctorService } from "./doctor-service.js";
import { createLogger } from "./logger.js";
import { PackService } from "./pack-service.js";
import { type AppPaths } from "./paths.js";

export class AttachService {
  private readonly logger = createLogger("attach-service");

  constructor(
    private readonly paths: AppPaths,
    private readonly doctor: DoctorService,
    private readonly packs: PackService,
    private readonly config: ConfigService
  ) {}

  async attachCalendar(state: AppState): Promise<{ result: AttachFlowResult; state: AppState }> {
    const skillSlug = "calendar";
    const packId = "skill:calendar";
    const targetDir = path.join(this.paths.packsRoot, "calendar");
    const skillsDir = path.join(targetDir, "skills");

    this.logger.info({ skillSlug, targetDir }, "Running one-click attach flow");

    const doctorReport = await this.doctor.run();
    if (!doctorReport.clawhubFound) {
      const failed = AttachFlowResultSchema.parse({
        skillSlug,
        packId,
        targetDir,
        skillsDir,
        success: false,
        doctorSummary: {
          clawhubFound: doctorReport.clawhubFound,
          openClawConfigPath: doctorReport.openClawConfigPath,
          resolutionMode: doctorReport.clawhubResolutionMode
        },
        installReport: {
          installed: [],
          skipped: [],
          failedPermanent: [],
          failedRetriable: [],
          reasons: ["clawhub not found"]
        },
        verify: {
          targetDir,
          skillsDir,
          rootExists: false,
          skillsDirExists: false,
          ok: false,
          skillEntries: [],
          findings: ["clawhub not found"]
        },
        userSummary: [
          "OpenClaw Skill Center could not find clawhub.",
          "Install the official clawhub CLI first, then retry the one-click flow."
        ],
        nextStep: "Install clawhub, then try again."
      });
      return { result: failed, state };
    }

    const installed = await this.packs.installSkill(skillSlug, state, { targetDir });
    let nextState = installed.state;
    let configPatch;

    if (installed.installReport.installed.some((entry) => entry.slug === skillSlug)) {
      const patched = await this.config.patchExtraDir(skillsDir, nextState, { dryRun: false });
      nextState = patched.state;
      configPatch = patched.result;
    }

    const verify = await this.packs.verifyPackLayout(targetDir, { verbose: true });
    const success =
      installed.installReport.installed.some((entry) => entry.slug === skillSlug) &&
      verify.ok &&
      Boolean(configPatch?.changed ?? true);

    const userSummary = [
      installed.installReport.installed.length > 0
        ? `Installed: ${installed.installReport.installed.map((entry) => entry.slug).join(", ")}`
        : "Installed: none",
      installed.installReport.skipped.length > 0
        ? `Skipped: ${installed.installReport.skipped.map((entry) => `${entry.slug} (${entry.reason})`).join(" | ")}`
        : "Skipped: none",
      `Files: ${skillsDir}`,
      configPatch
        ? `OpenClaw config updated: ${configPatch.configPath}`
        : "OpenClaw config was not updated.",
      success ? "Restart OpenClaw to use the new skill." : "Review the findings below before retrying."
    ];

    const result = AttachFlowResultSchema.parse({
      skillSlug,
      packId,
      targetDir,
      skillsDir,
      success,
      doctorSummary: {
        clawhubFound: doctorReport.clawhubFound,
        openClawConfigPath: doctorReport.openClawConfigPath,
        resolutionMode: doctorReport.clawhubResolutionMode
      },
      installReport: installed.installReport,
      verify,
      configPatch,
      userSummary,
      nextStep: success ? "Restart OpenClaw, then ask it to use the calendar skill." : "Retry after reviewing the failure details."
    });

    return { result, state: nextState };
  }
}
