# NaluXRP — Roadmap

> This roadmap reflects the current state of development and planned direction.
> Items are organized by release phase. Timelines are approximate.

---

## Current Status — v1.0 (Live)

The following features are **fully implemented and shipping**:

### ✅ Core Platform
- Client-side architecture — zero server, zero backend
- AES-256-GCM vault encryption with PBKDF2 (150,000 iterations)
- 3-step account creation (Identity → Security → Sync Awareness)
- @handle / domain registration
- Auto-lock (30-minute inactivity timer)
- Cross-device sync via encrypted vault code
- Backup export / restore (.json file)
- Password strength meter + canvas CAPTCHA

### ✅ Wallet Management
- Generate new wallets (Ed25519 / secp256k1)
- Import from seed phrase
- Watch-only wallet support
- Reserve breakdown (base 10 XRP + owner count × 2 XRP)
- Available vs. reserved balance
- Clickable token chips → Token Details modal
- DEX order tracking with inline Cancel
- NFT gallery per wallet

### ✅ Analytics
- Balance history sparklines
- 26-week on-chain activity heatmap
- Transaction type breakdown chart
- XRP flow analysis (inflow / outflow / net)
- Token allocation bars
- Benford's Law fraud detector
- Profile metrics row (Total XRP, Est. USD, Tx count, Age, Tokens, Reserved)

### ✅ XRPL Inspector
- 8-module deep analysis (Security, Drain, NFT, Wash Trading, Issuer, AMM, Trustlines, History)
- Composite risk score 0–100 with color bands
- 200-transaction timeline with type badges and risk coloring
- Notable addresses gallery
- Recent inspection history (last 8 with risk scores)

### ✅ Live Dashboard
- Real-time ledger stream
- TPS, avg fee, success rate, dominant TX type metric cards
- TX Mix chart (live transaction type breakdown)
- Fee pressure bar (Low → Congested)

### ✅ Infrastructure
- WebSocket auto-reconnect with exponential backoff
- 4-endpoint cycling (s1 → s2 → xrplcluster → xrpl.ws)
- Mainnet / Testnet / Xahau network switching
- PWA support (installable on iOS via Safari + Add to Home Screen)
- Capacitor iOS / TestFlight ready
- Full iOS safe area, 44pt touch targets, no-zoom inputs
- Command palette (⌘K / /)
- 5 visual themes

---

## v1.1 — Polish & Accessibility
*Target: Q1 2025*

### 🔲 UX Improvements
- [ ] Onboarding walkthrough — first-launch guided tour of each section
- [ ] Empty states — illustrated placeholders for wallets with no tokens, no NFTs, etc.
- [ ] Loading skeleton screens — replace spinner with content-shaped placeholders
- [ ] Haptic feedback on key actions (iOS)
- [ ] Toast notification improvements — persistent toasts for important actions

### 🔲 Accessibility
- [ ] Full ARIA label coverage for screen readers
- [ ] Keyboard navigation through wallet cards and drawer tabs
- [ ] High-contrast theme option
- [ ] Reduced-motion mode for particle animations and transitions
- [ ] Focus-visible outlines (`:focus-visible` CSS)

### 🔲 Inspector Improvements
- [ ] Address book — save labels for any inspected address (not just your own wallets)
- [ ] Compare two addresses side-by-side in Inspector
- [ ] Export inspection report as PDF
- [ ] Share inspection link (encodes address in URL fragment, no server needed)

### 🔲 Analytics
- [ ] Date range picker for all charts (7d / 30d / 90d / all time)
- [ ] Export analytics data as CSV
- [ ] Portfolio value chart (line chart across time using balance history)

---

## v1.2 — Transaction Capabilities
*Target: Q2 2025*

### 🔲 Send & Receive
- [ ] Full Send XRP flow with destination tag auto-detection
- [ ] Token (IOU) send — signed in-browser via xrpl.js
- [ ] QR code scanner for address input (camera API)
- [ ] Receive page with QR code generation
- [ ] Address book autocomplete when entering destinations
- [ ] Transaction preview with fee estimate before signing

### 🔲 Trustline Management
- [ ] Set trustline UI — issuer address + currency + limit
- [ ] Remove trustline (set limit to 0 when balance is zero)
- [ ] Trustline warnings — freeze status, rippling, negative balances

### 🔲 Escrow
- [ ] View all open escrows (received and created)
- [ ] Create time-based escrow
- [ ] Finish / cancel escrow UI

### 🔲 Checks
- [ ] Send Check (XRPL Check object)
- [ ] Cash / cancel received checks
- [ ] Check history tab on wallet drawer

---

## v1.3 — DEX & Trading
*Target: Q3 2025*

### 🔲 DEX Order Management
- [ ] Place new DEX offers — full buy/sell UI with pair selection
- [ ] Order book viewer for any currency pair
- [ ] Market price reference from AMM pools and existing offers
- [ ] Trade history chart (OHLCV candles for any XRPL trading pair)
- [ ] Position sizing calculator — calculates reserve impact of new offers

### 🔲 AMM Integration
- [ ] Deposit liquidity to any AMM pool
- [ ] Withdraw liquidity
- [ ] Vote on pool trading fee
- [ ] Single-asset AMM swap UI
- [ ] LP position P&L estimation (impermanent loss calculator)
- [ ] AMM pool browser — top pools by volume and TVL

---

## v1.4 — NFT Features
*Target: Q3 2025*

### 🔲 NFT Management
- [ ] Mint new NFT — URI, taxon, transfer fee, flags
- [ ] Burn NFT
- [ ] Create sell offer
- [ ] Accept buy offer
- [ ] Transfer NFT to another address
- [ ] NFT collection view — group by taxon or issuer
- [ ] IPFS pinning helper — store NFT content on IPFS from within the app
- [ ] Rarities viewer — trait breakdown if metadata follows standard formats

---

## v1.5 — Payment Channels & Streaming Payments
*Target: Q4 2025*

### 🔲 Payment Channels
- [ ] Open payment channel to any address
- [ ] Channel dashboard — balance, capacity, expiry
- [ ] Create off-chain payment claims (signed channel claims)
- [ ] Close / settle channel

### 🔲 Streaming Payments
- [ ] Integration with XRPL payment channel streaming protocol
- [ ] Pay-per-second UI for content or service gating
- [ ] Channel claim history and reconciliation

---

## v2.0 — Identity & Social Layer
*Target: Q1 2026*

### 🔲 Decentralized Identity (DID)
- [ ] Register on-chain DID document linking `@handle` to XRPL address
- [ ] Sign arbitrary messages with wallet (proof of address ownership)
- [ ] Verify signed messages from other addresses
- [ ] DID resolution viewer — inspect any DID document on XRPL

### 🔲 Profile Discovery
- [ ] Public profile page — shareable URL (`naluxrp.io/@handle`)
- [ ] Profile QR code — encodes handle + address for easy sharing
- [ ] Social graph — follow other XRPL addresses, see their recent activity
- [ ] On-chain attestations — verify social links via signed XRPL transactions

### 🔲 Messaging (Encrypted)
- [ ] End-to-end encrypted direct messages between XRPL addresses
- [ ] Encrypted message stored in `AccountSet.Domain` or memo fields
- [ ] NaCl / X25519 key exchange derived from XRPL signing keys

---

## v2.1 — Advanced Analytics
*Target: Q2 2026*

### 🔲 Portfolio Intelligence
- [ ] Multi-wallet aggregate P&L (cost basis tracking)
- [ ] Token price history charts for all held tokens (DEX data)
- [ ] Unrealised gain/loss per position
- [ ] Tax report export (CSV with acquisition cost, disposal proceeds)
- [ ] Correlation matrix — how correlated are your held assets?

### 🔲 Enhanced Fraud Detection
- [ ] Chi-squared test on Benford analysis (more rigorous than visual comparison)
- [ ] Time-series anomaly detection — flag sudden large deviations in activity
- [ ] Counterparty risk scoring — rate the wallets you transact with most
- [ ] Watchlist alerts — notify when a saved address reaches a risk score threshold

### 🔲 Historical Analytics
- [ ] Full transaction history export (beyond 200 — paginate all account_tx)
- [ ] Custom date range XRP flow analysis
- [ ] Profit/loss by trading pair (DEX P&L)
- [ ] Fee cost analysis — total fees paid across all wallets and time ranges

---

## v2.2 — Multi-Signature & Enterprise
*Target: Q3 2026*

### 🔲 Multi-Signature
- [ ] Create and manage SignerLists
- [ ] Multi-sig transaction proposal UI — one party proposes, others co-sign
- [ ] Offline signing — export unsigned transaction blob, sign offline, re-import
- [ ] Threshold signature setup wizard

### 🔲 Organizational Features
- [ ] Multiple named vaults on one device (personal + business)
- [ ] Vault-level access policies (read-only vault for display, write vault for signing)
- [ ] Batch transaction builder — construct multiple transactions in one session
- [ ] Recurring payment scheduler (escrow-backed)

---

## v2.3 — NaluLF Node Infrastructure
*Target: Q4 2026*

Running on shared public validators works for MVP, but owning infrastructure unlocks capabilities that are impossible over borrowed endpoints — custom streaming, private submission, deeper mempool visibility, and guaranteed uptime.

### 🔲 Dedicated XRPL Node
- [ ] Self-hosted rippled node (stock configuration, full history or recent-only)
- [ ] Private WebSocket endpoint — NaluLF users connect to our node instead of public clusters
- [ ] Node health dashboard — ledger lag, peer count, sync status visible in-app
- [ ] Automatic fallback — if NaluLF node is unreachable, cycle to public endpoints as today
- [ ] Reduced latency for transaction submission (bypass public relay queues)

### 🔲 Custom Streaming & Webhooks
- [ ] Private subscription feed — subscribe to specific accounts, currencies, or transaction types server-side
- [ ] Webhook delivery — push ledger events to user-configured URLs (for bots, automations, external tools)
- [ ] Account alert service — trigger on balance threshold, incoming payment, offer fill, trust-line change
- [ ] Batch account monitoring — track hundreds of watched addresses with a single server-side subscription
- [ ] Historical replay API — stream past ledger ranges for backtesting and analysis

### 🔲 Node-Enabled Analytics
- [ ] Full transaction history (no 200-tx browser cap — node pulls complete paginated history)
- [ ] Server-side Benford computation on 10,000+ tx datasets
- [ ] Mempool visibility — see unconfirmed transactions before ledger close
- [ ] DEX depth data — real-time order-book snapshots cached server-side, served to clients
- [ ] Fee oracle — predict optimal fee based on recent ledger congestion history

---

## v3.0 — AI Agent & Trading Intelligence
*Target: Q1 2027*

AI agents are the next layer above analytics — they act on insights rather than just displaying them. NaluLF's architecture is well-positioned for agents: local key signing, live ledger stream, rich portfolio context, and (by v2.3) its own node.

### 🔲 AI Portfolio Advisor
- [ ] Natural-language chat interface for portfolio Q&A ("What's my biggest risk exposure?", "How much XRP is locked in reserves?")
- [ ] AI-powered anomaly summaries — translate risk score changes and Benford deviations into plain English
- [ ] Automated due-diligence reports — user pastes an XRPL address, AI produces a structured risk summary
- [ ] Market context overlay — AI narrates wallet performance against broader XRPL market conditions
- [ ] Tax estimate helper — AI-guided cost basis Q&A to prep data for tax export

### 🔲 Dynamic Trading Bot Builder
- [ ] Visual strategy builder — drag-and-drop condition blocks (price threshold, balance trigger, time window, indicator crossover)
- [ ] Bot library — pre-built templates: DCA (Dollar Cost Average), Grid Bot, Stop-Loss, Take-Profit, Rebalancer
- [ ] Custom scripting layer — JavaScript sandbox for advanced users to write arbitrary strategy logic
- [ ] Backtesting engine — run strategy against historical DEX price data before deploying live capital
- [ ] Simulation mode — paper-trade any bot in real-time without submitting actual transactions
- [ ] Live deployment — bot signs and submits XRPL transactions locally (keys never leave device) on strategy signal
- [ ] Bot dashboard — P&L, fill rate, signal log, kill switch per active bot

### 🔲 AI Agent Automation
- [ ] Agent workflows — chain multiple actions: "If XRP drops 10%, cancel all open DEX offers and DCA into token X"
- [ ] Natural language strategy creation — describe a strategy in plain text, AI generates the condition blocks
- [ ] Risk-guard layer — agent hard stops if drawdown or reserve breach thresholds are approached
- [ ] Multi-wallet agent coordination — one agent managing position sizing across several wallets
- [ ] On-chain event triggers — agent reacts to real-time XRPL events (payment received, offer filled, ledger epoch)
- [ ] Agent audit log — immutable local record of every action the agent took, why, and the outcome

### 🔲 Scaling & Infrastructure for Agents
- [ ] Agent execution runtime — lightweight local worker (Web Worker or Capacitor background task) runs strategy loops without requiring the UI to stay open
- [ ] Rate-aware submission — agent queues transactions intelligently to avoid fee spikes and sequence conflicts
- [ ] Node-backed signal feeds — when NaluLF node is live, agents subscribe to private streams for sub-second event latency
- [ ] Offline resilience — agents persist state to encrypted vault so they can resume after a device restart
- [ ] Multi-agent isolation — each bot runs in its own sandboxed context with wallet-level permission scoping

---

## v3.1 — Cross-Chain & Bridges
*Target: 2027+*

### 🔲 Cross-Chain Bridges
- [ ] XRPL ↔ Ethereum bridge integration (for XRP and wrapped assets)
- [ ] XRPL Sidechain support (Xahau, EVM sidechain)
- [ ] Federated bridge monitoring — view open bridge transactions and their status

### 🔲 Hooks (Xahau)
- [ ] Hooks transaction type support in Inspector and stream
- [ ] Deploy/manage hooks from the UI
- [ ] Hook-aware wallet mode — show hook-triggered transactions distinctly

### 🔲 Hardware Wallet Integration
- [ ] Ledger hardware wallet signing (via WebHID / WebUSB)
- [ ] Trezor signing integration
- [ ] Air-gapped signing — QR-based PSBT-style workflow for offline signing machines

---

## Ongoing / Evergreen

These items are ongoing throughout all releases:

- **Performance** — reduce bundle size, lazy-load inspector modules, improve mobile frame rates
- **Test coverage** — unit tests for cryptographic operations, integration tests for XRPL API calls
- **Documentation** — keep HOWTO.md, WHITEPAPER.md, and inline code comments in sync with features
- **XRPL amendments** — add support for new XRPL amendments as they pass (e.g., new transaction types, reserve changes)
- **Security audits** — periodic review of the CryptoVault implementation and key handling
- **iOS updates** — maintain compatibility with new iOS versions and Capacitor releases

---

## Not Planned

The following are explicitly **out of scope** for NaluXRP:

- **Custodial accounts** — NaluXRP will never hold or manage user keys on a server
- **Centralized exchange features** — fiat on/off ramps, KYC flows, order books backed by our own servers
- **Social media / content hosting** — NaluXRP is a wallet, not a social platform
- **Token issuance service** — we may support viewing and managing issued tokens but not a token creation wizard that requires our infrastructure
- **Advertising** — the app will never show ads or allow advertisers to influence content

---

## Contributing to the Roadmap

Have a feature request or think something should be reprioritised? Open a GitHub issue with the `roadmap` label. Community-requested items that align with the core privacy-first, client-side principles are considered for inclusion.

---

*NaluXRP Roadmap · Last updated 2025*
*Not affiliated with Ripple Labs, Inc. or the XRP Ledger Foundation.*