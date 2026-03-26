/**
 * core/identity/profileFactory.js
 * 
 * Logic to generate realistic, weighted browser fingerprints.
 * Ensures UA/Platform/Screen/WebGL correlations.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── Data Sets ────────────────────────────────────────────────

const USER_AGENTS = [
  // Windows / Chrome
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform: 'Win32',
    vendor: 'Google Inc.',
    oscpu: 'Windows NT 10.0; Win64',
    weight: 45
  },
  // Mac / Chrome
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    platform: 'MacIntel',
    vendor: 'Google Inc.',
    oscpu: 'Intel Mac OS X 14_3_1',
    weight: 25
  },
  // Windows / Firefox
  {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    platform: 'Win32',
    vendor: '',
    oscpu: 'Windows NT 10.0; Win64',
    weight: 15
  },
  // Linux / Chrome
  {
    ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    platform: 'Linux x86_64',
    vendor: 'Google Inc.',
    oscpu: 'Linux x86_64',
    weight: 10
  },
  // Mac / Safari
  {
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    platform: 'MacIntel',
    vendor: 'Apple Computer, Inc.',
    oscpu: 'Intel Mac OS X 14_3_1',
    weight: 5
  }
];

const SCREENS = [
  { width: 1920, height: 1080, colorDepth: 24, weight: 60 },
  { width: 2560, height: 1440, colorDepth: 24, weight: 15 },
  { width: 1440, height: 900,  colorDepth: 24, weight: 15 },
  { width: 1366, height: 768,  colorDepth: 24, weight: 10 }
];

const WEBGL_RENDERERS = [
  { vendor: 'Intel Inc.',  renderer: 'Intel Iris OpenGL Engine', weight: 50 },
  { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060/PCIe/SSE2', weight: 30 },
  { vendor: 'Google Inc.', renderer: 'ANGLE (Intel)', weight: 20 }
];

class ProfileFactory {
  /**
   * Generates a new identity profile based on weighted randomization.
   */
  createProfile() {
    const baseUA = this._weightedPick(USER_AGENTS);
    const screen = this._weightedPick(SCREENS);
    const webgl  = this._weightedPick(WEBGL_RENDERERS);

    return {
      sessionId:    uuidv4(),
      userAgent:    baseUA.ua,
      platform:     baseUA.platform,
      vendor:       baseUA.vendor,
      oscpu:        baseUA.oscpu,
      hardwareConcurrency: this._pickRandom([4, 8, 12, 16]),
      deviceMemory: this._pickRandom([4, 8, 16, 32]),
      
      screen: {
        width:      screen.width,
        height:     screen.height,
        availWidth: screen.width,
        availHeight:screen.height - 40, // typical taskbar/dock
        colorDepth: screen.colorDepth,
        pixelDepth: screen.colorDepth
      },

      webglVendor:  webgl.vendor,
      webglRenderer:webgl.renderer,

      // Deterministic noise seeds
      canvasSeed:   Math.floor(Math.random() * 65535),
      audioNoise:   0.00005 + Math.random() * 0.00015,
      
      // Timezone is usually synced to the exit node, 
      // so we use a placeholder that server.js will fill based on circuit.
      timezone:     'UTC', 
      
      createdAt:    Date.now(),
      expiresAt:    Date.now() + (45 * 60 * 1000) // 45 mins
    };
  }

  /**
   * Helper for weighted random selection.
   */
  _weightedPick(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      if (random < item.weight) return item;
      random -= item.weight;
    }
    return items[0];
  }

  /**
   * Helper for simple random selection.
   */
  _pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
}

module.exports = new ProfileFactory();
