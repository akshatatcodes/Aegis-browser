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
      // Simulation: 2% chance a node "fails" (reduced from 5%)
      if (!node.flagged && Math.random() < 0.02) {
        node.flagged = true;
        console.warn(`[Self-Healer] ⚠️  Node ${node.id} flagged. Removing from routing.`);
      }
      
      // Simulation: 10% chance a flagged node recovers
      if (node.flagged && Math.random() < 0.10) {
        node.flagged = false;
        console.log(`[Self-Healer] ✅ Node ${node.id} recovered. Re-adding to pool.`);
      }
    });
  }
}

module.exports = new SelfHealer();
