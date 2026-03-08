import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createWindowOptions, resolveDesktopIcon, resolveWebServerEntry, resolveWebUrl } from "./window.js";

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const preloadPath = path.join(desktopDir, "preload.js");
const resourcesBase = app.isPackaged ? process.resourcesPath : desktopDir;
const webServerEntry = resolveWebServerEntry(resourcesBase, app.isPackaged);
const webUrl = resolveWebUrl();
const iconPath = resolveDesktopIcon(resourcesBase, app.isPackaged);

let webServerStarted = false;

function getLogPath() {
  const userDataDir = app.getPath("userData");
  const logsDir = path.join(userDataDir, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, "startup.log");
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim();
  }

  return String(error);
}

function logEvent(message: string, extra?: unknown) {
  try {
    const suffix = extra === undefined ? "" : ` ${typeof extra === "string" ? extra : JSON.stringify(extra)}`;
    fs.appendFileSync(getLogPath(), `[${new Date().toISOString()}] ${message}${suffix}\n`, "utf8");
  } catch {
    // Ignore logging failures to avoid masking startup errors.
  }
}

function installProcessLogging() {
  process.on("uncaughtException", (error) => {
    logEvent("uncaughtException", formatError(error));
    dialog.showErrorBox("OpenClaw Exoskeleton", `Main process crash.\n\nLog: ${getLogPath()}`);
  });

  process.on("unhandledRejection", (reason) => {
    logEvent("unhandledRejection", formatError(reason));
  });
}

function waitForPort(port: number, timeoutMs = 20000) {
  const start = Date.now();

  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.on("connect", () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for local server on port ${port}.`));
          return;
        }

        setTimeout(attempt, 250);
      });
    };

    attempt();
  });
}

async function ensureWebServer() {
  if (webServerStarted) {
    return;
  }

  logEvent("starting-web-server", { webServerEntry, resourcesBase, packaged: app.isPackaged });
  process.env.PORT = "47221";
  const webServerModule = await import(pathToFileURL(webServerEntry).href);
  if (typeof webServerModule.startWebServer !== "function") {
    throw new Error(`startWebServer export missing in ${webServerEntry}`);
  }
  webServerModule.startWebServer();
  webServerStarted = true;
  logEvent("web-server-started", { url: webUrl });
}

async function createMainWindow() {
  await ensureWebServer();
  await waitForPort(47221);
  logEvent("creating-main-window", { iconPath, preloadPath });

  const window = new BrowserWindow(createWindowOptions(preloadPath, iconPath));
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    logEvent("window-did-fail-load", { errorCode, errorDescription, validatedURL });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    logEvent("window-render-process-gone", details);
  });

  await window.loadURL(webUrl);
  logEvent("window-loaded", { url: webUrl });
}

installProcessLogging();

app.whenReady().then(async () => {
  logEvent("app-ready", { userData: app.getPath("userData") });
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  logEvent("window-all-closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});
