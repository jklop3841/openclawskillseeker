import { app, BrowserWindow } from "electron";
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

  process.env.PORT = "47221";
  const webServerModule = await import(pathToFileURL(webServerEntry).href);
  if (typeof webServerModule.startWebServer === "function") {
    webServerModule.startWebServer();
  }
  webServerStarted = true;
}

async function createMainWindow() {
  await ensureWebServer();
  await waitForPort(47221);

  const window = new BrowserWindow(createWindowOptions(preloadPath, iconPath));
  await window.loadURL(webUrl);
}

app.whenReady().then(async () => {
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
