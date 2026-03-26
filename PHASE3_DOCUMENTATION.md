# 🛡️ AEGIS — Phase 3 Complete Documentation
### Onion Encryption & Local Proxy (The Tunnel)
> Version 3.0 | Phase 3 of 12 | March 2026

---

## 📋 Phase 3 Overview

**Phase 3 builds the "Tunnel" that Aegis traffic travels through.** In Phase 2, we built the identity (the passenger). Now, we build the armored vehicle (encryption) and the road (the proxy).

**What Phase 3 Delivers:**
- **`localProxy.js`**: A custom SOCKS5 proxy server (RFC 1928) running at `127.0.0.1:8118`. This is the endpoint the browser uses for all traffic.
- **`onionCipher.js`**: The encryption engine that implements multi-layer AES-256-GCM "Onion Wrapping".
- **Traffic Interception**: The proxy intercepts raw TCP/UDP traffic from the browser, wraps it in 3 layers of encryption, and prepares it for the routing network.
- **Connectivity Fix**: Resolves the `ERR_ABORTED` errors in the Aegis browser by providing a functional gateway.

---

## 🏗️ Architecture: The Onion Pipe

```
┌──────────────────────────────────────────────────────────┐
│                  PHASE 3 TRAFFIC FLOW                    │
│                                                          │
│  ┌───────────┐      ┌──────────────────────────────┐     │
│  │ Browser   │ SOCKS5 │      localProxy.js         │     │
│  │ (Webview) ├───────►┤ (Interception Layer)       │     │
│  └───────────┘      └──────────────┬───────────────┘     │
│                                    │                     │
│  ┌─────────────────────────────────▼──────────────────┐  │
│  │               onionCipher.js                       │  │
│  │                                                    │  │
│  │  1. Incoming Data (HTTP/WS)                        │  │
│  │  2. Wrap Layer 3 (Inner - Exit Key)                │  │
│  │  3. Wrap Layer 2 (Middle - Relay Key)              │  │
│  │  4. Wrap Layer 1 (Outer - Entry Key)               │  │
│  └─────────────────────────────────┬──────────────────┘  │
│                                    │                     │
│  ┌─────────────────────────────────▼──────────────────┐  │
│  │  [Final Destination / Future: Entry Node]          │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 📄 File-by-File Documentation

### 1. `core/proxy/localProxy.js` — The SOCKS5 Gateway

#### What It Is
A lightweight TCP server that implements the SOCKS5 protocol. It handles the initial handshake and the `CONNECT` command from the browser.

#### Key Features
- **Zero-Dependency**: Built entirely on Node.js `net` module for security and performance.
- **Tunneling**: Creates a bidirectional pipe between the browser and the target destination.
- **Interception**: Every byte of outgoing traffic passes through the `_pipeWithEncryption` hook.

---

### 2. `core/encryption/onionCipher.js` — The Armor

#### What It Is
The primary cryptographic implementation for Aegis. It uses the AEAD (Authenticated Encryption with Associated Data) property of AES-GCM to ensure both confidentiality and integrity.

#### Why AES-256-GCM?
- **Speed**: Supported by hardware acceleration (AES-NI) on most CPUs.
- **AuthTag**: Every layer has a 16-byte authentication tag. If even 1 bit of an encrypted packet is tampered with, the `AuthTag` check will fail during decryption, preventing traffic injection attacks.

#### Onion Wrapping Logic
```javascript
// Each layer adds 28 bytes of overhead (12b IV + 16b Tag)
payload -> [IV|Tag|Encrypted(Payload)] -> [IV|Tag|Encrypted(Layer1)] -> ...
```
In Phase 3, we demonstrate a 3-layer wrap. In Phase 4, these layers will correspond to the Entry, Relay, and Exit nodes.

---

## 🧪 Verification & Testing

### Encryption Integrity Test
Ran `node core/tests/encryptionTest.js`:
- ✅ **Single Layer**: Verified AES-256-GCM works.
- ✅ **3-Layer Onion**: Verified data survives wrapping/unwrapping.
- ✅ **Tamper Test**: Flipped bits in ciphertext; verified `AuthTag` correctly rejected the corrupted data.

### Proxy Connectivity Test
1. Start `core/server.js` (starts proxy at 8118).
2. Open Aegis Browser.
3. **Observation**: Browser no longer shows `ERR_ABORTED`. Sites load successfully through the local tunnel.

---

## 🚀 How to Run Phase 3
1. `cd core && node server.js`
2. Look for `[LocalProxy] SOCKS5 Listening on 127.0.0.1:8118`.
3. Open Aegis Browser and navigate.
