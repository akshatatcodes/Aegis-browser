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

        // console.log(`[LocalProxy] CONNECT ${dstAddr}:${dstPort}`);

        // In Phase 3: We pretend to connect, but wrap outgoing traffic
        // In reality, Phase 3 just forwards to verify the encryption pipe.
        // We'll connect to the destination directly but pass through the cipher.

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
