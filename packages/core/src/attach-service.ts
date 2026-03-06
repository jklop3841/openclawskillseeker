import path from "node:path";
import {
  AttachFlowResultSchema,
  type AppState,
  type AttachFlowResult,
  type DoctorReport,
  type InstallExecutionReport,
  type VerifyPackLayout
} from "@openclaw-skill-center/shared";
import { ConfigService } from "./config-service.js";
import { DoctorService } from "./doctor-service.js";
import { createLogger } from "./logger.js";
import { PackService } from "./pack-service.js";
import { type AppPaths } from "./paths.js";

type FlowStage = AttachFlowResult["stages"][number];

export class AttachService {
  private readonly logger = createLogger("attach-service");

  constructor(
    private readonly paths: AppPaths,
    private readonly doctor: DoctorService,
    private readonly packs: PackService,
    private readonly config: ConfigService
  ) {}

  async attachCalendar(state: AppState): Promise<{ result: AttachFlowResult; state: AppState }> {
    return this.attachSkill("calendar", state);
  }

  async attachDemoSafe(state: AppState): Promise<{ result: AttachFlowResult; state: AppState }> {
    return this.attachPack("demo-safe", state);
  }

  private async attachSkill(skillSlug: string, state: AppState) {
    const packId = `skill:${skillSlug}`;
    const targetDir = path.join(this.paths.packsRoot, skillSlug);
    return this.runAttachFlow({
      kind: "skill",
      skillSlug,
      packId,
      targetDir,
      state,
      install: async (currentState) => this.packs.installSkill(skillSlug, currentState, { targetDir })
    });
  }

  private async attachPack(packId: string, state: AppState) {
    const targetDir = path.join(this.paths.packsRoot, packId);
    return this.runAttachFlow({
      kind: "pack",
      skillSlug: "calendar",
      packId,
      targetDir,
      state,
      install: async (currentState) =>
        this.packs.installPack(packId, currentState, { targetDir, patchConfig: false })
    });
  }

  private async runAttachFlow(input: {
    kind: "skill" | "pack";
    skillSlug: string;
    packId: string;
    targetDir: string;
    state: AppState;
    install: (state: AppState) => Promise<{
      state: AppState;
      installReport: InstallExecutionReport;
    }>;
  }): Promise<{ result: AttachFlowResult; state: AppState }> {
    const { kind, skillSlug, packId, targetDir, state } = input;
    const skillsDir = path.join(targetDir, "skills");

    this.logger.info({ kind, skillSlug, packId, targetDir }, "Running one-click attach flow");

    const doctorReport = await this.doctor.run();
    const environmentMode = this.detectEnvironmentMode(doctorReport);
    const selectedExtraDir = this.selectExtraDir(skillsDir, environmentMode);
    const stages: FlowStage[] = [
      { key: "detect", status: "success", summary: `Environment detected: ${environmentMode}` },
      { key: "install", status: "pending", summary: "Waiting to install." },
      { key: "attach", status: "pending", summary: "Waiting to attach to OpenClaw." },
      { key: "verify", status: "pending", summary: "Waiting to verify installed files." }
    ];

    if (!doctorReport.clawhubFound) {
      stages[1] = { key: "install", status: "failed", summary: "clawhub was not found on this machine." };
      return {
        result: this.buildResult({
          kind,
          skillSlug,
          packId,
          targetDir,
          skillsDir,
          selectedExtraDir,
          environmentMode,
          success: false,
          stages,
          failureCategory: "clawhub-not-found",
          failureMessage: "OpenClaw Skill Center could not find clawhub.",
          doctorReport,
          installReport: this.emptyInstallReport(["clawhub not found"]),
          verify: this.emptyVerify(targetDir, skillsDir, "clawhub not found"),
          userSummary: [
            "未找到 clawhub。",
            "请先安装官方 clawhub CLI，然后重新点击一键接入。"
          ],
          nextStep: "Install clawhub first, then retry."
        }),
        state
      };
    }

    const installed = await input.install(state);
    let nextState = installed.state;
    stages[1] = this.mapInstallStage(installed.installReport);

    let configPatch;
    if (installed.installReport.installed.length > 0) {
      try {
        const patched = await this.config.patchExtraDir(selectedExtraDir, nextState, { dryRun: false });
        nextState = patched.state;
        configPatch = patched.result;
        stages[2] = {
          key: "attach",
          status: "success",
          summary: "OpenClaw config was updated for the installed skills directory."
        };
      } catch (error) {
        stages[2] = {
          key: "attach",
          status: "failed",
          summary: error instanceof Error ? error.message : String(error)
        };
      }
    } else {
      stages[2] = {
        key: "attach",
        status: "failed",
        summary: "No installed skill was available to attach."
      };
    }

    const verify = await this.packs.verifyPackLayout(targetDir, { verbose: true });
    stages[3] = {
      key: "verify",
      status: verify.ok ? "success" : "failed",
      summary: verify.ok ? "Installed files were verified." : this.summarizeVerifyFailure(verify)
    };

    const failureCategory = this.getFailureCategory(installed.installReport, verify, configPatch);
    const success =
      installed.installReport.installed.length > 0 &&
      stages[2].status === "success" &&
      verify.ok;

    return {
      result: this.buildResult({
        kind,
        skillSlug,
        packId,
        targetDir,
        skillsDir,
        selectedExtraDir,
        environmentMode,
        success,
        stages,
        failureCategory,
        failureMessage: failureCategory ? this.failureMessage(failureCategory) : undefined,
        doctorReport,
        installReport: installed.installReport,
        verify,
        configPatch,
        userSummary: this.buildUserSummary(installed.installReport, selectedExtraDir, configPatch, verify, success),
        nextStep: success
          ? "Restart OpenClaw, then ask it to use the calendar skill."
          : this.nextStepForFailure(failureCategory)
      }),
      state: nextState
    };
  }

  private buildResult(input: {
    kind: "skill" | "pack";
    skillSlug: string;
    packId: string;
    targetDir: string;
    skillsDir: string;
    selectedExtraDir: string;
    environmentMode: "windows" | "wsl" | "unknown";
    success: boolean;
    stages: FlowStage[];
    failureCategory?: AttachFlowResult["failureCategory"];
    failureMessage?: string;
    doctorReport: DoctorReport;
    installReport: InstallExecutionReport;
    verify: VerifyPackLayout;
    configPatch?: AttachFlowResult["configPatch"];
    userSummary: string[];
    nextStep: string;
  }) {
    return AttachFlowResultSchema.parse({
      kind: input.kind,
      skillSlug: input.skillSlug,
      packId: input.packId,
      targetDir: input.targetDir,
      skillsDir: input.skillsDir,
      selectedExtraDir: input.selectedExtraDir,
      environmentMode: input.environmentMode,
      success: input.success,
      stages: input.stages,
      failureCategory: input.failureCategory,
      failureMessage: input.failureMessage,
      doctorSummary: {
        clawhubFound: input.doctorReport.clawhubFound,
        openClawConfigPath: input.doctorReport.openClawConfigPath,
        resolutionMode: input.doctorReport.clawhubResolutionMode
      },
      installReport: input.installReport,
      verify: input.verify,
      configPatch: input.configPatch,
      userSummary: input.userSummary,
      nextStep: input.nextStep
    });
  }

  private mapInstallStage(report: InstallExecutionReport): FlowStage {
    if (report.installed.length > 0) {
      return {
        key: "install",
        status: "success",
        summary: `Installed ${report.installed.map((entry) => entry.slug).join(", ")}.`
      };
    }

    if (report.skipped.some((entry) => entry.decision === "skip-suspicious")) {
      return {
        key: "install",
        status: "failed",
        summary: "Installation stopped because the skill was flagged as suspicious."
      };
    }

    if (report.failedRetriable.length > 0) {
      return {
        key: "install",
        status: "failed",
        summary: "Installation could not finish because the upstream registry asked us to retry later."
      };
    }

    return {
      key: "install",
      status: "failed",
      summary: "Installation did not complete."
    };
  }

  private detectEnvironmentMode(doctorReport: DoctorReport) {
    if (doctorReport.isWsl || doctorReport.platform === "linux") {
      return "wsl" as const;
    }

    if (doctorReport.platform === "win32") {
      return "windows" as const;
    }

    return "unknown" as const;
  }

  private selectExtraDir(skillsDir: string, environmentMode: "windows" | "wsl" | "unknown") {
    if (environmentMode !== "wsl") {
      return skillsDir;
    }

    return skillsDir.replace(/^([A-Za-z]):\\/, (_match, drive: string) => `/mnt/${drive.toLowerCase()}/`).replaceAll("\\", "/");
  }

  private getFailureCategory(
    report: InstallExecutionReport,
    verify: VerifyPackLayout,
    configPatch?: AttachFlowResult["configPatch"]
  ): AttachFlowResult["failureCategory"] | undefined {
    if (report.skipped.some((entry) => entry.decision === "skip-suspicious")) {
      return "suspicious-skipped";
    }

    if (report.failedRetriable.length > 0) {
      return "install-retriable";
    }

    if (report.failedPermanent.length > 0) {
      return "install-failed";
    }

    if (configPatch && !configPatch.changed && configPatch.diffSummary.includes("No config changes required")) {
      return undefined;
    }

    if (!configPatch && report.installed.length > 0) {
      return "attach-failed";
    }

    if (!verify.ok) {
      return "verify-failed";
    }

    return undefined;
  }

  private failureMessage(category?: AttachFlowResult["failureCategory"]) {
    switch (category) {
      case "clawhub-not-found":
        return "We could not find clawhub on this machine.";
      case "suspicious-skipped":
        return "The skill was skipped because it was marked suspicious by policy.";
      case "verify-failed":
        return "The install command returned, but the expected files were not verified.";
      case "install-retriable":
        return "The upstream registry asked us to retry later.";
      case "install-failed":
        return "The install failed with a permanent upstream error.";
      case "attach-failed":
        return "The skill installed, but OpenClaw config could not be updated.";
      default:
        return undefined;
    }
  }

  private nextStepForFailure(category?: AttachFlowResult["failureCategory"]) {
    switch (category) {
      case "clawhub-not-found":
        return "Install clawhub first, then retry.";
      case "suspicious-skipped":
        return "Choose a reviewed skill or ask an admin to allow suspicious installs explicitly.";
      case "verify-failed":
        return "Review the verification findings before using this skill in OpenClaw.";
      case "install-retriable":
        return "Wait a moment and retry the one-click attach flow.";
      case "install-failed":
        return "Open the advanced details and review the upstream install error.";
      case "attach-failed":
        return "Open advanced details and confirm the OpenClaw config path is writable.";
      default:
        return "Restart OpenClaw, then ask it to use the calendar skill.";
    }
  }

  private summarizeVerifyFailure(verify: VerifyPackLayout) {
    return verify.findings.join(" ") || "Verification did not pass.";
  }

  private buildUserSummary(
    installReport: InstallExecutionReport,
    selectedExtraDir: string,
    configPatch: AttachFlowResult["configPatch"] | undefined,
    verify: VerifyPackLayout,
    success: boolean
  ) {
    return [
      installReport.installed.length > 0
        ? `Installed: ${installReport.installed.map((entry) => entry.slug).join(", ")}`
        : "Installed: none",
      installReport.skipped.length > 0
        ? `Skipped: ${installReport.skipped.map((entry) => `${entry.slug} (${entry.reason})`).join(" | ")}`
        : "Skipped: none",
      `OpenClaw skills path: ${selectedExtraDir}`,
      configPatch
        ? `OpenClaw config updated: ${configPatch.configPath}`
        : "OpenClaw config was not updated.",
      success ? "Verification passed. Restart OpenClaw to use the skill." : this.summarizeVerifyFailure(verify)
    ];
  }

  private emptyInstallReport(reasons: string[]): InstallExecutionReport {
    return {
      installed: [],
      skipped: [],
      failedPermanent: [],
      failedRetriable: [],
      reasons
    };
  }

  private emptyVerify(targetDir: string, skillsDir: string, finding: string): VerifyPackLayout {
    return {
      targetDir,
      skillsDir,
      rootExists: false,
      skillsDirExists: false,
      ok: false,
      skillEntries: [],
      findings: [finding]
    };
  }
}
