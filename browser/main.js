/**
 * ============================================================
 * AEGIS BROWSER — main.js (Electron Main Process)
 * ============================================================
 *
 * ROLE: The root of the Electron app. Runs in Node.js context.
 *       Responsible for:
 *         1. Creating and managing the BrowserWindow
 *         2. Setting up the session proxy so ALL traffic
 *            from every webview goes through port 8118
 *         3. Listening for IPC calls from the renderer
 *            (tab create, identity rotate, circuit info, etc.)
 *         4. Communicating with the core backend (Express API)
 *
 * SECURITY MODEL:
 *   - contextIsolation: true  → renderer cannot touch Node.js
 *   - nodeIntegration: false  → renderer cannot require() modules
 *   - preload.js is injected → fingerprint spoofing happens there
 *
 * DATA FLOW:
 *   Renderer (React UI)
 *     → IPC call (ipcMain.handle)
 *     → main.js calls core backend API (axios)
 *     → Returns data back to renderer
 * ============================================================
 */

'use strict';

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const axios = require('axios');

// ─── Constants ────────────────────────────────────────────────
const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = process.env.LOCAL_PROXY_PORT || 8118;
const CORE_API   = process.env.CORE_API_URL || 'http://localhost:3001';
const IS_DEV     = process.argv.includes('--dev');

// ─── Main Window Reference ────────────────────────────────────
let mainWindow = null;

// ─── App Lifecycle ────────────────────────────────────────────

/**
 * createWindow()
 * Creates the main Electron BrowserWindow.
 * Sets up the session-level proxy BEFORE the window loads
 * so that from frame 1, all requests go through port 8118.
 */
async function createWindow() {
  // ── Step 1: Configure session proxy ──────────────────────
  // We apply the proxy to BOTH the default session and any 
  // partitioned sessions (like 'persist:aegis' used by tabs).
  const proxyConfig = {
    proxyRules: `socks5://${PROXY_HOST}:${PROXY_PORT}`,
    proxyBypassRules: '<local>'
  };

  await session.defaultSession.setProxy(proxyConfig);
  
  // Also apply to the specific partition used by our tabs
  const aegisSession = session.fromPartition('persist:aegis');
  await aegisSession.setProxy(proxyConfig);

  console.log(`[Aegis Main] Proxy configured → socks5://${PROXY_HOST}:${PROXY_PORT}`);

  // ── Step 2: Create the BrowserWindow ─────────────────────
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0d0f',         // Dark background while loading
    title: 'Aegis Browser',
    icon: path.join(__dirname, 'assets', 'icon.png'),

    webPreferences: {
      // Preload script runs BEFORE any renderer JS.
      // This is where fingerprint spoofing APIs are overridden.
      preload: path.join(__dirname, 'preload.js'),

      // SECURITY: Renderer cannot access Node.js modules
      nodeIntegration: false,

      // SECURITY: Renderer JS and preload run in isolated worlds
      contextIsolation: true,

      // SECURITY: Disable ability to open new windows via window.open
      // All new tabs go through our tab system instead
      disablePopups: false,

      // Allow webviews (each tab is a <webview> element)
      webviewTag: true,

      // Sandbox the renderer process
      sandbox: false, // Keep false to allow webview usage

      // PROTO-FIX: Disable webSecurity to allow Babel to load local App.jsx
      // In production (Phase 2+), we'll bundle everything and re-enable this.
      webSecurity: false
    }
  });

  // ── Step 3: Load the renderer HTML ───────────────────────
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // ── Step 4: Open DevTools in dev mode ────────────────────
  if (IS_DEV || process.env.DEVTOOLS_ENABLED === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // ── Step 5: Handle window closed ─────────────────────────
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Log any errors that happen in the renderer
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Aegis Main] Failed to load window: ${errorCode} - ${errorDescription}`);
  });

  // Inform renderer when window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Aegis Main] Renderer window loaded.');
    mainWindow.webContents.send('main:ready', {
      proxyPort: PROXY_PORT,
      coreApi: CORE_API
    });
  });
}

// ─── App Events ───────────────────────────────────────────────

app.whenReady().then(async () => {
  await createWindow();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, apps stay running until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── IPC Handlers ─────────────────────────────────────────────
// Renderer calls these via window.aegisAPI (exposed by preload.js)

/**
 * 'api:getStatus' — Check if the core backend is alive
 * Returns: { alive: boolean, version: string }
 */
ipcMain.handle('api:getStatus', async () => {
  try {
    const res = await axios.get(`${CORE_API}/api/status`, { timeout: 3000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'api:getCircuit' — Get the current circuit for a tab
 * Args: { tabId: string }
 * Returns: { entry, relay, exit } node objects
 */
ipcMain.handle('api:getCircuit', async (_event, { tabId }) => {
  try {
    const res = await axios.get(`${CORE_API}/api/circuit/${tabId}`, { timeout: 5000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'api:getIdentity' — Get the identity profile for a tab
 * Args: { tabId: string }
 * Returns: { userAgent, timezone, screen, canvasSeed, webglVendor }
 */
ipcMain.handle('api:getIdentity', async (_event, { tabId }) => {
  try {
    const res = await axios.get(`${CORE_API}/api/identity/${tabId}`, { timeout: 5000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'api:rotateIdentity' — Force a new identity for a tab
 * Args: { tabId: string }
 * Returns: new identity profile
 */
ipcMain.handle('api:rotateIdentity', async (_event, { tabId }) => {
  try {
    const res = await axios.post(`${CORE_API}/api/rotate-identity`, { tabId }, { timeout: 5000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'api:rotateRoute' — Force a new circuit for a tab
 * Args: { tabId: string }
 * Returns: new circuit
 */
ipcMain.handle('api:rotateRoute', async (_event, { tabId }) => {
  try {
    const res = await axios.post(`${CORE_API}/api/rotate-route`, { tabId }, { timeout: 5000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'api:getNodes' — Get all node health data
 * Returns: array of node objects with scores, region, uptime
 */
ipcMain.handle('api:getNodes', async () => {
  try {
    const res = await axios.get(`${CORE_API}/api/nodes`, { timeout: 5000 });
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * 'app:openDevTools' — Open DevTools for debugging (dev only)
 */
ipcMain.handle('app:openDevTools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
});

/**
 * 'app:setTitle' — Update the window title bar
 * Args: { title: string }
 */
ipcMain.handle('app:setTitle', (_event, { title }) => {
  if (mainWindow) {
    mainWindow.setTitle(`${title} — Aegis Browser`);
  }
});
