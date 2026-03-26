/**
 * core/phantom/phantomPayload.js
 * 
 * Generates realistic-looking dummy payloads for phantom clones.
 * In Phase 5: Simple buffer generator with randomized sizes.
 */

'use strict';

const crypto = require('crypto');

class PhantomPayload {
  /**
   * Generates a dummy payload that mimics real traffic volume.
   */
  generate(minSize = 512, maxSize = 4096) {
    const size = Math.floor(Math.random() * (maxSize - minSize)) + minSize;
    return crypto.randomBytes(size);
  }

  /**
   * Generates a dummy HTTP GET request string for the clone.
   */
  generateRequest(host) {
    const paths = ['/', '/api/v1/status', '/index.html', '/favicon.ico', '/assets/main.js'];
    const path = paths[Math.floor(Math.random() * paths.length)];
    
    return `GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`;
  }
}

module.exports = new PhantomPayload();
