/**
 * core/routing/circuitBuilder.js
 * 
 * Implements Phase 4 Path Selection Rules:
 * 1. 3 Hops: Entry -> Relay -> Exit
 * 2. Geo-Diversity: No two adjacent hops in same region
 * 3. Performance: Selection weighted by health scores
 */

'use strict';

const nodeScorer = require('./nodeScorer');

class CircuitBuilder {
  /**
   * Build a 3-hop circuit from a node registry
   */
  buildCircuit(nodes) {
    // 1. Filter by role and health
    const ranked = nodeScorer.rankNodes(nodes).filter(n => n.score > 0.4);

    const guards = ranked.filter(n => n.role === 'guard');
    const relays = ranked.filter(n => n.role === 'relay');
    const exits  = ranked.filter(n => n.role === 'exit');

    if (!guards.length || !relays.length || !exits.length) {
      throw new Error('Insufficient healthy nodes to build circuit');
    }

    // 2. Selection Loop
    for (let i = 0; i < 50; i++) { // Max 50 attempts
      const entryIdx = this._weightedPick(guards);
      const entry = guards[entryIdx];

      const relayIdx = this._weightedPick(relays);
      const relay = relays[relayIdx];

      // Rule: Entry and Relay must be different regions
      if (entry.region === relay.region) continue;

      const exitIdx = this._weightedPick(exits);
      const exit = exits[exitIdx];

      // Rule: Relay and Exit must be different regions
      if (relay.region === exit.region) continue;

      // Successful build!
      return { entry, relay, exit };
    }

    throw new Error('Failed to find geo-diverse circuit path');
  }

  /**
   * Pick index based on relative scores (weighted random)
   */
  _weightedPick(nodes) {
    const totalScore = nodes.reduce((sum, n) => sum + n.score, 0);
    let rand = Math.random() * totalScore;
    
    for (let i = 0; i < nodes.length; i++) {
      rand -= nodes[i].score;
      if (rand <= 0) return i;
    }
    return nodes.length - 1;
  }
}

module.exports = new CircuitBuilder();
