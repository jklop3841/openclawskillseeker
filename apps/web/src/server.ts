import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
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
} from "@openclaw-skill-center/core";

const app = express();
const port = Number(process.env.PORT ?? 47221);
const paths = getAppPaths();
const catalog = new CatalogService();

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

app.use(express.json());

app.get("/api/doctor", async (_req, res) => {
  const report = await doctor.run();
  res.json(report);
});

app.get("/api/catalog", (_req, res) => {
  res.json(catalog.listCatalog());
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "../client");

app.use(express.static(clientRoot));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientRoot, "index.html"));
});

app.listen(port, () => {
  process.stdout.write(`OpenClaw Skill Center web listening on http://localhost:${port}\n`);
});
