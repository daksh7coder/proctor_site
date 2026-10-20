
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("proctor", {
  showRules: () => ipcRenderer.invoke("show-rules"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
});
