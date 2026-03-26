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
  generateCircuit(nodes) {
    const path = circuitBuilder.buildCircuit(nodes);

    return {
      circuitId: uuidv4(),
      entry: path.entry,
      relay: path.relay,
      exit:  path.exit,
      totalLatencyMs: path.entry.latencyMs + path.relay.latencyMs + path.exit.latencyMs,
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
