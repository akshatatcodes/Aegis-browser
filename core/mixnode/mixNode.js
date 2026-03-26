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
    this.threshold = 5;
    this.batchManager = new BatchManager(this.flush.bind(this), {
      batchSize: this.threshold,
      flushInterval: 200 // Reduced from 500ms to prevent browser timeouts
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
    const originalCount = batch.length;
    
    // 1. Threshold Check: If batch is too small, inject dummies
    while (batch.length < this.threshold) {
      batch.push(dummyInjector.generateDummy());
    }

    const dummyCount = batch.length - originalCount;
    if (dummyCount > 0 || originalCount > 0) {
      console.log(`[MixNode] 🌪️  Mixing batch of ${batch.length} (included ${dummyCount} dummies)`);
    }

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
