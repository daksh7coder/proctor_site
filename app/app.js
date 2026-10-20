
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "ProctorLite",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("http://localhost:5173");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("show-rules", async () => {
  return dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "ProctorLite Exam Rules",
    message: "Exam rules",
    detail:
      "1. Keep your camera enabled when required.\n" +
      "2. Share the screen you intend to use for the exam.\n" +
      "3. Follow your exam administrator's instructions.\n" +
      "4. Ask for help if a technical problem occurs.",
    buttons: ["Understood"],
  });
});

ipcMain.handle("select-folder", async () => {
  return dialog.showOpenDialog(mainWindow, {
    title: "Select a folder",
    properties: ["openDirectory"],
  });
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
