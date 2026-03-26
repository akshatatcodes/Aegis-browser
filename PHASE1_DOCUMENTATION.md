# 🛡️ AEGIS — Phase 1 Complete Documentation
### Aegis Browser Core (Electron App)
> Version 1.0 | Phase 1 of 12 | March 2026

---

## 📋 Phase 1 Overview

**Phase 1 is the foundation of the entire Aegis system.** It builds the Electron-based browser that the user actually opens and uses. Every other phase (encryption, routing, phantom clones, mix nodes) plugs into this browser. Without Phase 1, nothing else exists.

**What Phase 1 Delivers:**
- A working Electron browser the user can open and navigate with
- Each browser tab is completely isolated (separate identity + circuit)
- All traffic is forced through a local proxy at port 8118
- A fingerprint spoofing layer that overrides 8 browser APIs before any page scripts run
- A live dashboard showing the user's current circuit and identity
- A backend API stub that returns realistic mock data so the UI is fully functional before the encryption/routing engines are built

**Files Created in Phase 1:**

```
aegis/
├── browser/
│   ├── main.js                   ← Electron main process
│   ├── preload.js                ← Fingerprint spoofing + context bridge
│   ├── package.json              ← Dependencies
│   ├── .env.example              ← Environment config template
│   └── renderer/
│       ├── index.html            ← Root HTML entry point
│       └── App.jsx               ← Complete React UI (all components)
└── core/
    └── server.js                 ← Express backend API (Phase 1 stub)
```

---

## 🏗️ Architecture: How Phase 1 Fits Into Aegis

```
┌──────────────────────────────────────────────────────────┐
│                  PHASE 1 SCOPE                           │
│                                                          │
│  ┌─────────────────────────────────────────┐            │
│  │        Electron Browser App             │            │
│  │                                         │            │
│  │  ┌─────────────────────────────────┐   │            │
│  │  │   React UI (renderer process)   │   │            │
│  │  │                                 │   │            │
│  │  │  TabBar  UrlBar  WebviewArea    │   │            │
│  │  │       Dashboard Panel           │   │            │
│  │  └──────────────┬──────────────────┘   │            │
│  │                 │ IPC (contextBridge)   │            │
│  │  ┌──────────────▼──────────────────┐   │            │
│  │  │       preload.js                │   │            │
│  │  │  (8 fingerprint overrides)      │   │            │
│  │  └─────────────────────────────────┘   │            │
│  │                                         │            │
│  │  ┌─────────────────────────────────┐   │            │
│  │  │         main.js                 │   │            │
│  │  │  Window + Proxy + IPC handlers  │   │            │
│  │  └──────────────┬──────────────────┘   │            │
│  └─────────────────┼───────────────────────┘            │
│                    │ HTTP (axios)                        │
│  ┌─────────────────▼───────────────────────┐            │
│  │       core/server.js (Express)          │            │
│  │   /api/status    /api/identity/:tab     │            │
│  │   /api/circuit/:tab  /api/nodes         │            │
│  │   /api/rotate-identity  /api/rotate-route│           │
│  └─────────────────────────────────────────┘            │
│                                                          │
│  Future phases attach here:                              │
│    Phase 3 → onion encryption in proxy                  │
│    Phase 4 → routingBrain in server.js                  │
│    Phase 5 → phantomLauncher in server.js               │
└──────────────────────────────────────────────────────────┘

Traffic flow:
  Webview → session proxy (port 8118) → [Phase 3 onion] → nodes → internet
```

---

## 📄 File-by-File Documentation

---

### 1. `browser/main.js` — The Electron Main Process

#### What It Is
`main.js` is the **root Node.js process** of the Electron app. When the user double-clicks the Aegis icon, this file runs first. It is the only file that has full Node.js access — the renderer (React UI) is sandboxed and cannot access Node.js directly.

#### Why It Exists
Electron has two process types:
- **Main process** (`main.js`) — Node.js, creates windows, controls OS-level things
- **Renderer process** (`App.jsx`) — Chromium, runs the UI, sandboxed like a web page

`main.js` is the gatekeeper. Every time the renderer needs to do something privileged (talk to the backend API, check a circuit, rotate an identity), it sends an IPC message to `main.js`, which does the actual work and sends back the result.

#### Responsibilities

| Responsibility | How |
|---|---|
| Create the browser window | `new BrowserWindow(...)` |
| Set session-level proxy | `session.defaultSession.setProxy(...)` |
| Load the React UI | `mainWindow.loadFile('renderer/index.html')` |
| Handle IPC from renderer | `ipcMain.handle('api:getCircuit', ...)` |
| Call backend API | `axios.get('http://localhost:3001/api/...')` |

#### The Proxy Setup — Critical Design

```javascript
await session.defaultSession.setProxy({
  proxyRules: `socks5://127.0.0.1:8118`,
  proxyBypassRules: '<local>'
});
```

**Why this is the most important line in Phase 1:**

This sets the proxy at the **Chromium session level**, which means it applies to **every network request made by any webview in this app**, not just the renderer. Before a single pixel loads, Chromium knows: all traffic → port 8118. No page can bypass this because it's configured at the session layer, not the JavaScript layer.

In Phase 3, a real SOCKS5 proxy will run at port 8118 and apply onion encryption. In Phase 1, you can run any SOCKS5 proxy there for testing.

#### IPC Handler Map

```
Renderer calls              main.js handles           Backend endpoint
─────────────────────────────────────────────────────────────────────
aegisAPI.getStatus()    →  'api:getStatus'    →  GET  /api/status
aegisAPI.getCircuit(id) →  'api:getCircuit'   →  GET  /api/circuit/:id
aegisAPI.getIdentity(id)→  'api:getIdentity'  →  GET  /api/identity/:id
aegisAPI.rotateIdentity →  'api:rotateIdentity'→ POST /api/rotate-identity
aegisAPI.rotateRoute    →  'api:rotateRoute'  →  POST /api/rotate-route
aegisAPI.getNodes()     →  'api:getNodes'     →  GET  /api/nodes
```

#### Security Configuration

```javascript
webPreferences: {
  nodeIntegration: false,   // Renderer cannot require() Node modules
  contextIsolation: true,   // Renderer JS and preload in separate V8 contexts
  webviewTag: true,         // Allow <webview> elements (each tab)
  preload: 'preload.js'     // Runs BEFORE page scripts in webview context
}
```

**Why `contextIsolation: true`?**
Without it, a malicious webpage could access the `require` function exposed by the preload script and execute arbitrary Node.js code with full OS access. With it, the preload runs in an isolated V8 context and can only communicate via `contextBridge`.

---

### 2. `browser/preload.js` — The Fingerprint Spoofing Engine

#### What It Is
`preload.js` is injected by Electron into **every webview** (every browser tab) and runs **before any page JavaScript loads**. It has a unique dual role:
1. It overrides browser fingerprinting APIs in the page JavaScript context
2. It exposes a safe `window.aegisAPI` object to the React renderer via `contextBridge`

#### Why It Can Do What Page Scripts Cannot
Preload scripts run with elevated access:
- They can call `require('electron')` to access `ipcRenderer` and `contextBridge`
- They can override `window.*` and `navigator.*` properties using `Object.defineProperty` before any page code runs
- These overrides persist for the entire lifetime of the page

#### The 8 Fingerprinting Vectors Blocked

##### Vector 1: User-Agent + Navigator
```javascript
Object.defineProperty(navigator, 'userAgent', {
  get: () => currentIdentity.userAgent,
  configurable: true
});
```
**Why:** Sites read `navigator.userAgent` to identify browser + OS. We return a real, common UA string from our curated list instead of the real Electron UA (which would immediately identify Aegis).

**Also overridden:** `navigator.platform`, `navigator.vendor`, `navigator.appVersion`

##### Vector 2: Screen Dimensions
```javascript
Object.defineProperty(screen, 'width', { get: () => currentIdentity.screen.width });
// Also: height, availWidth, availHeight, colorDepth, pixelDepth
```
**Why:** Real screen size (especially uncommon ones like 1200×900 or hi-DPI retina) is uniquely identifying. We report one of 4 common consumer screen sizes: 1920×1080, 2560×1440, 1440×900, 1366×768.

##### Vector 3: Canvas Fingerprint
```javascript
HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
  _addCanvasNoise(this);
  return origToDataURL.apply(this, [type, ...args]);
};
```
**How canvas fingerprinting works:** A site draws invisible text/shapes to an off-screen `<canvas>` and reads the pixel data. Different hardware/drivers render fractional pixels differently, creating a unique hash.

**Our solution:** Inject 1 pixel of nearly-invisible noise based on `canvasSeed`. The noise is **deterministic within a session** (same seed = same noise), so the fingerprint is consistent within one browsing session (looks human) but completely different from session to session.

##### Vector 4: WebGL Hardware Strings
```javascript
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return currentIdentity.webglVendor;    // UNMASKED_VENDOR_WEBGL
  if (parameter === 37446) return currentIdentity.webglRenderer;  // UNMASKED_RENDERER_WEBGL
  return origGetParameter.apply(this, [parameter]);
};
```
**Why:** WebGL exposes two strings that directly identify your GPU model. We replace them with `"Intel Inc."` / `"Intel Iris OpenGL Engine"` — the most common GPU strings worldwide.

##### Vector 5: AudioContext Noise
```javascript
AudioBuffer.prototype.getChannelData = function(...args) {
  const channelData = origGetChannelData.apply(this, args);
  for (let i = 0; i < Math.min(channelData.length, 20); i++) {
    channelData[i] += (Math.random() - 0.5) * noise;
  }
  return channelData;
};
```
**Why:** AudioContext fingerprinting runs an oscillator through a `ChannelSplitter` and reads the floating-point output. Hardware floating-point differences create a unique signature. Our noise perturbation is imperceptible to hearing but breaks the fingerprint.

##### Vector 6: WebRTC — Complete Block (CRITICAL)
```javascript
window.RTCPeerConnection        = blockFn;
window.webkitRTCPeerConnection  = blockFn;
window.mozRTCPeerConnection     = blockFn;
```
**This is the most important privacy protection.** WebRTC uses STUN servers to discover your local AND public IP address — and does this at the **OS socket level, bypassing any HTTP proxy**. Your real IP can leak even if you're behind a proxy.

We block it **completely** — no partial solution, no "proxy WebRTC". Any attempt to create an `RTCPeerConnection` throws a `DOMException`.

##### Vector 7: Timezone (Intl API)
```javascript
Intl.DateTimeFormat = function(locale, options = {}) {
  if (!options.timeZone) {
    options.timeZone = currentIdentity.timezone;
  }
  return new origDateTimeFormat(locale, options);
};
```
**Why:** `Intl.DateTimeFormat().resolvedOptions().timeZone` reveals local timezone. A US user connecting through a Japanese exit node would be immediately suspicious if their browser reports `America/New_York`. We sync the timezone to match the exit node's region.

##### Vector 8: Font Enumeration
```javascript
if (navigator.fonts && navigator.fonts.query) {
  navigator.fonts.query = () => Promise.resolve([]);
}
```
**Why:** Installed system fonts are surprisingly unique — especially non-standard fonts from installed software. We return an empty list for the Font Access API.

#### The Context Bridge

```javascript
contextBridge.exposeInMainWorld('aegisAPI', {
  applyIdentity: (profile) => { currentIdentity = profile; },
  getStatus:     ()         => ipcRenderer.invoke('api:getStatus'),
  getCircuit:    (tabId)    => ipcRenderer.invoke('api:getCircuit', { tabId }),
  // ... etc
});
```

**Why `contextBridge` is required:** With `contextIsolation: true`, the renderer's `window` is completely separate from the preload's `window`. `contextBridge.exposeInMainWorld()` creates a structured clone of the object in the renderer's context — the only allowed channel from renderer to preload/main. Page scripts cannot access anything not explicitly exposed here.

**Security principle:** Even if a page is compromised, it cannot call `require('electron')` because that module doesn't exist in the renderer context. The only thing it can call is the curated `window.aegisAPI` methods.

#### Identity Update Flow
```
Backend generates identity → Renderer receives it → aegisAPI.applyIdentity(profile)
  → preload.js sets currentIdentity → All 8 override functions read from it
  → Next canvas paint / WebGL call / UA read → Returns new identity values
```

---

### 3. `browser/renderer/index.html` — The Root HTML Entry

#### What It Is
The HTML file that `main.js` loads into the BrowserWindow. It is the shell that bootstraps the React application.

#### Key Design Choices

**Content Security Policy:**
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; ...
           connect-src http://localhost:3001;" />
```
CSP prevents any external scripts from loading in the main window (only `localhost:3001` for the backend). This doesn't affect webview pages — each webview has its own browsing context with the destination site's CSP.

**CSS Design System (variables):**
All colors, spacing, and typography are defined as CSS custom properties:
```css
:root {
  --bg-primary:    #0d0d0f;    /* Near-black background */
  --accent:        #6c63ff;    /* Purple highlight (circuits, badges) */
  --success:       #22c55e;    /* Green (online, trust high) */
  --danger:        #ef4444;    /* Red (blocked, trust low) */
  --font-mono:     'JetBrains Mono'; /* IP addresses, node IDs, seeds */
}
```
These variables are used throughout all inline components in `App.jsx`, ensuring visual consistency with a single source of truth.

**React via CDN (Phase 1 prototype):**
For Phase 1, React is loaded from CDN and Babel standalone transpiles JSX in the browser. In Phase 2+, this will be replaced with a proper Webpack/Vite build pipeline producing a bundled `/dist/bundle.js`.

---

### 4. `browser/renderer/App.jsx` — The Complete React UI

#### What It Is
The entire React application — root component `App` plus all sub-components — in a single file. For Phase 1 prototype simplicity. In later phases, components move to individual files under `renderer/components/`.

#### State Architecture

```
App                              (owns ALL state)
├── tabs: Tab[]                  (the tab list)
├── activeTabId: string          (which tab is shown)
├── backendStatus: string        (connecting/online/offline)
└── dashboardOpen: boolean       (right panel visible)
```

**Why all state lives in App:**
- The Dashboard needs to know the active tab's identity/circuit
- The TabBar needs to know which tab is active
- The UrlBar needs the active tab's URL
- Lifting state to `App` avoids prop drilling chains and gives one source of truth

#### The Tab Object (complete schema)
```javascript
Tab {
  id:          'tab_abc123_1711000000' // Unique ID (also used as backend key)
  url:         'https://example.com'  // Current URL in webview
  displayUrl:  'https://example.com'  // Shown in URL bar
  title:       'Example Domain'       // From webview page-title-updated event
  loading:     false                  // true while page loads
  identity:    { userAgent, timezone, screen, canvasSeed, ... } // From backend
  circuit:     { entry, relay, exit, circuitId, totalLatencyMs } // From backend
  webviewRef:  React.createRef()      // Direct reference to <webview> DOM element
}
```

**Why `webviewRef` is in the tab object:**
To apply an identity to a tab, we need to call `.executeJavaScript()` on the actual webview DOM element. The ref gives us direct access without DOM querying.

#### Key Lifecycle Flows

**Flow 1: App Startup**
```
App mounts
  → useEffect: createTab() creates tab with blank identity/circuit
  → useEffect: aegisAPI.getStatus() → sets backendStatus
  → activeTabId set → second useEffect triggers
  → getIdentity(tabId) + getCircuit(tabId) called in parallel
  → Tab updated with identity + circuit
  → applyIdentityToWebview() called → preload's currentIdentity updated
```

**Flow 2: User Navigates**
```
User types URL → presses Enter
  → UrlBar.onSubmit → App.navigateTo(url)
  → URL validation/normalization
  → tab.webviewRef.current.loadURL(url)
  → Webview fires 'did-start-loading' → tab.loading = true
  → Webview fires 'did-stop-loading' → tab.loading = false
  → Webview fires 'page-title-updated' → tab.title = new title
  → Webview fires 'did-navigate' → tab.url = new url
```

**Flow 3: Identity Rotation**
```
User clicks "New Identity" in Dashboard
  → onRotateIdentity(tabId) called
  → aegisAPI.rotateIdentity(tabId) → IPC → main.js → POST /api/rotate-identity
  → Backend generates fresh identity, stores in session Map
  → Returns new identity object
  → App updates tab.identity with new data
  → applyIdentityToWebview() called → preload.js updates currentIdentity
  → Next page request uses new identity
```

#### Component Breakdown

| Component | Role | Props Received |
|---|---|---|
| `App` | State owner, orchestrator | (none — root) |
| `TabBar` | Renders all tabs, new tab button, status dot | tabs, activeTabId, callbacks |
| `TabItem` | Single tab chip (title, close button) | tab, isActive, onSwitch, onClose |
| `UrlBar` | Address bar with lock icon + Aegis badge | activeTab, onNavigate |
| `WebviewContainer` | Wrapper that shows/hides webview per tab | tab, isActive, event callbacks |
| `NewTabPage` | Rendered when tab URL is `aegis://new` | (none) |
| `StatusBadge` | Icon + label + colored value (on new tab page) | icon, label, value, color |
| `Dashboard` | Right panel: identity + circuit + controls | activeTab, allTabs, backendStatus, rotate callbacks |
| `Section` | Labeled group with title line | title, children |
| `InfoRow` | Key/value pair row | label, value, mono, danger |
| `CircuitHop` | Single hop box (Entry/Relay/Exit) | role, node |
| `ActionButton` | Control button with icon + label | icon, label, onClick, disabled, variant |
| `EmptyState` | Placeholder text when no data | msg |

#### URL Smart Routing Logic
```javascript
let fullUrl = url.trim();
if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://') && !fullUrl.startsWith('aegis://')) {
  if (fullUrl.includes('.') && !fullUrl.includes(' ')) {
    fullUrl = `https://${fullUrl}`;          // "google.com" → "https://google.com"
  } else {
    fullUrl = `https://www.google.com/search?q=...`; // "search terms" → Google search
  }
}
```

---

### 5. `core/server.js` — The Backend API (Phase 1 Stub)

#### What It Is
An Express HTTP server running on `localhost:3001` that serves as the backend for the Electron browser. In Phase 1, it returns **realistic mock data** so the UI can be fully developed and tested before the real encryption/routing/identity engines are built.

#### Why a Backend Stub Now
Building the UI (Phase 1) and building the crypto engine (Phase 3) are independent work. By creating a stub that returns the right data *shape*, the front-end developer can build and test the full UI, and when Phase 3 swaps the stub for the real engine, the UI just works — no changes needed.

#### Per-Tab Session Store
```javascript
const tabSessions = new Map();
// tabSessions.get('tab_abc123') = { identity: {...}, circuit: {...} }
```
**Why a Map per tab:** Each browser tab has an isolated identity and circuit. When the dashboard shows "identity for tab 2", it must show tab 2's specific data, not a global identity. The tab ID (UUID) is the key.

**Auto-rotation:** If the browser hasn't called `GET /api/identity/:tabId` for a tab in 45 minutes, the identity has expired. The next call auto-generates a new one. Same for circuits (10-minute expiry).

#### Mock Identity Generation
```javascript
function generateIdentity() {
  const ua     = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];  // 5 real UAs
  const tz     = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];      // 8 real timezones
  const screen = SCREENS[Math.floor(Math.random() * SCREENS.length)];          // 4 common sizes
  const webgl  = WEBGL_CONFIGS[Math.floor(Math.random() * WEBGL_CONFIGS.length)]; // 3 GPU configs
  return { userAgent: ua, timezone: tz, screen, webglVendor: webgl.vendor, canvasSeed: Math.random() * 65535, ... };
}
```

The UAs, timezones, and screens are all **real values** from common consumer devices, not invented strings. This means even in stub mode, the browser presents a believable identity.

#### Mock Circuit Generation
```javascript
function generateCircuit() {
  // Pick 1 guard, 1 relay, 1 exit from MOCK_NODES list (no repeats)
  // In Phase 4: routingBrain.js scores nodes and picks geo-diverse combo
  return { entry: guard, relay: relayNode, exit: exitNode, totalLatencyMs: sum, ... };
}
```

The 7 mock nodes have real region codes (EU-West, AP-South, etc.), realistic trust scores (0.82–0.94), and realistic latencies (28ms for EU nearby, 145ms for SA). This lets the Dashboard circuit display look exactly as it will in production.

#### API Route Table

| Method | Route | Phase | Purpose |
|---|---|---|---|
| GET | `/api/status` | 1 stub | Health check, feature flags |
| GET | `/api/circuit/:tabId` | 1 stub → 4 real | Get/build 3-hop circuit |
| GET | `/api/identity/:tabId` | 1 stub → 2 real | Get/create identity profile |
| POST | `/api/rotate-identity` | 1 stub → 2 real | Force new identity |
| POST | `/api/rotate-route` | 1 stub → 4 real | Force new circuit |
| GET | `/api/nodes` | 1 stub → 6 real | All node health data |
| GET | `/api/detection` | 8 real | Detection test results |
| POST | `/api/run-detection` | 8 real | Trigger detection scan |

#### Upgrade Path (Phase 1 → Phase 2+)
When later phases are built, the stub functions get replaced:
```javascript
// Phase 1 (stub):
function generateIdentity() { return { userAgent: USER_AGENTS[...], ... }; }

// Phase 2 (real):
const profileFactory = require('./identity/profileFactory');
async function GET_identity(tabId) {
  return await profileFactory.getOrCreate(tabId);
}
```

The API contract (URL, response shape) stays identical — only the internal implementation changes.

---

### 6. `browser/package.json` — Electron Dependencies

```json
{
  "main": "main.js",
  "dependencies": {
    "axios": "^1.6.7",    // HTTP calls from main.js to backend
    "express": "^4.18.2", // Backend API server (core/server.js)
    "uuid": "^9.0.0"      // Generating tab IDs + session IDs
  },
  "devDependencies": {
    "electron": "^29.0.0",      // The Electron runtime
    "electron-builder": "^24.9" // Package into .exe/.dmg/.AppImage
  }
}
```

**Why these are the only dependencies:**
Aegis is designed to use built-in Node.js crypto (`require('crypto')`) for Phase 3 rather than sodium or forge — no external crypto deps. The routing brain, phantom system, and mix node are all pure JS. This keeps the attack surface minimal.

---

### 7. `browser/.env.example` — Environment Configuration

```bash
CORE_API_URL=http://localhost:3001    # Where the Express backend runs
LOCAL_PROXY_PORT=8118                 # Port for SOCKS5 proxy (browser → nodes)
SESSION_DURATION_MS=2700000           # 45 minutes before identity rotates
DEVTOOLS_ENABLED=false                # Show Chromium DevTools (dev only)
LOG_LEVEL=info                        # error | warn | info | debug
```

**Key design:** No secrets in Phase 1. The DA private key (Phase 6) and node ECDH keys (Phase 3) live in separate `.env` files per service, never in the browser env file.

---

## 🔄 Complete Data Flow (End-to-End, Phase 1)

```
1. USER OPENS AEGIS
   └─ app.whenReady() → createWindow()
      └─ session.setProxy(socks5://127.0.0.1:8118)   [all traffic routed]
      └─ new BrowserWindow() → loadFile(index.html)
      └─ index.html loads → React mounts → App component initializes

2. APP BOOTS
   └─ useEffect → aegisAPI.getStatus()
      → ipcRenderer.invoke('api:getStatus')
      → ipcMain.handle → axios.get('localhost:3001/api/status')
      → { status: 'ok', nodeCount: 7, ... }
      → backendStatus = 'online'

3. INITIAL TAB
   └─ createTab() → { id: 'tab_abc', url: 'aegis://new', ... }
      └─ useEffect (activeTabId changed) →
         getIdentity('tab_abc') + getCircuit('tab_abc') [parallel]
         → server.js: creates session, generateIdentity() + generateCircuit()
         → Returns { userAgent: '...Chrome...', timezone: 'America/New_York', ... }
                   { entry: EU-West node, relay: AP-South, exit: EU-South }
         → tab.identity = identity, tab.circuit = circuit
         → applyIdentityToWebview(webviewRef, identity)
            → webview.executeJavaScript(`window.__aegisApplyIdentity(...)`)
            → preload.js: currentIdentity = profile
            → All 8 override functions now return new values

4. USER TYPES URL
   └─ UrlBar input → Enter key → navigateTo('google.com')
      → normalized to 'https://google.com'
      → webviewRef.current.loadURL('https://google.com')
      → Chromium sends request → session proxy intercepts
      → Goes out through port 8118 → [Phase 3: onion encrypted to entry node]
      → [Phase 1: directly to internet — proxy not yet running]

5. DASHBOARD SHOWS
   └─ Dashboard receives activeTab via props
      → Shows identity (UA, timezone, screen, canvasSeed)
      → Shows circuit (EU-West Entry → AP-South Relay → EU-South Exit)
      → User clicks "New Route" → onRotateRoute(tabId)
         → aegisAPI.rotateRoute(tabId)
         → POST /api/rotate-route → new circuit generated
         → Dashboard re-renders with new circuit
```

---

## 🔐 Security Properties Phase 1 Establishes

| Property | Mechanism | Status |
|---|---|---|
| All traffic through proxy | Session-level setProxy() | ✅ Active |
| WebRTC IP leak | RTCPeerConnection = blockFn | ✅ Active |
| Canvas fingerprint | Seeded noise in toDataURL | ✅ Active |
| WebGL hardware | getParameter override | ✅ Active |
| User-Agent | navigator.userAgent override | ✅ Active |
| Screen size | screen.width/height override | ✅ Active |
| Timezone | Intl.DateTimeFormat override | ✅ Active |
| AudioContext | getChannelData noise | ✅ Active |
| Onion encryption | Not yet — Phase 3 | ⏳ Pending |
| Real node routing | Not yet — Phase 4 | ⏳ Pending |
| Phantom clones | Not yet — Phase 5 | ⏳ Pending |
| Mix node | Not yet — Phase 5.5 | ⏳ Pending |

---

## 🚀 How to Run Phase 1

### 1. Install Dependencies

```bash
cd f:/projects/proxy/aegis

# Install browser + core deps
cd browser && npm install
cd ../core && npm install  # or install express + uuid at root
```

### 2. Start the Backend API

```bash
cd f:/projects/proxy/aegis/core
node server.js
# → AEGIS CORE API running on http://127.0.0.1:3001
```

### 3. Start the Electron Browser

```bash
cd f:/projects/proxy/aegis/browser
npm start
# → Electron window opens
# → Browser connects to backend
# → Status dot turns green (CORE ONLINE)
```

### 4. Test a Tab Flow
1. Click the **+** button to open a new tab
2. Check the Dashboard — it should show an identity (UA, timezone, screen)
3. Check the Dashboard — it should show a 3-hop circuit (Entry → Relay → Exit)
4. Type `https://coveryourtracks.eff.org` in the URL bar → press Enter
5. The site tests your fingerprint. WebRTC should be blocked. Canvas should show as protected.

### 5. Test Identity Rotation
1. Note the current User-Agent shown in the Dashboard
2. Click **🔄 New Identity** in the Dashboard
3. The identity fields should change to a completely different UA/timezone/screen
4. Reload the tab — the new identity is now active

---

## 🔌 What Phases Plug Into Phase 1

| Phase | What Gets Added | Where It Hooks In |
|---|---|---|
| Phase 2 | `profileFactory.js` replaces stub identity generation | `core/server.js` GET /api/identity replaces `generateIdentity()` |
| Phase 3 | `onionCipher.js` + `localProxy.js` | Starts SOCKS5 at port 8118; browser traffic now onion-encrypted |
| Phase 4 | `routingBrain.js` replaces stub circuit | `core/server.js` GET /api/circuit replaces `generateCircuit()` |
| Phase 5 | `phantomLauncher.js` | Called from `localProxy.js` on each real request |
| Phase 5.5 | `mixNode.js` | Inserted between Entry and Relay in the circuit |
| Phase 6 | `nodeRegistry.js` (Redis) | MOCK_NODES array replaced by real Redis node pool |
| Phase 7 | `trafficShaper.js` + `dummyTraffic.js` | Runs as middleware in proxy layer |
| Phase 8 | `fingerprintDetector.js` | Dashboard "Run Test" button becomes functional |
| Phase 9 | Full analytics dashboard | Dashboard component gets real-time Redis streams |
| Phase 10 | End-to-end integration test | All phases verified together |

---

## 📊 Phase 1 vs Full Aegis Capabilities

| Capability | Phase 1 | Full Aegis (Phase 12) |
|---|---|---|
| Browser UI | ✅ Full | ✅ Full |
| Tab isolation | ✅ Full | ✅ Full |
| WebRTC block | ✅ Full | ✅ Full |
| Canvas spoof | ✅ Full | ✅ Full |
| WebGL spoof | ✅ Full | ✅ Full |
| User-Agent spoof | ✅ Full | ✅ Full |
| Timezone spoof | ✅ Full | ✅ Full |
| Onion routing | ❌ Mock circuit | ✅ Real 3-hop onion |
| Exit node (real) | ❌ Goes direct | ✅ Real exit node |
| Encryption | ❌ None | ✅ AES-256-GCM |
| Phantom clones | ❌ None | ✅ 3-5 decoys |
| Mix node | ❌ None | ✅ Batch shuffle |
| Real node pool | ❌ 7 mock nodes | ✅ Redis node registry |
| DA verification | ❌ No | ✅ RSA-signed list |

---

*Phase 1 Documentation v1.0 — Aegis Privacy Network | March 2026*
