import path from "node:path";

export function resolveWebServerEntry(fromDir: string, packaged = false) {
  if (packaged) {
    return path.resolve(fromDir, "..", "web-dist", "server", "server.js");
  }

  return path.resolve(fromDir, "..", "..", "web", "dist", "server", "server.js");
}

export function resolveWebUrl(port = 47221) {
  return `http://127.0.0.1:${port}`;
}

export function resolveDesktopIcon(fromDir: string, packaged = false) {
  if (packaged) {
    return path.resolve(fromDir, "..", "assets", "app-icon.png");
  }

  return path.resolve(fromDir, "..", "assets", "app-icon.png");
}

export function createWindowOptions(preloadPath: string, iconPath: string) {
  return {
    width: 1360,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    title: "OpenClaw机械外骨骼",
    backgroundColor: "#08111d",
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  };
}
