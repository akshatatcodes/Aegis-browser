/**
 * AEGIS Phase 6 Verification — mixNodeTest.js
 * 
 * Verifies that the Mix Node correctly batches, shuffles, and
 * potentially injects dummy traffic.
 */

'use strict';

const mixNode = require('../mixnode/mixNode');
const crypto = require('crypto');

console.log('--- Aegis MixNode Verification ---');

// 1. Send 3 "Real" packets (under the threshold of 5)
console.log('[Test] Sending 3 real packets...');
mixNode.receive(Buffer.from('Real Packet A'));
mixNode.receive(Buffer.from('Real Packet B'));
mixNode.receive(Buffer.from('Real Packet C'));

// Wait for the 500ms flush timeout
console.log('[Test] Waiting for Timed Mix flush...');
setTimeout(() => {
  console.log('\n[Test] Sending 6 real packets (triggers threshold early)...');
  for (let i = 0; i < 6; i++) {
    mixNode.receive(Buffer.from(`Burst Packet ${i}`));
  }
  
  setTimeout(() => {
    console.log('\n--- Phase 6 Test Complete ---');
    process.exit(0);
  }, 1000);
}, 1000);
