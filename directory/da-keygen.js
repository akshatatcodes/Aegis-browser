/**
 * AEGIS Directory Authority — da-keygen.js
 * 
 * ROLE: Generates the RSA-2048 key pair used by the DA to sign
 *       the node list. The private key stays on the DA server,
 *       the public key is bundled with every Aegis client.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_DIR = __dirname;
const PRIVATE_KEY_PATH = path.join(KEY_DIR, 'da-private.pem');
const PUBLIC_KEY_PATH  = path.join(KEY_DIR, 'da-public.pem');

function generateKeys() {
  console.log('[DA] Generating RSA-2048 key pair...');
  
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

  console.log(`[DA] Keys generated successfully.`);
  console.log(`  > Private: ${PRIVATE_KEY_PATH}`);
  console.log(`  > Public:  ${PUBLIC_KEY_PATH}`);
}

if (require.main === module) {
  generateKeys();
}
