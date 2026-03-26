/**
 * ============================================================
 * AEGIS CORE — server.js (Phase 3 Encryption & Proxy)
 * ============================================================
 *
 * ROLE: Express HTTP server + SOCKS5 Proxy Server.
 *       Acts as the central architecture for Aegis.
 *
 * PHASE STATUS:
 *   GET  /api/status          → Phase 3 Active
 *   GET  /api/circuit/:tabId  → Phase 1 stub (mock circuit)
 *   GET  /api/identity/:tabId → Phase 2 Active
 *   POST /api/rotate-identity → Phase 2 Active
 *   POST /api/rotate-route    → Phase 4 stub
 *   GET  /api/nodes           → Phase 6 stub
 *
 * PROXIES:
 *   SOCKS5 Proxy runs on port 8118 (localProxy.js)
 *   API Server runs on port 3001
 * ============================================================
 */

'use strict';

const express = require('express');
const cors    = require('cors');
const { v4: uuidv4 } = require('uuid');

const profileFactory = require('./identity/profileFactory');
const sessionStore   = require('./identity/sessionStore');
const localProxy     = require('./proxy/localProxy');
const routingBrain   = require('./routing/routingBrain');

const app  = express();
const PORT = process.env.CORE_PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Mock Data (to be moved to Redis in Phase 6) ─────────────
const MOCK_NODES = [
  { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  latencyMs: 28,  trustScore: 0.94, uptime: 99.1, flagged: false },
  { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  latencyMs: 52,  trustScore: 0.91, uptime: 98.7, flagged: false },
  { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   latencyMs: 35,  trustScore: 0.88, uptime: 99.5, flagged: false },
  { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   latencyMs: 112, trustScore: 0.85, uptime: 97.2, flagged: false },
  { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  latencyMs: 145, trustScore: 0.82, uptime: 96.8, flagged: false },
  { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', latencyMs: 88,  trustScore: 0.90, uptime: 98.3, flagged: false },
  { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   latencyMs: 42,  trustScore: 0.87, uptime: 98.9, flagged: false }
];

// ─── Phase 4 Logic ──────────────────────────────────────────
function generateCircuit() {
  return routingBrain.generateCircuit(MOCK_NODES);
}

// ─── API Routes ───────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    status:         'ok',
    version:        '1.0.0-phase5',
    timestamp:      Date.now(),
    uptime:         process.uptime(),
    activeSessions: sessionStore.getStats().activeSessions,
    nodeCount:      MOCK_NODES.filter(n => !n.flagged).length,
    phase:          5,
    features: {
      encryption:  true,
      realRouting: true,
      phantom:     true  // Phase 5 ACTIVE
    }
  });
});

app.get('/api/circuit/:tabId', (req, res) => {
  const { tabId } = req.params;
  let session = sessionStore.get(tabId);
  if (!session) {
    session = { identity: profileFactory.createProfile(), circuit: generateCircuit() };
    sessionStore.set(tabId, session);
  }
  if (Date.now() > session.circuit.expiresAt) {
    session.circuit = generateCircuit();
    sessionStore.set(tabId, session);
  }
  res.json(session.circuit);
});

app.get('/api/identity/:tabId', (req, res) => {
  const { tabId } = req.params;
  let session = sessionStore.get(tabId);
  if (!session) {
    session = { identity: profileFactory.createProfile(), circuit: generateCircuit() };
    sessionStore.set(tabId, session);
  }
  if (Date.now() > session.identity.expiresAt) {
    session.identity = profileFactory.createProfile();
    sessionStore.set(tabId, session);
  }
  // Correlation Sync
  if (session.circuit && session.circuit.exit) {
    const regionToTz = {
      'EU-West': 'Europe/London', 'US-East': 'America/New_York', 'EU-North': 'Europe/Berlin',
      'AP-South': 'Asia/Kolkata', 'SA-East': 'America/Sao_Paulo', 'AP-East': 'Asia/Hong_Kong',
      'EU-South': 'Europe/Rome'
    };
    session.identity.timezone = regionToTz[session.circuit.exit.region] || 'UTC';
  }
  res.json(session.identity);
});

app.post('/api/rotate-identity', (req, res) => {
  const { tabId } = req.body;
  if (!tabId) return res.status(400).json({ error: 'tabId required' });
  const session = sessionStore.get(tabId) || { circuit: generateCircuit() };
  session.identity = profileFactory.createProfile();
  sessionStore.set(tabId, session);
  res.json(session.identity);
});

app.post('/api/rotate-route', (req, res) => {
  const { tabId } = req.body;
  if (!tabId) return res.status(400).json({ error: 'tabId required' });
  const session = sessionStore.get(tabId) || { identity: profileFactory.createProfile() };
  session.circuit = generateCircuit();
  sessionStore.set(tabId, session);
  res.json(session.circuit);
});

app.get('/api/nodes', (req, res) => {
  res.json({ nodes: MOCK_NODES, total: MOCK_NODES.length });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  localProxy.start();
  console.log(`
╔══════════════════════════════════════╗
║   AEGIS CORE API — Phase 5 Phantoms  ║
║   Running on http://127.0.0.1:${PORT}  ║
║   SOCKS5 Proxy: 127.0.0.1:8118       ║
╚══════════════════════════════════════╝
  `);
});

module.exports = app;
