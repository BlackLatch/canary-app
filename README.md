# Canary

**Silence becomes a signal.**

Canary is a privacy dApp that ensures encrypted data is released only under verifiable conditions.  
It operates entirely client-side using **threshold cryptography**, **decentralized storage**, and **peer-to-peer signaling**.

ReFi Hackathon Video Submission: https://youtu.be/MSMqIGQ-n88

---

## Overview

Canary provides cryptographic assurance that data remains protected until specific triggers are met.  
It does not rely on a backend or trusted server. All encryption, signing, and verification occur locally or across decentralized peers.

---

## Core Features

- **Heartbeats** — cryptographic proofs of presence verifying ongoing control over encrypted data.  
- **Release Triggers** — automated conditions that distribute encrypted payloads when heartbeats stop.  
- **End-to-End Encryption** — all data is encrypted locally before any distribution.  
- **Peer-to-Peer Messaging** — built with Waku for resilient, censorship-resistant signaling.  
- **Threshold Decryption** — multi-party decryption through TACo nodes; no single entity can unlock data.  
- **Anonymous Wallets** — supports in-browser burner wallets for private, ephemeral key generation and use.  

---

## Architecture

| Layer | Technology | Function |
|-------|-------------|-----------|
| **Encryption / Access Control** | TACo (Threshold Access Control) | Distributed key management and verification |
| **Storage** | Codex / IPFS | Decentralized, redundant file storage |
| **Messaging** | Waku | Peer-to-peer message propagation for heartbeats and triggers |
| **Frontend** | React + Next.js (PWA) | Client-side app with offline capability |
| **Wallet** | Embedded Burner Wallet + ERC-4337 Support | Anonymous and ephemeral transaction signing |

No centralized servers.  
No single point of failure.  
No telemetry or analytics.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18  
- npm or yarn  
- Modern browser with WebCrypto and IndexedDB support

### Installation
```bash
git clone https://github.com/BlackLatch/canary-app.git
cd canary-app
npm install
npm run dev

