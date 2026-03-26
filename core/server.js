/**
 * ============================================================
 * AEGIS CORE — server.js (Phase 1 Backend API Stub)
 * ============================================================
 *
 * ROLE: Express HTTP server that acts as the bridge between
 *       the Electron browser (main.js) and all core Aegis
 *       subsystems (encryption, routing, identity, phantom, etc.)
 *
 * In Phase 1, this is a STUB — it returns realistic mock data
 * so the browser UI can be tested end-to-end before the real
 * routing/encryption engines are built in later phases.
 *
 * PHASE STATUS OF EACH ROUTE:
 *   GET  /api/status          → Phase 1 stub (always returns OK)
 *   GET  /api/circuit/:tabId  → Phase 1 stub (mock circuit)
 *   GET  /api/identity/:tabId → Phase 1 stub (mock identity)
 *   POST /api/rotate-identity → Phase 2 stub (calls profileFactory)
 *   POST /api/rotate-route    → Phase 4 stub (calls routingBrain)
 *   GET  /api/nodes           → Phase 6 stub (mock node list)
 *   GET  /api/detection       → Phase 8 stub (placeholder)
 *   POST /api/run-detection   → Phase 8 stub (placeholder)
 *
 * In Phase 2+, the stubs get replaced with real module calls:
 *   const profileFactory = require('./identity/profileFactory');
 *   const routingBrain   = require('./routing/routingBrain');
 *   etc.
 *
 * RUNS ON: http://localhost:3001
 * ============================================================
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');

const app  = express();
const PORT = process.env.CORE_PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));  // Electron app is same-machine
app.use(express.json());

// ─── In-Memory State (stub only) ─────────────────────────────
// In production: this data comes from Redis (nodeRegistry.js)
// and per-tab session stores.

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15'
];

const TIMEZONES = [
  'America/New_York', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles',
  'Europe/Berlin', 'Asia/Singapore', 'Europe/Paris', 'America/Chicago'
];

const SCREENS = [
  { width: 1920, height: 1080, colorDepth: 24 },
  { width: 2560, height: 1440, colorDepth: 24 },
  { width: 1440, height: 900,  colorDepth: 24 },
  { width: 1366, height: 768,  colorDepth: 24 }
];

const WEBGL_CONFIGS = [
  { vendor: 'Intel Inc.',  renderer: 'Intel Iris OpenGL Engine' },
  { vendor: 'Intel Inc.',  renderer: 'Intel HD Graphics 620' },
  { vendor: 'Google Inc.', renderer: 'ANGLE (Intel)' }
];

const MOCK_NODES = [
  { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  latencyMs: 28,  trustScore: 0.94, uptime: 99.1, flagged: false },
  { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  latencyMs: 52,  trustScore: 0.91, uptime: 98.7, flagged: false },
  { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   latencyMs: 35,  trustScore: 0.88, uptime: 99.5, flagged: false },
  { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   latencyMs: 112, trustScore: 0.85, uptime: 97.2, flagged: false },
  { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  latencyMs: 145, trustScore: 0.82, uptime: 96.8, flagged: false },
  { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', latencyMs: 88,  trustScore: 0.90, uptime: 98.3, flagged: false },
  { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   latencyMs: 42,  trustScore: 0.87, uptime: 98.9, flagged: false }
];

// Per-tab session store (tab_id → { identity, circuit })
const tabSessions = new Map();

// ─── Helper: Build random identity ────────────────────────────
function generateIdentity() {
  const ua     = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  const tz     = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)];
  const screen = SCREENS[Math.floor(Math.random() * SCREENS.length)];
  const webgl  = WEBGL_CONFIGS[Math.floor(Math.random() * WEBGL_CONFIGS.length)];

  return {
    sessionId:    uuidv4(),
    userAgent:    ua,
    platform:    ua.includes('Windows') ? 'Win32' : ua.includes('Mac') ? 'MacIntel' : 'Linux x86_64',
    vendor:      ua.includes('Firefox') ? 'Mozilla' : 'Google Inc.',
    timezone:    tz,
    screen,
    webglVendor:  webgl.vendor,
    webglRenderer:webgl.renderer,
    canvasSeed:  Math.floor(Math.random() * 65535),
    audioNoise:  0.00005 + Math.random() * 0.0002,
    createdAt:   Date.now(),
    expiresAt:   Date.now() + 2700000 // 45 minutes
  };
}

// ─── Helper: Build random circuit ────────────────────────────
function generateCircuit() {
  const guards  = MOCK_NODES.filter(n => n.role === 'guard');
  const relays  = MOCK_NODES.filter(n => n.role === 'relay');
  const exits   = MOCK_NODES.filter(n => n.role === 'exit');

  const entry = guards[Math.floor(Math.random() * guards.length)];
  const relay = relays[Math.floor(Math.random() * relays.length)];
  const exit  = exits[Math.floor(Math.random() * exits.length)];

  return {
    circuitId: uuidv4(),
    entry, relay, exit,
    totalLatencyMs: entry.latencyMs + relay.latencyMs + exit.latencyMs,
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000 // 10 minutes
  };
}

// ─── GET /api/status ──────────────────────────────────────────
/**
 * Health check endpoint. Browser polls this every 30 seconds.
 * In Phase 4+: also reports routing brain status.
 * In Phase 6+: also reports active node count.
 */
app.get('/api/status', (req, res) => {
  res.json({
    status:         'ok',
    version:        '1.0.0-phase1',
    timestamp:      Date.now(),
    uptime:         process.uptime(),
    activeSessions: tabSessions.size,
    nodeCount:      MOCK_NODES.filter(n => !n.flagged).length,
    phase:          1,
    features: {
      encryption:  false,  // Phase 3
      realRouting: false,  // Phase 4
      phantom:     false,  // Phase 5
      mixNode:     false   // Phase 5.5
    }
  });
});

// ─── GET /api/circuit/:tabId ──────────────────────────────────
/**
 * Returns the current 3-hop circuit for a given tab.
 * Phase 1: Returns a random mock circuit from MOCK_NODES.
 * Phase 4: Will call routingBrain.js → circuitBuilder.js.
 */
app.get('/api/circuit/:tabId', (req, res) => {
  const { tabId } = req.params;

  // Create session if it doesn't exist
  if (!tabSessions.has(tabId)) {
    tabSessions.set(tabId, {
      identity: generateIdentity(),
      circuit:  generateCircuit()
    });
  }

  const session = tabSessions.get(tabId);

  // Auto-rotate if circuit expired
  if (Date.now() > session.circuit.expiresAt) {
    session.circuit = generateCircuit();
    tabSessions.set(tabId, session);
  }

  res.json(session.circuit);
});

// ─── GET /api/identity/:tabId ─────────────────────────────────
/**
 * Returns the identity profile for a given tab.
 * Phase 1: Returns a random mock identity.
 * Phase 2: Will call profileFactory.js → sessionStore.js.
 */
app.get('/api/identity/:tabId', (req, res) => {
  const { tabId } = req.params;

  if (!tabSessions.has(tabId)) {
    tabSessions.set(tabId, {
      identity: generateIdentity(),
      circuit:  generateCircuit()
    });
  }

  const session = tabSessions.get(tabId);

  // Auto-rotate if identity expired (45 min)
  if (Date.now() > session.identity.expiresAt) {
    session.identity = generateIdentity();
    tabSessions.set(tabId, session);
  }

  res.json(session.identity);
});

// ─── POST /api/rotate-identity ────────────────────────────────
/**
 * Force a new identity for a tab.
 * Args body: { tabId: string }
 * Phase 1: Generates a fresh random identity immediately.
 * Phase 2: Will call profileFactory.createProfile() with constraints.
 */
app.post('/api/rotate-identity', (req, res) => {
  const { tabId } = req.body;

  if (!tabId) {
    return res.status(400).json({ error: 'tabId required' });
  }

  const newIdentity = generateIdentity();
  const existing = tabSessions.get(tabId) || { circuit: generateCircuit() };
  tabSessions.set(tabId, { ...existing, identity: newIdentity });

  console.log(`[Core] Identity rotated for tab: ${tabId}`);
  res.json(newIdentity);
});

// ─── POST /api/rotate-route ───────────────────────────────────
/**
 * Force a new circuit for a tab.
 * Args body: { tabId: string }
 * Phase 1: Generates a fresh random circuit immediately.
 * Phase 4: Will call routingBrain.buildCircuit(tabId, destination).
 */
app.post('/api/rotate-route', (req, res) => {
  const { tabId } = req.body;

  if (!tabId) {
    return res.status(400).json({ error: 'tabId required' });
  }

  const newCircuit = generateCircuit();
  const existing = tabSessions.get(tabId) || { identity: generateIdentity() };
  tabSessions.set(tabId, { ...existing, circuit: newCircuit });

  console.log(`[Core] Circuit rotated for tab: ${tabId}`);
  res.json(newCircuit);
});

// ─── GET /api/nodes ───────────────────────────────────────────
/**
 * Returns all known nodes and their health metrics.
 * Phase 1: Returns MOCK_NODES array.
 * Phase 6: Will call nodeRegistry.getAllNodes() from Redis.
 */
app.get('/api/nodes', (req, res) => {
  res.json({
    nodes: MOCK_NODES,
    total: MOCK_NODES.length,
    active: MOCK_NODES.filter(n => !n.flagged).length,
    timestamp: Date.now()
  });
});

// ─── GET /api/detection ───────────────────────────────────────
/**
 * Returns the latest detection test results.
 * Phase 1: Stub — returns placeholder data.
 * Phase 8: Will return results from fingerprintDetector.js + proxyDetector.js.
 */
app.get('/api/detection', (req, res) => {
  res.json({
    lastRun:          null,
    fingerprintScore: null,
    trafficUniformity:null,
    exitNodeClean:    null,
    overallRisk:      'unknown',
    message:          'Detection engine not yet active (Phase 8)'
  });
});

// ─── POST /api/run-detection ──────────────────────────────────
/**
 * Trigger a detection scan immediately.
 * Phase 1: Stub — responds with "scheduled" but does nothing.
 * Phase 8: Will call fingerprintDetector.run() etc.
 */
app.post('/api/run-detection', (req, res) => {
  res.json({
    scheduled: true,
    message: 'Detection engine not yet active (Phase 8)'
  });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`
╔══════════════════════════════════════╗
║   AEGIS CORE API — Phase 1 Stub     ║
║   Running on http://127.0.0.1:${PORT}  ║
║   Active sessions: 0                 ║
║   Nodes available: ${MOCK_NODES.length}                  ║
╚══════════════════════════════════════╝
  `);
});

module.exports = app; // Export for testing
