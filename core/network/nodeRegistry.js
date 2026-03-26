/**
 * AEGIS Network — nodeRegistry.js
 * 
 * ROLE: Local cache/store for the verified node network.
 *       Provides methods to retrieve nodes by role.
 */

'use strict';

class NodeRegistry {
  constructor() {
    this.nodes = [];
    this.lastUpdate = 0;
  }

  update(newList) {
    this.nodes = newList.map(n => ({
      ...n,
      trustScore: n.trustScore || 1.0,
      latencyMs: n.latencyMs || Math.floor(Math.random() * 50) + 10,
      flagged: false
    }));
    this.lastUpdate = Date.now();
  }

  getNodesByRole(role) {
    return this.nodes.filter(n => n.role === role && !n.flagged);
  }

  getAll() {
    return this.nodes;
  }
}

module.exports = new NodeRegistry();
