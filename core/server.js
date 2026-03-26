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
 *   GET  /api/nodes           → Phase 7 Active
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

// Phase 7 Network Modules
const DirectoryClient = require('./network/directoryClient');
const nodeRegistry    = require('./network/nodeRegistry');
const selfHealer      = require('./network/selfHealer');

const directoryClient = new DirectoryClient();

const app  = express();
const PORT = process.env.CORE_PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());


// ─── Phase 4 Logic ──────────────────────────────────────────
function generateCircuit() {
  return routingBrain.generateCircuit();
}

// ─── API Routes ───────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    status:         'ok',
    version:        '1.0.0-phase5',
    timestamp:      Date.now(),
    uptime:         process.uptime(),
    activeSessions: sessionStore.getStats().activeSessions,
    nodeCount:      nodeRegistry.getNodesByRole('guard').length + nodeRegistry.getNodesByRole('relay').length + nodeRegistry.getNodesByRole('exit').length,
    phase:          7,
    features: {
      encryption:  true,
      realRouting: true,
      phantom:     true,
      mixNode:     true,
      dynamicNet:  true  // Phase 7 ACTIVE
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
  const nodes = nodeRegistry.getAll();
  res.json({ nodes, total: nodes.length });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', async () => {
  localProxy.start();
  console.log(`
╔══════════════════════════════════════╗
║   AEGIS CORE API — Phase 7 Network   ║
║   Running on http://127.0.0.1:${PORT}  ║
║   SOCKS5 Proxy: 127.0.0.1:8118       ║
╚══════════════════════════════════════╝
  `);

  // Phase 7: Fetch initial consensus
  const nodes = await directoryClient.fetchConsensus();
  if (nodes) {
    nodeRegistry.update(nodes);
    selfHealer.start();
  } else {
    console.error('[Aegis] ❌ CRITICAL: Failed to load node consensus on startup.');
  }
});

module.exports = app;
