/**
 * AEGIS Network — selfHealer.js
 * 
 * ROLE: Monitors node health and automatically flags suspicious
 *       or unresponsive nodes in the registry.
 */

'use strict';

const nodeRegistry = require('./nodeRegistry');

class SelfHealer {
  constructor() {
    this.checkInterval = 10000; // 10 seconds for simulation
    this.timer = null;
  }

  start() {
    console.log('[Self-Healer] Monitoring network health...');
    this.timer = setInterval(() => this.checkHealth(), this.checkInterval);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  checkHealth() {
    const nodes = nodeRegistry.getAll();
    nodes.forEach(node => {
      // Simulation: 5% chance a node "fails" health check
      if (Math.random() < 0.05) {
        node.flagged = true;
        console.warn(`[Self-Healer] ⚠️  Node ${node.id} flagged for low reliability. Removing from routing.`);
      }
    });
  }
}

module.exports = new SelfHealer();
