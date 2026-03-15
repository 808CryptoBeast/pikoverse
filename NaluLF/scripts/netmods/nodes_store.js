/* =====================================================
   scripts/netmods/nodes_store.js — Node Dataset Loader
   - Fetches /data/nodes/<network>.json
   - Merges /data/nodes/geo_overrides.json (manual mapping)
   - Normalizes fields for fast UI + worker compute
   ===================================================== */

import { state } from '../state.js';

const CACHE_PREFIX = 'nalulf_nodes_cache_v1:';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function normalizeNetworkId(net) {
  // match your state.currentNetwork values
  // fallback to mainnet naming used in data folder
  const n = String(net || 'xrpl-mainnet');
  if (n.includes('test')) return 'xrpl-testnet';
  if (n.includes('dev')) return 'xrpl-devnet';
  return 'xrpl-mainnet';
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`Fetch failed ${r.status}: ${url}`);
  return r.json();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// Converts uptime strings like "8.12 d." / "21.9 hr." / "45.7 mo." to seconds (approx)
function uptimeToSec(uptime) {
  const s = String(uptime || '').trim().toLowerCase();
  const m = s.match(/([\d.]+)\s*(d|day|days|hr|h|hour|hours|min|m|month|mo|year|yr)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;

  const unit = m[2];
  if (unit.startsWith('d')) return Math.round(v * 86400);
  if (unit.startsWith('h')) return Math.round(v * 3600);
  if (unit.startsWith('m') && (unit === 'min' || unit === 'm')) return Math.round(v * 60);
  if (unit.startsWith('mo')) return Math.round(v * 30 * 86400);
  if (unit.startsWith('y') || unit.startsWith('yr')) return Math.round(v * 365 * 86400);
  return null;
}

function normalizeNode(raw) {
  const pubkey = String(raw.pubkey || raw.node_pubkey || '').trim();
  const ip = String(raw.ip || raw.address || '').trim();

  const geo = raw.geo && Number.isFinite(Number(raw.geo.lat)) && Number.isFinite(Number(raw.geo.lng))
    ? {
        lat: Number(raw.geo.lat),
        lng: Number(raw.geo.lng),
        city: raw.geo.city || '',
        country: raw.geo.country || '',
        org: raw.geo.org || '',
        source: raw.geo.source || 'unknown',
      }
    : null;

  const peers = safeNum(raw.peers) ?? 0;
  const inbound = safeNum(raw.in) ?? safeNum(raw.inbound) ?? null;
  const outbound = safeNum(raw.out) ?? safeNum(raw.outbound) ?? null;

  const uptimeSec =
    safeNum(raw.uptimeSec) ??
    uptimeToSec(raw.uptime) ??
    null;

  const lastLedger =
    safeNum(raw.lastLedger) ??
    safeNum(raw.last_ledger) ??
    safeNum(raw.lastledger) ??
    null;

  const latencyMs =
    safeNum(raw.latencyMs) ??
    safeNum(raw.latency) ??
    null;

  return {
    pubkey,
    ip,
    state: raw.state || raw.server_state || '',
    version: raw.version || raw.build_version || '',
    lastLedger,
    uptime: raw.uptime || '',
    uptimeSec,
    peers,
    inbound,
    outbound,
    ledgerHistory: raw.ledgerHistory || raw.history || '',
    quorum: raw.quorum ?? null,
    load: raw.load ?? null,
    latencyMs,
    geo,
    // keep original around if you need it later
    _raw: raw,
  };
}

function mergeOverrides(nodes, overrides) {
  const byPubkey = overrides?.byPubkey || {};
  const byIp = overrides?.byIp || {};

  for (const n of nodes) {
    const o =
      (n.pubkey && byPubkey[n.pubkey]) ||
      (n.ip && byIp[n.ip]) ||
      null;

    if (!o) continue;

    // allow override geo only, or any field
    if (o.geo && Number.isFinite(Number(o.geo.lat)) && Number.isFinite(Number(o.geo.lng))) {
      n.geo = {
        lat: Number(o.geo.lat),
        lng: Number(o.geo.lng),
        city: o.geo.city || n.geo?.city || '',
        country: o.geo.country || n.geo?.country || '',
        org: o.geo.org || n.geo?.org || '',
        source: o.geo.source || 'override',
      };
    }

    // optional field overrides
    if (o.org) n.org = o.org;
    if (o.label) n.label = o.label;
  }

  return nodes;
}

export async function getGlobalNodes({ networkId, force = false } = {}) {
  const net = normalizeNetworkId(networkId || state.currentNetwork);
  const key = `${CACHE_PREFIX}${net}`;

  if (!force) {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.ts && (Date.now() - parsed.ts) < CACHE_TTL_MS && Array.isArray(parsed.nodes)) {
          return parsed.nodes;
        }
      }
    } catch {}
  }

  const datasetUrl = `/data/nodes/${net}.json`;
  const overridesUrl = `/data/nodes/geo_overrides.json`;

  const [dataset, overrides] = await Promise.all([
    fetchJson(datasetUrl).catch(() => ({ nodes: [] })),
    fetchJson(overridesUrl).catch(() => ({ byPubkey: {}, byIp: {} })),
  ]);

  const nodes = (dataset.nodes || dataset || []).map(normalizeNode);
  mergeOverrides(nodes, overrides);

  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), nodes }));
  } catch {}

  return nodes;
}

export function clearGlobalNodesCache(networkId) {
  const net = normalizeNetworkId(networkId || state.currentNetwork);
  try { localStorage.removeItem(`${CACHE_PREFIX}${net}`); } catch {}
}

export { normalizeNetworkId };