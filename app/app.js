
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  desktopCapturer,
  session,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let selectedFolderPath = null;

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

// Exam rules dialog
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

// Select screenshot destination
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose screenshot folder",
    properties: ["openDirectory", "createDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    selectedFolderPath = result.filePaths[0];
  }

  return result;
});

// Fullscreen exam controls
ipcMain.handle("enter-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(true);
  }
});

ipcMain.handle("exit-fullscreen", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(false);
  }
});

// Save a camera or screen screenshot
ipcMain.handle("save-screenshot", async (_event, image) => {
  if (
    !image ||
    !["camera", "screen"].includes(image.type) ||
    typeof image.dataUrl !== "string" ||
    !image.dataUrl.startsWith("data:image/png;base64,")
  ) {
    throw new Error("Invalid screenshot data.");
  }

  const baseFolder =
    selectedFolderPath ||
    path.join(app.getPath("pictures"), "ProctorLite");

  const folderName =
    image.type === "camera"
      ? "user-camera-snap"
      : "user-screen-snap";

  const folderPath = path.join(baseFolder, folderName);

  await mkdir(folderPath, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const filename = `${image.type}-${timestamp}.png`;
  const imageBase64 = image.dataUrl.split(",")[1];

  await writeFile(
    path.join(folderPath, filename),
    Buffer.from(imageBase64, "base64")
  );

  return { success: true, filename };
});

// Configure screen sharing
app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
        });

        if (sources.length === 0) {
          callback({});
          return;
        }

        const buttons = [
          ...sources.map((source) => source.name),
          "Cancel",
        ];

        const result = await dialog.showMessageBox(mainWindow, {
          type: "question",
          title: "Choose what to share",
          message: "Select a screen or window to share",
          buttons,
          cancelId: buttons.length - 1,
        });

        if (
          result.response >= 0 &&
          result.response < sources.length
        ) {
          callback({
            video: sources[result.response],
          });
        } else {
          callback({});
        }
      } catch (error) {
        console.error("Screen capture error:", error);
        callback({});
      }
    }
  );

  createWindow();
});

// Quit on closing all windows
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Reopen the window on macOS
app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
