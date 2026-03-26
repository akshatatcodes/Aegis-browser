/**
 * core/tests/encryptionTest.js
 * 
 * Verifies Phase 3 Onion Encryption logic.
 */

'use strict';

const onionCipher = require('../encryption/onionCipher');

console.log('🧪 Starting Phase 3 Encryption Verification...\n');

// 1. Test Single Layer
console.log('--- 1. Testing Single Layer Encryption ---');
const key = onionCipher.generateKey();
const message = 'Privacy is a human right.';
const encrypted = onionCipher.encryptLayer(Buffer.from(message), key);
const decrypted = onionCipher.decryptLayer(encrypted, key);

if (decrypted.toString() === message) {
  console.log('✅ Single layer encrypt/decrypt successful.');
} else {
  console.error('❌ Single layer failed.');
  process.exit(1);
}

// 2. Test 3-Layer Onion Wrap
console.log('--- 2. Testing 3-Layer Onion Wrap ---');
const keys = [
  onionCipher.generateKey(), // Inner (Exit)
  onionCipher.generateKey(), // Middle (Relay)
  onionCipher.generateKey()  // Outer (Entry)
];

const onion = onionCipher.wrapOnion(message, keys);
console.log(`Payload: "${message}" (${Buffer.from(message).length} bytes)`);
console.log(`Onion size: ${onion.length} bytes (Added ${onion.length - message.length} bytes overhead)`);

// Unwrap Entry
const layer1 = onionCipher.unwrapLayer(onion, keys[2]);
// Unwrap Relay
const layer2 = onionCipher.unwrapLayer(layer1, keys[1]);
// Unwrap Exit
const final = onionCipher.unwrapLayer(layer2, keys[0]);

if (final.toString() === message) {
  console.log('✅ 3-layer onion wrap/unwrap successful.');
} else {
  console.error('❌ Onion wrap failed.');
  process.exit(1);
}

// 3. Test Integrity (Tamper test)
console.log('--- 3. Testing Integrity (Tamper detection) ---');
const tampered = Buffer.from(encrypted);
tampered[30] ^= 0x01; // Flip one bit in ciphertext

try {
  onionCipher.decryptLayer(tampered, key);
  console.error('❌ Tamper test failed: Decrypted corrupted data without error.');
  process.exit(1);
} catch (err) {
  console.log('✅ Tamper test successful (AuthTag rejected corrupted data).');
}

console.log('\n✨ Phase 3 Encryption Logic Verified Successfully.');
