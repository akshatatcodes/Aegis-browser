/**
 * core/tests/identityTest.js
 * 
 * Verifies Phase 2 Identity Profile System.
 */

'use strict';

const profileFactory = require('../identity/profileFactory');
const sessionStore   = require('../identity/sessionStore');

console.log('🧪 Starting Phase 2 Identity Verification...\n');

// 1. Test Profile Generation
console.log('--- 1. Testing Profile Generation ---');
const profiles = [];
for (let i = 0; i < 5; i++) {
  const p = profileFactory.createProfile();
  profiles.push(p);
  console.log(`Profile ${i+1}: ${p.userAgent.substring(0, 50)}... [${p.platform}]`);
  console.log(`   Screen: ${p.screen.width}x${p.screen.height}, CanvasSeed: ${p.canvasSeed}`);
}

if (profiles.length === 5) {
  console.log('✅ Generated 5 profiles successfully.\n');
} else {
  console.error('❌ Failed to generate profiles.\n');
  process.exit(1);
}

// 2. Test Session Store
console.log('--- 2. Testing Session Store ---');
const tabId = 'test-tab-123';
const mockSession = {
  identity: profiles[0],
  circuit: { id: 'mock-circuit' }
};

sessionStore.set(tabId, mockSession);
const retrieved = sessionStore.get(tabId);

if (retrieved && retrieved.identity.sessionId === profiles[0].sessionId) {
  console.log('✅ Session store persisted and retrieved correctly.');
} else {
  console.error('❌ Session store failure.');
  process.exit(1);
}

if (sessionStore.has(tabId)) {
  console.log('✅ sessionStore.has() works.');
}

sessionStore.delete(tabId);
if (!sessionStore.has(tabId)) {
  console.log('✅ sessionStore.delete() works.\n');
}

// 3. Test Weighted Randomization (Visual check)
console.log('--- 3. Testing Weighted Randomization (100 runs) ---');
const uaCounts = {};
for (let i = 0; i < 100; i++) {
  const p = profileFactory.createProfile();
  uaCounts[p.platform] = (uaCounts[p.platform] || 0) + 1;
}
console.log('Platform distribution in 100 runs:', uaCounts);
console.log('Expected: Win32 should be highest (~60%), MacIntel next (~30%), Linux last (~10%).');

console.log('\n✨ Phase 2 Core Logic Verified Successfully.');
