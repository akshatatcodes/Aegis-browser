/**
 * AEGIS MixNode — mixNode.js
 * 
 * ROLE: The "Timed Mix" implementation. Collects packets,
 *       shuffles their order cryptographically, and forwards them.
 */

'use strict';

const crypto = require('crypto');
const BatchManager = require('./batchManager');
const dummyInjector = require('./dummyInjector');

class MixNode {
  constructor() {
    this.batchManager = new BatchManager(this.flush.bind(this), {
      batchSize: 5,   // Small for local testing, would be 10+ in production
      flushInterval: 500
    });
  }

  /**
   * Entry point for packets arriving from Entry nodes or Phantoms.
   */
  receive(packet) {
    this.batchManager.add(packet);
  }

  /**
   * Shuffles and Flushes a batch.
   */
  flush(batch) {
    // 1. Threshold Check: If batch is too small, inject dummies
    const threshold = 5;
    while (batch.length < threshold) {
      batch.push(dummyInjector.generateDummy());
    }

    console.log(`[MixNode] 🌪️  Mixing batch of ${batch.length} (included ${batch.length - (batch.length - (threshold - batch.length))} dummies)`);

    // 2. Cryptographic Shuffle (Fisher-Yates)
    for (let i = batch.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [batch[i], batch[j]] = [batch[j], batch[i]];
    }

    // 3. Forward all (In Phase 6 simulation, we just log the shuffle)
    batch.forEach((pkt, idx) => {
      setTimeout(() => {
        // console.log(`  > [MixOut] Forwarding packet ${idx + 1} to next hop`);
        // In real network, this would send over TCP/TLS to the next onion hop.
      }, Math.random() * 50); // Add micro-jitter for extra timing protection
    });
  }
}

module.exports = new MixNode();
