#!/usr/bin/env node
import { Command } from "commander";
import {
  CatalogService,
  ConfigService,
  DoctorService,
  PackService,
  RegistryAdapter,
  ReportService,
  RollbackService,
  SnapshotService,
  getAppPaths,
  loadState
} from "@openclaw-skill-center/core";
import type { InstallExecutionReport } from "@openclaw-skill-center/shared";

const program = new Command();
const paths = getAppPaths();
const catalogService = new CatalogService();
const reports = new ReportService(paths);
const snapshots = new SnapshotService(paths);
const configService = new ConfigService(paths, snapshots);
const rollbackService = new RollbackService(paths, reports);

program
  .name("openclaw-skill-center")
  .description("Local sidecar for curated OpenClaw skill management.")
  .version("0.1.0");

function addClawhubOptions(command: Command) {
  return command
    .option("--clawhub-bin <path>", "Explicit clawhub binary path")
    .option("--use-wsl", "Run clawhub through WSL bridge");
}

function createRegistry(options: { clawhubBin?: string; useWsl?: boolean }) {
  return new RegistryAdapter(process.cwd(), {
    clawhubBin: typeof options.clawhubBin === "string" ? options.clawhubBin : undefined,
    useWsl: Boolean(options.useWsl)
  });
}

function createPackService(options: { clawhubBin?: string; useWsl?: boolean }) {
  const registry = createRegistry(options);
  return new PackService(paths, registry, snapshots, reports, configService);
}

function writeInstallResult(
  packService: PackService,
  result: {
    plan: { packId: string; installRoot: string };
    reportPath?: string;
    installReport: InstallExecutionReport;
  }
) {
  process.stdout.write(
    `${JSON.stringify(
      {
        packId: result.plan.packId,
        reportPath: result.reportPath,
        installReport: result.installReport
      },
      null,
      2
    )}\n`
  );
  process.stdout.write(`${packService.buildUserInstallSummary(result)}\n`);
}

addClawhubOptions(
program
  .command("doctor")
  .option("--json", "Print raw JSON output")
  .action(async (options) => {
    const doctor = new DoctorService(paths, {
      clawhubBin: typeof options.clawhubBin === "string" ? options.clawhubBin : undefined,
      useWsl: Boolean(options.useWsl)
    });
    const report = await doctor.run();
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }

    process.stdout.write(`OpenClaw Skill Center doctor\n`);
    process.stdout.write(`- clawhub found: ${report.clawhubFound ? "yes" : "no"}\n`);
    process.stdout.write(`- clawhub path: ${report.clawhubBinary ?? "not found"}\n`);
    process.stdout.write(`- clawhub resolution mode: ${report.clawhubResolutionMode}\n`);
    process.stdout.write(`- resolved clawhub command: ${report.resolvedClawhubCommand}\n`);
    process.stdout.write(`- wsl available: ${report.wslAvailable ? "yes" : "no"}\n`);
    process.stdout.write(`- openclaw config path: ${report.openClawConfigPath}\n`);
    process.stdout.write(`- snapshot root: ${report.snapshotRoot}\n`);
    process.stdout.write(`- default pack root: ${report.defaultPackRoot}\n`);
    for (const check of report.checks) {
      process.stdout.write(`- [${check.ok ? "ok" : "fail"}] ${check.name}: ${check.summary}\n`);
    }
  }))
;

program
  .command("catalog")
  .description("Print curated catalog")
  .action(() => {
    process.stdout.write(`${JSON.stringify(catalogService.listCatalog(), null, 2)}\n`);
  });

addClawhubOptions(
program
  .command("search")
  .argument("<query>", "Query for clawhub search")
  .action(async (query, options) => {
    const registry = createRegistry(options);
    const result = await registry.search(query);
    process.stdout.write(`${result.stdout || result.stderr}\n`);
    process.exitCode = result.ok ? 0 : 1;
  }))
;

addClawhubOptions(
program
  .command("inspect")
  .argument("<slug>", "Skill slug")
  .action(async (slug, options) => {
    const registry = createRegistry(options);
    const result = await registry.inspect(slug);
    process.stdout.write(`${result.stdout || result.stderr}\n`);
    process.exitCode = result.ok ? 0 : 1;
  }))
;

addClawhubOptions(
program
  .command("validate-skill")
  .argument("<slug>", "Skill slug to probe without installing")
  .action(async (slug, options) => {
    const packService = createPackService(options);
    const result = await packService.validateSkill(slug);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.exists ? 0 : 1;
  }))
;

addClawhubOptions(
program
  .command("validate-pack")
  .argument("<packId>", "Pack id to validate against live registry")
  .action(async (packId, options) => {
    const packService = createPackService(options);
    const result = await packService.validatePack(packId);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.notFound.length === 0 ? 0 : 1;
  }))
;

addClawhubOptions(
program
  .command("install-pack")
  .argument("<packId>", "Curated pack id")
  .requiredOption("--targetDir <dir>", "Target directory for the curated pack install")
  .option("--dry-run", "Plan commands without writing files")
  .option("--patch-config", "Patch ~/.openclaw/openclaw.json with the pack skills dir")
  .option("--allow-suspicious", "Explicitly allow suspicious skills and pass --force to clawhub")
  .action(async (packId, options) => {
    const packService = createPackService(options);
    const state = await loadState(paths);
    const result = await packService.installPack(packId, state, {
      patchConfig: Boolean(options.patchConfig),
      targetDir: String(options.targetDir),
      dryRun: Boolean(options.dryRun),
      allowSuspicious: Boolean(options.allowSuspicious)
    });
    if (result.dryRun) {
      process.stdout.write(
        `${JSON.stringify(
          {
            plan: result.plan,
            commandPreview: result.commandPreview,
            reportPath: result.reportPath,
            installReport: result.installReport
          },
          null,
          2
        )}\n`
      );
      return;
    }
    if (options.allowSuspicious) {
      process.stdout.write("WARNING: allow-suspicious enabled; suspicious skills may be installed with --force.\n");
    }
    writeInstallResult(packService, result);
  }))
;

addClawhubOptions(
program
  .command("install-skill")
  .argument("<slug>", "Single skill slug for isolated install testing")
  .requiredOption("--targetDir <dir>", "Target directory for the isolated skill install")
  .option("--dry-run", "Plan commands without writing files")
  .option("--allow-suspicious", "Explicitly allow suspicious skills and pass --force to clawhub")
  .action(async (slug, options) => {
    const packService = createPackService(options);
    const state = await loadState(paths);
    const result = await packService.installSkill(slug, state, {
      targetDir: String(options.targetDir),
      dryRun: Boolean(options.dryRun),
      allowSuspicious: Boolean(options.allowSuspicious)
    });
    if (options.allowSuspicious) {
      process.stdout.write("WARNING: allow-suspicious enabled; suspicious skills may be installed with --force.\n");
    }
    writeInstallResult(packService, result);
  }))
;

addClawhubOptions(
program
  .command("update")
  .description("Update installed curated skills")
  .action(async (options) => {
    const packService = createPackService(options);
    const state = await loadState(paths);
    const result = await packService.updateInstalled(state);
    process.stdout.write(`Updated curated skills\n`);
    process.stdout.write(`Report: ${result.reportPath}\n`);
  }))
;

program
  .command("rollback")
  .argument("<snapshotId>", "Snapshot id to restore")
  .action(async (snapshotId) => {
    const state = await loadState(paths);
    const result = await rollbackService.rollback(snapshotId, state);
    process.stdout.write(`Rolled back snapshot ${result.snapshot.id}\n`);
    process.stdout.write(`Verify: ${JSON.stringify(result.verify, null, 2)}\n`);
    process.stdout.write(`Report: ${result.reportPath}\n`);
  });

program
  .command("patch-config")
  .argument("[dir]", "Directory to append into skills.load.extraDirs")
  .option("--extraDir <dir>", "Directory to append into skills.load.extraDirs")
  .option("--config <file>", "Patch a test config file instead of the default OpenClaw config")
  .option("--dry-run", "Preview config patch without writing")
  .action(async (dir, options) => {
    const state = await loadState(paths);
    const resolvedExtraDir =
      String(options.extraDir ?? dir ?? state.installedPacks.at(-1)?.skillsDir ?? "");
    if (!resolvedExtraDir) {
      throw new Error("No extraDir provided and no installed pack available to infer from.");
    }

    const patched = await configService.patchExtraDir(resolvedExtraDir, state, {
      dryRun: Boolean(options.dryRun),
      configPath: typeof options.config === "string" ? options.config : undefined
    });
    process.stdout.write(`${JSON.stringify(patched.result, null, 2)}\n`);
  });

program
  .command("verify-pack-layout")
  .argument("<dir>", "Installed pack directory to inspect")
  .option("--verbose", "Include .clawhub and per-skill file checks")
  .action(async (dir, options) => {
    const packService = createPackService({});
    const result = await packService.verifyPackLayout(String(dir), {
      verbose: Boolean(options.verbose)
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.ok ? 0 : 1;
  });

program.parseAsync(process.argv);
