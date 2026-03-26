/**
 * AEGIS Directory Authority — da-server.js
 * 
 * ROLE: The "Source of Truth" for the Aegis network.
 *       Maintains and RSA-signs the master node list.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

const PRIVATE_KEY = fs.readFileSync(path.join(__dirname, 'da-private.pem'), 'utf8');

// The "Master List" of nodes (simulated database)
const MASTER_NODES = [
  { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  port: 9001, pubKey: 'node-pk-01' },
  { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  port: 9001, pubKey: 'node-pk-02' },
  { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   port: 9001, pubKey: 'node-pk-03' },
  { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   port: 9001, pubKey: 'node-pk-04' },
  { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  port: 9001, pubKey: 'node-pk-05' },
  { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', port: 9001, pubKey: 'node-pk-06' },
  { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   port: 9001, pubKey: 'node-pk-07' },
  { id: 'node-us-2', role: 'exit',   region: 'US-West',  ip: '23.101.44.15',  port: 9001, pubKey: 'node-pk-08' }
];

/**
 * GET /consensus
 * Returns the signed list of nodes.
 */
app.get('/consensus', (req, res) => {
  const timestamp = Date.now();
  const payload = JSON.stringify({
    nodes: MASTER_NODES,
    timestamp
  });

  // Create RSA-SHA256 signature
  const signer = crypto.createSign('SHA256');
  signer.update(payload);
  signer.end();
  
  const signature = signer.sign(PRIVATE_KEY, 'hex');

  console.log(`[DA] Served signed consensus (v${timestamp})`);
  
  res.json({
    payload: JSON.parse(payload),
    signature
  });
});

app.listen(PORT, () => {
  console.log(`[DA-Server] Running on http://localhost:${PORT}`);
});
