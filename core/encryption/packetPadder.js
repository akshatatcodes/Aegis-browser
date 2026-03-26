/**
 * AEGIS Encryption — packetPadder.js
 * 
 * ROLE: Ensures every packet in the network is exactly the same size.
 *       This defeats "Size Analysis" attacks where an observer
 *       identifies a website by its unique fingerprint of packet sizes.
 */

'use strict';

const crypto = require('crypto');

class PacketPadder {
  constructor(fixedSize = 4096) {
    this.fixedSize = fixedSize;
  }

  /**
   * Pads a buffer to the fixed size using high-entropy random bytes.
   * Format: [4-byte original_len][original_data][random_padding]
   */
  pad(data) {
    const originalBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const originalLen = originalBuffer.length;

    if (originalLen > this.fixedSize - 4) {
      throw new Error(`Data exceeds fixed packet size (${this.fixedSize} bytes)`);
    }

    const paddedBuffer = Buffer.alloc(this.fixedSize);
    
    // Write original length (uint32be)
    paddedBuffer.writeUInt32BE(originalLen, 0);
    
    // Write original data
    originalBuffer.copy(paddedBuffer, 4);
    
    // Fill remaining space with high-entropy random bytes
    const paddingLen = this.fixedSize - 4 - originalLen;
    if (paddingLen > 0) {
      crypto.randomBytes(paddingLen).copy(paddedBuffer, 4 + originalLen);
    }

    return paddedBuffer;
  }

  /**
   * Unpads a buffer by reading the length header.
   */
  unpad(paddedBuffer) {
    if (paddedBuffer.length !== this.fixedSize) {
      throw new Error('Invalid packet size for unpadding');
    }

    const originalLen = paddedBuffer.readUInt32BE(0);
    if (originalLen > this.fixedSize - 4) {
      throw new Error('Corrupt packet: length exceeds bounds');
    }

    return paddedBuffer.slice(4, 4 + originalLen);
  }
}

module.exports = new PacketPadder();
