import express from "express";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import {
  ActiveSkillService,
  AttachService,
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
} from "../../../packages/core/src/index.js";
import { SetupStatusSchema } from "../../../packages/shared/src/index.js";

function detectDefaultClawhubBin() {
  if (process.env.CLAWHUB_BIN) {
    return process.env.CLAWHUB_BIN;
  }

  if (process.platform === "win32") {
    const candidate = path.join(os.homedir(), "AppData", "Roaming", "npm", "clawhub.cmd");
    return fs.existsSync(candidate) ? candidate : undefined;
  }

  return undefined;
}

function detectClawXBinary() {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(os.homedir(), "AppData", "Local", "Programs", "ClawX", "ClawX.exe"),
          path.join(os.homedir(), "AppData", "Local", "Programs", "ClawX", "ClawX-Setup.exe"),
          path.join(process.env.LOCALAPPDATA ?? "", "Programs", "ClawX", "ClawX.exe")
        ]
      : [];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) ?? null;
}

function derivePlatformMode(doctorReport: Awaited<ReturnType<DoctorService["run"]>>) {
  if (doctorReport.isWsl || doctorReport.platform === "linux") {
    return "wsl" as const;
  }

  if (doctorReport.platform === "win32") {
    return "windows" as const;
  }

  return "unknown" as const;
}

function buildSetupStatus(doctorReport: Awaited<ReturnType<DoctorService["run"]>>) {
  const hasOpenClawConfig = doctorReport.checks.some((check) => check.name === "openclaw-config" && check.ok);
  const hasClawhub = doctorReport.clawhubFound;
  const hasClawX = Boolean(detectClawXBinary());
  const platformMode = derivePlatformMode(doctorReport);

  let status: "ready" | "needs attention" | "blocked" = "ready";
  let recommendation: "connect-existing" | "install-clawhub" | "install-openclaw" | "check-wsl-path" = "connect-existing";
  let title = "直接连接现有 OpenClaw";
  let summary = "已检测到可用环境，现在可以直接安装并接入精选技能。";
  let nextSteps = [
    "点击 Install and attach Calendar。",
    "完成后重启 OpenClaw。",
    "回到 OpenClaw 里测试 calendar skill。"
  ];

  if (!hasOpenClawConfig) {
    status = "blocked";
    recommendation = "install-openclaw";
    title = "先安装 OpenClaw / ClawX";
    summary = "系统还没有检测到可用的 OpenClaw 配置文件，建议先安装或启动一次底座。";
    nextSteps = [
      "如果你想用图形界面，可以先安装 ClawX。",
      "如果你想用官方底座，请按 OpenClaw 官方安装文档完成安装。",
      "安装或启动一次后，回到这里重新检测。"
    ];
  } else if (!hasClawhub) {
    status = "blocked";
    recommendation = "install-clawhub";
    title = "先修复技能安装器";
    summary = "系统已经检测到 OpenClaw，但没有找到 clawhub，所以暂时无法安装技能。";
    nextSteps = [
      "先安装官方 clawhub CLI。",
      "安装完成后点击 Retry environment check。",
      "然后再执行一键接入。"
    ];
  } else if (platformMode === "windows" && doctorReport.wslAvailable && !doctorReport.isWsl) {
    status = "needs attention";
    recommendation = "check-wsl-path";
    title = "确认你的底座运行位置";
    summary = "这台机器同时具备 Windows 和 WSL 环境。先确认 OpenClaw 跑在哪边，再继续接入。";
    nextSteps = [
      "如果 OpenClaw 跑在 Windows，继续当前模式即可。",
      "如果 OpenClaw 跑在 WSL，请优先使用 WSL 路径模式。",
      "确认后再开始一键接入。"
    ];
  } else if (hasClawX) {
    summary = "已检测到 OpenClaw/ClawX 环境，可以直接连接并接入精选技能。";
  }

  return SetupStatusSchema.parse({
    generatedAt: new Date().toISOString(),
    status,
    hasOpenClawConfig,
    hasClawhub,
    hasClawX,
    platformMode,
    recommendation,
    title,
    summary,
    nextSteps,
    detectedPaths: {
      openClawConfigPath: doctorReport.openClawConfigPath,
      openClawWorkspacePath: doctorReport.openClawWorkspacePath,
      clawhubBinary: doctorReport.clawhubBinary,
      clawxBinary: detectClawXBinary()
    },
    docs: {
      openClawInstallUrl: "https://docs.openclaw.ai/install/index",
      clawhubUrl: "https://docs.openclaw.ai/tools/clawhub",
      clawxUrl: "https://github.com/ValueCell-ai/ClawX"
    }
  });
}

export function createWebApp() {
  const app = express();
  const port = Number(process.env.PORT ?? 47221);
  const paths = getAppPaths();
  const catalog = new CatalogService();
  const registry = new RegistryAdapter(process.cwd(), {
    clawhubBin: detectDefaultClawhubBin()
  });
  const reports = new ReportService(paths);
  const snapshots = new SnapshotService(paths);
  const config = new ConfigService(paths, snapshots);
  const packs = new PackService(paths, registry, snapshots, reports, config);
  const rollback = new RollbackService(paths, reports);
  const doctor = new DoctorService(paths, {
    clawhubBin: detectDefaultClawhubBin()
  });
  const attach = new AttachService(paths, doctor, packs, config);
  const activeSkills = new ActiveSkillService(paths, config, packs);

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "openclaw-skill-center-web"
    });
  });

  app.get("/api/doctor", async (_req, res) => {
    const report = await doctor.run();
    res.json(report);
  });

  app.get("/api/setup/status", async (_req, res) => {
    try {
      const report = await doctor.run();
      res.json(buildSetupStatus(report));
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/catalog", (_req, res) => {
    res.json(catalog.listCatalog());
  });

  app.get("/api/library", (_req, res) => {
    res.json(activeSkills.listManagedLibrary());
  });

  app.get("/api/state", async (_req, res) => {
    res.json(await loadState(paths));
  });

  app.post("/api/attach/calendar", async (_req, res) => {
    try {
      const state = await loadState(paths);
      const result = await attach.attachCalendar(state);
      res.json(result.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/attach/demo-safe", async (_req, res) => {
    try {
      const state = await loadState(paths);
      const result = await attach.attachDemoSafe(state);
      res.json(result.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/library/skills/:slug/activate", async (req, res) => {
    try {
      const state = await loadState(paths);
      const result = await activeSkills.activateSkill(req.params.slug, state);
      res.json(result.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/library/packs/:packId/activate", async (req, res) => {
    try {
      const state = await loadState(paths);
      const result = await activeSkills.activatePack(req.params.packId, state);
      res.json(result.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/library/deactivate-all", async (_req, res) => {
    try {
      const state = await loadState(paths);
      const result = await activeSkills.deactivateAll(state);
      res.json(result.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/packs/:packId/install", async (req, res) => {
    try {
      const state = await loadState(paths);
      const result = await packs.installPack(req.params.packId, state, {
        patchConfig: Boolean(req.body?.patchConfig),
        targetDir: typeof req.body?.targetDir === "string" ? req.body.targetDir : undefined,
        dryRun: Boolean(req.body?.dryRun)
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/update", async (_req, res) => {
    try {
      const state = await loadState(paths);
      const result = await packs.updateInstalled(state);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/rollback", async (req, res) => {
    try {
      const state = await loadState(paths);
      const result = await rollback.rollback(String(req.body?.snapshotId ?? ""), state);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/config/patch", async (req, res) => {
    try {
      const state = await loadState(paths);
      const patched = await config.patchExtraDir(String(req.body?.extraDir ?? ""), state, {
        dryRun: Boolean(req.body?.dryRun)
      });
      res.json(patched.result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/paper/run", async (req, res) => {
    try {
      const sourceFiles = Array.isArray(req.body?.sourceFiles)
        ? req.body.sourceFiles.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const cluster = typeof req.body?.cluster === "string" && req.body.cluster.trim().length > 0 ? req.body.cluster.trim() : null;

      const args = ["scripts/paper_orchestrate.mjs"];
      if (cluster) {
        args.push("--cluster", cluster);
      }
      args.push(...sourceFiles);

      const stdout = await runLocalNode(args, process.cwd());
      const latest = await findLatestReport(path.join(process.cwd(), "reports", "orchestration"));
      const markdown = await fsp.readFile(latest.markdownPath, "utf8");
      const report = JSON.parse(await fsp.readFile(latest.jsonPath, "utf8"));

      res.json({
        ok: true,
        stdout,
        reportPath: path.relative(process.cwd(), latest.markdownPath).replaceAll("\\", "/"),
        markdown,
        report
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/paper/history", async (_req, res) => {
    try {
      const history = await listPaperHistory(path.join(process.cwd(), "reports", "orchestration"));
      res.json({ items: history });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/paper/history/:runId", async (req, res) => {
    try {
      const baseName = String(req.params.runId ?? "").replace(/[^a-zA-Z0-9._-]+/g, "");
      if (!baseName) {
        throw new Error("Invalid run id.");
      }
      const orchestrationDir = path.join(process.cwd(), "reports", "orchestration");
      const markdownPath = path.join(orchestrationDir, `${baseName}.md`);
      const jsonPath = path.join(orchestrationDir, `${baseName}.json`);
      const markdown = await fsp.readFile(markdownPath, "utf8");
      const report = JSON.parse(await fsp.readFile(jsonPath, "utf8"));
      res.json({ runId: baseName, markdown, report });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/paper/clusters", async (_req, res) => {
    try {
      const manifestPath = path.join(process.cwd(), "reports", "manifest", "paper_manifest.json");
      const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
      const clusters = summarizeClusters(Array.isArray(manifest.entries) ? manifest.entries : []);
      res.json({ items: clusters });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/paper/stage", async (req, res) => {
    try {
      const stage = typeof req.body?.stage === "string" ? req.body.stage : "";
      const sourceFiles = Array.isArray(req.body?.sourceFiles)
        ? req.body.sourceFiles.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const config = stageConfig(stage);
      const stdout = await runLocalNode([config.script, ...sourceFiles], process.cwd());
      const latest = await findLatestReport(path.join(process.cwd(), config.outputDir));
      const markdown = await fsp.readFile(latest.markdownPath, "utf8");
      const report = JSON.parse(await fsp.readFile(latest.jsonPath, "utf8"));
      res.json({
        ok: true,
        stage,
        stdout,
        reportPath: path.relative(process.cwd(), latest.markdownPath).replaceAll("\\", "/"),
        markdown,
        report
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const clientRootCandidates = [
    path.resolve(__dirname, "../client"),
    path.resolve(__dirname, "..", "..", "..", "..", "client"),
    path.resolve(resourcesPath ?? "", "web-dist", "client")
  ].filter(Boolean);
  const clientRoot =
    clientRootCandidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html"))) ??
    clientRootCandidates[0];

  app.use(express.static(clientRoot));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(clientRoot, "index.html"));
  });

  return { app, port };
}

let activeServer: Server | null = null;

export function startWebServer() {
  if (activeServer) {
    return activeServer;
  }

  const { app, port } = createWebApp();
  activeServer = app.listen(port, () => {
    process.stdout.write(`OpenClaw Skill Center web listening on http://localhost:${port}\n`);
  });
  return activeServer;
}

const isEntryPoint = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  startWebServer();
}

function runLocalNode(args: string[], cwd: string) {
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(process.execPath, args, { cwd });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `paper orchestration failed with code ${code ?? -1}`));
    });
  });
}

async function findLatestReport(orchestrationDir: string) {
  const entries = await fsp.readdir(orchestrationDir, { withFileTypes: true });
  const markdownFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"));
  if (markdownFiles.length === 0) {
    throw new Error("No orchestration report was generated.");
  }

  const ranked = await Promise.all(
    markdownFiles.map(async (entry) => {
      const markdownPath = path.join(orchestrationDir, entry.name);
      const stats = await fsp.stat(markdownPath);
      return { markdownPath, mtimeMs: stats.mtimeMs };
    })
  );
  ranked.sort((left, right) => right.mtimeMs - left.mtimeMs);

  const markdownPath = ranked[0].markdownPath;
  return {
    markdownPath,
    jsonPath: markdownPath.replace(/\.md$/i, ".json")
  };
}

async function listPaperHistory(orchestrationDir: string) {
  const entries = await fsp.readdir(orchestrationDir, { withFileTypes: true });
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  const items = await Promise.all(
    jsonFiles.map(async (entry) => {
      const jsonPath = path.join(orchestrationDir, entry.name);
      const report = JSON.parse(await fsp.readFile(jsonPath, "utf8"));
      const stats = await fsp.stat(jsonPath);
      return {
        runId: report.runId ?? entry.name.replace(/\.json$/i, ""),
        generatedAt: report.generatedAt ?? new Date(stats.mtimeMs).toISOString(),
        recommendedNextStage: report.recommendedNextStage ?? "unknown",
        scopeFiles: Array.isArray(report.scopeFiles) ? report.scopeFiles : [],
        reportPath: path.relative(process.cwd(), jsonPath).replaceAll("\\", "/")
      };
    })
  );

  return items.sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime());
}

function summarizeClusters(entries: Array<{ topicCluster?: string; sourceFiles?: string[]; stageGuess?: string }>) {
  const map = new Map<string, { topicCluster: string; fileCount: number; sampleFiles: string[]; files: string[]; stageGuess: string }>();

  for (const entry of entries) {
    const topicCluster = typeof entry.topicCluster === "string" && entry.topicCluster.length > 0 ? entry.topicCluster : "general";
    const current =
      map.get(topicCluster) ??
      {
        topicCluster,
        fileCount: 0,
        sampleFiles: [],
        files: [],
        stageGuess: typeof entry.stageGuess === "string" ? entry.stageGuess : "unknown"
      };

    const files = Array.isArray(entry.sourceFiles) ? entry.sourceFiles : [];
    current.fileCount += files.length;
    for (const file of files) {
      if (!current.files.includes(file)) {
        current.files.push(file);
      }
      if (current.sampleFiles.length >= 3) {
        break;
      }
      if (!current.sampleFiles.includes(file)) {
        current.sampleFiles.push(file);
      }
    }
    if (current.stageGuess === "unknown" && typeof entry.stageGuess === "string") {
      current.stageGuess = entry.stageGuess;
    }
    map.set(topicCluster, current);
  }

  return [...map.values()].sort((left, right) => right.fileCount - left.fileCount);
}

function stageConfig(stage: string) {
  switch (stage) {
    case "problem_anchor":
      return { script: "scripts/generate_paper_problem_anchor.mjs", outputDir: "reports/problem-anchor" };
    case "litmap":
      return { script: "scripts/generate_paper_litmap.mjs", outputDir: "reports/litmap" };
    case "experiment":
      return { script: "scripts/generate_paper_experiment.mjs", outputDir: "reports/experiments" };
    default:
      throw new Error(`Unsupported stage: ${stage}`);
  }
}
