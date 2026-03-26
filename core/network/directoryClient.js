/**
 * AEGIS Network — directoryClient.js
 * 
 * ROLE: Fetches the node consensus from the DA and verifies its 
 *       cryptographic signature before updating the local registry.
 */

'use strict';

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Public key bundled with the client
const DA_PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../directory/da-public.pem'), 'utf8');

class DirectoryClient {
  constructor(daUrl = 'http://localhost:3002') {
    this.daUrl = daUrl;
  }

  /**
   * Fetches and verifies the node list
   */
  async fetchConsensus() {
    try {
      console.log(`[Directory] Fetching consensus from ${this.daUrl}...`);
      const res = await axios.get(`${this.daUrl}/consensus`);
      const { payload, signature } = res.data;

      // Verify RSA-SHA256 signature
      const verifier = crypto.createVerify('SHA256');
      verifier.update(JSON.stringify(payload));
      verifier.end();

      const isValid = verifier.verify(DA_PUBLIC_KEY, signature, 'hex');

      if (!isValid) {
        throw new Error('CONSENSUS SIGNATURE INVALID — POTENTIAL ATTACK');
      }

      console.log(`[Directory] Successfully verified consensus (Authored: ${new Date(payload.timestamp).toLocaleTimeString()})`);
      return payload.nodes;
    } catch (err) {
      console.error(`[Directory] Consensus failure: ${err.message}`);
      return null;
    }
  }
}

module.exports = DirectoryClient;
