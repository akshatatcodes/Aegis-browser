# 🛡️ AEGIS — Phase 4 Complete Documentation
### Adaptive Routing Brain (The Intelligence)
> Version 4.0 | Phase 4 of 12 | March 2026

---

## 📋 Phase 4 Overview

**Phase 4 implements the "Intelligence" of the Aegis network.** In Phases 1-3, we built the browser, identities, and encryption tunnel. In Phase 4, we replace the random "pick a node" logic with a sophisticated routing engine that selects the safest and fastest paths.

**What Phase 4 Delivers:**
- **`nodeScorer.js`**: Calculates a real-time health score for every node (0.0 to 1.0).
- **`circuitBuilder.js`**: Implements the Path Selection Rules (3 hops, geographic diversity).
- **`routingBrain.js`**: Orchestrates the building and rotation of circuits.
- **Adaptive Selection**: The system now automatically avoids low-trust or high-latency nodes.

---

## 🏗️ The Scoring Engine (`nodeScorer.js`)

Aegis uses a multi-factor formula to rank nodes. This prevents "Sybil" nodes (fake nodes controlled by attackers) from being selected if they provide poor performance or show suspicious behavior.

### The Formula:
```text
score = (uptime * 0.30) + (trustScore * 0.40) + (latencyScore * 0.20) - (anomalyPenalty * 0.10)
```

| Factor | Weight | Reality Check |
|---|---|---|
| **Uptime** | 30% | Favors nodes that stay online consistently. |
| **Trust Score** | 40% | Determined by the Directory Authority (DA). |
| **Latency** | 20% | Favors nodes with <= 50ms response times. |
| **Anomaly** | -10% | Penalizes nodes that drop connections or fail handshakes. |

---

## 🏛️ Path Selection Rules (`circuitBuilder.js`)

Every circuit built by Aegis in Phase 4 must follow these strict privacy rules:

1.  **3-Hop Minimum**: Every path MUST be Entry -> Relay -> Exit.
2.  **Geographic Diversity**: No two **adjacent** nodes are allowed to be in the same region/country.
    - *Example*: If the Entry is in `EU-West`, the Relay CANNOT be in `EU-West`.
3.  **Weighted Selection**: High-scoring nodes are exponentially more likely to be picked than low-scoring nodes.
4.  **Health Threshold**: Nodes with a total score below `0.4` are excluded from the pool entirely.

---

## 🧪 Verification & Testing

### Routing Logic Test
Ran `node core/tests/routingTest.js`:
- ✅ **Geographic Diversity**: Generated 100 circuits; 0 violations of the adjacent-region rule.
- ✅ **Scoring Priority**: In a pool of 8 nodes, a "Bad Node" (low score) was picked less than 2% of the time.
- ✅ **Structure**: Verified every circuit followed the required 3-layer role structure.

---

## 🚀 How to Run Phase 4
1. `cd core && node server.js`
2. Open the Aegis Browser.
3. Access `/api/circuit/default` to see the new intelligent circuit details.
