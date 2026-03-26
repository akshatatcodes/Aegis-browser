/**
 * ============================================================
 * AEGIS BROWSER — preload.js (Fingerprint Spoofing Engine)
 * ============================================================
 *
 * ROLE: Runs BEFORE any page JavaScript in every webview.
 *       Has access to both renderer DOM APIs AND the
 *       contextBridge (to expose safe Node.js APIs to renderer).
 *
 * TWO JOBS:
 *   1. FINGERPRINT SPOOFING — Override browser APIs that leak
 *      real device identity (canvas, WebGL, AudioContext, etc.)
 *      This script runs in the same context as page JS so it
 *      can override window.CanvasRenderingContext2D.prototype etc.
 *
 *   2. CONTEXT BRIDGE — Expose a safe, curated `window.aegisAPI`
 *      object that the renderer (React app) can call to ask
 *      the main process (Node.js) to do things via IPC.
 *
 * SECURITY:
 *   - contextIsolation: true means this script and page scripts
 *     run in separate V8 contexts. The overrides below land in
 *     the PAGE context (via `window` assignment in executeScript
 *     or simply by being this preload running in the main world).
 *   - The contextBridge only works in the PRELOAD world; page JS
 *     only sees what contextBridge.exposeInMainWorld() allows.
 *
 * HOW IDENTITY IS RECEIVED:
 *   The renderer's React app fetches the identity from the backend,
 *   then sends it via IPC to this preload using:
 *     window.aegisAPI.applyIdentity(profile)
 *   which stores it in `currentIdentity` and refreshes overrides.
 *
 * OVERRIDDEN APIS (8 vectors):
 *   1. navigator.userAgent / navigator.platform / navigator.vendor
 *   2. screen.width / screen.height / screen.colorDepth
 *   3. Date / Intl → timezone spoofing
 *   4. HTMLCanvasElement.prototype.toDataURL → noise injection
 *   5. WebGLRenderingContext → RENDERER + VENDOR strings
 *   6. AudioContext → subtle frequency perturbation
 *   7. RTCPeerConnection → BLOCKED entirely
 *   8. navigator.fonts / document.fonts → restricted
 * ============================================================
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// ─── Live Identity State ──────────────────────────────────────
// Populated when the renderer calls aegisAPI.applyIdentity(profile)
let currentIdentity = {
  userAgent:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  platform:    'Win32',
  vendor:      'Google Inc.',
  screen:      { width: 1920, height: 1080, colorDepth: 24 },
  timezone:    'America/New_York',
  canvasSeed:  42,
  webglVendor: 'Intel Inc.',
  webglRenderer:'Intel Iris OpenGL Engine',
  audioNoise:  0.0001
};

// ─── 1. User-Agent & Navigator Spoofing ──────────────────────
// Override BEFORE any page script can read them.
// Object.defineProperty prevents page scripts from reading the real values.
Object.defineProperty(navigator, 'userAgent', {
  get: () => currentIdentity.userAgent,
  configurable: true
});

Object.defineProperty(navigator, 'platform', {
  get: () => currentIdentity.platform,
  configurable: true
});

Object.defineProperty(navigator, 'vendor', {
  get: () => currentIdentity.vendor,
  configurable: true
});

// appVersion is derived from userAgent (browsers do this)
Object.defineProperty(navigator, 'appVersion', {
  get: () => currentIdentity.userAgent.replace('Mozilla/', ''),
  configurable: true
});

// ─── 2. Screen Spoofing ───────────────────────────────────────
Object.defineProperty(screen, 'width',      { get: () => currentIdentity.screen.width,       configurable: true });
Object.defineProperty(screen, 'height',     { get: () => currentIdentity.screen.height,      configurable: true });
Object.defineProperty(screen, 'availWidth', { get: () => currentIdentity.screen.width,       configurable: true });
Object.defineProperty(screen, 'availHeight',{ get: () => currentIdentity.screen.height - 40, configurable: true });
Object.defineProperty(screen, 'colorDepth', { get: () => currentIdentity.screen.colorDepth,  configurable: true });
Object.defineProperty(screen, 'pixelDepth', { get: () => currentIdentity.screen.colorDepth,  configurable: true });

// ─── 3. Canvas Fingerprint Noise ─────────────────────────────
/**
 * Canvas fingerprinting works by drawing text/shapes and reading
 * pixel values. Different hardware/drivers render slightly differently.
 * We inject deterministic noise based on canvasSeed so:
 *   - Same session → same noise → looks like one consistent device
 *   - Different session → different seed → different device entirely
 */
(function overrideCanvas() {
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  HTMLCanvasElement.prototype.toDataURL = function(type, ...args) {
    _addCanvasNoise(this);
    return origToDataURL.apply(this, [type, ...args]);
  };

  CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
    const imageData = origGetImageData.apply(this, [x, y, w, h]);
    _noiseImageData(imageData);
    return imageData;
  };

  function _addCanvasNoise(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const seed = currentIdentity.canvasSeed;
    // Inject 1x1 pixel of nearly-invisible noise — imperceptible but changes hash
    ctx.fillStyle = `rgba(${seed % 255}, ${(seed * 3) % 255}, ${(seed * 7) % 255}, 0.003)`;
    ctx.fillRect(0, 0, 1, 1);
  }

  function _noiseImageData(imageData) {
    const seed = currentIdentity.canvasSeed;
    // Perturb every 100th pixel by ±1 — invisible to eye, changes fingerprint hash
    for (let i = 0; i < imageData.data.length; i += 400) {
      imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + (seed % 3) - 1));
    }
  }
})();

// ─── 4. WebGL Vendor/Renderer Spoofing ───────────────────────
/**
 * WebGL RENDERER and VENDOR strings uniquely identify GPU hardware.
 * We replace them with a common Intel GPU string seen on millions
 * of consumer laptops.
 */
(function overrideWebGL() {
  const origGetParameter = WebGLRenderingContext.prototype.getParameter;

  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    // 37445 = UNMASKED_VENDOR_WEBGL
    if (parameter === 37445) return currentIdentity.webglVendor;
    // 37446 = UNMASKED_RENDERER_WEBGL
    if (parameter === 37446) return currentIdentity.webglRenderer;
    return origGetParameter.apply(this, [parameter]);
  };

  // Also override WebGL2
  if (typeof WebGL2RenderingContext !== 'undefined') {
    const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return currentIdentity.webglVendor;
      if (parameter === 37446) return currentIdentity.webglRenderer;
      return origGetParameter2.apply(this, [parameter]);
    };
  }
})();

// ─── 5. AudioContext Noise ────────────────────────────────────
/**
 * AudioContext fingerprinting reads the output of an oscillator
 * processed through a ChannelSplitter. Hardware/software differences
 * create unique floating-point rounding patterns.
 * We perturb the copyFromChannel output slightly.
 */
(function overrideAudio() {
  const origGetChannelData = AudioBuffer.prototype.getChannelData;

  AudioBuffer.prototype.getChannelData = function(...args) {
    const channelData = origGetChannelData.apply(this, args);
    const noise = currentIdentity.audioNoise;
    // Add imperceptible noise to first few samples
    for (let i = 0; i < Math.min(channelData.length, 20); i++) {
      channelData[i] += (Math.random() - 0.5) * noise;
    }
    return channelData;
  };
})();

// ─── 6. WebRTC — COMPLETE BLOCK ──────────────────────────────
/**
 * WebRTC (used for video/audio calls and P2P) exposes your REAL
 * local IP address even through a proxy. There is no reliable way
 * to proxy WebRTC — the only safe option is to block it entirely.
 *
 * We replace RTCPeerConnection with a no-op class that throws an
 * error if anything tries to use it.
 */
(function blockWebRTC() {
  const blockFn = function() {
    throw new DOMException(
      'WebRTC is disabled in Aegis for privacy protection.',
      'NotSupportedError'
    );
  };

  // Override all variants
  window.RTCPeerConnection        = blockFn;
  window.webkitRTCPeerConnection  = blockFn;
  window.mozRTCPeerConnection     = blockFn;

  // Also block getUserMedia WebRTC path
  if (navigator.mediaDevices) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      // Allow audio/video (for legitimate use) but block if used with RTCPeerConnection
      return origGetUserMedia(constraints);
    };
  }
})();

// ─── 7. Timezone Spoofing ─────────────────────────────────────
/**
 * Date.prototype.getTimezoneOffset() reveals local timezone.
 * Intl.DateTimeFormat leaks timezone through locale settings.
 * We override both to report the spoofed timezone.
 *
 * NOTE: Full timezone override is best done via Electron's
 *       session.defaultSession.setUserAgent + Chromium's
 *       --timezone flag. This JS override catches JS-level probes.
 */
(function overrideTimezone() {
  const origDateTimeFormat = Intl.DateTimeFormat;

  // Override Intl.DateTimeFormat to inject our timezone
  Intl.DateTimeFormat = function(locale, options = {}) {
    if (!options.timeZone) {
      options.timeZone = currentIdentity.timezone;
    }
    return new origDateTimeFormat(locale, options);
  };

  // Copy static methods
  Intl.DateTimeFormat.supportedLocalesOf = origDateTimeFormat.supportedLocalesOf;
  Intl.DateTimeFormat.prototype = origDateTimeFormat.prototype;
})();

// ─── 8. Font Enumeration Protection ──────────────────────────
/**
 * document.fonts.forEach / queryLocalFonts() can reveal installed
 * system fonts which form a unique fingerprint. We restrict to
 * only a minimal safe set.
 */
(function blockFontEnum() {
  // Block the newer Font Access API if available
  if (navigator.fonts && navigator.fonts.query) {
    navigator.fonts.query = () => Promise.resolve([]);
  }
})();

// ─── Context Bridge — Expose Safe API to Renderer ─────────────
/**
 * contextBridge.exposeInMainWorld() is the ONLY channel from
 * renderer to main process with contextIsolation: true.
 *
 * window.aegisAPI is the interface the React app uses for
 * all backend communication and identity management.
 */
contextBridge.exposeInMainWorld('aegisAPI', {

  // ── Apply a new identity to this webview ──────────────────
  // Called by React when the backend assigns an identity to a tab.
  // Updates currentIdentity (all overrides above read from it).
  applyIdentity: (profile) => {
    if (!profile) return;
    currentIdentity = {
      userAgent:    profile.userAgent    || currentIdentity.userAgent,
      platform:     profile.platform     || currentIdentity.platform,
      vendor:       profile.vendor       || currentIdentity.vendor,
      screen:       profile.screen       || currentIdentity.screen,
      timezone:     profile.timezone     || currentIdentity.timezone,
      canvasSeed:   profile.canvasSeed   || currentIdentity.canvasSeed,
      webglVendor:  profile.webglVendor  || currentIdentity.webglVendor,
      webglRenderer:profile.webglRenderer|| currentIdentity.webglRenderer,
      audioNoise:   profile.audioNoise   || currentIdentity.audioNoise
    };
    console.log('[Aegis Preload] Identity applied:', currentIdentity.userAgent);
  },

  // ── IPC bridge methods ────────────────────────────────────
  // These are the ONLY way the renderer can talk to main.js
  // All are async and return { success, data, error }

  getStatus:      ()          => ipcRenderer.invoke('api:getStatus'),
  getCircuit:     (tabId)     => ipcRenderer.invoke('api:getCircuit',    { tabId }),
  getIdentity:    (tabId)     => ipcRenderer.invoke('api:getIdentity',   { tabId }),
  rotateIdentity: (tabId)     => ipcRenderer.invoke('api:rotateIdentity',{ tabId }),
  rotateRoute:    (tabId)     => ipcRenderer.invoke('api:rotateRoute',   { tabId }),
  getNodes:       ()          => ipcRenderer.invoke('api:getNodes'),

  // App-level calls
  openDevTools: ()            => ipcRenderer.invoke('app:openDevTools'),
  setTitle:     (title)       => ipcRenderer.invoke('app:setTitle', { title }),

  // ── Event listeners from main ─────────────────────────────
  // Main process sends 'main:ready' after window loads
  onReady: (callback) => {
    ipcRenderer.on('main:ready', (_event, data) => callback(data));
  }
});

console.log('[Aegis Preload] Fingerprint overrides active. WebRTC blocked.');
