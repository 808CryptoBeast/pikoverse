/* =====================================================
   inspector.js — Deep Account Inspector
   Analyses: security posture, drain risk, NFT exploits,
   wash trading, token issuer manipulation, AMM positions.
   Enhanced for:
   - deeper tx history pagination
   - token creation/distribution lifecycle reconstruction
   - reduced false positives via evidence confidence gating
   - evidence-weighted reporting
   ===================================================== */
import { $, $$, escHtml, isValidXrpAddress, shortAddr, fmt, safeGet, safeSet, safeRemove, safeJson } from './utils.js';
import { state } from './state.js';
import { wsSend } from './xrpl.js';

/* ─────────────────────────────
   Constants
──────────────────────────────── */

// XRPL account flags
const FLAGS = {
  lsfPasswordSpent:  0x00010000,
  lsfRequireDestTag: 0x00020000,
  lsfRequireAuth:    0x00040000,
  lsfDisallowXRP:    0x00080000,
  lsfDisableMaster:  0x00100000,
  lsfNoFreeze:       0x00200000,
  lsfGlobalFreeze:   0x00400000,
  lsfDefaultRipple:  0x00800000,
  lsfDepositAuth:    0x01000000,
};

// NFT flag bits
const NFT_FLAGS = {
  lsfBurnable:     0x0001,
  lsfOnlyXRP:      0x0002,
  lsfTrustLine:    0x0004,
  lsfTransferable: 0x0008,
};

// TX types that are high-risk if in history
const DRAIN_TX_TYPES = new Set([
  'SetRegularKey',
  'SignerListSet',
  'AccountSet',
  'AccountDelete',
  'EscrowCreate',
  'PaymentChannelCreate',
  'DepositPreauth',
]);

const XRPL_EPOCH = 946684800;

// False-positive control / evidence gates
const MIN_SAMPLE_WASH         = 40;
const MIN_SAMPLE_BENFORD      = 80;
const MIN_SAMPLE_ENTROPY      = 60;
const MIN_SAMPLE_TIMESERIES   = 40;
const MIN_SAMPLE_GRANGER      = 50;
const MIN_SAMPLE_ZIPF_CP      = 12;
const MIN_SAMPLE_VOLCONC      = 12;
const MIN_SAMPLE_TOKEN_DIST   = 8;

// History depth
const TX_PAGE_LIMIT           = 400;
const TX_MAX_PAGES_DEFAULT    = 12;   // up to ~4,800 tx
const TX_MAX_PAGES_ISSUER     = 30;   // up to ~12,000 tx for issuer-like accounts
const TX_MAX_TOTAL            = 12000;

/* ─────────────────────────────
   Known Exchange / Entity Registry
──────────────────────────────── */
const KNOWN_ENTITIES = new Map([
  ['rPVMhWBsfF9iMXYj3aAzJVkPDTFNSyWdKy', { name: 'Bitstamp', type: 'exchange' }],
  ['rrpNnNLKrartuEqfJGpqyDwPj1BBN1ih7', { name: 'Bitstamp', type: 'exchange' }],
  ['rN7n3473SaZBCG4dFL83w7PB9judJ7qdDo', { name: 'Binance', type: 'exchange' }],
  ['rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh', { name: 'Binance', type: 'exchange' }],
  ['rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', { name: 'Genesis (Black Hole)', type: 'blackhole' }],
  ['r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59', { name: 'Black Hole #2', type: 'blackhole' }],
  ['rBKPS4oLSaV2KVVuHH8EpQqMGgGefGFQs7', { name: 'Bitso', type: 'exchange' }],
  ['rfk5bwaKCoNU84fTzdqWQowqnNaZorDmiV', { name: 'Gate.io', type: 'exchange' }],
  ['rwYHCs2EYBMBvRXFmxDrCUSorPsuqCck7t', { name: 'Kraken', type: 'exchange' }],
  ['rLHzPsX6oXkzU2qL12kHCH8G8cnZv1rBJh', { name: 'Kraken', type: 'exchange' }],
  ['ra5nK24KXen9AHvsdFTKHSANinZseWnPcX', { name: 'Uphold', type: 'exchange' }],
  ['rGWrZyax5eXbi5gs49MRZKkE9eKNL9p4B', { name: 'Bittrex', type: 'exchange' }],
  ['rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv', { name: 'Coinone', type: 'exchange' }],
  ['rHsMUQFzBb7S6GnQFVgNirqvHRcLpAn5dU', { name: 'Bithumb', type: 'exchange' }],
  ['rMQ98K56yXJbDGv49ZSmW51sLn94Xe1mu1', { name: 'Huobi', type: 'exchange' }],
]);

/* ─────────────────────────────
   Known blackhole addresses
──────────────────────────────── */
const KNOWN_BLACKHOLE_ADDRESSES = new Set([
  'rrrrrrrrrrrrrrrrrrrrrhoLvTp',
  'rrrrrrrrrrrrrrrrrrrrBZbvji',
  'rrrrrrrrrrrrrrrrrNAMEtxvNvQ',
  'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
  'r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59',
]);

/* ─────────────────────────────
   State
──────────────────────────────── */
let _currentAddr = null;
let _inspectAbort = false;

/* ─────────────────────────────
   Lazy DOM cache
──────────────────────────────── */
let _dom = null;
function _getDOM() {
  if (_dom) return _dom;
  _dom = {
    input:   () => document.getElementById('inspect-addr'),
    err:     document.getElementById('inspect-err'),
    result:  document.getElementById('inspect-result'),
    empty:   document.getElementById('inspect-empty'),
    loading: document.getElementById('inspect-loading'),
    loadMsg: document.getElementById('inspect-loading-msg'),
    warn:    document.getElementById('inspect-warn'),
    badge:   document.getElementById('inspect-addr-badge'),
    score:   document.getElementById('inspect-risk-score'),
    label:   document.getElementById('inspect-risk-label'),
  };
  return _dom;
}
function _warmDOMCache() { _dom = null; _getDOM(); }

/* ─────────────────────────────
   Init
──────────────────────────────── */
export function initInspector() {
  _mountInspectorHTML();
  _mountInspectorNav();
  _mountHowToOverlay();

  $('inspect-addr')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') runInspect();
  });

  $('inspect-addr')?.addEventListener('paste', () => {
    setTimeout(() => {
      const v = $('inspect-addr')?.value.trim();
      if (v && isValidXrpAddress(v)) runInspect();
    }, 60);
  });

  document.getElementById('tab-inspector')?.addEventListener('click', e => {
    const hdr = e.target.closest('.section-header');
    if (!hdr) return;
    hdr.closest('.inspector-section')?.classList.toggle('collapsed');
  });

  document.getElementById('inspector-nav')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-jump]');
    if (!btn) return;
    const sec = document.getElementById('section-' + btn.dataset.jump);
    if (sec) {
      sec.classList.remove('collapsed');
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    _navSetActive(btn.dataset.jump);
  });

  let _scrollTick = false;
  window.addEventListener('scroll', () => {
    if (!_scrollTick) {
      _scrollTick = true;
      requestAnimationFrame(() => {
        _navOnScroll();
        _scrollTick = false;
      });
    }
  }, { passive: true });

  window.runInspect = runInspect;
  window.inspectorCopyAddr = _copyAddr;
  window.showInspectorHowTo = _showHowTo;
  window.hideInspectorHowTo = _hideHowTo;

  _warmDOMCache();
  initInspectorDashboard();

  window.addEventListener('naluxrp:tabchange', e => {
    if (e.detail?.tabId === 'inspector') {
      _loadWallets();
      _loadRecentHistory();
    }
  });
}

/* ─────────────────────────────
   Public: pre-fill + run from profile
──────────────────────────────── */
function inspectAddress(addr) {
  const inp = $('inspect-addr');
  if (inp) inp.value = addr;
  runInspect();
}

/* ─────────────────────────────
   Main entry
──────────────────────────────── */
export async function runInspect() {
  const d = _getDOM();
  const addr = d.input()?.value.trim() || '';

  [d.err, d.result, d.empty, d.warn].forEach(el => el && (el.style.display = 'none'));
  _inspectAbort = true;

  if (!addr) {
    if (d.empty) d.empty.style.display = '';
    return;
  }

  if (!isValidXrpAddress(addr)) {
    if (d.err) {
      d.err.textContent = `⚠ Invalid address: ${escHtml(addr)}`;
      d.err.style.display = '';
    }
    return;
  }

  if (state.connectionState !== 'connected') {
    if (d.warn) d.warn.style.display = '';
    return;
  }

  _currentAddr = addr;
  _inspectAbort = false;

  const _setMsg = m => {
    if (!d.loading) return;
    d.loading.style.display = '';
    if (d.loadMsg) d.loadMsg.textContent = m;
  };

  try {
    _setMsg('Fetching account state…');

    const [infoRes, linesRes, offersRes, nftRes, objRes] = await Promise.all([
      wsSend({ command: 'account_info', account: addr, ledger_index: 'validated' }),
      wsSend({ command: 'account_lines', account: addr, ledger_index: 'validated', limit: 400 }),
      wsSend({ command: 'account_offers', account: addr, ledger_index: 'validated', limit: 400 }),
      wsSend({ command: 'account_nfts', account: addr, ledger_index: 'validated', limit: 400 }).catch(() => null),
      wsSend({ command: 'account_objects', account: addr, ledger_index: 'validated', limit: 400 }).catch(() => null),
    ]);

    if (_inspectAbort) return;

    const acct    = infoRes?.result?.account_data || {};
    const lines   = linesRes?.result?.lines || [];
    const offers  = offersRes?.result?.offers || [];
    const nfts    = nftRes?.result?.account_nfts || [];
    const objects = objRes?.result?.account_objects || [];
    const flags   = Number(acct.Flags || 0);

    const issuerLike = looksLikeIssuer(acct, flags, []);
    const txPageBudget = issuerLike ? TX_MAX_PAGES_ISSUER : TX_MAX_PAGES_DEFAULT;

    _setMsg(`Fetching deep transaction history…`);

    const txList = await fetchAccountTxDeep(addr, {
      pageLimit: TX_PAGE_LIMIT,
      maxPages: txPageBudget,
      maxTotal: TX_MAX_TOTAL,
      progress: (page, total) => {
        _setMsg(`Fetching transaction history… page ${page} · ${total.toLocaleString()} tx`);
      },
    });

    if (_inspectAbort) return;

    _setMsg('Reconstructing token lifecycle…');

    const tokenLifecycle = buildTokenLifecycle(addr, acct, lines, txList);

    if (_inspectAbort) return;

    _setMsg('Running forensic analysis…');

    renderAll(addr, acct, lines, offers, nfts, objects, txList, tokenLifecycle);

    if (_inspectAbort) return;

    if (d.loading) d.loading.style.display = 'none';
    if (d.result) d.result.style.display = '';

    const riskVal = d.score ? Number(d.score.textContent) : null;
    addInspectHistory(addr, isNaN(riskVal) ? null : riskVal);

  } catch (err) {
    if (_inspectAbort) return;
    if (d.loading) d.loading.style.display = 'none';
    if (d.err) {
      d.err.textContent = `Error: ${escHtml(err.message || String(err))}`;
      d.err.style.display = '';
    }
  }
}

/* ─────────────────────────────
   Deep paginated account_tx fetch
──────────────────────────────── */
async function fetchAccountTxDeep(addr, opts = {}) {
  const pageLimit = opts.pageLimit || TX_PAGE_LIMIT;
  const maxPages  = opts.maxPages  || TX_MAX_PAGES_DEFAULT;
  const maxTotal  = opts.maxTotal  || TX_MAX_TOTAL;
  const progress  = typeof opts.progress === 'function' ? opts.progress : null;

  let marker = undefined;
  let page = 0;
  let out = [];

  while (page < maxPages && out.length < maxTotal) {
    if (_inspectAbort) break;

    const req = {
      command: 'account_tx',
      account: addr,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: pageLimit,
      forward: false,
    };
    if (marker) req.marker = marker;

    const res = await wsSend(req).catch(() => null);
    const chunk = normaliseTxList(res?.result?.transactions || []);

    if (!chunk.length) break;

    out.push(...chunk);
    page += 1;

    // dedupe by hash as we go
    out = dedupeTxList(out);

    if (progress) progress(page, out.length);

    marker = res?.result?.marker;
    if (!marker) break;
  }

  // chronological oldest -> newest for lifecycle reconstruction
  out.sort((a, b) => {
    const ta = txLedgerTime(a.tx);
    const tb = txLedgerTime(b.tx);
    if (ta !== tb) return ta - tb;
    return (a.tx.ledger_index || 0) - (b.tx.ledger_index || 0);
  });

  return out.slice(0, maxTotal);
}

function dedupeTxList(txList) {
  const seen = new Set();
  const out = [];
  for (const item of txList) {
    const h = item?.tx?.hash || item?.tx?.Hash || item?.hash || '';
    if (!h) {
      out.push(item);
      continue;
    }
    if (seen.has(h)) continue;
    seen.add(h);
    out.push(item);
  }
  return out;
}

/* ─────────────────────────────
   Normalise tx list
──────────────────────────────── */
function normaliseTxList(raw) {
  return raw.map(item => {
    const tx = item.tx_json || item.tx || item.transaction || {};
    const meta = item.meta || item.metadata || {};

    if (tx.date == null && item.date != null) tx.date = item.date;
    if (!tx.hash && item.hash) tx.hash = item.hash;
    if (!tx.ledger_index && item.ledger_index) tx.ledger_index = item.ledger_index;

    return { tx, meta };
  });
}

/* ─────────────────────────────
   Token lifecycle reconstruction
   Rebuilds issuer events from earliest tx forward.
──────────────────────────────── */
function buildTokenLifecycle(addr, acct, lines, txList) {
  const flags = Number(acct.Flags || 0);

  const currencies = new Map(); // currencyKey -> stats
  const trustlineOpens = [];
  const issuerPayments = [];
  const tokenSales = [];
  const accountActivations = [];
  const authChanges = [];
  const lifecycleEvents = [];

  const currentIssuedLines = lines.filter(l => Number(l.balance) < 0);

  for (const l of currentIssuedLines) {
    const key = currencyKey(l.currency, addr);
    if (!currencies.has(key)) {
      currencies.set(key, {
        key,
        currencyHex: l.currency,
        currency: hexToAscii(l.currency),
        issuer: addr,
        firstSeenTs: null,
        firstTrustSetTs: null,
        firstDistributionTs: null,
        firstAMMTs: null,
        totalDistributed: 0,
        outstandingNow: 0,
        holdersNow: 0,
        distributions: new Map(),
        distributionTxs: 0,
        trustSetOpeners: new Set(),
        marketMakers: new Set(),
        ammCreates: 0,
        offerCreates: 0,
      });
    }
    const c = currencies.get(key);
    c.outstandingNow += Math.abs(Number(l.balance || 0));
    c.holdersNow += 1;
  }

  for (const { tx, meta } of txList) {
    const type = tx.TransactionType;
    const ts = getCloseTime(tx);

    if (type === 'TrustSet') {
      const lim = tx.LimitAmount;
      if (lim?.currency && lim?.issuer === addr) {
        const key = currencyKey(lim.currency, addr);
        ensureLifecycleCurrency(currencies, key, lim.currency, addr);
        const c = currencies.get(key);

        c.firstSeenTs ??= ts;
        c.firstTrustSetTs ??= ts;
        if (tx.Account && tx.Account !== addr) c.trustSetOpeners.add(tx.Account);

        trustlineOpens.push({
          ts,
          opener: tx.Account,
          issuer: addr,
          currency: hexToAscii(lim.currency),
          limit: Number(lim.value || 0),
          ledger: tx.ledger_index || 0,
        });

        lifecycleEvents.push({
          ts,
          type: 'trustline_open',
          currency: hexToAscii(lim.currency),
          account: tx.Account,
          detail: `${shortAddr(tx.Account)} opened trustline for ${hexToAscii(lim.currency)}`,
        });
      }
    }

    if (type === 'Payment') {
      const amt = tx.Amount;
      const created = meta?.AffectedNodes?.some?.(n =>
        n.CreatedNode?.LedgerEntryType === 'AccountRoot' &&
        n.CreatedNode?.NewFields?.Account === tx.Destination
      );

      if (created && tx.Destination) {
        accountActivations.push({
          ts,
          dest: tx.Destination,
          amountXrp: typeof amt === 'string' ? Number(amt) / 1e6 : 0,
          ledger: tx.ledger_index || 0,
        });
      }

      if (tx.Account === addr && typeof amt === 'object' && amt?.currency) {
        const key = currencyKey(amt.currency, amt.issuer || addr);
        if ((amt.issuer || addr) === addr) {
          ensureLifecycleCurrency(currencies, key, amt.currency, addr);
          const c = currencies.get(key);
          const val = Number(amt.value || 0);

          c.firstSeenTs ??= ts;
          c.firstDistributionTs ??= ts;
          c.totalDistributed += Math.max(0, val);
          c.distributionTxs += 1;

          if (tx.Destination) {
            c.distributions.set(tx.Destination, (c.distributions.get(tx.Destination) || 0) + Math.max(0, val));
          }

          issuerPayments.push({
            ts,
            currency: hexToAscii(amt.currency),
            dest: tx.Destination,
            value: val,
            hash: tx.hash || '',
            ledger: tx.ledger_index || 0,
          });

          lifecycleEvents.push({
            ts,
            type: 'distribution',
            currency: hexToAscii(amt.currency),
            account: tx.Destination,
            detail: `Distributed ${fmt(val, 2)} ${hexToAscii(amt.currency)} to ${shortAddr(tx.Destination || '')}`,
          });
        }
      }
    }

    if (type === 'OfferCreate') {
      for (const side of [tx.TakerPays, tx.TakerGets]) {
        if (typeof side === 'object' && side?.currency && side?.issuer === addr) {
          const key = currencyKey(side.currency, addr);
          ensureLifecycleCurrency(currencies, key, side.currency, addr);
          const c = currencies.get(key);
          c.offerCreates += 1;
          if (tx.Account && tx.Account !== addr) c.marketMakers.add(tx.Account);

          tokenSales.push({
            ts,
            account: tx.Account,
            currency: hexToAscii(side.currency),
            value: Number(side.value || 0),
            ledger: tx.ledger_index || 0,
          });

          lifecycleEvents.push({
            ts,
            type: 'market_offer',
            currency: hexToAscii(side.currency),
            account: tx.Account,
            detail: `${shortAddr(tx.Account || '')} placed offer involving ${hexToAscii(side.currency)}`,
          });
        }
      }
    }

    if (type === 'AMMCreate') {
      for (const field of ['Amount', 'Amount2']) {
        const amt = tx[field];
        if (typeof amt === 'object' && amt?.currency && amt?.issuer === addr) {
          const key = currencyKey(amt.currency, addr);
          ensureLifecycleCurrency(currencies, key, amt.currency, addr);
          const c = currencies.get(key);
          c.firstAMMTs ??= ts;
          c.ammCreates += 1;

          lifecycleEvents.push({
            ts,
            type: 'amm_create',
            currency: hexToAscii(amt.currency),
            account: tx.Account,
            detail: `AMM created for ${hexToAscii(amt.currency)}`,
          });
        }
      }
    }

    if (type === 'AccountSet' || type === 'SetRegularKey' || type === 'SignerListSet') {
      authChanges.push({
        ts,
        type,
        account: tx.Account,
        ledger: tx.ledger_index || 0,
      });
    }
  }

  const tokenSummaries = [...currencies.values()].map(c => {
    const topRecipients = [...c.distributions.entries()]
      .map(([a, v]) => ({ addr: a, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    const totalDist = Math.max(c.totalDistributed, 0);
    const top1Pct = totalDist > 0 && topRecipients[0] ? (topRecipients[0].value / totalDist) * 100 : 0;
    const top5Pct = totalDist > 0
      ? (topRecipients.slice(0, 5).reduce((s, x) => s + x.value, 0) / totalDist) * 100
      : 0;

    return {
      ...c,
      topRecipients,
      top1Pct,
      top5Pct,
      uniqueRecipients: c.distributions.size,
      trustlineOpenersCount: c.trustSetOpeners.size,
      marketMakerCount: c.marketMakers.size,
    };
  });

  tokenSummaries.sort((a, b) => (a.firstDistributionTs || Infinity) - (b.firstDistributionTs || Infinity));
  lifecycleEvents.sort((a, b) => a.ts - b.ts);

  return {
    issuerLike: looksLikeIssuer(acct, flags, txList),
    currencies: tokenSummaries,
    issuerPayments,
    tokenSales,
    trustlineOpens,
    accountActivations,
    authChanges,
    lifecycleEvents,
    txDepth: txList.length,
    firstTxTs: txList[0] ? getCloseTime(txList[0].tx) : null,
    lastTxTs: txList.length ? getCloseTime(txList[txList.length - 1].tx) : null,
  };
}

function ensureLifecycleCurrency(map, key, currencyHex, issuer) {
  if (map.has(key)) return;
  map.set(key, {
    key,
    currencyHex,
    currency: hexToAscii(currencyHex),
    issuer,
    firstSeenTs: null,
    firstTrustSetTs: null,
    firstDistributionTs: null,
    firstAMMTs: null,
    totalDistributed: 0,
    outstandingNow: 0,
    holdersNow: 0,
    distributions: new Map(),
    distributionTxs: 0,
    trustSetOpeners: new Set(),
    marketMakers: new Set(),
    ammCreates: 0,
    offerCreates: 0,
  });
}

function currencyKey(currency, issuer) {
  return `${currency || ''}.${issuer || ''}`;
}

/* ─────────────────────────────
   Confidence / evidence helpers
──────────────────────────────── */
function evidenceBucket(sample, strongAt, mediumAt) {
  if (sample >= strongAt) return 'strong';
  if (sample >= mediumAt) return 'medium';
  return 'weak';
}

function severityWithConfidence(sev, confidence) {
  if (confidence === 'weak') {
    if (sev === 'critical') return 'warn';
    if (sev === 'warn') return 'info';
  }
  return sev;
}

function maybeDeescalateFinding(base, sample, strongAt, mediumAt, weakDetailSuffix = '') {
  const confidence = evidenceBucket(sample, strongAt, mediumAt);
  return {
    ...base,
    sev: severityWithConfidence(base.sev, confidence),
    confidence,
    detail: confidence === 'weak' && weakDetailSuffix
      ? `${base.detail}${weakDetailSuffix}`
      : base.detail,
  };
}

/* ─────────────────────────────
   Blackhole / issuer helpers
──────────────────────────────── */
function isKnownBlackholeAddress(addr) {
  return !!addr && KNOWN_BLACKHOLE_ADDRESSES.has(addr);
}

function isIntentionalBlackhole(acct, flags, signerLists = [], txList = []) {
  const masterDisabled = !!(flags & FLAGS.lsfDisableMaster);
  const regularKey = acct?.RegularKey || '';
  const hasSignerList = Array.isArray(signerLists) && signerLists.length > 0;
  const knownBlackhole = isKnownBlackholeAddress(regularKey);
  return masterDisabled && knownBlackhole && !hasSignerList;
}

function looksLikeIssuer(acct, flags, txList = []) {
  const defaultRipple = !!(flags & FLAGS.lsfDefaultRipple);
  const requireAuth   = !!(flags & FLAGS.lsfRequireAuth);
  const globalFreeze  = !!(flags & FLAGS.lsfGlobalFreeze);
  const noFreeze      = !!(flags & FLAGS.lsfNoFreeze);

  const trustSetCount = txList.filter(({ tx }) => tx.TransactionType === 'TrustSet').length;
  const tokenPayCount = txList.filter(({ tx }) =>
    tx.TransactionType === 'Payment' &&
    typeof tx.Amount === 'object' &&
    tx.Amount?.currency
  ).length;

  return defaultRipple || requireAuth || globalFreeze || noFreeze || trustSetCount >= 3 || tokenPayCount >= 5;
}

/* ─────────────────────────────
   Master render
──────────────────────────────── */
function renderAll(addr, acct, lines, offers, nfts, objects, txList, tokenLifecycle) {
  const balXrp   = Number(acct.Balance || 0) / 1e6;
  const ownerCnt = Number(acct.OwnerCount || 0);
  const reserve  = 10 + ownerCnt * 2;
  const flags    = Number(acct.Flags || 0);
  const sequence = acct.Sequence ?? '—';

  const signerLists  = objects.filter(o => o.LedgerEntryType === 'SignerList');
  const escrows      = objects.filter(o => o.LedgerEntryType === 'Escrow');
  const paychans     = objects.filter(o => o.LedgerEntryType === 'PayChannel');
  const depositAuths = objects.filter(o => o.LedgerEntryType === 'DepositPreauth');
  const checks       = objects.filter(o => o.LedgerEntryType === 'Check');

  const securityAudit    = analyseSecurityPosture(acct, flags, signerLists, txList);
  const drainAnalysis    = analyseDrainRisk(acct, flags, signerLists, txList, paychans, escrows);
  const nftAnalysis      = analyseNftRisk(nfts, txList, addr);
  const washAnalysis     = analyseWashTrading(txList, addr, lines);
  const issuerAnalysis   = analyseTokenIssuer(acct, lines, flags, txList, tokenLifecycle);
  const ammAnalysis      = analyseAmmPositions(lines, txList, objects);
  const benfordsAnalysis = analyseBenfordsLaw(txList);
  const volConcAnalysis  = analyseVolumeConcentration(txList, addr, tokenLifecycle);

  const entropyAnalysis    = analyseShannonsEntropy(txList, addr);
  const zipfAnalysis       = analyseZipfsLaw(txList, addr);
  const timeSeriesAnalysis = analyseTimeSeries(txList);
  const grangerAnalysis    = analyseGrangerCausality(txList, addr);

  const fundFlowAnalysis   = analyseFundFlow(txList, addr);
  const issuerConnAnalysis = analyseIssuerConnections(txList, addr, lines, tokenLifecycle);

  const riskScore = computeOverallRisk(
    securityAudit,
    drainAnalysis,
    nftAnalysis,
    washAnalysis,
    benfordsAnalysis,
    volConcAnalysis,
    entropyAnalysis,
    zipfAnalysis,
    timeSeriesAnalysis,
    grangerAnalysis,
    issuerConnAnalysis
  );

  renderHeader(addr, acct, balXrp, reserve, ownerCnt, sequence, riskScore, txList, tokenLifecycle);
  renderSecurityAudit(securityAudit, acct, flags, signerLists, depositAuths);
  renderDrainAnalysis(drainAnalysis, paychans, escrows, checks);
  renderFundFlowPanel(fundFlowAnalysis);
  renderNftPanel(nftAnalysis, nfts);
  renderWashPanel(washAnalysis);
  renderBenfordsPanel(benfordsAnalysis);
  renderVolConcPanel(volConcAnalysis);
  renderEntropyPanel(entropyAnalysis);
  renderZipfPanel(zipfAnalysis);
  renderTimeSeriesPanel(timeSeriesAnalysis);
  renderGrangerPanel(grangerAnalysis);
  renderForensicSuitePanel(benfordsAnalysis, entropyAnalysis, zipfAnalysis, timeSeriesAnalysis, grangerAnalysis);
  renderIssuerPanel(issuerAnalysis, lines, tokenLifecycle);
  renderIssuerConnectionsPanel(issuerConnAnalysis, lines, tokenLifecycle);
  renderAmmPanel(ammAnalysis, lines);
  renderTrustlines(lines);
  renderTxTimeline(txList, addr);

  const reportContainer = $('inspect-report-body');
  if (reportContainer) {
    renderFullReport(
      reportContainer,
      addr, acct, balXrp, riskScore,
      securityAudit, drainAnalysis, nftAnalysis, washAnalysis,
      benfordsAnalysis, volConcAnalysis, issuerAnalysis,
      ammAnalysis, fundFlowAnalysis, issuerConnAnalysis, txList,
      entropyAnalysis, zipfAnalysis, timeSeriesAnalysis, grangerAnalysis,
      tokenLifecycle
    );
  }
}

/* ─────────────────────────────
   Shared tx helpers
──────────────────────────────── */
function txLedgerTime(tx) {
  const t = tx?.date ?? tx?.close_time ?? tx?.ledger_close_time;
  return t != null ? Number(t) : 0;
}

function getCloseTime(tx) {
  const t = tx?.date || tx?.close_time || tx?.ledger_close_time;
  if (!t) return 0;
  return Number(t) + XRPL_EPOCH;
}

function hexToAscii(hex) {
  if (!hex || hex.length !== 40) return hex || '';
  try {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16);
      if (code === 0) continue;
      if (code < 32 || code > 126) return hex;
      str += String.fromCharCode(code);
    }
    return str || hex;
  } catch {
    return hex;
  }
}
