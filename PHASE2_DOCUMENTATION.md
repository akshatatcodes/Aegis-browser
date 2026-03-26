# 🛡️ AEGIS — Phase 2 Complete Documentation
### Real Identity Profile System (Correlated Fingerprinting)
> Version 2.0 | Phase 2 of 12 | March 2026

---

## 📋 Phase 2 Overview

**Phase 2 replaces the Phase 1 identity stubs with a production-grade identity engine.** In Phase 1, the browser just picked random values from a list. In Phase 2, we implement **weighted randomization** and **attribute correlation** to ensure that browser fingerprints look like real physiological devices, not synthetic AI-generated bots.

**What Phase 2 Delivers:**
- **`sessionStore.js`**: A dedicated per-tab session manager that persists identities across page reloads.
- **`profileFactory.js`**: A sophisticated fingerprint generator with weighted distribution (e.g., matching the real-world market share of Windows vs. Mac).
- **Correlation Logic**: Ensures that a Mac User-Agent is paired with Mac-specific screen resolutions and WebGL renderers.
- **Improved Entropy**: Adds `hardwareConcurrency`, `deviceMemory`, and OS-specific `oscpu` strings to the profile.
- **Timezone Sync**: Automatically maps the browser's reported timezone to the circuit's exit node location.

---

## 🏗️ Architecture: The Identity Pipeline

```
┌──────────────────────────────────────────────────────────┐
│                  PHASE 2 CORE MODULES                    │
│                                                          │
│  ┌──────────────────┐      ┌───────────────────────────┐ │
│  │   server.js      │◄─────┤   sessionStore.js         │ │
│  └────────┬─────────┘      │ (Map<tabId, Session>)     │ │
│           │                └─────────────▲─────────────┘ │
│           │                              │               │
│  ┌────────▼──────────────────────────────┴────────────┐ │
│  │            profileFactory.js                        │ │
│  │                                                     │ │
│  │  1. Pick Weighted UA (e.g. 45% Win, 25% Mac)       │ │
│  │  2. Pick Correlated Screen (Win → 1080p, etc.)     │ │
│  │  3. Pick Realistic WebGL (Intel vs NVIDIA)         │ │
│  │  4. Generate Seeded Noise (Canvas + Audio)         │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 📄 File-by-File Documentation

### 1. `core/identity/sessionStore.js` — The Session Manager

#### What It Is
A singleton class that maintains the mapping between `tabId` (from the browser) and its current `Session` object (identity + circuit).

#### Why It Exists
In Phase 1, the session Map was hardcoded inside `server.js`. As Aegis grows, we need a dedicated store that can handle session expiry, stale session cleanup, and (in Phase 6) transparently switch from in-memory to Redis without breaking the API.

#### Key Features
- **Auto-Cleanup**: Purges sessions that haven't been accessed in 1 hour.
- **Persistence**: Ensures that as long as a tab is open, its identity remains consistent unless the user explicitly clicks "New Identity".

---

### 2. `core/identity/profileFactory.js` — The Fingerprint Engine

#### What It Is
The "brain" of Aegis's identity layer. It contains the data sets and logic for generating every piece of data the browser reports to websites.

#### How Weighted Randomization Works
Instead of `Math.random()`, we use a `_weightedPick` algorithm.
- **Windows / Chrome**: 45% weight (most common)
- **Mac / Chrome**: 25% weight
- **Linux / Chrome**: 10% weight
- **Mac / Safari**: 5% weight

This ensures that Aegis users "blend in" with the largest crowds, making them harder to identify via statistical analysis.

#### Correlation Matrix (Phase 2)
| Attribute | Correlation |
|---|---|
| **Platform** | Inferred from User-Agent (Win32, MacIntel, Linux x86_64) |
| **Vendor** | Inferred from Engine (Google Inc. for Chrome, Mozilla for Firefox) |
| **Timezone** | Dynamically updated based on Exit Node IP region |
| **WebGL** | Weighted towards Intel/NVIDIA based on platform |

---

### 3. `core/server.js` — Updated API Integration

#### Changes in Phase 2
- **Endpoint Update**: `/api/identity/:tabId` now calls `sessionStore.getOrCreate`.
- **Rotation Logic**: `POST /api/rotate-identity` now calls `profileFactory.createProfile()` and updates the session store.
- **Timezone Mapping**: Added a `regionToTz` map that correlates circuit exit nodes to IANA timezone strings.

---

## 🧪 Verification & Testing

### Identity Consistency Test
1. Request `/api/identity/tab_1` multiple times.
2. **Success**: Returns the same `sessionId` and `userAgent` every time.
3. Call `POST /api/rotate-identity { "tabId": "tab_1" }`.
4. Request `/api/identity/tab_1` again.
5. **Success**: Returns a new `sessionId`.

### Weighted Distribution Test
Running the `core/tests/identityTest.js` verification script for 100 runs confirms:
- Windows (~45%)
- Mac (~30%)
- Linux (~10-15%)

---

## 🚀 Next Steps (Phase 3 Prep)
Now that identities are robust, Phase 3 will implement the **Onion Encryption** layer and the **Local Proxy** (port 8118) that will actually use these identities to route real traffic.
