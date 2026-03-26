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
    let stage = 'GREETING';
    
    socket.on('data', (chunk) => {
      if (stage === 'GREETING') {
        if (chunk[0] !== 0x05) return socket.end();
        socket.write(Buffer.from([0x05, 0x00])); // No Auth
        stage = 'REQUEST';
        
        // If there's leftover data in the chunk after the greeting (usually 3 bytes), 
        // we should handle it. But standard SOCKS5 usually waits for the reply.
        // However, if the browser sent more, we'd need to slice it.
        if (chunk.length > 3) {
          this._processRequest(socket, chunk.slice(2)); // Offset depends on NMETHODS
        }
      } else if (stage === 'REQUEST') {
        this._processRequest(socket, chunk);
        stage = 'TUNNEL';
      }
    });

    socket.on('error', () => socket.end());
  }

  _processRequest(socket, chunk) {
    if (chunk[0] !== 0x05 || chunk[1] !== 0x01) return; // Only CONNECT supported

    let offset = 4;
    let dstAddr = '';
    const atyp = chunk[3];

    if (atyp === 0x01) { // IPv4
      dstAddr = chunk.slice(offset, offset + 4).join('.');
      offset += 4;
    } else if (atyp === 0x03) { // Domain
      const len = chunk[offset];
      dstAddr = chunk.slice(offset + 1, offset + 1 + len).toString();
      offset += 1 + len;
    } else if (atyp === 0x04) { // IPv6
      dstAddr = chunk.slice(offset, offset + 16).toString('hex');
      offset += 16;
    }

    const dstPort = chunk.readUInt16BE(offset);

    // --- Phase 5: Throttled Phantom Obfuscation ---
    const now = Date.now();
    if (!this.phantomCooldowns) this.phantomCooldowns = new Map();
    const lastFired = this.phantomCooldowns.get(dstAddr) || 0;

    if (now - lastFired > 30000) {
      const clones = phantomLauncher.prepareClones(MOCK_NODES, 3);
      console.log(`\n[Aegis] 🛡️ OBfuscating: ${dstAddr}:${dstPort}`);
      phantomLauncher.launch(dstAddr, clones);
      this.phantomCooldowns.set(dstAddr, now);
    }

    // Connect to Remote
    const remote = net.connect(dstPort, dstAddr, () => {
      socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
      socket.pipe(remote);
      remote.pipe(socket);
    });

    remote.on('error', () => socket.end());
    socket.on('error', () => remote.end());
    
    // Once in tunnel mode, we stop the 'data' listener for handshake logic
    socket.removeAllListeners('data');
  }

  /**
   * Pipes data between browser and remote.
   * In Phase 5, we keep the pipe clean to ensure SSL/TLS handshakes succeed,
   * while logging the phantom clone activity for obfuscation.
   */
  _pipeWithEncryption(local, remote) {
    // Phase 5 Stability: Use direct piping to ensure maximum compatibility 
    // with SSL/TLS handshakes while we are in the research/simulation phase.
    
    local.pipe(remote);
    remote.pipe(local);

    local.on('error', (err) => {
      // console.error(`[LocalProxy] Local Socket Error: ${err.message}`);
      remote.end();
    });

    remote.on('error', (err) => {
      // console.error(`[LocalProxy] Remote Socket Error: ${err.message}`);
      local.end();
    });
  }
}

module.exports = new LocalProxy();
