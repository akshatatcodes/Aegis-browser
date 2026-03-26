/**
 * AEGIS MixNode — dummyInjector.js
 * 
 * ROLE: Generates believable dummy-traffic packets to fill batches
 *       and maintain a constant traffic profile even when idle.
 */

'use strict';

const crypto = require('crypto');
const packetPadder = require('../encryption/packetPadder');

class DummyInjector {
  /**
   * Generates a "Cover Traffic" packet.
   * It looks exactly like an encrypted onion packet from the outside.
   */
  generateDummy() {
    // Generate random junk that is exactly the size of a standard payload
    // before padding. 
    const junkSize = 1024 + Math.floor(Math.random() * 2048);
    const junk = crypto.randomBytes(junkSize);
    
    // All packets exiting a MixNode are padded to 4096 bytes
    return packetPadder.pad(junk);
  }
}

module.exports = new DummyInjector();
