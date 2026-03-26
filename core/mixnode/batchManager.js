/**
 * AEGIS MixNode — batchManager.js
 * 
 * ROLE: Collects packets and decides when to trigger a "Flush" (Shuffle + Forward).
 *       Implements the "Timed Mix" strategy.
 */

'use strict';

class BatchManager {
  constructor(onFlush, config = {}) {
    this.onFlush = onFlush; // Callback to MixNode.flush()
    this.batchSize = config.batchSize || 10;
    this.flushInterval = config.flushInterval || 300; // ms
    
    this.batch = [];
    this.timer = null;
  }

  /**
   * Adds a packet to the current batch.
   */
  add(packet) {
    this.batch.push(packet);

    // Initial packet starts the timer
    if (!this.timer) {
      this.timer = setTimeout(() => this._triggerFlush(), this.flushInterval);
    }

    // If we hit the threshold early, we can flush now
    if (this.batch.length >= this.batchSize) {
      this._triggerFlush();
    }
  }

  /**
   * Internal trigger that clears timer and calls the MixNode's flush.
   */
  _triggerFlush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) return;

    const currentBatch = [...this.batch];
    this.batch = [];
    
    this.onFlush(currentBatch);
  }
}

module.exports = BatchManager;
