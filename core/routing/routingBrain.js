/**
 * core/routing/routingBrain.js
 * 
 * The central logic for Aegis adaptive routing.
 * Manages circuit state, rotation, and node scoring.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const circuitBuilder = require('./circuitBuilder');

class RoutingBrain {
  constructor() {
    this.CIRCUIT_TTL_MS = 600000; // 10 minutes
  }

  /**
   * Generates a new 3-hop circuit for a session
   */
  generateCircuit() {
    const nodeRegistry = require('../network/nodeRegistry');
    const nodes = nodeRegistry.getAll();
    const path = circuitBuilder.buildCircuit(nodes);

    return {
      circuitId: uuidv4(),
      entry: path.entry,
      relay: path.relay,
      exit:  path.exit,
      mixNode: { id: 'mix-01', region: path.entry.region, strategy: 'timed', status: 'active' },
      totalLatencyMs: path.entry.latencyMs + path.relay.latencyMs + path.exit.latencyMs + 300, // +300ms mix latency
      createdAt: Date.now(),
      expiresAt: Date.now() + this.CIRCUIT_TTL_MS
    };
  }

  /**
   * Check if a circuit needs rotation
   */
  shouldRotate(circuit) {
    if (!circuit) return true;
    return Date.now() > circuit.expiresAt;
  }
}

module.exports = new RoutingBrain();
