/* =====================================================
   FILE: scripts/xrpl.js
   xrpl.js — WebSocket Engine · Ledger Processing
   Dispatches:
     - xrpl-ledger       (CustomEvent detail = xrplState)
     - xrpl-connection   (CustomEvent detail = {connected, server, state})
     - xrpl-ledger-gap   (CustomEvent detail = {from, to, missed})
     - xrpl-connected    (Event)
     - xrpl-disconnected (Event)

   Notes:
   - Uses a subscribe→ledgerClosed→(gated) ledger fetch flow to avoid request storms.
   - Enriches recentTransactions with:
       * Paths / SendMax / DeliverMax / Flags (for autobridge/path-payment heuristics)
       * NFTokenID(s) extracted from NFTokenMint meta (AffectedNodes)
       * AMM fields (Asset, Asset2, LPTokenOut/In)
       * Offer exchange rate (TakerPays/TakerGets)
       * Memo type/data (first memo only)
   - Pre-computes per-ledger derived signals:
       * whaleTxs  — XRP payments >= WHALE_THRESHOLD_XRP
       * feeSpike  — avgFee > 3× recent rolling mean
       * gapDetected — missed >= 2 ledger indexes since last processed
   ===================================================== */

import {
  ENDPOINTS_BY_NETWORK,
  CHART_WINDOW,
  LEDGER_LOG_MAX,
  WS_TIMEOUT_MS,
  MAX_RECONNECT_DELAY,
} from './config.js';

import { $ } from './utils.js';
import { state } from './state.js';

/* ─────────────────────────────
   Constants
──────────────────────────────── */

// FIX 2a — define once, not as magic numbers scattered through the file
const RIPPLE_EPOCH = 946684800;

// FIX 2e — config-driven cap on enriched tx list
const RECENT_TX_LIMIT = 150;

// FIX 4a — whale detection threshold (XRP). Adjust as needed.
const WHALE_THRESHOLD_XRP = 100_000;

// FIX 3e — ledger fetches can be slow on busy ledgers; give them more runway
//           than the default WS timeout used for lightweight requests.
const LEDGER_FETCH_TIMEOUT_MS = Math.max(WS_TIMEOUT_MS, 8000);

/* ─────────────────────────────
   Endpoint helpers
──────────────────────────────── */
function endpointsForNetwork() {
  return ENDPOINTS_BY_NETWORK[state.currentNetwork] || ENDPOINTS_BY_NETWORK['xrpl-mainnet'];
}

function nextEndpoint() {
  const eps = endpointsForNetwork();
  const ep = eps[state.endpointIdx % eps.length];
  state.endpointIdx += 1;
  return ep;
}

/* ─────────────────────────────
   Connect / disconnect
──────────────────────────────── */
export function connectXRPL() {
  if (state.wsConn && state.wsConn.readyState <= 1) return;

  const ep = nextEndpoint();
  console.log(`🌊 Connecting → ${ep.name} (${ep.url})`);
  setConnState('connecting', ep.name);

  const ws = new WebSocket(ep.url);
  state.wsConn = ws;

  ws.onopen = () => {
    console.log(`✅ Connected: ${ep.name}`);
    state.wsRetry = 0;

    // Reset gating on every fresh connection
    _ledgerReqInFlight = false;
    _latestWantedIndex = null;
    _lastProcessedIndex = 0;

    setConnState('connected', ep.name);
    window.dispatchEvent(new Event('xrpl-connected'));
    subscribeStream();
  };

  ws.onclose = () => {
    console.log(`🔌 Disconnected: ${ep.name}`);
    setConnState('disconnected', '');
    window.dispatchEvent(new Event('xrpl-disconnected'));
    scheduleReconnect();
  };

  ws.onerror = () => ws.close();
  ws.onmessage = (e) => {
    try {
      handleMessage(JSON.parse(e.data));
    } catch {
      // ignore malformed frames
    }
  };
}

export function disconnectXRPL() {
  clearTimeout(state.reconnectTimer);
  if (state.wsConn) {
    state.wsConn.onclose = null;
    state.wsConn.close();
    state.wsConn = null;
  }
  setConnState('disconnected', '');
}

export function reconnectXRPL(forced = false) {
  disconnectXRPL();
  if (forced) state.wsRetry = 0;
  if (state.session) setTimeout(connectXRPL, 200);
}

/* ─────────────────────────────
   Internal helpers
──────────────────────────────── */
function scheduleReconnect() {
  if (state.reconnectTimer) return;
  const delay = Math.min(MAX_RECONNECT_DELAY, 1500 * Math.pow(1.6, state.wsRetry++));
  console.log(`⏳ Reconnect in ${(delay / 1000).toFixed(1)}s`);
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    if (state.session) connectXRPL();
  }, delay);
}

function subscribeStream() {
  // ledger stream only; we fetch the full ledger via gated requests.
  wsSend({ id: 'sub_ledger', command: 'subscribe', streams: ['ledger'] }).catch(() => {});
}

export function wsSend(payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (!state.wsConn || state.wsConn.readyState !== 1) return reject(new Error('Not connected'));

    const id = `req_${++state.reqId}`;
    payload.id = id;

    const timer = setTimeout(() => {
      delete state.pendingReqs[id];
      reject(new Error('Timeout'));
    }, timeoutMs ?? WS_TIMEOUT_MS);

    state.pendingReqs[id] = { resolve, reject, timer };
    state.wsConn.send(JSON.stringify(payload));
  });
}

/* ─────────────────────────────
   Ledger request gating
   One request in-flight at a time; always fetches newest wanted index.
──────────────────────────────── */
let _ledgerReqInFlight = false;
let _latestWantedIndex = null;
let _lastProcessedIndex = 0;

function _onLedgerClosed(ledgerIndex) {
  const li = Number(ledgerIndex);
  if (!Number.isFinite(li)) return;
  _latestWantedIndex = Math.max(_latestWantedIndex || 0, li);
  _maybeRequest();
}

function _maybeRequest() {
  if (!state.wsConn || state.wsConn.readyState !== 1) return;
  if (_ledgerReqInFlight) return;
  if (_latestWantedIndex == null) return;
  if (_latestWantedIndex <= _lastProcessedIndex) return;
  _fetch(_latestWantedIndex);
}

function _fetch(ledgerIndex) {
  _ledgerReqInFlight = true;

  // FIX 3e — use extended timeout for ledger fetches (can be large payloads)
  wsSend(
    { command: 'ledger', ledger_index: ledgerIndex, transactions: true, expand: true },
    LEDGER_FETCH_TIMEOUT_MS,
  )
    .then((msg) => {
      const li = Number(msg.result?.ledger?.ledger_index ?? ledgerIndex);
      if (Number.isFinite(li)) {
        // FIX 4c — detect skipped ledgers before updating the pointer
        if (_lastProcessedIndex > 0 && li - _lastProcessedIndex > 2) {
          const missed = li - _lastProcessedIndex - 1;
          console.warn(`⚠️ Ledger gap: skipped ${missed} ledger(s) (${_lastProcessedIndex} → ${li})`);
          window.dispatchEvent(new CustomEvent('xrpl-ledger-gap', {
            detail: { from: _lastProcessedIndex, to: li, missed },
          }));
        }
        _lastProcessedIndex = Math.max(_lastProcessedIndex, li);
      }
      processLedger(msg.result);
    })
    .catch((err) => console.warn('Ledger req failed:', err?.message || err))
    .finally(() => {
      _ledgerReqInFlight = false;
      _maybeRequest(); // catch up if newer ledgers closed while fetching
    });
}

/* ─────────────────────────────
   Message handler
──────────────────────────────── */
function handleMessage(msg) {
  // Resolve pending promise
  if (msg.id && state.pendingReqs[msg.id]) {
    const { resolve, reject, timer } = state.pendingReqs[msg.id];
    clearTimeout(timer);
    delete state.pendingReqs[msg.id];

    if (msg.status === 'error') reject(new Error(msg.error_message || msg.error || 'XRPL error'));
    else resolve(msg);

    return;
  }

  if (msg.type === 'ledgerClosed') {
    _onLedgerClosed(msg.ledger_index);
  }
}

/* ─────────────────────────────
   Amount parsing (safe)
──────────────────────────────── */
function parseAmount(a) {
  if (a == null) return { amountXrp: null, amountIssued: null, raw: null };

  // XRP drops string
  if (typeof a === 'string') {
    const drops = Number(a);
    if (!Number.isFinite(drops)) return { amountXrp: null, amountIssued: null, raw: a };
    return { amountXrp: drops / 1e6, amountIssued: null, raw: a };
  }

  // Issued currency object: { currency, issuer, value }
  if (typeof a === 'object' && a.value != null && a.currency) {
    const v = Number(a.value);
    const c = String(a.currency);
    const i = String(a.issuer || '');
    return {
      amountXrp: null,
      amountIssued: Number.isFinite(v) ? `${v} ${c}${i ? `/${i.slice(0, 6)}…` : ''}` : `${a.value} ${c}`,
      raw: a,
    };
  }

  return { amountXrp: null, amountIssued: null, raw: a };
}

/* ─────────────────────────────
   FIX 1e — Offer exchange rate helper
   Returns XRP-per-unit rate or null if either side is not XRP.
──────────────────────────────── */
function offerExchangeRate(takerGets, takerPays) {
  if (!takerGets || !takerPays) return null;
  const gets = typeof takerGets === 'string' ? Number(takerGets) / 1e6 : null; // XRP
  const pays = typeof takerPays === 'string' ? Number(takerPays) / 1e6 : null; // XRP
  // Only compute when one side is XRP (most common DEX pair)
  if (gets !== null && gets > 0 && typeof takerPays === 'object') {
    const paysV = Number(takerPays.value);
    return Number.isFinite(paysV) && paysV > 0 ? gets / paysV : null; // XRP per token
  }
  if (pays !== null && pays > 0 && typeof takerGets === 'object') {
    const getsV = Number(takerGets.value);
    return Number.isFinite(getsV) && getsV > 0 ? pays / getsV : null; // XRP per token
  }
  return null;
}

/* ─────────────────────────────
   NFTokenID extraction from NFTokenMint meta (AffectedNodes)
──────────────────────────────── */
function extractMintedNftIds(meta) {
  const out = new Set();
  const nodes = meta?.AffectedNodes || meta?.affected_nodes || [];
  if (!Array.isArray(nodes)) return [];

  const idsFromTokens = (tokens) => {
    if (!Array.isArray(tokens)) return [];
    const ids = [];
    for (const t of tokens) {
      const id = t?.NFToken?.NFTokenID || t?.NFTokenID;
      if (id) ids.push(id);
    }
    return ids;
  };

  for (const wrap of nodes) {
    const node = wrap?.CreatedNode || wrap?.ModifiedNode || wrap?.DeletedNode;
    if (!node) continue;
    if (node.LedgerEntryType !== 'NFTokenPage') continue;

    const newTokens = node.NewFields?.NFTokens;
    if (Array.isArray(newTokens) && newTokens.length) {
      idsFromTokens(newTokens).forEach((id) => out.add(id));
      continue;
    }

    const finalTokens  = node.FinalFields?.NFTokens;
    const prevTokens   = node.PreviousFields?.NFTokens;
    const finalIds     = new Set(idsFromTokens(finalTokens));
    const prevIds      = new Set(idsFromTokens(prevTokens));

    for (const id of finalIds) {
      if (!prevIds.has(id)) out.add(id);
    }
  }

  return [...out];
}

/* ─────────────────────────────
   Ledger processing
   Fires: xrpl-ledger custom event
──────────────────────────────── */
function processLedger(result) {
  const ledger = result?.ledger;
  if (!ledger) return;

  const li   = Number(ledger.ledger_index ?? 0);
  const hash = ledger.ledger_hash ?? ledger.hash ?? null;           // FIX 1a
  const txs  = Array.isArray(ledger.transactions) ? ledger.transactions : [];

  // FIX 2a — use named constant instead of magic number
  const closeT = new Date((Number(ledger.close_time ?? 0) + RIPPLE_EPOCH) * 1000);

  // Close-time delta
  let closeTimeSec = null;
  if (state.lastCloseTs) {
    const delta = closeT - state.lastCloseTs;
    // FIX 2b — floor at 1.0s to prevent astronomical TPS from sub-second deltas
    if (delta > 0 && delta < 30_000) closeTimeSec = Math.max(delta / 1000, 1.0);
  }
  state.lastCloseTs = closeT;

  const tps = closeTimeSec != null ? txs.length / closeTimeSec : null;

  // Categorise & fee stats
  const typeCounts = {};
  let totalFeesDrops = 0;
  let successCount   = 0;

  // FIX 1c — also compute fee std-dev for spike detection
  const feeDropsList = [];

  txs.forEach((tx) => {
    const t = tx.TransactionType || 'Other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;

    const fee = Number(tx.Fee || 0);
    totalFeesDrops += fee;
    feeDropsList.push(fee);

    const res = tx.metaData?.TransactionResult || tx.meta?.TransactionResult;
    if (res === 'tesSUCCESS') successCount += 1;
  });

  const txCount      = txs.length;
  const avgFeeDrops  = txCount ? totalFeesDrops / txCount : 0;
  const successRate  = txCount ? (successCount / txCount) * 100 : 100;

  // FIX 1c — fee std-dev
  let feeStdDevDrops = 0;
  if (feeDropsList.length > 1) {
    const variance = feeDropsList.reduce((s, f) => s + (f - avgFeeDrops) ** 2, 0) / feeDropsList.length;
    feeStdDevDrops = Math.sqrt(variance);
  }

  // Rolling history
  if (tps !== null) {
    state.tpsHistory.push(tps);
    if (state.tpsHistory.length > CHART_WINDOW) state.tpsHistory.shift();
  }

  state.feeHistory.push(avgFeeDrops);
  if (state.feeHistory.length > CHART_WINDOW) state.feeHistory.shift();

  // FIX 4d — fee spike: avgFee > 3× rolling mean of recent history
  let feeSpike = false;
  if (state.feeHistory.length >= 5) {
    const rollingMean = state.feeHistory.slice(0, -1).reduce((a, b) => a + b, 0)
      / (state.feeHistory.length - 1);
    feeSpike = rollingMean > 0 && avgFeeDrops > rollingMean * 3;
  }

  // TX mix accumulator
  Object.entries(typeCounts).forEach(([t, c]) => {
    state.txMixAccum[t] = (state.txMixAccum[t] || 0) + c;
  });

  // Ledger log
  state.ledgerLog.unshift({
    ledgerIndex: li,
    ledgerHash: hash,                                               // FIX 1a
    txCount,
    tps:          tps         != null ? tps.toFixed(2)          : '—',
    closeTimeSec: closeTimeSec != null ? closeTimeSec.toFixed(2) : '—',
    avgFeeDrops,
    feeSpike,                                                       // FIX 4d
    time: new Date().toLocaleTimeString(),
  });
  if (state.ledgerLog.length > LEDGER_LOG_MAX) state.ledgerLog.pop();

  // ── Recent txs (enriched) ─────────────────────────
  // FIX 2e — use named constant instead of magic 120
  const recentTransactions = txs.slice(0, RECENT_TX_LIMIT).map((tx) => {
    const res  = tx.metaData?.TransactionResult || tx.meta?.TransactionResult;
    const meta = tx.metaData || tx.meta || null;

    // Prefer Amount, else DeliverMax/SendMax
    const primary = tx.Amount ?? tx.DeliverMax ?? tx.SendMax ?? null;
    const amt = parseAmount(primary);

    const out = {
      hash:           tx.hash,
      type:           tx.TransactionType,
      account:        tx.Account,
      destination:    tx.Destination,
      destinationTag: tx.DestinationTag ?? null,
      feeDrops:       Number(tx.Fee || 0),
      ledgerIndex:    li,
      result:         res,

      // Amount (for whale / bot / risk)
      amountXrp:    amt.amountXrp,
      amountIssued: amt.amountIssued,
      amountRaw:    amt.raw,

      // For path-payment / autobridge heuristics
      paths:      tx.Paths     ?? null,
      sendmax:    tx.SendMax   ?? null,
      delivermax: tx.DeliverMax ?? null,
      flags:      tx.Flags     ?? null,

      // For DEX proxy / quick cancel
      sequence:      tx.Sequence,
      offerSequence: tx.OfferSequence,
      takerGets:     tx.TakerGets,
      takerPays:     tx.TakerPays,
    };

    // FIX 1e — pre-compute offer exchange rate
    if (tx.TransactionType === 'OfferCreate' || tx.TransactionType === 'OfferCrossing') {
      out.exchangeRate = offerExchangeRate(tx.TakerGets, tx.TakerPays);
    }

    // FIX 1f — AMM transaction fields
    if (tx.TransactionType?.startsWith('AMM')) {
      out.ammAsset     = tx.Asset     ?? null; // { currency, issuer } or 'XRP'
      out.ammAsset2    = tx.Asset2    ?? null;
      out.ammLpTokenOut = tx.LPTokenOut ?? null; // AMMDeposit
      out.ammLpTokenIn  = tx.LPTokenIn  ?? null; // AMMWithdraw
      out.ammTradingFee = tx.TradingFee ?? null; // AMMCreate/Vote
      out.ammBidMin     = tx.BidMin     ?? null; // AMMBid
      out.ammBidMax     = tx.BidMax     ?? null;
    }

    // FIX 1d — first Memo (type + data, hex-decoded where possible)
    const firstMemo = tx.Memos?.[0]?.Memo;
    if (firstMemo) {
      const hexDecode = (h) => {
        try { return decodeURIComponent(h.replace(/../g, '%$&')); } catch { return h; }
      };
      out.memoType = firstMemo.MemoType ? hexDecode(firstMemo.MemoType)   : null;
      out.memoData = firstMemo.MemoData ? hexDecode(firstMemo.MemoData)   : null;
    }

    // NFT mint metadata enrichment
    if (tx.TransactionType === 'NFTokenMint') {
      const minted     = extractMintedNftIds(meta);
      out.nftokenIds   = minted;
      out.nftokenId    = minted[0] || null;
      out.nftURI       = tx.URI           ?? null;
      out.nftTaxon     = tx.NFTokenTaxon  ?? null;
      out.nftIssuer    = tx.Issuer        ?? tx.Account ?? null;
      out.nftTransferFee = tx.TransferFee ?? null;
    }

    if (tx.TransactionType === 'NFTokenBurn') {
      out.nftokenId  = tx.NFTokenID ?? null;
      out.nftokenIds = out.nftokenId ? [out.nftokenId] : [];
    }

    return out;
  });

  // FIX 4a — pre-filter whale txs (XRP payments >= threshold)
  const whaleTxs = recentTransactions.filter(
    (tx) => tx.amountXrp != null && tx.amountXrp >= WHALE_THRESHOLD_XRP,
  );

  // FIX 4b — DEX activity summary
  const dexSummary = (() => {
    const creates = typeCounts['OfferCreate'] ?? 0;
    const cancels  = typeCounts['OfferCancel'] ?? 0;
    if (!creates && !cancels) return null;

    const pairs = new Set();
    let xrpVolume = 0;

    recentTransactions.forEach((tx) => {
      if (tx.type !== 'OfferCreate') return;
      // Build a canonical pair string from TakerGets/TakerPays
      const getCcy = (a) => (typeof a === 'string' ? 'XRP' : `${a?.currency}/${a?.issuer?.slice(0, 6)}`);
      if (tx.takerGets && tx.takerPays) {
        pairs.add(`${getCcy(tx.takerGets)}:${getCcy(tx.takerPays)}`);
      }
      // Accumulate XRP side volume
      if (typeof tx.takerGets === 'string') xrpVolume += Number(tx.takerGets) / 1e6;
      if (typeof tx.takerPays === 'string') xrpVolume += Number(tx.takerPays) / 1e6;
    });

    return { offerCreates: creates, offerCancels: cancels, uniquePairs: pairs.size, xrpVolume };
  })();

  // ── Compose xrplState ─────────────────────────────
  const xrplState = {
    ledgerIndex:  li,
    ledgerHash:   hash,                                             // FIX 1a
    ledgerTime:   closeT,
    tps,
    txPerLedger:  txCount,
    avgFee:       avgFeeDrops / 1e6,                               // XRP
    totalFees:    totalFeesDrops / 1e6,                            // FIX 1c — XRP
    feeStdDev:    feeStdDevDrops / 1e6,                            // FIX 1c — XRP
    feeSpike,                                                       // FIX 4d
    successRate,
    txTypes:      typeCounts,
    whaleTxs,                                                       // FIX 4a
    dexSummary,                                                     // FIX 4b

    latestLedger: {
      ledgerIndex:  li,
      ledgerHash:   hash,                                           // FIX 1a
      closeTime:    closeT,
      closeTimeSec,
      totalTx:      txCount,
      txTypes:      typeCounts,
      avgFee:       avgFeeDrops / 1e6,
      totalFees:    totalFeesDrops / 1e6,                          // FIX 1c
      feeStdDev:    feeStdDevDrops / 1e6,                          // FIX 1c
      feeSpike,                                                     // FIX 4d
      successRate,
    },

    recentTransactions,
  };

  window.dispatchEvent(new CustomEvent('xrpl-ledger', { detail: xrplState }));
}

/* ─────────────────────────────
   Connection state → DOM + event
──────────────────────────────── */
function setConnState(connState, name) {
  state.connectionState = connState;

  const dot    = $('connDot');
  const text   = $('connText');
  const dot2   = $('connDot2');
  const text2  = $('connText2');
  const inspBtn  = $('inspect-btn');
  const inspWarn = $('inspect-warn');

  if (dot)  dot.classList.toggle('live',  connState === 'connected');
  if (dot2) dot2.classList.toggle('live', connState === 'connected');

  const msg =
    connState === 'connected'  ? `LIVE – ${name}` :
    connState === 'connecting' ? 'Connecting…'    :
    'Disconnected';

  const colour =
    connState === 'connected'  ? '#50fa7b' :
    connState === 'connecting' ? '#ffb86c' :
    '#ff5555';

  if (text)  { text.textContent  = msg; text.style.color  = colour; }
  if (text2) { text2.textContent = msg; text2.style.color = colour; }

  if (inspBtn)  inspBtn.disabled = connState !== 'connected';
  if (inspWarn) inspWarn.style.display = connState !== 'connected' ? '' : 'none';

  window.dispatchEvent(new CustomEvent('xrpl-connection', {
    detail: { connected: connState === 'connected', server: name, state: connState },
  }));
}

/* ─────────────────────────────
   Network switch
──────────────────────────────── */
export function switchNetwork(net) {
  if (net === state.currentNetwork) return;

  state.currentNetwork = net;
  state.endpointIdx    = 0;
  state.wsRetry        = 0;

  state.ledgerLog  = [];
  state.tpsHistory = [];
  state.feeHistory = [];
  state.txMixAccum = {};
  state.lastCloseTs = null;

  _ledgerReqInFlight  = false;
  _latestWantedIndex  = null;
  _lastProcessedIndex = 0;

  reconnectXRPL(true);
  window.dispatchEvent(new CustomEvent('xrpl-connection', {
    detail: { connected: false, server: '', state: 'connecting' },
  }));
}