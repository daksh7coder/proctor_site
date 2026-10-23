

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("proctor", {
  showRules: () => ipcRenderer.invoke("show-rules"),
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  enterFullscreen: () => ipcRenderer.invoke("enter-fullscreen"),
  exitFullscreen: () => ipcRenderer.invoke("exit-fullscreen"),

  saveScreenshot: (image) =>
    ipcRenderer.invoke("save-screenshot", image),
});
