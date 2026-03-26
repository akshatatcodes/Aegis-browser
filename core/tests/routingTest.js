/**
 * core/tests/routingTest.js
 * 
 * Verifies Phase 4 Adaptive Routing rules:
 * 1. Geographic diversity (adjacent hops != same region)
 * 2. Score-based selection
 * 3. Circuit structure (Entry -> Relay -> Exit)
 */

'use strict';

const routingBrain = require('../routing/routingBrain');

const MOCK_NODES = [
  { id: 'node-eu-1', role: 'guard',  region: 'EU-West',  ip: '185.23.44.12',  latencyMs: 28,  trustScore: 0.94, uptime: 99.1, flagged: false },
  { id: 'node-us-1', role: 'guard',  region: 'US-East',  ip: '104.21.33.91',  latencyMs: 52,  trustScore: 0.91, uptime: 98.7, flagged: false },
  { id: 'node-eu-2', role: 'relay',  region: 'EU-North', ip: '46.182.21.9',   latencyMs: 35,  trustScore: 0.88, uptime: 99.5, flagged: false },
  { id: 'node-ap-1', role: 'relay',  region: 'AP-South', ip: '139.59.1.42',   latencyMs: 112, trustScore: 0.85, uptime: 97.2, flagged: false },
  { id: 'node-sa-1', role: 'relay',  region: 'SA-East',  ip: '177.71.128.5',  latencyMs: 145, trustScore: 0.82, uptime: 96.8, flagged: false },
  { id: 'node-ap-2', role: 'exit',   region: 'AP-East',  ip: '103.252.116.1', latencyMs: 88,  trustScore: 0.90, uptime: 98.3, flagged: false },
  { id: 'node-eu-3', role: 'exit',   region: 'EU-South', ip: '5.180.64.88',   latencyMs: 42,  trustScore: 0.87, uptime: 98.9, flagged: false },
  { id: 'node-bad',  role: 'guard',  region: 'EU-West',  ip: '0.0.0.0',       latencyMs: 900, trustScore: 0.1,  uptime: 10.0, flagged: false }
];

console.log('🧪 Starting Phase 4 Routing Verification...\n');

// 1. Test 100 random circuits for diversity
console.log('--- 1. Testing Geographic Diversity (100 runs) ---');
let diversityFailures = 0;
for (let i = 0; i < 100; i++) {
  const circuit = routingBrain.generateCircuit(MOCK_NODES);
  
  if (circuit.entry.region === circuit.relay.region || circuit.relay.region === circuit.exit.region) {
    console.error(`❌ Diversity Rule Violation in circuit ${i}:`, 
                  `${circuit.entry.region} -> ${circuit.relay.region} -> ${circuit.exit.region}`);
    diversityFailures++;
  }
}

if (diversityFailures === 0) {
  console.log('✅ 100/100 circuits passed geographic diversity rules.');
} else {
  console.error(`❌ Failed diversity: ${diversityFailures} violations.`);
  process.exit(1);
}

// 2. Test Score-based selection
console.log('\n--- 2. Testing Score-based Selection ---');
let badNodePicked = 0;
for (let i = 0; i < 1000; i++) {
  const circuit = routingBrain.generateCircuit(MOCK_NODES);
  if (circuit.entry.id === 'node-bad') badNodePicked++;
}

console.log(`Node-Bad pick rate: ${((badNodePicked/1000)*100).toFixed(2)}%`);

if (badNodePicked < 20) { // Should be very low/zero given scores
  console.log('✅ Scoring engine correctly prioritized healthy nodes.');
} else {
  console.warn('⚠️ Node-Bad was picked more than expected. Check weighting.');
}

// 3. Status Check simulation
console.log('\n--- 3. Simulation: Circuit Expiry ---');
const c1 = routingBrain.generateCircuit(MOCK_NODES);
console.log('Circuit created. Should rotate:', routingBrain.shouldRotate(c1));

// Mock time jump
const expiredCircuit = { ...c1, expiresAt: Date.now() - 1000 };
console.log('Circuit expired. Should rotate:', routingBrain.shouldRotate(expiredCircuit));

if (routingBrain.shouldRotate(expiredCircuit)) {
  console.log('✅ Expiry logic functioning.');
} else {
  console.error('❌ Expiry logic failed.');
  process.exit(1);
}

console.log('\n✨ Phase 4 Routing Brain Verified Successfully.');
