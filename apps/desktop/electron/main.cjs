const { app, BrowserWindow, dialog, shell, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { fork } = require("node:child_process");

const isDevelopment = Boolean(process.env.DIRA_DESKTOP_URL || process.env.BIZPRO_DESKTOP_URL);
let nextServer;

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (remaining <= 0) reject(new Error(`Dira OS renderer did not start at ${url}`));
        else setTimeout(() => check(remaining - 1), 250);
      });
    };
    check(attempts);
  });
}

function resolveStandaloneServer() {
  const appRoot = path.join(__dirname, "..");
  const unpackedRoot = appRoot.replace(`${path.sep}app.asar`, `${path.sep}app.asar.unpacked`);
  const candidates = [
    path.join(unpackedRoot, ".next", "standalone", "apps", "desktop", "server.js"),
    path.join(unpackedRoot, ".next", "standalone", "server.js"),
    path.join(appRoot, ".next", "standalone", "apps", "desktop", "server.js"),
    path.join(appRoot, ".next", "standalone", "server.js")
  ];
  const serverPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!serverPath) {
    throw new Error("Could not locate the Dira OS desktop renderer server.");
  }
  return serverPath;
}

async function startProductionServer() {
  const serverPath = resolveStandaloneServer();
  const port = Number(process.env.DIRA_DESKTOP_PORT) || 4317 + (process.pid % 1000);
  nextServer = fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1"
    },
    stdio: "ignore"
  });
  const url = `http://127.0.0.1:${port}`;
  await Promise.race([
    waitForServer(url, 120),
    new Promise((_, reject) => {
      nextServer.once("error", reject);
      nextServer.once("exit", (code, signal) => reject(new Error(`Dira OS renderer exited before startup (${code ?? signal}).`)));
    })
  ]);
  return url;
}

async function createWindow() {
  const iconPath = path.join(__dirname, "..", "resources", "icon.ico");
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0d1420",
    title: "Dira OS",
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("did-fail-load", (_event, _errorCode, errorDescription) => {
    dialog.showErrorBox("Dira OS could not open", errorDescription);
  });
  await window.loadURL(isDevelopment ? process.env.DIRA_DESKTOP_URL || process.env.BIZPRO_DESKTOP_URL : await startProductionServer());
}

app.whenReady().then(async () => {
  app.setName("Dira OS");
  if (process.platform === "win32") {
    app.setAppUserModelId("com.diraos.desktop");
  }
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "notifications");
  });
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((error) => {
  dialog.showErrorBox("Dira OS could not open", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

app.on("before-quit", () => { if (nextServer) nextServer.kill(); });
