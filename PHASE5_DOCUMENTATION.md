# 🛡️ AEGIS — Phase 5 Complete Documentation
### Phantom Clone System (Traffic Obfuscation)
> Version 5.0 | Phase 5 of 12 | March 2026

---

## 📋 Phase 5 Overview

**Phase 5 implements the "Phantom Clone System,"** a critical layer for defeating traffic analysis. Every time the user makes a real request, Aegis automatically launches multiple "decoy" requests across different circuits. This floods the network with similar-looking traffic, making it statistically impossible for an observer to distinguish the real user flow.

**What Phase 5 Delivers:**
- **`phantomLauncher.js`**: Orchestrates the creation of 3–5 decoy circuits for every real request.
- **`phantomPayload.js`**: Generates realistic dummy traffic to fill the decoy circuits.
- **Staggered Timing**: Decoy requests are fired with random delays (100–500ms) to mimic organic browsing behavior.
- **Circuit Uniqueness**: Each clone is forced to use a unique Entry node to maximize obfuscation.

---

## 🏗️ How it Works

When the Aegis Browser requests a site (e.g., `google.com`):

1.  **Real Flow**: A circuit is selected (Circuit A), and the request is sent.
2.  **Phantom Generation**: The system picks 3–5 additional circuits (B, C, D, E) using different Entry nodes.
3.  **Jitter Launch**:
    - Clone 1 (Circuit B) launched after `142ms`.
    - Clone 2 (Circuit C) launched after `288ms`.
    - Clone 3 (Circuit D) launched after `410ms`.
4.  **Result**: An adversary watching the target see 4–6 connections from different exit nodes at roughly the same time. They cannot correlate which one belongs to the user.

---

## 🧪 Verification & Testing

### Phantom Logic Test
Ran `node core/tests/phantomTest.js`:
- ✅ **Clone Count**: Verified that 3–5 clones are prepared per request.
- ✅ **Entry Node Uniqueness**: Confirmed that clones use different entry points to prevent source correlation.
- ✅ **Timing Stagger**: Verified that all clones are delayed within the 100–500ms range.
- ✅ **Integration**: Confirmed that `localProxy.js` triggers clones on ogni `CONNECT` request.

---

## 🚀 How to Run Phase 5
1.  Navigate to `f:/projects/proxy/aegis`.
2.  Start the backend: `node core/server.js`.
3.  Open the Aegis Browser: `npm start` (in `browser/`).
4.  As you browse, check the backend console logs to see phantoms being "fired" in the background!
