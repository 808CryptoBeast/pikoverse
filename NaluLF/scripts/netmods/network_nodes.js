/* =====================================================
   scripts/netmods/nodes_worker.js — Worker
   Receives:
     - setNodes: { nodes: [...] }
     - query: { q, filters, sort, gridDeg }
   Returns:
     - result: { list, clusters, stats }
   ===================================================== */

let NODES = [];

function safeLower(s) { return String(s || '').toLowerCase(); }

function hasGeo(n) {
  return !!(n?.geo && Number.isFinite(n.geo.lat) && Number.isFinite(n.geo.lng));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function gridKey(lat, lng, gridDeg) {
  const g = Math.max(0.1, Number(gridDeg) || 0.5);
  const la = Math.round(lat / g) * g;
  const ln = Math.round(lng / g) * g;
  return `${la.toFixed(3)},${ln.toFixed(3)}`;
}

function scoreMatch(n, q) {
  if (!q) return 0;
  const p = safeLower(n.pubkey);
  const ip = safeLower(n.ip);
  const st = safeLower(n.state);
  const ver = safeLower(n.version);
  const city = safeLower(n.geo?.city);
  const org = safeLower(n.geo?.org);

  // quick score: exact includes more weight
  let s = 0;
  if (p.includes(q)) s += 4;
  if (ip.includes(q)) s += 3;
  if (city.includes(q)) s += 2;
  if (org.includes(q)) s += 2;
  if (st.includes(q)) s += 1;
  if (ver.includes(q)) s += 1;
  return s;
}

function applyFilters(nodes, q, filters) {
  const query = safeLower(q).trim();
  const wantState = filters?.state && filters.state !== 'all' ? safeLower(filters.state) : null;
  const mappedOnly = filters?.mapped === true;
  const unmappedOnly = filters?.unmapped === true;
  const minPeers = Number(filters?.minPeers || 0);

  const out = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    if (wantState) {
      if (safeLower(n.state) !== wantState) continue;
    }

    const g = hasGeo(n);
    if (mappedOnly && !g) continue;
    if (unmappedOnly && g) continue;

    if ((n.peers || 0) < minPeers) continue;

    if (query) {
      const sc = scoreMatch(n, query);
      if (sc <= 0) continue;
      out.push({ i, sc });
    } else {
      out.push({ i, sc: 0 });
    }
  }

  return { query, matches: out };
}

function sortMatches(matches, sortKey) {
  const key = sortKey || 'peers_desc';

  matches.sort((a, b) => {
    // if query exists, keep best matches first (tie-break by metric)
    if (a.sc !== b.sc) return b.sc - a.sc;

    const A = NODES[a.i];
    const B = NODES[b.i];

    if (key === 'peers_desc') return (B.peers || 0) - (A.peers || 0);
    if (key === 'uptime_desc') return (B.uptimeSec || 0) - (A.uptimeSec || 0);
    if (key === 'ledger_desc') return (B.lastLedger || 0) - (A.lastLedger || 0);

    // latency_asc (null last)
    if (key === 'latency_asc') {
      const la = Number.isFinite(A.latencyMs) ? A.latencyMs : 1e18;
      const lb = Number.isFinite(B.latencyMs) ? B.latencyMs : 1e18;
      return la - lb;
    }

    return (B.peers || 0) - (A.peers || 0);
  });

  return matches;
}

function buildClusters(indices, gridDeg) {
  const clusters = new Map();
  let mapped = 0;
  let unmapped = 0;

  for (const idx of indices) {
    const n = NODES[idx];
    if (!hasGeo(n)) { unmapped++; continue; }
    mapped++;

    const k = gridKey(n.geo.lat, n.geo.lng, gridDeg);
    if (!clusters.has(k)) {
      clusters.set(k, {
        lat: n.geo.lat,
        lng: n.geo.lng,
        count: 0,
        sample: idx,
        states: {},
      });
    }
    const c = clusters.get(k);
    c.count++;
    const st = n.state || 'unknown';
    c.states[st] = (c.states[st] || 0) + 1;
  }

  // convert to array and sort by count desc
  const out = [...clusters.values()].sort((a, b) => b.count - a.count);
  return { clusters: out, mapped, unmapped };
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === 'setNodes') {
    NODES = Array.isArray(msg.nodes) ? msg.nodes : [];
    self.postMessage({ type: 'ready', total: NODES.length });
    return;
  }

  if (msg.type === 'query') {
    const q = msg.q || '';
    const filters = msg.filters || {};
    const sort = msg.sort || 'peers_desc';
    const gridDeg = clamp(Number(msg.gridDeg || 0.5), 0.1, 5);

    const { matches } = applyFilters(NODES, q, filters);
    sortMatches(matches, sort);

    const list = matches.map((m) => m.i);
    const { clusters, mapped, unmapped } = buildClusters(list, gridDeg);

    self.postMessage({
      type: 'result',
      list,
      clusters,
      stats: { total: NODES.length, filtered: list.length, mapped, unmapped },
    });
  }
};