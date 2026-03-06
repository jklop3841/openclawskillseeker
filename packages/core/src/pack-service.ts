import path from "node:path";
import fs from "node:fs/promises";
import { loadLocalCatalog } from "@openclaw-skill-center/catalog";
import {
  InstallExecutionReportSchema,
  PackValidationReportSchema,
  type AppState,
  type InstallDecision,
  type InstallExecutionReport,
  type PackValidationReport,
  type SkillValidation
} from "@openclaw-skill-center/shared";
import { ensureDir, pathExists } from "./fs.js";
import { buildInstallPlan } from "./install-planner.js";
import { type AppPaths } from "./paths.js";
import { RegistryAdapter } from "./registry-adapter.js";
import { ReportService } from "./report-service.js";
import { SnapshotService } from "./snapshot-service.js";
import { saveState } from "./state.js";
import { ConfigService } from "./config-service.js";
import { createLogger } from "./logger.js";

export class PackService {
  private readonly logger = createLogger("pack-service");
  static readonly DEFAULT_INSTALL_RETRY_DELAYS_MS = [2000, 5000];

  constructor(
    private readonly paths: AppPaths,
    private readonly registry: RegistryAdapter,
    private readonly snapshots: SnapshotService,
    private readonly reports: ReportService,
    private readonly configService: ConfigService,
    private readonly retryDelaysMs: number[] = PackService.DEFAULT_INSTALL_RETRY_DELAYS_MS
  ) {}

  planInstall(packId: string, options: { patchConfig?: boolean; targetDir?: string } = {}) {
    const catalog = loadLocalCatalog();
    const pack = catalog.packs.find((entry) => entry.id === packId);
    if (!pack) {
      throw new Error(`Unknown pack: ${packId}`);
    }

    return buildInstallPlan({
      pack,
      catalogSkills: catalog.skills,
      packsRoot: this.paths.packsRoot,
      installRoot: options.targetDir,
      patchConfig: options.patchConfig
    });
  }

  async installPack(
    packId: string,
    state: AppState,
    options: { patchConfig?: boolean; targetDir?: string; dryRun?: boolean; allowSuspicious?: boolean } = {}
  ) {
    const dryRun = options.dryRun ?? false;
    const allowSuspicious = options.allowSuspicious ?? false;
    this.logger.info(
      { packId, patchConfig: options.patchConfig, targetDir: options.targetDir, dryRun, allowSuspicious },
      "Installing curated pack"
    );
    const plan = this.planInstall(packId, options);
    if (plan.blockedSkills.length > 0) {
      throw new Error(`Install blocked. Skills not whitelisted: ${plan.blockedSkills.join(", ")}`);
    }
    return this.installPackUsingPlan(packId, plan, state, {
      dryRun,
      allowSuspicious
    });
  }

  async validateSkill(slug: string): Promise<SkillValidation> {
    const inspect = await this.registry.inspect(slug);
    const text = `${inspect.stdout}\n${inspect.stderr}`.trim();
    const lowered = text.toLowerCase();
    const summaryMatch = inspect.stdout.match(/^Summary:\s*(.*)$/m);
    const exists = !lowered.includes("skill not found") && Boolean(inspect.stdout || inspect.ok);
    const suspiciousHint =
      lowered.includes("suspicious") ||
      lowered.includes("warning") ||
      lowered.includes("unapproved") ||
      lowered.includes("use --force");

    return {
      slug,
      exists,
      summary: summaryMatch?.[1]?.trim() ?? "",
      suspiciousHint,
      rawStatus: this.compactMessage(text || (exists ? "exists" : "not-found"))
    };
  }

  async validatePack(packId: string): Promise<PackValidationReport> {
    const plan = this.planInstall(packId);
    const probes = await Promise.all(plan.allowedSkills.map((slug) => this.validateSkill(slug)));

    return PackValidationReportSchema.parse({
      packId,
      valid: probes.filter((probe) => probe.exists && !probe.suspiciousHint),
      suspicious: probes.filter((probe) => probe.exists && probe.suspiciousHint),
      notFound: probes.filter((probe) => !probe.exists),
      skipped: [
        ...probes
          .filter((probe) => probe.exists && probe.suspiciousHint)
          .map((probe) => ({
            slug: probe.slug,
            reason: "suspicious and skipped by default policy"
          })),
        ...probes
          .filter((probe) => !probe.exists)
          .map((probe) => ({
            slug: probe.slug,
            reason: "not found in registry"
          }))
      ]
    });
  }

  async installSkill(
    slug: string,
    state: AppState,
    options: { targetDir: string; dryRun?: boolean; allowSuspicious?: boolean }
  ) {
    const workdir = options.targetDir;
    const validation = await this.validateSkill(slug);
    const plan = {
      packId: `skill:${slug}`,
      packName: `Skill ${slug}`,
      installRoot: workdir,
      patchConfig: false,
      skills: [{ slug, allowed: validation.exists, reason: validation.rawStatus }],
      blockedSkills: validation.exists ? [] : [slug],
      allowedSkills: validation.exists ? [slug] : []
    };

    return this.installPackUsingPlan(plan.packId, plan, state, {
      dryRun: options.dryRun ?? false,
      allowSuspicious: options.allowSuspicious ?? false
    });
  }

  async updateInstalled(state: AppState) {
    this.logger.info({ installedPacks: state.installedPacks.length }, "Updating curated skills");
    const snapshot = await this.snapshots.createSnapshot({
      operation: "update",
      configPath: this.paths.openClawConfigPath,
      copiedPackRoots: state.installedPacks.map((pack) => pack.workdir),
      state,
      notes: ["Pre-update snapshot"]
    });

    const results = [];
    for (const installed of state.installedPacks) {
      for (const slug of installed.slugs) {
        const result = await this.registry.update(slug, installed.workdir);
        results.push({ packId: installed.packId, slug, result });
        if (!result.ok) {
          throw new Error(`clawhub update failed for ${slug}: ${result.stderr || result.stdout}`);
        }
      }
    }

    const nextState: AppState = {
      ...state,
      snapshots: [...state.snapshots, snapshot]
    };

    await saveState(this.paths, nextState);
    const reportPath = await this.reports.writeReport(
      "update",
      "OpenClaw Skill Center update report",
      [
        `Snapshot: ${snapshot.id}`,
        "",
        ...results.map(({ packId, slug }) => `- Updated ${slug} in ${packId}`)
      ].join("\n")
    );

    this.logger.info({ reportPath }, "Curated skill update completed");
    return { snapshot, reportPath, state: nextState };
  }

  async verifyPackLayout(targetDir: string, options: { verbose?: boolean } = {}) {
    const skillsDir = path.join(targetDir, "skills");
    const findings: string[] = [];
    const verbose = options.verbose ?? false;

    const rootExists = await pathExists(targetDir);
    const skillsDirExists = await pathExists(skillsDir);
    const lockFilePath = path.join(targetDir, ".clawhub", "lock.json");
    const lockFileExists = await pathExists(lockFilePath);

    if (!rootExists) {
      findings.push("Target directory does not exist.");
    }

    if (!skillsDirExists) {
      findings.push("skills directory does not exist.");
    }

    const skillEntries: string[] = [];
    const skillDetails: Array<{
      slug: string;
      skillRoot: string;
      skillMdExists: boolean;
      originJsonExists: boolean;
    }> = [];
    if (skillsDirExists) {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      if (entries.length === 0) {
        findings.push("no skills installed");
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const skillRoot = path.join(skillsDir, entry.name);
        const hasSkillMd = await pathExists(path.join(skillRoot, "SKILL.md"));
        const hasOriginJson = await pathExists(path.join(skillRoot, ".clawhub", "origin.json"));
        skillDetails.push({
          slug: entry.name,
          skillRoot,
          skillMdExists: hasSkillMd,
          originJsonExists: hasOriginJson
        });
        if (hasSkillMd) {
          skillEntries.push(entry.name);
        } else {
          findings.push(`Missing SKILL.md in ${skillRoot}`);
        }
      }
    }

    if (skillsDirExists && skillEntries.length === 0) {
      findings.push("no SKILL.md found");
    }

    return {
      targetDir,
      skillsDir,
      rootExists,
      skillsDirExists,
      skillEntries,
      ...(verbose
        ? {
            lockFilePath,
            lockFileExists,
            skillDetails
          }
        : {}),
      ok: rootExists && skillsDirExists && skillEntries.length > 0 && findings.length === 0,
      findings
    };
  }

  buildUserInstallSummary(result: {
    plan: { packId: string; installRoot: string };
    installReport: InstallExecutionReport;
  }) {
    const { plan, installReport } = result;
    const installed = installReport.installed.map((entry) => entry.slug);
    const skipped = installReport.skipped.map((entry) => `${entry.slug}: ${entry.reason}`);
    const failed = [
      ...installReport.failedPermanent.map((entry) => `${entry.slug}: ${entry.reason}`),
      ...installReport.failedRetriable.map((entry) => `${entry.slug}: ${entry.reason}`)
    ];

    return [
      `Install summary for ${plan.packId}`,
      `Installed: ${installed.length > 0 ? installed.join(", ") : "none"}`,
      `Skipped: ${skipped.length > 0 ? skipped.join(" | ") : "none"}`,
      `Failed: ${failed.length > 0 ? failed.join(" | ") : "none"}`,
      `Files expected under: ${path.join(plan.installRoot, "skills")}`,
      `Success check: run verify-pack-layout ${plan.installRoot}`
    ].join("\n");
  }

  private async preflightInstall(slugs: string[], allowSuspicious: boolean) {
    const entries: Array<{ slug: string; decision: InstallDecision; reason: string }> = [];
    const reasons: string[] = [];

    for (const slug of slugs) {
      const probe = await this.validateSkill(slug);
      const lowered = `${probe.rawStatus} ${probe.summary}`.toLowerCase();

      if (!probe.exists) {
        entries.push({ slug, decision: "skip-unknown", reason: "Skill not found in registry." });
        reasons.push(`${slug}: not found in registry`);
        continue;
      }

      if (lowered.includes("malicious") || lowered.includes("blocked")) {
        entries.push({ slug, decision: "fail-hard", reason: "Registry metadata indicates malicious or blocked skill." });
        reasons.push(`${slug}: malicious or blocked`);
        continue;
      }

      if (probe.suspiciousHint) {
        if (allowSuspicious) {
          entries.push({ slug, decision: "install", reason: "Suspicious skill allowed explicitly." });
          reasons.push(`${slug}: suspicious but allowed explicitly`);
        } else {
          entries.push({ slug, decision: "skip-suspicious", reason: "Suspicious skill requires explicit allow-suspicious." });
          reasons.push(`${slug}: suspicious and skipped by policy`);
        }
        continue;
      }

      entries.push({ slug, decision: "install", reason: "Preflight passed." });
    }

    return { entries, reasons };
  }

  private async installPackUsingPlan(
    derivedPackId: string,
    plan: {
      packId: string;
      packName: string;
      installRoot: string;
      patchConfig: boolean;
      skills: Array<{ slug: string; allowed: boolean; reason: string }>;
      blockedSkills: string[];
      allowedSkills: string[];
    },
    state: AppState,
    options: { dryRun: boolean; allowSuspicious: boolean }
  ) {
    const workdir = plan.installRoot;
    const skillsDir = path.join(workdir, "skills");
    const preflight = await this.preflightInstall(plan.allowedSkills, options.allowSuspicious);
    const commandPreview = preflight.entries
      .filter((entry) => entry.decision === "install")
      .map((entry) => ({
        slug: entry.slug,
        command: "clawhub",
        args: [
          "install",
          entry.slug,
          "--workdir",
          workdir,
          "--dir",
          "skills",
          "--no-input",
          ...(options.allowSuspicious && entry.reason.toLowerCase().includes("suspicious") ? ["--force"] : [])
        ]
      }));

    const report = this.createEmptyInstallReport(preflight.reasons);
    for (const entry of preflight.entries) {
      if (entry.decision !== "install") {
        report.skipped.push(entry);
      }
    }

    if (options.dryRun) {
      const reportPath = await this.reports.writeReport(
        "install",
        `OpenClaw Skill Center dry-run install report: ${plan.packName}`,
        this.renderInstallReport(plan.packId, plan.installRoot, plan.patchConfig, undefined, report, [])
      );

      return { plan, dryRun: true, reportPath, state, commandPreview, installReport: report };
    }

    if (preflight.entries.every((entry) => entry.decision !== "install")) {
      const reportPath = await this.reports.writeReport(
        "install",
        `OpenClaw Skill Center install report: ${plan.packName}`,
        this.renderInstallReport(plan.packId, plan.installRoot, plan.patchConfig, undefined, report, [])
      );
      return { plan, reportPath, state, installReport: InstallExecutionReportSchema.parse(report) };
    }

    await ensureDir(skillsDir);

    const snapshot = await this.snapshots.createSnapshot({
      operation: "install",
      packId: derivedPackId,
      configPath: this.paths.openClawConfigPath,
      copiedPackRoots: [workdir],
      state,
      notes: [`Pre-install snapshot for ${derivedPackId}`]
    });

    const outputs = [];
    for (const entry of preflight.entries.filter((item) => item.decision === "install")) {
      const force = options.allowSuspicious && entry.reason.toLowerCase().includes("suspicious");
      const attempt = await this.installWithRetry(entry.slug, workdir, force);
      outputs.push(...attempt.outputs);
      const { result } = attempt;
      if (!result.ok) {
        if (!options.allowSuspicious && this.isSuspiciousInstallBlock(result)) {
          report.skipped.push({
            slug: entry.slug,
            decision: "skip-suspicious",
            reason: this.compactMessage(result.stderr || result.stdout)
          });
          continue;
        }

        const reason = this.compactMessage(result.stderr || result.stdout);
        if (this.isRetriableInstallError(result)) {
          report.failedRetriable.push({
            slug: entry.slug,
            decision: "retry-later",
            reason: `retry-later: ${reason}`
          });
          report.reasons.push(`${entry.slug}: retriable upstream install failure`);
          continue;
        }

        report.failedPermanent.push({
          slug: entry.slug,
          decision: "fail-hard",
          reason
        });
        continue;
      }

      report.installed.push({
        slug: entry.slug,
        decision: "install",
        reason: force ? "Installed with explicit allow-suspicious and --force." : "Installed successfully."
      });
    }

    let nextState: AppState = {
      ...state,
      installedPacks:
        report.installed.length > 0
          ? [
              ...state.installedPacks.filter((pack) => pack.packId !== derivedPackId),
              {
                packId: derivedPackId,
                installedAt: new Date().toISOString(),
                workdir,
                skillsDir,
                slugs: report.installed.map((entry) => entry.slug),
                snapshotId: snapshot.id
              }
            ]
          : state.installedPacks.filter((pack) => pack.packId !== derivedPackId),
      snapshots: [...state.snapshots, snapshot]
    };

    if (plan.patchConfig && report.installed.length > 0) {
      const patched = await this.configService.patchExtraDir(skillsDir, nextState, { dryRun: false });
      nextState = patched.state;
    }

    await saveState(this.paths, nextState);
    const reportPath = await this.reports.writeReport(
      "install",
      `OpenClaw Skill Center install report: ${plan.packName}`,
      this.renderInstallReport(plan.packId, plan.installRoot, plan.patchConfig, snapshot.id, report, outputs)
    );

    this.logger.info({ packId: derivedPackId, reportPath }, "Install execution completed");
    return { plan, snapshot, reportPath, state: nextState, installReport: InstallExecutionReportSchema.parse(report) };
  }

  private createEmptyInstallReport(reasons: string[]): InstallExecutionReport {
    return {
      installed: [],
      skipped: [],
      failedPermanent: [],
      failedRetriable: [],
      reasons
    };
  }

  private isSuspiciousInstallBlock(result: { stdout: string; stderr: string }) {
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return text.includes("suspicious") || text.includes("use --force");
  }

  private isRetriableInstallError(result: { stdout: string; stderr: string }) {
    const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
    return text.includes("rate limit exceeded") || text.includes("too many requests") || text.includes("429");
  }

  private async installWithRetry(slug: string, workdir: string, force: boolean) {
    const outputs: Array<{ slug: string; result: { command: string; args: string[]; ok: boolean } }> = [];
    let result = await this.registry.install(slug, workdir, "skills", undefined, { force });
    outputs.push({ slug, result });

    for (const delayMs of this.retryDelaysMs) {
      if (result.ok || !this.isRetriableInstallError(result)) {
        break;
      }

      this.logger.warn({ slug, delayMs }, "Retriable install failure, waiting before retry");
      await this.sleep(delayMs);
      result = await this.registry.install(slug, workdir, "skills", undefined, { force });
      outputs.push({ slug, result });
    }

    return { result, outputs };
  }

  private async sleep(delayMs: number) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private compactMessage(message: string) {
    return message.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join(" ");
  }

  private renderInstallReport(
    packId: string,
    installRoot: string,
    patchConfig: boolean,
    snapshotId: string | undefined,
    report: InstallExecutionReport,
    outputs: Array<{ slug: string; result: { command: string; args: string[]; ok: boolean } }>
  ) {
    return [
      `Pack ID: ${packId}`,
      `Install root: ${installRoot}`,
      `Patched config: ${patchConfig ? "yes" : "no"}`,
      `Snapshot: ${snapshotId ?? "none"}`,
      "",
      "Installed:",
      ...(report.installed.length > 0
        ? report.installed.map((entry) => `- ${entry.slug}: ${entry.reason}`)
        : ["- none"]),
      "",
      "Skipped:",
      ...(report.skipped.length > 0
        ? report.skipped.map((entry) => `- ${entry.slug}: ${entry.decision} (${entry.reason})`)
        : ["- none"]),
      "",
      "Failed:",
      ...(report.failedPermanent.length > 0
        ? report.failedPermanent.map((entry) => `- ${entry.slug}: ${entry.reason}`)
        : ["- none"]),
      "",
      "Retriable failures:",
      ...(report.failedRetriable.length > 0
        ? report.failedRetriable.map((entry) => `- ${entry.slug}: ${entry.reason}`)
        : ["- none"]),
      "",
      "Reasons:",
      ...(report.reasons.length > 0 ? report.reasons.map((reason) => `- ${reason}`) : ["- none"]),
      "",
      "Registry output:",
      ...outputs.map((output) => `- ${output.slug}: \`${output.result.command} ${output.result.args.join(" ")}\` -> ${output.result.ok ? "ok" : "failed"}`)
    ].join("\n");
  }
}
