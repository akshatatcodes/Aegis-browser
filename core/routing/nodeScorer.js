/**
 * core/routing/nodeScorer.js
 * 
 * Implements the Aegis Node Scoring formula.
 * score = (uptime * 0.30) + (trustScore * 0.40) + (latencyScore * 0.20) - (anomalyPenalty * 0.10)
 */

'use strict';

class NodeScorer {
  /**
   * Calculates a health score from 0.0 to 1.0
   */
  calculateScore(node) {
    if (node.flagged) return 0.0;

    const uptimeWeight = 0.30;
    const trustWeight  = 0.40;
    const latencyWeight = 0.20;
    const anomalyWeight = 0.10;

    // Normalize inputs
    const uptimeFactor = (node.uptime || 0) / 100;
    const trustFactor  = node.trustScore || 0;

    // Latency Score: 1.0 for <= 50ms, 0.0 for >= 500ms
    const latency = node.latencyMs || 1000;
    const latencyFactor = Math.max(0, 1 - (latency - 50) / 450);

    const anomalyPenalty = Math.min(1, (node.anomalyCount || 0) * 0.1);

    const score = (uptimeFactor * uptimeWeight) + 
                  (trustFactor  * trustWeight)  + 
                  (latencyFactor * latencyWeight) - 
                  (anomalyPenalty * anomalyWeight);

    return Math.max(0.0, Math.min(1.0, score));
  }

  /**
   * Sorts nodes by score descending
   */
  rankNodes(nodes) {
    return nodes
      .map(node => ({ ...node, score: this.calculateScore(node) }))
      .sort((a, b) => b.score - a.score);
  }
}

module.exports = new NodeScorer();
