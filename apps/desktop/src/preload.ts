import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("openClawSkillCenter", {
  desktopShell: true
});
