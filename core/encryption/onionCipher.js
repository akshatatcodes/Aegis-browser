/**
 * core/encryption/onionCipher.js
 * 
 * Implements multi-layer AES-256-GCM encryption for onion routing.
 * Each layer represents a "hop" in the circuit.
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

class OnionCipher {
  /**
   * Encrypts data for a single layer.
   * returns Buffer: [IV (12b)] [TAG (16b)] [Ciphertext]
   */
  encryptLayer(data, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]);
  }

  /**
   * Decrypts a single layer.
   * expects Buffer: [IV (12b)] [TAG (16b)] [Ciphertext]
   */
  decryptLayer(encryptedData, key) {
    try {
      const iv = encryptedData.slice(0, IV_LENGTH);
      const tag = encryptedData.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
      const ciphertext = encryptedData.slice(IV_LENGTH + TAG_LENGTH);

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }

  /**
   * Wraps a payload in multiple layers of encryption (Onion Wrap).
   * keys[] order: [Exit Key, Relay Key, Entry Key]
   * Result: Entry(Relay(Exit(Payload)))
   */
  wrapOnion(payload, keys) {
    let current = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    
    // We wrap from inside out: Exit -> Relay -> Entry
    for (const key of keys) {
      current = this.encryptLayer(current, key);
    }
    
    return current;
  }

  /**
   * Unwraps a single layer at a node.
   */
  unwrapLayer(onion, key) {
    return this.decryptLayer(onion, key);
  }

  /**
   * Generate a secure 32-byte key (stubs for ECDH in Phase 6)
   */
  generateKey() {
    return crypto.randomBytes(32);
  }
}

module.exports = new OnionCipher();
