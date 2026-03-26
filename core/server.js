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
 * In Phase 2, the stubs get replaced with real module calls:
 *   const profileFactory = require('./identity/profileFactory');
 *   const sessionStore   = require('./identity/sessionStore');
 *
 * RUNS ON: http://localhost:3001
 * ============================================================
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');

const profileFactory = require('./identity/profileFactory');
const sessionStore   = require('./identity/sessionStore');

const app  = express();
const PORT = process.env.CORE_PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));  // Electron app is same-machine
app.use(express.json());

const MOCK_NODES = [
  { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  latencyMs: 28,  trustScore: 0.94, uptime: 99.1, flagged: false },
  { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  latencyMs: 52,  trustScore: 0.91, uptime: 98.7, flagged: false },
  { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   latencyMs: 35,  trustScore: 0.88, uptime: 99.5, flagged: false },
  { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   latencyMs: 112, trustScore: 0.85, uptime: 97.2, flagged: false },
  { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  latencyMs: 145, trustScore: 0.82, uptime: 96.8, flagged: false },
  { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', latencyMs: 88,  trustScore: 0.90, uptime: 98.3, flagged: false },
  { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   latencyMs: 42,  trustScore: 0.87, uptime: 98.9, flagged: false }
];

// ─── Helpers (stubs being phased out) ─────────────────────────

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
    activeSessions: sessionStore.getStats().activeSessions,
    nodeCount:      MOCK_NODES.filter(n => !n.flagged).length,
    phase:          2,
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

  let session = sessionStore.get(tabId);

  if (!session) {
    session = {
      identity: profileFactory.createProfile(),
      circuit:  generateCircuit()
    };
    sessionStore.set(tabId, session);
  }

  // Auto-rotate if circuit expired
  if (Date.now() > session.circuit.expiresAt) {
    session.circuit = generateCircuit();
    sessionStore.set(tabId, session);
  }

  res.json(session.circuit);
});

// ─── GET /api/identity/:tabId ─────────────────────────────────
/**
 * Returns the identity profile for a given tab.
 * Phase 2: Uses profileFactory.js and sessionStore.js.
 */
app.get('/api/identity/:tabId', (req, res) => {
  const { tabId } = req.params;

  let session = sessionStore.get(tabId);

  if (!session) {
    session = {
      identity: profileFactory.createProfile(),
      circuit:  generateCircuit()
    };
    sessionStore.set(tabId, session);
  }

  // Auto-rotate if identity expired (45 min)
  if (Date.now() > session.identity.expiresAt) {
    session.identity = profileFactory.createProfile();
    sessionStore.set(tabId, session);
  }

  // Sync timezone to circuit exit node (Phase 2 enhancement)
  if (session.circuit && session.circuit.exit) {
    // In a real app, mapping region to timezone would be more complex.
    // For now, we use the circuit metadata.
    const regionToTz = {
      'EU-West':  'Europe/London',
      'US-East':  'America/New_York',
      'EU-North': 'Europe/Berlin',
      'AP-South': 'Asia/Kolkata',
      'SA-East':  'America/Sao_Paulo',
      'AP-East':  'Asia/Hong_Kong',
      'EU-South': 'Europe/Rome'
    };
    session.identity.timezone = regionToTz[session.circuit.exit.region] || 'UTC';
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

  const session = sessionStore.get(tabId) || { circuit: generateCircuit() };
  session.identity = profileFactory.createProfile();
  
  sessionStore.set(tabId, session);

  console.log(`[Core] Identity rotated for tab: ${tabId}`);
  res.json(session.identity);
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

  const session = sessionStore.get(tabId) || { identity: profileFactory.createProfile() };
  session.circuit = generateCircuit();
  
  sessionStore.set(tabId, session);

  console.log(`[Core] Circuit rotated for tab: ${tabId}`);
  res.json(session.circuit);
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
║   AEGIS CORE API — Phase 2 Identity ║
║   Running on http://127.0.0.1:${PORT}  ║
║   Active sessions: 0                 ║
║   Nodes available: ${MOCK_NODES.length}                  ║
╚══════════════════════════════════════╝
  `);
});

module.exports = app; // Export for testing
