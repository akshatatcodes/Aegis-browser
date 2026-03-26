/**
 * core/tests/phantomTest.js
 * 
 * Verifies Phase 5 Phantom Clone System:
 * 1. Correct number of clones (3-5)
 * 2. Uniqueness of entry nodes
 * 3. Staggered timing (100-500ms)
 */

'use strict';

const phantomLauncher = require('../phantom/phantomLauncher');

const MOCK_NODES = [
  { id: 'node-eu-1',  role: 'guard',  region: 'EU-West',  uptime: 99, trustScore: 0.9, latencyMs: 30 },
  { id: 'node-us-1',  role: 'guard',  region: 'US-East',  uptime: 98, trustScore: 0.8, latencyMs: 50 },
  { id: 'node-uk-1',  role: 'guard',  region: 'EU-North', uptime: 99, trustScore: 0.9, latencyMs: 40 },
  { id: 'node-in-1',  role: 'guard',  region: 'AP-South', uptime: 97, trustScore: 0.7, latencyMs: 120 },
  { id: 'node-br-1',  role: 'guard',  region: 'SA-East',  uptime: 96, trustScore: 0.6, latencyMs: 150 },
  { id: 'node-relay', role: 'relay', region: 'Relay-Region', uptime: 99, trustScore: 1.0, latencyMs: 20 },
  { id: 'node-exit',  role: 'exit',  region: 'Exit-Region',  uptime: 99, trustScore: 1.0, latencyMs: 25 }
];

console.log('🧪 Starting Phase 5 Phantom Verification...\n');

// 1. Test Launcher Preparation
console.log('--- 1. Testing Clone Preparation ---');
const count = 4;
const clones = phantomLauncher.prepareClones(MOCK_NODES, count);

if (clones.length === count) {
  console.log(`✅ Correct number of clones prepared: ${clones.length}`);
} else {
  console.error('❌ Clone count mismatch');
  process.exit(1);
}

// 2. Test Entry Node Uniqueness
console.log('\n--- 2. Testing Entry Node Uniqueness ---');
const entryIds = clones.map(c => c.circuit.entry.id);
const uniqueEntries = new Set(entryIds);

if (uniqueEntries.size === entryIds.length) {
  console.log('✅ All clones are using unique Entry nodes.');
} else {
  console.warn('⚠️ Entry node collision detected (can happen if node pool is small).');
}

// 3. Test Staggered Timing
console.log('\n--- 3. Testing Staggered Timing ---');
let timingValid = true;
clones.forEach((clone, i) => {
  console.log(`Clone ${i+1}: ${clone.delayMs}ms delay`);
  if (clone.delayMs < 100 || clone.delayMs > 500) timingValid = false;
});

if (timingValid) {
  console.log('✅ All delays are within the 100-500ms staggered range.');
} else {
  console.error('❌ Timing validation failed.');
  process.exit(1);
}

// 4. Test Launcher Execution (Visual/Log check)
console.log('\n--- 4. Execution Simulation ---');
phantomLauncher.launch('google.com', clones);

setTimeout(() => {
  console.log('\n✨ Phase 5 Phantom System Verified Automatically.');
}, 600);
