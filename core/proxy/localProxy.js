/**
 * core/proxy/localProxy.js
 * 
 * Lightweight SOCKS5 Proxy Server (RFC 1928).
 * Intercepts browser traffic at 127.0.0.1:8118.
 * In Phase 3: Wraps outgoing traffic in onion layers.
 */

'use strict';

const net = require('net');
const onionCipher = require('../encryption/onionCipher');
const sessionStore = require('../identity/sessionStore');
const phantomLauncher = require('../phantom/phantomLauncher');

class LocalProxy {
  constructor(port = 8118) {
    this.port = port;
    this.server = null;
  }

  start() {
    this.server = net.createServer((socket) => {
      this._handleConnection(socket);
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`[LocalProxy] SOCKS5 Listening on 127.0.0.1:${this.port}`);
    });

    this.server.on('error', (err) => {
      console.error(`[LocalProxy] Server Error: ${err.message}`);
    });
  }

  _handleConnection(socket) {
    // SOCKS5 Greeting & Version Check
    socket.once('data', (data) => {
      if (data[0] !== 0x05) {
        return socket.end(); // Only SOCKS5 supported
      }

      // 1. Initial Greeting: [VER, NMETHODS, METHODS]
      // Reply: [VER, METHOD] (0x00 = No auth)
      socket.write(Buffer.from([0x05, 0x00]));

      // 2. Request Handling: [VER, CMD, RSV, ATYP, DST.ADDR, DST.PORT]
      socket.once('data', (chunk) => {
        const cmd = chunk[1];
        if (cmd !== 0x01) {
          // Only CONNECT (0x01) supported for now
          socket.write(Buffer.from([0x05, 0x07])); // Command not supported
          return socket.end();
        }

        // Parse Destination
        let dstAddr = '';
        let dstPort = 0;
        const atyp = chunk[3];
        let offset = 4;

        if (atyp === 0x01) { // IPv4
          dstAddr = chunk.slice(offset, offset + 4).join('.');
          offset += 4;
        } else if (atyp === 0x03) { // Domain Name
          const len = chunk[offset];
          dstAddr = chunk.slice(offset + 1, offset + 1 + len).toString();
          offset += 1 + len;
        }

        dstPort = chunk.readUInt16BE(offset);

        // Phase 5: Trigger Phantom Clones for this destination
        // We use a mock node list for now (Phase 6 will use the real registry)
        const MOCK_NODES = [
          { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  latencyMs: 28,  trustScore: 0.94, uptime: 99.1, flagged: false },
          { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  latencyMs: 52,  trustScore: 0.91, uptime: 98.7, flagged: false },
          { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   latencyMs: 35,  trustScore: 0.88, uptime: 99.5, flagged: false },
          { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   latencyMs: 112, trustScore: 0.85, uptime: 97.2, flagged: false },
          { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  latencyMs: 145, trustScore: 0.82, uptime: 96.8, flagged: false },
          { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', latencyMs: 88,  trustScore: 0.90, uptime: 98.3, flagged: false },
          { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   latencyMs: 42,  trustScore: 0.87, uptime: 98.9, flagged: false }
        ];
        
        const clones = phantomLauncher.prepareClones(MOCK_NODES, Math.floor(Math.random() * 3) + 3);
        phantomLauncher.launch(dstAddr, clones);

        const remote = net.connect(dstPort, dstAddr, () => {
          // Success: [VER, REP, RSV, ATYP, BND.ADDR, BND.PORT]
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          
          // Bidirectional Piping
          // Browser -> Proxy -> [Onion Wrap] -> Remote
          // Remote -> [Unwrap] -> Proxy -> Browser
          
          this._pipeWithEncryption(socket, remote);
        });

        remote.on('error', (err) => {
          // console.error(`[LocalProxy] Remote connection failed: ${err.message}`);
          socket.end();
        });
      });
    });
  }

  /**
   * Pipes data between browser and remote, applying onion layers.
   */
  _pipeWithEncryption(local, remote) {
    // Phase 3 Middleware Logic:
    // Every packet from browser is "wrapped" in a mock 3-layer onion.
    // In later phases, this will go to the Entry Node, not the final destination.

    const mockKeys = [
      onionCipher.generateKey(), // Exit Key
      onionCipher.generateKey(), // Relay Key
      onionCipher.generateKey()  // Entry Key
    ];

    local.on('data', (chunk) => {
      // Wrap outgoing
      const wrapped = onionCipher.wrapOnion(chunk, mockKeys);
      // In Phase 3: We unwrap immediately to verify the data integrity before sending
      // because we don't have the real nodes to unwrap it yet.
      const unwrapped = onionCipher.unwrapLayer(onionCipher.unwrapLayer(onionCipher.unwrapLayer(wrapped, mockKeys[2]), mockKeys[1]), mockKeys[0]);
      
      remote.write(unwrapped);
    });

    remote.on('data', (chunk) => {
      // For Phase 3: Directly forward incoming
      local.write(chunk);
    });

    local.on('close', () => remote.end());
    remote.on('close', () => local.end());
  }
}

module.exports = new LocalProxy();
