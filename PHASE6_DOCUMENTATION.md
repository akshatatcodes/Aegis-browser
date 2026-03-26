# 🛡️ Aegis Privacy Network — Phase 6: Mix Node Layer

The **Mix Node Layer** adds a critical cryptographic defense against traffic correlation. By batching signals from multiple sources and shuffling their order before forwarding, Aegis makes it mathematically impossible for an observer to match incoming and outgoing flows.

## 🧱 What's New in Phase 6

### 1. Timed Mix Nodes (`core/mixnode/`)
-   **Traffic Batching**: Packets are collected into a buffer for **300ms** or until **10 packets** are reached.
-   **Cryptographic Shuffling**: The internal order of each batch is randomized using a Fisher-Yates shuffle before flushing.
-   **Dummy Injection**: If a batch is too small to provide anonymity, the `DummyInjector` automatically fills the gap with high-entropy "Cover Traffic."

### 2. Packet Padding (`core/encryption/`)
-   **Uniform Sizing**: Every packet in the Aegis network is now padded to exactly **4096 bytes**.
-   **Feature**: Prevents "Size Analysis" attacks where an adversary identifies a website or file by its unique packet size signature.

### 3. Proxy Simulation
-   The `LocalProxy` now "samples" traffic into the mix layer in real-time. You can see the logs in your terminal during browsing:
    -   `[MixNode] 🌪️ Mixing batch of 5...`
    -   `[MixNode] Threshold not met. Injecting 2 dummies.`

---

## 🚀 How to Run Phase 6

### 1. Start the Backend
```powershell
cd core
node server.js
```

### 2. Verify with standalone Test
```powershell
node core/tests/mixNodeTest.js
```

### 3. Browse with Aegis
Launch the browser as usual (`npm start`). You will notice a slight increase in latency (~300ms) which represents the **Anonymity Delay** introduced by the Timed Mix.

---

## 🛤️ Progress Tracker
- [x] Mix Node Implementation (Batch/Shuffle/Forward)
- [x] Dummy Traffic Injection
- [x] Packet Padding (4096-byte fixed size)
- [x] Proxy Integration (Real-time simulation)
- [x] Circuit Metadata Integration
