# NaluXRP — White Paper

**Version 1.0 · 2025**

---

## Abstract

NaluXRP is a self-custodied, client-side XRPL wallet and portfolio analytics platform. It operates with zero server-side infrastructure for user data — every byte of sensitive information is encrypted with AES-256-GCM on the user's device and never transmitted to any external system. This paper describes the architectural decisions, cryptographic implementation, privacy model, XRPL integration layer, portfolio analytics engine, and mathematical fraud detection methodology that underpin the platform.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Why Client-Side and Locally Stored](#2-why-client-side-and-locally-stored)
3. [Architecture Overview](#3-architecture-overview)
4. [Cryptographic Design](#4-cryptographic-design)
5. [Vault System](#5-vault-system)
6. [Identity & Multi-Device Model](#6-identity--multi-device-model)
7. [XRPL Integration Layer](#7-xrpl-integration-layer)
8. [Wallet Management](#8-wallet-management)
9. [Reserve Mechanics](#9-reserve-mechanics)
10. [Portfolio Analytics Engine](#10-portfolio-analytics-engine)
11. [Mathematical Fraud Detection — Benford's Law](#11-mathematical-fraud-detection--benfords-law)
12. [Additional Statistical Signals](#12-additional-statistical-signals)
13. [Account Inspector — Risk Scoring](#13-account-inspector--risk-scoring)
14. [NFT & DEX Security Analysis](#14-nft--dex-security-analysis)
15. [AMM Liquidity Analysis](#15-amm-liquidity-analysis)
16. [Live Ledger Stream Architecture](#16-live-ledger-stream-architecture)
17. [Privacy Model](#17-privacy-model)
18. [Threat Model & Mitigations](#18-threat-model--mitigations)
19. [Profile & Identity Layer](#19-profile--identity-layer)
20. [iOS & PWA Deployment](#20-ios--pwa-deployment)
21. [Limitations & Honest Caveats](#21-limitations--honest-caveats)
22. [Conclusion](#22-conclusion)
23. [References](#23-references)

---

## 1. Problem Statement

The dominant model for cryptocurrency wallets involves a **trusted third party**: a custodial exchange or cloud-connected wallet that holds keys, stores user data on remote servers, and acts as an intermediary to the blockchain. This introduces:

- **Counterparty risk** — the provider can be hacked, go insolvent, freeze accounts, or face regulatory action
- **Privacy exposure** — transaction history, balances, and identity are aggregated by the provider
- **Censorship surface** — a centralized service can block users or transactions selectively
- **Single points of failure** — server outages mean wallet outages

Non-custodial alternatives have historically required technical sophistication (CLI tools, raw JSON-RPC), expensive hardware (hardware wallets), or accepted data leakage at the UI layer (browser extensions that phone home for analytics or key management).

The XRP Ledger presents a specific challenge: it is a high-throughput, feature-rich blockchain with trustlines, DEX orders, NFTs, AMM pools, payment channels, and escrow — all of which require sophisticated tooling to inspect and manage safely. Existing tools either require centralized infrastructure, or expose users to complex raw interfaces without the analytical context needed to detect compromise.

NaluXRP proposes a fourth path: a **full-featured, visually rich, analytically capable wallet** that operates entirely inside the user's browser, with no server whatsoever, and with built-in on-chain fraud detection.

---

## 2. Why Client-Side and Locally Stored

### The Case Against Server Storage

When user data is stored on a server, the following properties are unavoidably true:

1. **The server operator can read it** — encryption at rest is only as good as the operator's key management
2. **The server can be compelled** — law enforcement, courts, and hostile state actors can demand data
3. **The server can be breached** — even well-resourced organizations suffer data breaches regularly
4. **The server can disappear** — startups fail; when they do, user data may be lost or sold

For a wallet application, these risks are amplified: the data being protected is money.

### The Web Crypto API Changes the Equation

Modern browsers expose the **Web Crypto API** (`window.crypto.subtle`), which provides:

- Hardware-accelerated AES-GCM encryption/decryption
- PBKDF2 key derivation with configurable iteration counts
- True cryptographic random number generation via `crypto.getRandomValues()`
- **Non-exportable key objects** — CryptoKey objects with `extractable: false` cannot have their raw bytes read, even by JavaScript running on the same page

This means a browser application can perform military-grade encryption without any server involvement, and the derived key can be used for operations but never extracted or transmitted.

### localStorage as a Secure Ciphertext Store

`localStorage` is often dismissed as insecure — correctly so for plaintext. However, when used as a store for **AES-256-GCM authenticated ciphertext**, the threat model changes:

- An attacker who reads `localStorage` gets ciphertext — computationally indistinguishable from random noise without the key
- The key is derived from the user's password and **never persisted to storage**
- The ciphertext includes an authentication tag — any tampering is detected at decryption

The attack surface reduces to: **know the user's password AND have physical access to the device.** This is equivalent to the threat model of a hardware wallet with a PIN.

### Comparative Analysis

| Property | Custodial Exchange | Cloud Wallet | NaluXRP (Local) |
|----------|-------------------|--------------|-----------------|
| Data breach exposure | High | Medium | None (no server) |
| Subpoena surface | Present | Present | None |
| Offline functionality | None | Partial | Full |
| Infrastructure cost | Ongoing | Ongoing | Zero |
| User privacy | Low | Medium | Maximum |
| Censorship resistance | Low | Medium | High |
| Account recovery | Email/KYC reset | Seed phrase | Seed phrase + backup file |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser Context                          │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ auth.js  │  │profile.js│  │dashboard  │  │ inspector.js  │  │
│  │          │  │          │  │   .js     │  │               │  │
│  │CryptoVault  │Wallets   │  │Live Stream│  │8-module deep  │  │
│  │3-step    │  │Analytics │  │Metrics    │  │analysis       │  │
│  │signup    │  │Benford   │  │TX Mix     │  │Risk Scoring   │  │
│  │Sync/Backup  │Token/NFT │  │Fee Meter  │  │0–100 composite│  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────┬────────┘  │
│       │              │              │                │           │
│  ┌────▼──────────────▼──────────────▼────────────────▼────────┐  │
│  │              state.js / utils.js / config.js               │  │
│  └──────────────────────────────┬─────────────────────────────┘  │
│                                 │                                 │
│  ┌──────────────────────────────▼─────────────────────────────┐  │
│  │                          xrpl.js                           │  │
│  │   WebSocket · auto-reconnect · endpoint cycling · events   │  │
│  └──────────────────────────────┬─────────────────────────────┘  │
│                                 │                                 │
│  ┌──────────────────────────────▼─────────────────────────────┐  │
│  │                       localStorage                          │  │
│  │  naluxrp_vault_data  (AES-256-GCM ciphertext)               │  │
│  │  naluxrp_vault_meta  (salt, iterations, version)            │  │
│  │  naluxrp_session     (name, email — session convenience)    │  │
│  │  nalulf_balhist_*    (balance history snapshots)            │  │
│  │  nalulf_inspect_history  (last 8 addresses + risk scores)   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                               │
               ┌───────────────▼──────────────────┐
               │           XRPL Network            │
               │  wss://s1.ripple.com (primary)    │
               │  wss://s2.ripple.com              │
               │  wss://xrplcluster.com (fallback) │
               │  wss://xrpl.ws        (fallback)  │
               └───────────────────────────────────┘
```

All sensitive operations occur in the browser. The only outbound connections are:
1. XRPL WebSocket to public validators (account info, tx history, submission)
2. CoinGecko price feed — XRP/USD rate, unauthenticated public API
3. IPFS gateways — NFT metadata, only fetched for wallets with NFTs

---

## 4. Cryptographic Design

### Key Derivation

```
Password (UTF-8 string, entered by user)
         │
         ▼
PBKDF2-HMAC-SHA256
  iterations: 150,000
  salt:       32 random bytes (unique per account, stored in vault_meta)
  key length: 256 bits
         │
         ▼
CryptoKey { type: "secret", algorithm: AES-GCM, extractable: false }
```

**Why 150,000 iterations?**

NIST SP 800-132 (2010) recommended a minimum of 10,000 PBKDF2 iterations. The OWASP Password Storage Cheat Sheet (2023) recommends 600,000 for PBKDF2-SHA256 as a modern baseline. We choose 150,000 as a calibrated balance: aggressive enough to make offline dictionary attacks computationally expensive (~200–800ms on mobile hardware), fast enough to not frustrate users on low-end devices.

At 150,000 iterations, an attacker must compute 300,000 HMAC-SHA256 operations per password guess. On commodity cloud hardware (AWS c5.4xlarge, ~4M SHA256/sec), exhausting a 10-character alphanumeric password space would require approximately 3.4 × 10¹² guesses × 300,000 operations = infeasible.

**Why a random 32-byte salt per account?**

Without a unique salt, two users with the same password would produce the same derived key — enabling precomputed rainbow table attacks. The 32-byte random salt (256 bits of entropy) makes precomputation impossible: an attacker must run PBKDF2 fresh for every account.

### Encryption

```
vault JSON object
        │
        ▼
JSON.stringify(vault) → UTF-8 encoded Uint8Array
        │
        ▼
AES-256-GCM encrypt
  key:  derived CryptoKey (non-exportable)
  iv:   12 random bytes (generated fresh on every save operation)
  aad:  none
        │
        ▼
{ iv: Array<number>[12], cipher: Array<number>[N] }
        │
        ▼
JSON.stringify → localStorage["naluxrp_vault_data"]
```

**Why AES-256-GCM?**

GCM (Galois/Counter Mode) provides **authenticated encryption** (AEAD). Unlike AES-CBC which provides only confidentiality, GCM also produces a 128-bit authentication tag that covers every byte of ciphertext. Any modification to the stored ciphertext — even a single bit flip — causes decryption to fail with an authentication error. This prevents:

- **Malleability attacks** — an attacker cannot flip specific bits to alter decrypted values without detection
- **Ciphertext forgery** — a crafted ciphertext cannot be injected as a valid vault

**Why a new 12-byte IV per save?**

AES-GCM security is catastrophically broken if the same (key, IV) pair is used twice. Two ciphertexts encrypted with the same key and IV can be XORed to cancel the keystream, revealing the XOR of the plaintexts. By generating a cryptographically random IV on every save, this property is guaranteed regardless of how many times the vault is written.

### Key Lifecycle

```
Login:    Password entered → PBKDF2 derivation → CryptoKey in RAM (_key field)
Active:   _key used for encrypt/decrypt vault writes/reads
Inactive: Inactivity timer fires after 30 minutes
Lock:     _key = null (garbage collected), _vault = null
```

The key **never touches persistent storage.** Even if an attacker has both the localStorage contents (ciphertext) and a RAM dump from a locked session, they have ciphertext and a reference to a garbage-collected non-exportable key object — neither is useful without the original password.

---

## 5. Vault System

### Vault Schema

```json
{
  "checksum": "naluxrp_v2",
  "identity": {
    "name": "Alice",
    "email": "alice@example.com",
    "domain": "alice",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "profile": {
    "bio": "",
    "location": "",
    "website": ""
  },
  "wallets": [
    {
      "id": "w_1700000000000",
      "label": "Main Wallet",
      "address": "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "algo": "ed25519",
      "seed": "sXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "emoji": "💎",
      "color": "#00d4ff",
      "testnet": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "social": {}
}
```

**Checksum verification:** On every unlock, after decryption, the `checksum` field is compared to the expected constant `"naluxrp_v2"`. A mismatch means either the wrong password was used (decryption produced garbage bytes that happened to parse as JSON but contain the wrong checksum) or the data is corrupted.

**Watch-only wallets** store `seed: null` and `watchOnly: true`. Because they contain no secret material, their metadata is stored in `localStorage["nalulf_wallets"]` (plaintext) rather than the encrypted vault. This allows them to be displayed even when the vault is locked.

**Versioning:** The checksum string (`naluxrp_v2`) enables future migrations. If the encryption scheme is upgraded, the app can detect the old format by its checksum and offer a re-encryption migration path without data loss.

---

## 6. Identity & Multi-Device Model

### Why Names Are Device-Local

NaluXRP has no user account database. There is no server that could enforce global uniqueness of display names, emails, or handles. The local uniqueness check (stored in `nalulf_used_names`) prevents duplicate accounts **on the same browser** but makes no claim about global uniqueness.

This is a deliberate trade-off: no server means no data breach surface, no subpoena target, no single point of failure. The globally unique identifier for a NaluXRP user is their **XRPL address** — a 160-bit hash derived from a cryptographic public key, collision-resistant by construction.

### Cross-Device Sync Protocol

```
Device A (source)                     Device B (destination)
─────────────────────                 ──────────────────────
Vault data (ciphertext)
Vault meta (salt, version)
          │
          │  btoa(JSON({ vault, meta }))
          │  = base64-encoded bundle
          │─────────────────────────────────────────────────►
                                       Paste code into sync view
                                       Enter password
                                       ▼
                                       PBKDF2(password, meta.salt)
                                       = derived key
                                       ▼
                                       AES-GCM.decrypt(vault, key)
                                       ▼
                                       Verify checksum
                                       ▼
                                  Vault available on Device B
```

The sync code is the raw encrypted vault bytes, base64-encoded. Observing this code in transit (copy-paste, email, QR scan) reveals only ciphertext — it cannot be decrypted without the user's password.

---

## 7. XRPL Integration Layer

### WebSocket Architecture

NaluXRP maintains a persistent WebSocket connection to XRPL nodes:

- **Auto-reconnect** with exponential backoff (initial 1s, max 30s, jitter added)
- **Endpoint cycling** — if s1.ripple.com fails, tries s2.ripple.com, then xrpl.ws, then xrplcluster.com
- **Request timeout** — 12 seconds per WebSocket command before retry
- **Parallel fetches** — Inspector fires 5 independent requests simultaneously via `Promise.all()`
- **Abort guard** — `_inspectAbort` flag cancels stale renders if the user searches again mid-flight

### XRPL API Methods Used

| Method | Purpose |
|--------|---------|
| `account_info` | Balance, sequence number, owner count, account flags |
| `account_lines` | Token trustlines — issuer, balance, limit, freeze state |
| `account_tx` | Transaction history — up to 200 recent transactions |
| `account_nfts` | NFT holdings — serial number, URI, taxon, transfer fee, flags |
| `account_offers` | Open DEX orders — direction, pair, amount, sequence |
| `account_objects` | All ledger objects — channels, escrows, AMM LP tokens |
| `amm_info` | AMM pool details for LP position analysis |
| `submit` | Broadcast signed transaction blobs |
| `subscribe` | Real-time ledger stream (dashboard) |

### Transaction Signing

```
Transaction object (JSON)
         │
         ▼
CryptoVault.update() → decrypt seed from vault
         │
         ▼
xrpl.Wallet.fromSeed(plaintextSeed)
         │
         ▼
wallet.sign(tx)  →  { tx_blob: "XXXXX...", hash: "YYYYYYY..." }
         │
         ▼
Seed object discarded from memory
         │
         ▼
POST submit { tx_blob }  →  XRPL network
         │
         ▼
{ engine_result: "tesSUCCESS", tx_hash: "..." }
```

The seed is decrypted from the vault only for the duration of the signing operation and is never transmitted over the network. The XRPL validator receives only the signed transaction blob — a cryptographic proof of authorization without the key material that produced it.

---

## 8. Wallet Management

### Wallet Types

| Type | Seed Stored | Can Sign | Use Case |
|------|-------------|----------|----------|
| **Full (generated)** | Encrypted in vault | Yes | Self-generated wallets |
| **Full (imported)** | Encrypted in vault | Yes | Imported from seed phrase |
| **Watch-only** | Never | No | Monitoring external addresses |

### Seed Generation

For generated wallets, the entropy source is `crypto.getRandomValues()` — a CSPRNG provided by the browser's cryptographic primitives, seeded from the operating system's entropy pool (e.g., `/dev/urandom` on Linux, `CryptGenRandom` on Windows). This is equivalent in security quality to the entropy source used by hardware wallets.

```javascript
// Conceptually — actual xrpl.js internals
const entropyBytes = crypto.getRandomValues(new Uint8Array(16));
const wallet = xrpl.Wallet.generate('ed25519');
// wallet.seed   → sXXXXXX (family seed, base58)
// wallet.address → rXXXXXX
```

### Algorithm Selection

**Ed25519** (recommended):
- 32-byte keys vs secp256k1's 32-byte keys (similar size)
- Significantly faster signing and verification (~2× on most hardware)
- Deterministic signatures — no need for random nonces during signing (eliminates a category of nonce-reuse vulnerabilities)
- Increasingly the standard for new XRPL accounts

**secp256k1** (legacy compatible):
- Original XRPL algorithm
- Shares the curve with Bitcoin, enabling tooling interoperability
- Appropriate for accounts originally created with Bitcoin-derived tools

---

## 9. Reserve Mechanics

The XRPL requires every account to maintain a minimum XRP balance — the **reserve** — that cannot be spent. This serves as an anti-spam measure protecting validators from unbounded state growth.

### Reserve Formula

```
Reserve = BaseReserve + (OwnerCount × OwnerReserve)

Where:
  BaseReserve  = 10 XRP  (set by network consensus)
  OwnerReserve = 2 XRP per owned object (set by network consensus)
  OwnerCount   = from account_info.OwnerCount
```

**Objects that consume owner reserve:**
- Each trustline (IOU token held or issued)
- Each open DEX offer
- Each escrow object (created or received)
- Each payment channel
- Each NFT (minted or held)
- Each AMM LP token holding
- Each signer list entry

NaluXRP fetches `OwnerCount` from `account_info` and calculates the precise reserve on every balance sync. The available balance displayed is:

```
Available = TotalXRP - Reserve
```

This distinction is critical: a user with 15 XRP and 4 trustlines has a 18 XRP reserve and effectively 0 XRP available to spend.

---

## 10. Portfolio Analytics Engine

### Balance History

NaluXRP stores balance snapshots in `localStorage["nalulf_balhist_{address}"]` as a chronological array of `{ xrp, tokens, timestamp }` records. Snapshots are written:
- On every manual balance refresh
- On session start (after vault unlock)
- After any transaction is submitted

These snapshots power the **balance history sparkline** on wallet cards and the **balance chart** in the Analytics tab — showing the user their balance trajectory without requiring any historical API.

### Heatmap Construction

The **26-week activity heatmap** is built from the `account_tx` response:

1. Fetch up to 200 recent transactions
2. Extract the `date` field from each transaction (XRPL epoch seconds, offset from Jan 1 2000)
3. Convert to week-of-year buckets covering the trailing 26 weeks
4. Count transactions per week
5. Normalize to 0–4 intensity levels
6. Render as a 26×7 CSS grid with color intensity cells

### XRP Flow Analysis

For each transaction in history:
- **Inflow**: Payment where `Destination` = wallet address, amount > 0
- **Outflow**: Payment where `Account` = wallet address
- Net = Inflow total − Outflow total

This gives users a clear picture of their net XRP movement beyond just the current balance.

### Token Allocation

For wallets with multiple trustlines, the allocation bar shows the proportional share of each token by value where price data is available, or by nominal balance count where it is not.

---

## 11. Mathematical Fraud Detection — Benford's Law

### Theoretical Foundation

Benford's Law (1938, rediscovered by Frank Benford after Simon Newcomb's 1881 observation) states that in many naturally occurring numerical datasets, the probability of the leading digit *d* is:

```
P(d) = log₁₀(1 + 1/d)
```

This yields the distribution:

| d | P(d) |
|---|------|
| 1 | 30.103% |
| 2 | 17.609% |
| 3 | 12.494% |
| 4 | 9.691% |
| 5 | 7.918% |
| 6 | 6.695% |
| 7 | 5.799% |
| 8 | 5.115% |
| 9 | 4.576% |

The law arises from **scale invariance**: naturally generated numbers spanning multiple orders of magnitude will exhibit this distribution regardless of the unit of measurement. It was first applied to financial fraud detection by Mark Nigrini in his 1992 doctoral dissertation, subsequently adopted by the IRS and forensic accounting firms worldwide, and played a notable role in the Enron, WorldCom, and Bernie Madoff investigations.

### Why Blockchain Transactions Follow Benford's Law

Legitimate on-chain economic activity generates transactions that span many orders of magnitude — micro-payments of 0.001 XRP, routine payments of 1–100 XRP, and large settlements of 10,000+ XRP. This natural span across scales produces the characteristic Benford distribution.

Fabricated or structured transactions — characteristic of wash trading, layering, or volume inflation — tend to cluster around specific amounts (round numbers, equal splits), producing deviations from the expected distribution. These deviations are detectable.

### NaluXRP Implementation

1. Fetch the full transaction history via `account_tx`
2. Extract the XRP amount from each transaction (Payment type, `Amount` field)
3. Normalize to drops (XRPL's smallest unit, 1 XRP = 1,000,000 drops) to eliminate decimal artifacts
4. Extract the first significant digit of each amount
5. Count occurrences of digits 1–9
6. Calculate observed frequency distribution
7. Compute the **Kolmogorov-Smirnov statistic** (max absolute difference between cumulative observed and expected distributions)
8. Render overlaid bar chart — observed (blue bars) vs. expected (dotted Benford curve)

### Statistical Thresholds

| K-S Statistic | Assessment |
|---------------|-----------|
| < 0.05 | Consistent with Benford's Law — no anomaly |
| 0.05–0.10 | Mild deviation — may be normal for small sample sizes |
| 0.10–0.20 | Notable deviation — worth investigating |
| > 0.20 | Significant deviation — inconsistent with natural financial activity |

> **Sample size caveat:** Benford's Law requires a sufficiently large and diverse dataset to be reliable. Fewer than ~50 transactions produce high variance. NaluXRP notes the sample size alongside the analysis and suppresses the anomaly signal for wallets with insufficient history.

---

## 12. Additional Statistical Signals

### Wash Trading Detection — Five-Signal Composite Score

The wash trading module scores an account 0–100 across five independent signals:

**Signal 1: Cancel Ratio**
```
cancelRatio = OfferCancel count / OfferCreate count
Threshold: > 55% → suspicious
Reasoning: legitimate market makers cancel selectively;
           wash traders often cancel after creating artificial volume
```

**Signal 2: Round-Trip Counterparty Concentration**
```
roundTripScore = count of addresses appearing on both sides of trades
                 / total unique counterparties
Threshold: any appearance → flag
Reasoning: trading with yourself (same operator, different accounts)
           is the textbook definition of wash trading
```

**Signal 3: Currency Pair Concentration**
```
pairConcentration = max(pair_count) / total_offer_count
Threshold: > 80% → suspicious
Reasoning: natural traders diversify across pairs;
           wash traders typically focus on one pair to inflate its volume
```

**Signal 4: Fill Rate**
```
fillRate = offers that filled / total offers created
Threshold: < 10% fill rate → suspicious
Reasoning: a market maker with almost no filled orders
           suggests the offers were never intended to fill
```

**Signal 5: Burst Activity**
```
burstScore = max(offers in single ledger)
Threshold: > 20 in one ledger → suspicious
Reasoning: legitimate trading is distributed over time;
           bursts suggest automated coordination
```

Each signal contributes proportionally to the composite score. A score above 60 triggers the wash trading warning in the risk banner.

### Drain Pattern Detection

The drain detection module uses temporal correlation analysis:

```
drainScore = f(
  SetRegularKey in tx history,
  time_delta(SetRegularKey, subsequent_outflow),
  key_setter != account_owner,
  payment_channel_destinations != known_counterparties,
  outflow_amount > threshold_fraction_of_balance
)
```

The "critical drain" classification requires all of: a `SetRegularKey` transaction where the setter address is distinct from the account, followed by a significant outflow within 48 ledger-hours. This precisely matches the documented pattern of the most common XRPL account compromise technique.

---

## 13. Account Inspector — Risk Scoring

The risk score aggregates findings across all analysis modules into a single 0–100 composite:

| Condition | Penalty Points |
|-----------|:-------------:|
| Master key disabled, no regular key (black hole) | +35 |
| Regular key set by third-party address | +40 |
| Auth change + significant outflow within 48h | +45 |
| Open payment channels to unrecognised addresses | +20 per channel |
| Free NFT sell offers present (price = 0) | +30 per offer |
| Wash trading composite score > 60% | +25 |
| Token issuer with individual freeze active | +15 |
| SignerList with quorum achievable by single unknown signer | +15 |
| NoFreeze not set on active issuer | +10 |

Score is clamped to 100. Color classification:

| Score | Band | Color | Recommended Action |
|-------|------|-------|--------------------|
| 0–19 | Low | 🟢 Green | No action required |
| 20–44 | Medium | 🟡 Amber | Review flagged items |
| 45–69 | High | 🟠 Orange | Action recommended before transacting |
| 70–100 | Critical | 🔴 Red | Treat account as potentially compromised |

---

## 14. NFT & DEX Security Analysis

### NFT Free Sell Offer Vulnerability

A critical XRPL NFT exploit involves creating a `NFTokenCreateOffer` with `Amount: "0"`. This creates a publicly visible, fillable sell offer for 0 XRP — any address can call `NFTokenAcceptOffer` and claim the NFT without paying. NFT holders who don't monitor their accounts can lose NFTs silently.

NaluXRP scans `account_objects` for all NFT sell offers with price 0 or below a defined dust threshold and flags them as critical findings.

### No-URI NFT Risk

NFTs minted without a URI (`NFTokenMint` without the `URI` field) are common spam vectors. Accepting an offer on a no-URI NFT can create unintended trustlines or trigger other state changes. NaluXRP flags these distinctly from legitimate zero-URI minting (which is valid in some use cases).

### DEX Order Analysis

The DEX analysis cross-references an account's `account_offers` with its `account_tx` history to compute fill rates, identify single-pair concentration, and detect burst creation patterns. These are the inputs to the wash trading composite score described in Section 12.

---

## 15. AMM Liquidity Analysis

NaluXRP's AMM module queries `account_objects` for objects of type `LPToken` and calls `amm_info` for each pool to retrieve:

- Pool composition and current exchange rate
- The account's LP token balance as a fraction of total LP supply
- The account's fee vote (if any)
- Active auction slot and bid amount

This provides liquidity providers with an accurate picture of their impermanent loss exposure and current position value without requiring any external oracle.

---

## 16. Live Ledger Stream Architecture

The dashboard stream tab subscribes to `{ command: "subscribe", streams: ["ledger"] }` on the WebSocket connection. Each ledger close event yields:

```json
{
  "type": "ledgerClosed",
  "ledger_index": 91234567,
  "ledger_hash": "ABCDEF...",
  "txn_count": 42,
  "close_time": 1700000000,
  "fee_base": 10,
  "reserve_base": 10000000,
  "reserve_inc": 2000000
}
```

NaluXRP maintains a rolling window of the last 30 ledger events to compute:

- **TPS** = total transactions in window / time span of window
- **Average fee** = sum of fees across sampled transactions / count
- **Success rate** = `tesSUCCESS` count / total count
- **Fee pressure band** = categorized from `fee_base` relative to historical baseline

Transaction type distribution is computed by sampling the `TransactionType` field of incoming transaction objects and accumulating counts in a session-scoped histogram.

---

## 17. Privacy Model

### What NaluXRP Does NOT Collect

- No user identifiers, emails, or names leave the device
- No wallet addresses or balances are sent to NaluXRP servers (there are none)
- No analytics SDKs, tracking pixels, or telemetry libraries
- No third-party authentication (no "Sign in with Google/Apple")

### What Is Transmitted

| Recipient | Data Sent | Purpose |
|-----------|-----------|---------|
| XRPL validators | XRPL addresses only | Fetch balances, history, submit tx |
| CoinGecko | Nothing (unauthenticated GET) | XRP price ticker |
| IPFS gateways | NFT content hashes | Load NFT images |

XRPL addresses are public by nature — they are on a public blockchain. Querying them from the user's IP address is equivalent to checking a public records database. No personal information is transmitted.

### Local Storage Privacy

The session record stored in `naluxrp_session` (name and email in plaintext) is a convenience for displaying the user's name without requiring vault decryption on every page load. This data is no more sensitive than a browser cookie. It contains no financial information and no key material.

---

## 18. Threat Model & Mitigations

| Threat | Likelihood | Mitigation |
|--------|-----------|-----------|
| Browser extension reads localStorage | Medium | Ciphertext only — useless without password |
| Malware keylogger captures password | High | Out-of-scope for software wallet; 2FA not applicable to symmetric encryption |
| Physical device access while locked | Low | Vault locked = key null = no decryption possible |
| Physical device access while unlocked | Medium | Auto-lock timer; screen lock |
| Malicious website (XSS) in same origin | Very Low | App is static files; no user-generated content rendered in same origin |
| Compromised XRPL node | Low | Responses are signed ledger data; a malicious node can withhold data but not forge it |
| Supply chain attack on JS dependencies | Low | xrpl.js is the only major dependency; pinned version; browser bundle |
| CoinGecko price manipulation | Medium | Price data is display-only; no financial decisions are automated |
| Brute-force vault offline | Very Low | PBKDF2 150k iterations makes this computationally infeasible for strong passwords |

---

## 19. Profile & Identity Layer

### @Handle and Domain

NaluXRP introduces the concept of a user-defined `@handle` stored as `identity.domain` in the vault. This handle is:

- Set during account creation (auto-suggested from display name, user-editable)
- Checked for local uniqueness on this device
- Displayed as a `◈ handle.xrpl` chip in the profile header
- A human-readable companion to the XRPL address as the user's on-chain identity

In future versions, this handle is intended to be registerable on the XRPL via DID (Decentralized Identifier) standards, linking the human-readable name to the on-chain address in a verifiable, tamper-evident way.

### Metrics Row

The profile metrics row provides at-a-glance portfolio summary without requiring the user to navigate to the Analytics tab:

| Metric | Derivation |
|--------|-----------|
| **Total XRP** | Sum of `account_info.Balance` across all wallets |
| **Est. USD** | Total XRP × live CoinGecko `ripple.usd` |
| **Transactions** | `account_info.Sequence` (count of signed transactions) |
| **Wallet Age** | Date of first ledger close for the account (from earliest `account_tx` entry) |
| **Tokens** | `account_lines` count |
| **Reserved XRP** | Sum of reserves across all wallets (see Section 9) |

---

## 20. iOS & PWA Deployment

NaluXRP ships as a Progressive Web App (PWA) and can be packaged as a native iOS app via Capacitor (WKWebView wrapper). Key considerations:

**Web Crypto API availability:** `window.crypto.subtle` is available in WKWebView on iOS 15+ and in Safari 15+. Older iOS versions do not support the full API and are not supported.

**localStorage persistence:** `localStorage` in WKWebView is persistent across app launches unless the user explicitly clears app data. It is scoped to the app's origin and inaccessible from other apps or the Safari browser.

**Secure context requirement:** The Web Crypto API requires a secure context (`https://` or `localhost`). In Capacitor WKWebView, content is served from a local `capacitor://` origin which is treated as a secure context by WebKit.

**Safe area handling:** All padding, margins, and fixed elements account for `env(safe-area-inset-*)` to handle notches, Dynamic Island, and the home indicator bar. Touch targets meet Apple HIG minimum sizes (44×44pt).

---

## 21. Limitations & Honest Caveats

**Local-only uniqueness** — Display names, emails, and handles are unique only on one browser/device. The same name can exist on another device. There is no global identity enforcement without a server.

**localStorage limitations** — `localStorage` has a typical quota of 5–10MB per origin. A user with extensive transaction history across many wallets could approach this limit over time. The balance history stores only summarized snapshots, not full transaction records, to mitigate this.

**Benford's Law sample size** — The fraud detection is unreliable for wallets with fewer than ~50 transactions. NaluXRP suppresses the anomaly signal for small sample sizes and notes this limitation in the UI.

**No hardware wallet integration** — NaluXRP does not currently support Ledger or Trezor hardware wallets. All signing is software-based. High-value users should consider seed phrase cold storage independent of NaluXRP.

**XRPL node trust** — NaluXRP cannot independently verify that the XRPL nodes it connects to are serving canonical ledger data. However, XRPL's consensus mechanism means that a single malicious node cannot forge ledger state — it can only withhold data (denial of service) or return stale data. The multi-endpoint fallback mitigates the latter.

**Password recovery impossible** — If a user forgets their password and has no backup file, their vault data is permanently inaccessible. This is a fundamental property of the security model, not a bug. The application is explicit about this from the first account creation screen.

---

## 22. Conclusion

NaluXRP demonstrates that a full-featured cryptocurrency wallet and analytics platform — with military-grade encryption, advanced on-chain fraud detection, real-time market data, and a complete XRPL feature set — can be built without any server infrastructure. The user's security is not dependent on trusting NaluXRP as an organization; it depends only on the cryptographic primitives built into their browser and the strength of their chosen password.

By combining AES-256-GCM authenticated encryption, PBKDF2 key derivation with 150,000 iterations, and direct WebSocket connections to XRPL validators, NaluXRP achieves the privacy guarantees of a hardware wallet with the accessibility of a web application.

The application of Benford's Law, wash trading composite scoring, drain pattern detection, and reserve analysis provides users with analytical tools that were previously available only to institutional actors and forensic investigators — democratizing on-chain security intelligence for the broader XRPL community.

---

## 23. References

1. Benford, F. (1938). *The Law of Anomalous Numbers.* Proceedings of the American Philosophical Society, 78(4), 551–572.
2. Nigrini, M. J. (1992). *The Detection of Income Tax Evasion Through an Analysis of Digital Frequencies.* Doctoral dissertation, University of Cincinnati.
3. Nigrini, M. J. (2012). *Benford's Law: Applications for Forensic Accounting, Auditing, and Fraud Detection.* John Wiley & Sons.
4. NIST SP 800-132 (2010). *Recommendation for Password-Based Key Derivation, Part 1: Storage Applications.* National Institute of Standards and Technology.
5. OWASP Password Storage Cheat Sheet (2023). *PBKDF2 Recommendations.* Open Web Application Security Project.
6. Rogaway, P. (2011). *Evaluation of Some Blockcipher Modes of Operation.* University of California, Davis.
7. XRPL Documentation (2024). *Account Reserves.* https://xrpl.org/reserves.html
8. XRPL Documentation (2024). *Transaction Types Reference.* https://xrpl.org/transaction-types.html
9. XRPL Documentation (2024). *Automated Market Maker.* https://xrpl.org/automated-market-maker.html
10. W3C Web Cryptography API (2017). *W3C Recommendation.* https://www.w3.org/TR/WebCryptoAPI/
11. McGrew, D. A. & Viega, J. (2004). *The Galois/Counter Mode of Operation (GCM).* Submission to NIST Modes of Operation Process.
12. Bernstein, D. J. (2011). *High-speed high-security signatures.* Journal of Cryptographic Engineering, 2, 77–89. (Ed25519)

---

*NaluXRP White Paper · Version 1.0 · 2025*
*Not affiliated with Ripple Labs, Inc. or the XRP Ledger Foundation.*