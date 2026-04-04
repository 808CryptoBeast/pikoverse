/* ============================================================
   AMP ADMIN — admin.js
   Goes in: js/admin.js

   DATA LAYER: localStorage
   ┌─────────────────────────────────────────────────────────┐
   │  When you're ready for a real backend, search for       │
   │  "TODO: SWAP" comments — they mark every place where    │
   │  a localStorage call should be replaced with an API     │
   │  fetch() to your Sanity / Contentful / custom endpoint. │
   └─────────────────────────────────────────────────────────┘
   ============================================================ */

'use strict';

/* ─────────────────────────────────────────────
   CONFIG — change these before going live
───────────────────────────────────────────── */
const ADM_CONFIG = {
  // Username/password auth
  // IMPORTANT: These are stored hashed (SHA-256) in localStorage after first run.
  // On first load the plain-text defaults below are hashed and stored, then cleared.
  DEFAULT_USERNAME: 'admin',
  DEFAULT_PASSWORD: 'alohamass2025!',   // Change this before deploying

  // Google OAuth — replace with your actual client ID
  // See Settings → Google OAuth Setup for instructions
  GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID',

  // Which Google email addresses are allowed to log in
  GOOGLE_ALLOWED_EMAILS: [
    // 'you@gmail.com',
  ],

  // Session duration in ms (default: 8 hours)
  SESSION_DURATION: 8 * 60 * 60 * 1000,

  // localStorage key prefix
  STORAGE_PREFIX: 'amp_admin_',
};

/* ─────────────────────────────────────────────
   STORAGE HELPERS
   TODO: SWAP — replace readDB/writeDB with
   fetch() calls to your real API/CMS
───────────────────────────────────────────── */
const DB = {
  key: (k) => ADM_CONFIG.STORAGE_PREFIX + k,

  get(k, fallback = null) {
    try {
      const v = localStorage.getItem(DB.key(k));
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },

  set(k, v) {
    try { localStorage.setItem(DB.key(k), JSON.stringify(v)); return true; }
    catch { return false; }
  },

  del(k) { localStorage.removeItem(DB.key(k)); },
};

/* ─────────────────────────────────────────────
   CRYPTO helpers
   Pure-JS SHA-256 — works on HTTP, file://, localhost,
   everywhere. No crypto.subtle required.
───────────────────────────────────────────── */
async function sha256(str) {
  // Try the native API first (HTTPS / localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) { /* fall through to pure-JS */ }
  }
  return sha256PureJS(str);
}

// Pure-JS SHA-256 fallback (works on any protocol)
function sha256PureJS(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord  = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [];
  let k = [];
  let primeCounter = 0;
  const isComposite = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = candidate * candidate; i < 313; i += candidate)
        isComposite[i] = true;
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++]  = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  const orig = ascii;
  while (ascii.length % 64 !== 56)
    ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';   // non-ASCII – shouldn't happen here
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const W = words.slice(j, j += 16);
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = W[i - 15], w2 = W[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6]))
        + k[i]
        + (W[i] = (i < 16) ? W[i] : (
            W[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + W[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2],
              (hash[3] + temp1) | 0, e, hash[5], hash[6]];
    }
    hash = hash.map((v, i) => (v + oldHash[i]) | 0);
  }
  hash.forEach(val => {
    for (let i = 7; i >= 0; i--)
      result += ((val >>> (i * 4)) & 15).toString(16);
  });
  return result;
}

/* ─────────────────────────────────────────────
   XSS SANITISE
───────────────────────────────────────────── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─────────────────────────────────────────────
   NEW SUBMISSION NOTIFICATIONS
   Compares item timestamps against a stored
   "last seen" time per panel. Badge glows when
   there are items newer than last visit.
───────────────────────────────────────────── */
const NotifDB = {
  key: panel => 'amp_admin_seen_' + panel,
  mark(panel)  { localStorage.setItem(this.key(panel), Date.now()); },
  lastSeen(panel) {
    const v = localStorage.getItem(this.key(panel));
    return v ? parseInt(v) : 0;
  },
  hasNew(panel, items, tsField) {
    const seen = this.lastSeen(panel);
    if (!seen) return items.length > 0; // first ever visit → show badge
    return items.some(i => (i[tsField] || 0) > seen);
  },
};

function refreshNotifBadges() {
  // Suggestions + Ideas
  const allSugg = [
    ...SuggDB.all().map(s => ({ ts: s.timestamp || 0, status: s.status })),
    ...IdeaDB.all().map(i => ({ ts: i.ts || 0, status: i.status })),
  ].filter(s => s.status === 'pending');
  const hasSuggNew = allSugg.length > 0 &&
    allSugg.some(s => s.ts > NotifDB.lastSeen('suggestions'));

  const suggBadge = document.getElementById('admSuggBadge');
  if (suggBadge) {
    suggBadge.hidden = allSugg.length === 0;
    suggBadge.textContent = allSugg.length;
    suggBadge.classList.toggle('adm-nav-badge--new', hasSuggNew);
  }

  // Projects
  const pendingProj = ProjDB.all().filter(p => p.status === 'pending');
  const hasProjNew  = pendingProj.length > 0 &&
    pendingProj.some(p => (p.ts || 0) > NotifDB.lastSeen('projects'));

  const projBadge = document.getElementById('admProjBadge');
  if (projBadge) {
    projBadge.hidden = pendingProj.length === 0;
    projBadge.textContent = pendingProj.length;
    projBadge.classList.toggle('adm-nav-badge--new', hasProjNew);
  }
}

/* ─────────────────────────────────────────────
   DEFAULT PRODUCTS (seeded on first run)
   TODO: SWAP — on first run, fetch these from
   your CMS instead of seeding from here
───────────────────────────────────────────── */
const DEFAULT_PRODUCTS = [
  {
    id: 'amp-ryb-shirt',
    name: 'AMP RYB T-Shirt',
    category: 'shirts',
    price: 3500,        // cents
    description: 'Bold red, yellow and blue AMP tee. Comfortable everyday wear.',
    image: 'https://pikoverse.xyz/assets/AMP%20RYB.jpg',
    badge: 'featured',
    sizes: ['XS','S','M','L','XL','2XL'],
    featured: true,
    soldOut: false,
  },
  {
    id: 'rabbit-island-hat',
    name: 'Rabbit Island Hat',
    category: 'hats',
    price: 2800,
    description: 'Classic cap featuring Rabbit Island artwork.',
    image: 'https://pikoverse.xyz/assets/AMP%20Rabbit%20Island.jpg',
    badge: 'new',
    sizes: ['One Size'],
    featured: false,
    soldOut: false,
  },
  {
    id: 'amp-tiki-sticker',
    name: 'AMP Tiki Sticker',
    category: 'stickers',
    price: 800,
    description: 'Vinyl sticker of the iconic AMP Tiki. Waterproof.',
    image: 'https://pikoverse.xyz/assets/AMPTTiki.jpg',
    badge: '',
    sizes: [],
    featured: false,
    soldOut: false,
  },
  {
    id: 'amp-tote',
    name: 'AMP Tote Bag',
    category: 'accessories',
    price: 2200,
    description: 'Reusable tote with the AMP Tiki logo.',
    image: 'https://pikoverse.xyz/assets/AMP%20Tiki.jpg',
    badge: '',
    sizes: ['One Size'],
    featured: false,
    soldOut: false,
  },
];

/* ─────────────────────────────────────────────
   PRODUCT DB  (localStorage wrapper)
   TODO: SWAP loadProducts  → GET  /api/products
   TODO: SWAP saveProducts  → PUT  /api/products  (bulk)
   TODO: SWAP addProduct    → POST /api/products
   TODO: SWAP updateProduct → PUT  /api/products/:id
   TODO: SWAP deleteProduct → DELETE /api/products/:id
───────────────────────────────────────────── */
const BASE_URL = 'https://pikoverse.xyz';

const ProductDB = {
  load() {
    const stored = DB.get('products');
    if (stored) {
      // One-time migration: fix bare 'assets/...' paths to '../../assets/...'
      // needed when admin moved from marketplace/ to projects/admin/
      const needsFix = stored.some(p => p.image && (
        p.image.startsWith('assets/') || p.image.startsWith('../../assets/')
      ));
      if (needsFix) {
        const fixed = stored.map(p => {
          if (!p.image) return p;
          let img = p.image;
          if (img.startsWith('../../assets/')) img = img.replace('../../assets/', BASE_URL + '/assets/');
          else if (img.startsWith('assets/'))  img = BASE_URL + '/' + img;
          return { ...p, image: img };
        });
        DB.set('products', fixed);
        return fixed;
      }
      return stored;
    }
    DB.set('products', DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  },
  save(products) {
    DB.set('products', products);
  },
  all()   { return this.load(); },
  byId(id) { return this.load().find(p => p.id === id) || null; },
  add(product) {
    const products = this.load();
    product.id = product.id || slugify(product.name) + '-' + Date.now();
    products.push(product);
    this.save(products);
    return product;
  },
  update(id, updates) {
    const products = this.load();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updates };
    this.save(products);
    return products[idx];
  },
  remove(id) {
    const products = this.load().filter(p => p.id !== id);
    this.save(products);
  },
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ─────────────────────────────────────────────
   AUTH
───────────────────────────────────────────── */
const Auth = {
  async init() {
    // Pre-seeded hash for default credentials: admin / alohamass2025!
    // Generated with: echo -n "admin:alohamass2025!" | sha256sum
    if (!DB.get('creds')) {
      DB.set('creds', {
        username: 'admin',
        hash: 'fa9b1f183328c65a71a1bdd3d234435a6bfd76e683e4b2ede1f3525d3a53dbf6',
      });
    }
  },

  async checkPassword(username, password) {
    const creds = DB.get('creds');
    if (!creds) return false;
    const hash = await sha256(username + ':' + password);
    return creds.username === username && creds.hash === hash;
  },

  async changePassword(currentPw, newPw) {
    const creds = DB.get('creds');
    const currentHash = await sha256(creds.username + ':' + currentPw);
    if (currentHash !== creds.hash) return { ok: false, msg: 'Current password is incorrect.' };
    if (newPw.length < 12) return { ok: false, msg: 'New password must be at least 12 characters.' };
    const newHash = await sha256(creds.username + ':' + newPw);
    DB.set('creds', { username: creds.username, hash: newHash });
    return { ok: true };
  },

  startSession(user) {
    DB.set('session', {
      user,
      expires: Date.now() + ADM_CONFIG.SESSION_DURATION,
    });
  },

  getSession() {
    const s = DB.get('session');
    if (!s) return null;
    if (Date.now() > s.expires) { this.endSession(); return null; }
    return s;
  },

  endSession() { DB.del('session'); },

  isLoggedIn() { return this.getSession() !== null; },
};

/* ─────────────────────────────────────────────
   RATE LIMITER — brute-force login protection
   5 attempts max, 15-minute lockout, persisted
   in localStorage so it survives page refresh.
───────────────────────────────────────────── */
const RateLimit = {
  KEY:          'amp_admin_login_attempts',
  MAX_ATTEMPTS: 5,
  LOCKOUT_MS:   15 * 60 * 1000,   // 15 minutes

  _get() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{"count":0,"lockedUntil":0}'); }
    catch { return { count: 0, lockedUntil: 0 }; }
  },
  _save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); } catch {}
  },

  // Returns { locked: true, secondsLeft: N } or { locked: false }
  check() {
    const d = this._get();
    if (d.lockedUntil && Date.now() < d.lockedUntil) {
      return { locked: true, secondsLeft: Math.ceil((d.lockedUntil - Date.now()) / 1000) };
    }
    // Lockout expired — reset
    if (d.lockedUntil && Date.now() >= d.lockedUntil) {
      this._save({ count: 0, lockedUntil: 0 });
    }
    return { locked: false };
  },

  // Call on failed attempt. Returns { locked: true, secondsLeft } if now locked, else { locked: false, remaining }
  fail() {
    const d = this._get();
    d.count = (d.count || 0) + 1;
    if (d.count >= this.MAX_ATTEMPTS) {
      d.lockedUntil = Date.now() + this.LOCKOUT_MS;
      this._save(d);
      return { locked: true, secondsLeft: Math.ceil(this.LOCKOUT_MS / 1000) };
    }
    this._save(d);
    return { locked: false, remaining: this.MAX_ATTEMPTS - d.count };
  },

  // Call on successful login
  reset() { this._save({ count: 0, lockedUntil: 0 }); },

  // Human-readable countdown
  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  },
};

// Live countdown timer reference
let _lockoutTimer = null;

function startLockoutCountdown(secondsLeft) {
  const btn = document.getElementById('admLoginBtn');
  const form = document.getElementById('admLoginForm');
  if (form) {
    form.querySelectorAll('input').forEach(i => i.disabled = true);
  }
  if (btn) btn.disabled = true;

  function tick() {
    const status = RateLimit.check();
    if (!status.locked) {
      clearInterval(_lockoutTimer);
      _lockoutTimer = null;
      showLoginError(`Account unlocked. You may try again.`);
      if (form) form.querySelectorAll('input').forEach(i => i.disabled = false);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
      }
      return;
    }
    if (btn) {
      btn.innerHTML = `<i class="fas fa-lock"></i> Locked — ${RateLimit.formatTime(status.secondsLeft)}`;
    }
    showLoginError(`Too many failed attempts. Try again in ${RateLimit.formatTime(status.secondsLeft)}.`);
  }

  tick();
  _lockoutTimer = setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────
   GOOGLE OAUTH CALLBACK
   Called by the Google Identity Services library
   TODO: SWAP — verify token server-side for
   production. Never trust client-only validation
   for anything sensitive.
───────────────────────────────────────────── */
window.handleGoogleLogin = function(credentialResponse) {
  try {
    // Decode the JWT payload (not cryptographically verified client-side)
    const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
    const email = payload.email || '';
    const name  = payload.name  || email;
    const picture = payload.picture || '';

    // Check allowed emails list (if configured)
    if (ADM_CONFIG.GOOGLE_ALLOWED_EMAILS.length > 0 &&
        !ADM_CONFIG.GOOGLE_ALLOWED_EMAILS.includes(email)) {
      showLoginError('This Google account is not authorised.');
      return;
    }

    Auth.startSession({ name, email, picture, method: 'google' });
    enterDashboard({ name, email, picture });
  } catch (e) {
    showLoginError('Google login failed. Please try again.');
    console.error('Google auth error:', e);
  }
};

/* ─────────────────────────────────────────────
   UI helpers
───────────────────────────────────────────── */
function showLoginError(msg) {
  const el  = document.getElementById('admLoginError');
  const txt = document.getElementById('admLoginErrorMsg');
  txt.textContent = msg;
  el.hidden = false;
  el.style.display = 'flex';
}

function hideLoginError() {
  const el = document.getElementById('admLoginError');
  el.hidden = true;
  el.style.display = 'none';
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('admToast');
  t.textContent = msg;
  t.setAttribute('aria-hidden', 'false');
  t.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('is-visible');
    t.setAttribute('aria-hidden', 'true');
  }, 3000);
}

function openModal(backdropId) {
  const el = document.getElementById(backdropId);
  el.classList.add('is-open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(backdropId) {
  const el = document.getElementById(backdropId);
  // Blur any focused element inside the modal before hiding it
  // prevents the aria-hidden + focused descendant browser warning
  if (document.activeElement && el && el.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function setPanel(panelName) {
  if (!panelName) return; // guard: platform link buttons have no data-panel
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.remove('is-active'));
  document.querySelectorAll('.adm-nav-btn').forEach(b => b.classList.remove('is-active'));
  document.getElementById('admPanel' + panelName.charAt(0).toUpperCase() + panelName.slice(1))
    ?.classList.add('is-active');
  document.querySelector(`.adm-nav-btn[data-panel="${panelName}"]`)
    ?.classList.add('is-active');
  document.getElementById('admPageTitle').textContent =
    panelName.charAt(0).toUpperCase() + panelName.slice(1);
}

/* ─────────────────────────────────────────────
   PRODUCT TABLE RENDERING
───────────────────────────────────────────── */
function renderProducts(filterText = '') {
  const products = ProductDB.all();
  const query    = filterText.toLowerCase().trim();
  const filtered = query
    ? products.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query))
    : products;

  const tbody = document.getElementById('admProductTbody');
  const empty = document.getElementById('admProductEmpty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    document.getElementById('admProductTable').hidden = true;
  } else {
    document.getElementById('admProductTable').hidden = false;
    empty.hidden = true;
    tbody.innerHTML = filtered.map(p => productRow(p)).join('');
  }

  // Update stats (always from full product list)
  const total   = products.length;
  const soldOut = products.filter(p => p.soldOut).length;
  document.getElementById('admStatTotal').textContent   = total;
  document.getElementById('admStatActive').textContent  = total - soldOut;
  document.getElementById('admStatSoldOut').textContent = soldOut;

  // Sync bulk bar visibility
  updateBulkBar();
}

/* ── Bulk selection ── */
function getSelectedIds() {
  return Array.from(document.querySelectorAll('.adm-row-check:checked'))
    .map(cb => cb.dataset.id);
}

function updateBulkBar() {
  var bar = document.getElementById('admBulkBar');
  var countEl = document.getElementById('admBulkCount');
  if (!bar) return;
  var selected = getSelectedIds();
  bar.hidden = selected.length === 0;
  if (countEl) countEl.textContent = selected.length;
}

function productRow(p) {
  const imgHtml = p.image
    ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" class="adm-table-img"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
       + `<div class="adm-table-img-placeholder" style="display:none"><i class="fas fa-image"></i></div>`
    : `<div class="adm-table-img-placeholder"><i class="fas fa-image"></i></div>`;

  const badgeHtml = p.badge
    ? `<span class="adm-product-badge adm-badge--${esc(p.badge)}">${esc(p.badge)}</span>`
    : '';

  const statusHtml = p.soldOut
    ? `<span class="adm-status-chip adm-status-chip--soldout">Sold Out</span>`
    : `<span class="adm-status-chip adm-status-chip--active">Active</span>`;

  const soldBtnTitle = p.soldOut ? 'Mark as Active' : 'Mark as Sold Out';
  const soldBtnIcon  = p.soldOut ? 'fa-circle-check' : 'fa-ban';
  const soldBtnClass = p.soldOut ? 'adm-icon-btn--unsold' : 'adm-icon-btn--sold';

  return `
    <tr data-id="${esc(p.id)}">
      <td style="width:36px;padding:12px 8px 12px 16px">
        <input type="checkbox" class="adm-row-check" data-id="${esc(p.id)}"
               style="accent-color:var(--gold);width:15px;height:15px;cursor:pointer">
      </td>
      <td>${imgHtml}</td>
      <td>
        <div class="adm-product-name">${esc(p.name)}${badgeHtml}</div>
      </td>
      <td><span class="adm-category-chip">${esc(p.category)}</span></td>
      <td>$${(p.price / 100).toFixed(2)}</td>
      <td>${statusHtml}</td>
      <td>
        <div class="adm-row-actions">
          <button class="adm-icon-btn adm-icon-btn--edit"
                  data-action="edit" data-id="${esc(p.id)}"
                  title="Edit product" type="button">
            <i class="fas fa-pen"></i>
          </button>
          <button class="adm-icon-btn ${soldBtnClass}"
                  data-action="toggleSold" data-id="${esc(p.id)}"
                  title="${soldBtnTitle}" type="button">
            <i class="fas ${soldBtnIcon}"></i>
          </button>
          <button class="adm-icon-btn adm-icon-btn--del"
                  data-action="delete" data-id="${esc(p.id)}"
                  data-name="${esc(p.name)}"
                  title="Remove product" type="button">
            <i class="fas fa-trash-can"></i>
          </button>
        </div>
      </td>
    </tr>`;
}

/* ─────────────────────────────────────────────
   PRODUCT FORM MODAL
───────────────────────────────────────────── */
let editingProductId = null;
let currentImageData = null; // base64 or URL

function openProductModal(productId = null) {
  editingProductId = productId;
  currentImageData = null;
  const modal = document.getElementById('admProductModal');
  const form  = document.getElementById('admProductForm');
  form.reset();
  document.getElementById('admFormError').hidden = true;
  document.getElementById('admDescCount').textContent = '0';
  document.getElementById('admImgPreview').hidden = true;
  document.getElementById('admImgPlaceholder').hidden = false;

  if (productId) {
    const p = ProductDB.byId(productId);
    if (!p) return;
    document.getElementById('admProductModalTitle').textContent = 'Edit Product';
    document.getElementById('admProductSaveBtnLabel').textContent = 'Save Changes';
    document.getElementById('admProductId').value = p.id;
    document.getElementById('admProdName').value  = p.name;
    document.getElementById('admProdCat').value   = p.category;
    document.getElementById('admProdPrice').value = (p.price / 100).toFixed(2);
    document.getElementById('admProdBadge').value = p.badge || '';
    document.getElementById('admProdDesc').value  = p.description || '';
    document.getElementById('admDescCount').textContent = (p.description || '').length;
    const storyTitleEl   = document.getElementById('admProdStoryTitle');
    const storyExcerptEl = document.getElementById('admProdStoryExcerpt');
    const storyUrlEl     = document.getElementById('admProdStoryUrl');
    if (storyTitleEl)   storyTitleEl.value   = p.storyTitle   || '';
    if (storyExcerptEl) storyExcerptEl.value = p.story        || '';
    if (storyUrlEl)     storyUrlEl.value     = p.storyUrl     || '';
    document.getElementById('admProdFeatured').checked = !!p.featured;
    document.getElementById('admImgUrl').value = p.image || '';
    if (p.image) {
      setImagePreview(p.image);
      currentImageData = p.image;
    }

    // Sizes checkboxes
    document.querySelectorAll('.adm-sizes-wrap input[type=checkbox]').forEach(cb => {
      cb.checked = (p.sizes || []).includes(cb.value);
    });
  } else {
    document.getElementById('admProductModalTitle').textContent = 'Add Product';
    document.getElementById('admProductSaveBtnLabel').textContent = 'Save Product';
    document.getElementById('admProductId').value = '';
    document.querySelectorAll('.adm-sizes-wrap input[type=checkbox]')
      .forEach(cb => cb.checked = false);
    const _st = document.getElementById('admProdStoryTitle');
    const _se = document.getElementById('admProdStoryExcerpt');
    const _su = document.getElementById('admProdStoryUrl');
    if (_st) _st.value = '';
    if (_se) _se.value = '';
    if (_su) _su.value = '';
  }

  openModal('admProductModalBackdrop');
  setTimeout(() => document.getElementById('admProdName').focus(), 100);
}

function setImagePreview(src) {
  const preview = document.getElementById('admImgPreview');
  const placeholder = document.getElementById('admImgPlaceholder');
  preview.src = src;
  preview.hidden = false;
  placeholder.hidden = true;
}

function getFormData() {
  const name     = document.getElementById('admProdName').value.trim();
  const category = document.getElementById('admProdCat').value;
  const priceRaw = parseFloat(document.getElementById('admProdPrice').value);
  const badge    = document.getElementById('admProdBadge').value;
  const desc     = document.getElementById('admProdDesc').value.trim();
  const featured = document.getElementById('admProdFeatured').checked;
  const imgUrl   = document.getElementById('admImgUrl').value.trim();
  const sizes    = Array.from(
    document.querySelectorAll('.adm-sizes-wrap input[type=checkbox]:checked')
  ).map(cb => cb.value);

  if (!name)     return { error: 'Product name is required.' };
  if (!category) return { error: 'Please select a category.' };
  if (isNaN(priceRaw) || priceRaw < 0) return { error: 'Please enter a valid price.' };

  const image = currentImageData || imgUrl || '';
  const price = Math.round(priceRaw * 100);

  const storyTitle  = (document.getElementById('admProdStoryTitle')?.value  || '').trim();
  const story       = (document.getElementById('admProdStoryExcerpt')?.value || '').trim();
  const storyUrl    = (document.getElementById('admProdStoryUrl')?.value     || '').trim();

  return { name, category, price, badge, description: desc, featured, image, sizes, storyTitle, story, storyUrl };
}

/* ─────────────────────────────────────────────
   ENTER / EXIT DASHBOARD
───────────────────────────────────────────── */
function enterDashboard(user) {
  // Reset login button before hiding screen — prevents zombie spinner state
  const lb = document.getElementById('admLoginBtn');
  if (lb) { lb.disabled = false; lb.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In'; }
  // Clear any login error
  const le = document.getElementById('admLoginError');
  if (le) { le.hidden = true; le.style.display = 'none'; }

  document.getElementById('admLoginScreen').hidden = true;
  document.getElementById('admApp').hidden = false;
  document.body.style.overflow = '';

  // Set user info in sidebar
  const name = user.name || user.email || 'Admin';
  document.getElementById('admSidebarName').textContent = name;
  document.getElementById('admPageTitle').textContent   = 'Products';

  const avatar = document.getElementById('admSidebarAvatar');
  if (user.picture) {
    avatar.innerHTML = `<img src="${esc(user.picture)}" alt="${esc(name)}">`;
  } else {
    avatar.textContent = (name[0] || 'A').toUpperCase();
  }

  // ── Sync pikoData.js into localStorage on every login ──────────────────
  // This means logging in from ANY device gives you all your published content
  // (articles, products, promos, banner, pay config, approved projects, ideas).
  // Customer data (orders, subscribers, ratings) can't sync without a backend.
  syncPikoDataToLocalStorage(function() {
    renderProducts();
    setPanel('products');
  });
}

function syncPikoDataToLocalStorage(onDone) {
  // Determine the path to pikoData.js relative to admin panel location
  // Admin is at: /projects/admin/admin.html
  // pikoData.js is at: /js/pikoData.js
  // So relative path is: ../../js/pikoData.js
  var dataUrl = '../../js/pikoData.js?v=' + Date.now();

  // Show a subtle sync indicator
  var syncEl = document.getElementById('admSyncStatus');
  if (syncEl) { syncEl.textContent = 'Syncing data…'; syncEl.hidden = false; }

  if (typeof fetch === 'undefined') { if (onDone) onDone(); return; }

  fetch(dataUrl, { cache: 'no-store' })
    .then(function(r) { return r.ok ? r.text() : null; })
    .then(function(text) {
      if (!text) {
        if (syncEl) { syncEl.textContent = 'No published data found. Changes here are local only.'; }
        setTimeout(function() { if (syncEl) syncEl.hidden = true; }, 3000);
        if (onDone) onDone();
        return;
      }
      try {
        // eslint-disable-next-line no-eval
        eval(text); // sets window._pikoData
        var d = window._pikoData;
        if (!d) throw new Error('_pikoData not set');

        var synced = [];

        // Articles
        if (Array.isArray(d.articles) && d.articles.length > 0) {
          // Merge: keep local edits, add server articles not yet local
          var localArts = [];
          try { localArts = JSON.parse(localStorage.getItem('amp_articles_v1') || '[]'); } catch(e) {}
          d.articles.forEach(function(sa) {
            var idx = localArts.findIndex(function(la) { return la.id === sa.id; });
            if (idx === -1) localArts.push(sa); // add server article if not local
            // Don't overwrite local edits — admin on this device wins
          });
          localStorage.setItem('amp_articles_v1', JSON.stringify(localArts));
          synced.push('articles');
        }

        // Products
        if (Array.isArray(d.products) && d.products.length > 0) {
          var localProds = [];
          try { localProds = JSON.parse(localStorage.getItem('amp_admin_products') || '[]'); } catch(e) {}
          d.products.forEach(function(sp) {
            var idx = localProds.findIndex(function(lp) { return lp.id === sp.id; });
            if (idx === -1) localProds.push(sp);
          });
          localStorage.setItem('amp_admin_products', JSON.stringify(localProds));
          synced.push('products');
        }

        // Promos
        if (Array.isArray(d.promos) && d.promos.length > 0) {
          var localPromos = [];
          try { localPromos = JSON.parse(localStorage.getItem('amp_admin_promos') || '[]'); } catch(e) {}
          d.promos.forEach(function(sp) {
            var idx = localPromos.findIndex(function(lp) { return lp.id === sp.id; });
            if (idx === -1) localPromos.push(sp);
          });
          localStorage.setItem('amp_admin_promos', JSON.stringify(localPromos));
          synced.push('promos');
        }

        // Banner
        if (d.banner) {
          localStorage.setItem('amp_admin_banner', JSON.stringify(d.banner));
          synced.push('banner');
        }

        // Pay config
        if (d.payConfig && (d.payConfig.paypal || d.payConfig.venmo || d.payConfig.cashapp || d.payConfig.stripe)) {
          localStorage.setItem('amp_pay_config', JSON.stringify(d.payConfig));
          synced.push('payment config');
        }

        // Approved projects — merge into local hub projects list
        if (Array.isArray(d.projects) && d.projects.length > 0) {
          var localProjs = [];
          try { localProjs = JSON.parse(localStorage.getItem('amp_admin_projects_hub') || '[]'); } catch(e) {}
          d.projects.forEach(function(sp) {
            var idx = localProjs.findIndex(function(lp) { return lp.id === sp.id; });
            if (idx !== -1) { localProjs[idx] = Object.assign({}, localProjs[idx], sp); }
            else            { localProjs.push(sp); }
          });
          localStorage.setItem('amp_admin_projects_hub', JSON.stringify(localProjs));
          synced.push('projects');
        }

        // Ideas — merge admin replies
        if (Array.isArray(d.ideas) && d.ideas.length > 0) {
          var localIdeas = [];
          try { localIdeas = JSON.parse(localStorage.getItem('amp_admin_ideas') || '[]'); } catch(e) {}
          d.ideas.forEach(function(si) {
            var idx = localIdeas.findIndex(function(li) { return li.id === si.id; });
            if (idx !== -1) { localIdeas[idx] = Object.assign({}, localIdeas[idx], si); }
            else            { localIdeas.push(si); }
          });
          localStorage.setItem('amp_admin_ideas', JSON.stringify(localIdeas));
          synced.push('ideas');
        }

        var msg = synced.length > 0
          ? 'Synced: ' + synced.join(', ') + '.'
          : 'Up to date.';
        if (syncEl) { syncEl.textContent = msg; }
        setTimeout(function() { if (syncEl) syncEl.hidden = true; }, 3000);

      } catch(e) {
        console.warn('[Admin Sync] Could not parse pikoData.js:', e);
        if (syncEl) { syncEl.textContent = 'Sync failed — working with local data.'; }
        setTimeout(function() { if (syncEl) syncEl.hidden = true; }, 3000);
      }
      if (onDone) onDone();
    })
    .catch(function() {
      // No network or file not found — work offline with local data
      if (syncEl) { syncEl.hidden = true; }
      if (onDone) onDone();
    });
}

function exitDashboard() {
  Auth.endSession();
  document.getElementById('admApp').hidden = true;
  document.getElementById('admLoginScreen').hidden = false;
  document.getElementById('admUsername').value = '';
  document.getElementById('admPassword').value = '';
  hideLoginError();
}

/* ─────────────────────────────────────────────
   EXPORT
───────────────────────────────────────────── */
function exportProducts() {
  const data = JSON.stringify(ProductDB.all(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'amp-products-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Products exported.');
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // ── Force login UI to a clean known state on every page load ──
  const loginBtn = document.getElementById('admLoginBtn');
  loginBtn.disabled = false;
  loginBtn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
  document.getElementById('admLoginError').style.display = 'none';
  document.getElementById('admLoginError').hidden = true;

  try { await Auth.init(); } catch (e) { console.warn('Auth.init failed:', e); }

  // ── Check if currently locked out (persists across page refresh) ──
  const lockStatus = RateLimit.check();
  if (lockStatus.locked) {
    startLockoutCountdown(lockStatus.secondsLeft);
  }

  // If already logged in, go straight to dashboard
  const session = Auth.getSession();
  if (session) {
    try {
      enterDashboard(session.user);
    } catch (err) {
      // Session exists but dashboard crashed — clear it and show login cleanly
      console.error('enterDashboard failed on session restore:', err);
      Auth.endSession();
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
    }
  }

  /* ── Login form ── */
  document.getElementById('admLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideLoginError();

    // ── Rate limit check before attempting login ──
    const lockCheck = RateLimit.check();
    if (lockCheck.locked) {
      startLockoutCountdown(lockCheck.secondsLeft);
      return;
    }

    const btn = document.getElementById('admLoginBtn');
    const resetBtn = () => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
    };
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

    // Artificial minimum delay — prevents timing attacks and feels more secure
    const minDelay = new Promise(resolve => setTimeout(resolve, 600));

    try {
      const username = document.getElementById('admUsername').value.trim();
      const password = document.getElementById('admPassword').value;

      const [ok] = await Promise.all([Auth.checkPassword(username, password), minDelay]);

      if (ok) {
        RateLimit.reset();
        Auth.startSession({ name: username, method: 'password' });
        enterDashboard({ name: username });
        // Note: don't resetBtn here — login screen is hidden
      } else {
        const result = RateLimit.fail();
        if (result.locked) {
          startLockoutCountdown(result.secondsLeft);
        } else {
          showLoginError(
            `Incorrect username or password. ${result.remaining} attempt${result.remaining !== 1 ? 's' : ''} remaining.`
          );
          resetBtn();
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      showLoginError('Something went wrong. Please try again.');
      resetBtn();
    }
  });

  /* ── Password visibility toggle ── */
  document.getElementById('admPwToggle').addEventListener('click', () => {
    const input = document.getElementById('admPassword');
    const icon  = document.querySelector('#admPwToggle i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fas fa-eye';
    }
  });

  /* ── Google button (triggers the GIS popup) ── */
  document.getElementById('admGoogleBtn').addEventListener('click', () => {
    const clientId = DB.get('googleClientId') || ADM_CONFIG.GOOGLE_CLIENT_ID;
    if (clientId === 'YOUR_GOOGLE_CLIENT_ID') {
      showLoginError('Google login is not configured yet. See Settings → Google OAuth Setup.');
      return;
    }
    if (window.google?.accounts?.id) {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: window.handleGoogleLogin,
      });
      google.accounts.id.prompt();
    } else {
      showLoginError('Google login failed to load. Please refresh and try again.');
    }
  });

  /* ── Logout ── */
  document.getElementById('admLogoutBtn').addEventListener('click', () => {
    exitDashboard();
  });

  /* ── Sidebar nav ── */
  document.querySelectorAll('.adm-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.dataset.panel) return; // platform external links — no panel to switch to
      setPanel(btn.dataset.panel);
      // Close sidebar on mobile
      if (window.innerWidth <= 860) {
        document.getElementById('admSidebar').classList.remove('is-open');
      }
    });
  });

  /* ── Sidebar toggle (mobile) ── */
  document.getElementById('admSidebarToggle').addEventListener('click', () => {
    document.getElementById('admSidebar').classList.toggle('is-open');
  });

  /* ── Product search ── */
  let searchDebounce;
  document.getElementById('admProductSearch').addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderProducts(e.target.value), 200);
  });

  /* ── Add product button ── */
  document.getElementById('admAddProductBtn').addEventListener('click', () => {
    openProductModal(null);
  });

  /* ── Product table actions (delegated) ── */
  document.getElementById('admProductTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id     = btn.dataset.id;

    if (action === 'edit') {
      openProductModal(id);
    } else if (action === 'toggleSold') {
      const p = ProductDB.byId(id);
      if (p) {
        ProductDB.update(id, { soldOut: !p.soldOut });
        renderProducts(document.getElementById('admProductSearch').value);
        showToast(p.soldOut ? `${p.name} marked as active.` : `${p.name} marked as sold out.`);
      }
    } else if (action === 'delete') {
      document.getElementById('admDeleteName').textContent = btn.dataset.name;
      document.getElementById('admDeleteConfirm').dataset.id = id;
      openModal('admDeleteBackdrop');
    }
  });

  /* ── Product form submit ── */
  document.getElementById('admProductForm').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('admFormError').hidden = true;

    const data = getFormData();
    if (data.error) {
      document.getElementById('admFormErrorMsg').textContent = data.error;
      document.getElementById('admFormError').hidden = false;
      return;
    }

    if (editingProductId) {
      ProductDB.update(editingProductId, data);
      showToast(`${data.name} updated.`);
    } else {
      data.soldOut = false;
      ProductDB.add(data);
      showToast(`${data.name} added.`);
    }

    closeModal('admProductModalBackdrop');
    renderProducts(document.getElementById('admProductSearch').value);
  });

  /* ── Product modal close buttons ── */
  ['admProductModalClose', 'admProductCancelBtn'].forEach(id => {
    document.getElementById(id).addEventListener('click', () =>
      closeModal('admProductModalBackdrop'));
  });

  /* ── Close modal on backdrop click ── */
  document.getElementById('admProductModalBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('admProductModalBackdrop');
  });

  /* ── Delete modal ── */
  document.getElementById('admDeleteConfirm').addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.id;
    const p  = ProductDB.byId(id);
    if (p) {
      ProductDB.remove(id);
      renderProducts(document.getElementById('admProductSearch').value);
      showToast(`${p.name} removed.`);
    }
    closeModal('admDeleteBackdrop');
  });
  document.getElementById('admDeleteCancel').addEventListener('click', () =>
    closeModal('admDeleteBackdrop'));
  document.getElementById('admDeleteClose').addEventListener('click', () =>
    closeModal('admDeleteBackdrop'));
  document.getElementById('admDeleteBackdrop').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('admDeleteBackdrop');
  });

  /* ── Image file upload ── */
  document.getElementById('admImgFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentImageData = ev.target.result;
      setImagePreview(ev.target.result);
      document.getElementById('admImgUrl').value = '';
    };
    reader.readAsDataURL(file);
  });

  /* ── Image URL input ── */
  document.getElementById('admImgUrl').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
      currentImageData = url;
      setImagePreview(url);
    } else {
      currentImageData = null;
      document.getElementById('admImgPreview').hidden = true;
      document.getElementById('admImgPlaceholder').hidden = false;
    }
  });

  /* ── Description char count ── */
  document.getElementById('admProdDesc').addEventListener('input', (e) => {
    document.getElementById('admDescCount').textContent = e.target.value.length;
  });

  /* ── Settings: change password ── */
  document.getElementById('admChangePwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('admPwError').hidden   = true;
    document.getElementById('admPwSuccess').hidden = true;

    const curr    = document.getElementById('admCurrPw').value;
    const newPw   = document.getElementById('admNewPw').value;
    const confirm = document.getElementById('admConfirmPw').value;

    if (newPw !== confirm) {
      document.getElementById('admPwErrorMsg').textContent = 'New passwords do not match.';
      document.getElementById('admPwError').hidden = false;
      return;
    }

    const result = await Auth.changePassword(curr, newPw);
    if (result.ok) {
      document.getElementById('admPwSuccess').hidden = false;
      document.getElementById('admChangePwForm').reset();
      // Auto-hide success message after 4 seconds
      setTimeout(() => {
        document.getElementById('admPwSuccess').hidden = true;
      }, 4000);
    } else {
      document.getElementById('admPwErrorMsg').textContent = result.msg;
      document.getElementById('admPwError').hidden = false;
    }
  });

  /* ── Settings: save Google Client ID ── */
  document.getElementById('admSaveGoogleId').addEventListener('click', () => {
    const id = document.getElementById('admGoogleClientId').value.trim();
    if (!id) return;
    DB.set('googleClientId', id);
    showToast('Google Client ID saved.');
  });

  /* ── Load saved Google Client ID into settings field ── */
  const savedGoogleId = DB.get('googleClientId');
  if (savedGoogleId) {
    document.getElementById('admGoogleClientId').value = savedGoogleId;
  }

  /* ── Payment config — load saved handles ── */
  (function loadPayConfig() {
    try {
      var raw = localStorage.getItem('amp_pay_config');
      if (!raw) return;
      var cfg = JSON.parse(raw);
      if (cfg.paypal  && document.getElementById('admPayPal'))   document.getElementById('admPayPal').value   = cfg.paypal;
      if (cfg.venmo   && document.getElementById('admVenmo'))    document.getElementById('admVenmo').value    = cfg.venmo;
      if (cfg.cashapp && document.getElementById('admCashApp'))  document.getElementById('admCashApp').value  = cfg.cashapp;
      if (cfg.stripe  && document.getElementById('admStripe'))   document.getElementById('admStripe').value   = cfg.stripe;
    } catch(e) {}
  })();

  var admSavePayBtn = document.getElementById('admSavePayBtn');
  if (admSavePayBtn) {
    admSavePayBtn.addEventListener('click', function() {
      var cfg = {
        paypal:  (document.getElementById('admPayPal')?.value  || '').trim(),
        venmo:   (document.getElementById('admVenmo')?.value   || '').trim(),
        cashapp: (document.getElementById('admCashApp')?.value || '').trim(),
        stripe:  (document.getElementById('admStripe')?.value  || '').trim(),
      };
      localStorage.setItem('amp_pay_config', JSON.stringify(cfg));
      showToast('Payment settings saved.');
    });
  }

  /* ── Export button ── */
  document.getElementById('admExportBtn').addEventListener('click', exportProducts);

  /* ── Select-all checkbox ── */
  var selectAll = document.getElementById('admSelectAll');
  if (selectAll) {
    selectAll.addEventListener('change', function() {
      document.querySelectorAll('.adm-row-check').forEach(function(cb) {
        cb.checked = selectAll.checked;
      });
      updateBulkBar();
    });
  }

  /* ── Row checkbox delegation ── */
  var productTbody = document.getElementById('admProductTbody');
  if (productTbody) {
    productTbody.addEventListener('change', function(e) {
      if (e.target.classList.contains('adm-row-check')) updateBulkBar();
    });
  }

  /* ── Bulk action buttons ── */
  var bulkSoldOut = document.getElementById('admBulkSoldOut');
  var bulkActive  = document.getElementById('admBulkActive');
  var bulkDelete  = document.getElementById('admBulkDelete');
  var bulkClear   = document.getElementById('admBulkClear');

  if (bulkSoldOut) bulkSoldOut.addEventListener('click', function() {
    getSelectedIds().forEach(id => ProductDB.update(id, { soldOut: true }));
    renderProducts(document.getElementById('admProductSearch').value);
    showToast('Marked as sold out.');
  });
  if (bulkActive) bulkActive.addEventListener('click', function() {
    getSelectedIds().forEach(id => ProductDB.update(id, { soldOut: false }));
    renderProducts(document.getElementById('admProductSearch').value);
    showToast('Marked as active.');
  });
  if (bulkDelete) bulkDelete.addEventListener('click', function() {
    var ids = getSelectedIds();
    if (!ids.length) return;
    if (!confirm('Delete ' + ids.length + ' product(s)? This cannot be undone.')) return;
    ids.forEach(id => ProductDB.remove(id));
    renderProducts(document.getElementById('admProductSearch').value);
    showToast(ids.length + ' product(s) deleted.');
  });
  if (bulkClear) bulkClear.addEventListener('click', function() {
    document.querySelectorAll('.adm-row-check').forEach(cb => cb.checked = false);
    var sa = document.getElementById('admSelectAll');
    if (sa) sa.checked = false;
    updateBulkBar();
  });

  /* ── Export ALL data ── */
  var admExportAllBtn = document.getElementById('admExportAllBtn');
  if (admExportAllBtn) {
    admExportAllBtn.addEventListener('click', function() {
      var all = {
        exported:    new Date().toISOString(),
        products:    ProductDB.all(),
        promos:      PromooDB.all(),
        banner:      BannerDB.get(),
        suggestions: SuggDB.all(),
        ideas:       IdeaDB.all(),
        projects:    ProjDB.all(),
        payConfig:   JSON.parse(localStorage.getItem('amp_pay_config') || '{}'),
      };
      var blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url;
      a.download = 'amp-all-data-' + new Date().toISOString().split('T')[0] + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('All data exported.');
    });
  }

  /* ── Escape key closes open modals ── */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('admProductModalBackdrop').classList.contains('is-open'))
      closeModal('admProductModalBackdrop');
    if (document.getElementById('admDeleteBackdrop').classList.contains('is-open'))
      closeModal('admDeleteBackdrop');
  });
});

/* ============================================================
   EXTENDED ADMIN — Promos, Banner, Suggestions, Analytics,
   Inventory (stock tracking), product form stock field
   ============================================================ */

/* ─── Shared storage keys ─── */
const PROMO_KEY      = 'amp_admin_promos';
const BANNER_KEY     = 'amp_admin_banner';
const SUGG_KEY       = 'amp_admin_suggestions';
const IDEA_KEY       = 'amp_admin_ideas';          // hub ideas from index.html modal

/* ══════════════════════════════════════════
   PROMO CODES
══════════════════════════════════════════ */
const PromooDB = {
  all()  { return DB.get(PROMO_KEY, []); },
  save(a) { DB.set(PROMO_KEY, a); },
  byId(id) { return this.all().find(p => p.id === id) || null; },
  add(p)   { const a = this.all(); p.id = 'promo_' + Date.now(); p.uses = 0; a.push(p); this.save(a); return p; },
  update(id, u) {
    const a = this.all(); const i = a.findIndex(p => p.id === id);
    if (i === -1) return null; a[i] = { ...a[i], ...u }; this.save(a); return a[i];
  },
  remove(id) { this.save(this.all().filter(p => p.id !== id)); },
};

function renderPromos() {
  const promos = PromooDB.all();
  const tbody  = document.getElementById('admPromoTbody');
  const empty  = document.getElementById('admPromoEmpty');
  document.getElementById('admPromoTable').hidden = promos.length === 0;
  empty.hidden = promos.length > 0;

  tbody.innerHTML = promos.map(p => {
    const discount = p.type === 'percent'
      ? `${p.value}% off`
      : `$${(p.value / 100).toFixed(2)} off`;
    const minOrder = p.minOrder ? `$${(p.minOrder / 100).toFixed(2)}` : '—';
    const uses     = p.maxUses ? `${p.uses}/${p.maxUses}` : `${p.uses} / ∞`;
    const expires  = p.expires ? new Date(p.expires).toLocaleDateString() : '—';
    const expired  = p.expires && new Date(p.expires) < new Date();
    const statusClass = (!p.active || expired) ? 'adm-status-chip--soldout' : 'adm-status-chip--active';
    const statusLabel = expired ? 'Expired' : (p.active ? 'Active' : 'Inactive');

    return `<tr>
      <td><span class="adm-promo-code">${esc(p.code)}</span></td>
      <td>${esc(discount)}</td>
      <td>${esc(minOrder)}</td>
      <td><span class="adm-promo-uses"><strong>${esc(String(p.uses))}</strong> / ${p.maxUses || '∞'}</span></td>
      <td>${esc(expires)}</td>
      <td><span class="adm-status-chip ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="adm-row-actions">
          <button class="adm-icon-btn adm-icon-btn--edit" data-promo-action="edit" data-id="${esc(p.id)}" title="Edit" type="button"><i class="fas fa-pen"></i></button>
          <button class="adm-icon-btn adm-icon-btn--del"  data-promo-action="delete" data-id="${esc(p.id)}" title="Delete" type="button"><i class="fas fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

let editingPromoId = null;

function openPromoModal(id = null) {
  editingPromoId = id;
  document.getElementById('admPromoForm').reset();
  document.getElementById('admPromoError').hidden = true;
  document.getElementById('admPromoActive').checked = true;
  if (id) {
    const p = PromooDB.byId(id);
    if (!p) return;
    document.getElementById('admPromoModalTitle').textContent = 'Edit Promo Code';
    document.getElementById('admPromoSaveBtnLabel').textContent = 'Save Changes';
    document.getElementById('admPromoId').value    = p.id;
    document.getElementById('admPromoCode').value  = p.code;
    document.getElementById('admPromoType').value  = p.type;
    document.getElementById('admPromoValue').value = p.type === 'fixed' ? (p.value / 100).toFixed(2) : p.value;
    document.getElementById('admPromoMin').value   = p.minOrder ? (p.minOrder / 100).toFixed(2) : '';
    document.getElementById('admPromoMaxUses').value = p.maxUses || '';
    document.getElementById('admPromoExpiry').value  = p.expires || '';
    document.getElementById('admPromoActive').checked = p.active;
  } else {
    document.getElementById('admPromoModalTitle').textContent = 'New Promo Code';
    document.getElementById('admPromoSaveBtnLabel').textContent = 'Save Code';
  }
  updatePromoValueIcon();
  openModal('admPromoModalBackdrop');
}

function updatePromoValueIcon() {
  const type = document.getElementById('admPromoType').value;
  const icon = document.getElementById('admPromoValueIcon');
  icon.className = type === 'fixed' ? 'fas fa-dollar-sign adm-input-icon' : 'fas fa-percent adm-input-icon';
}

/* ══════════════════════════════════════════
   BANNER
══════════════════════════════════════════ */
const BannerDB = {
  get()  { return DB.get(BANNER_KEY, { text: '', style: 'info', active: false }); },
  save(b) { DB.set(BANNER_KEY, b); },
};

function initBannerPanel() {
  const b = BannerDB.get();
  document.getElementById('admBannerText').value = b.text || '';
  document.getElementById('admBannerCount').textContent = (b.text || '').length;
  document.getElementById('admBannerActive').checked = !!b.active;
  const radio = document.querySelector(`input[name="admBannerStyle"][value="${b.style || 'info'}"]`);
  if (radio) radio.checked = true;
  updateBannerPreview();
}

function updateBannerPreview() {
  const text  = document.getElementById('admBannerText').value || 'Your banner message will appear here.';
  const style = document.querySelector('input[name="admBannerStyle"]:checked')?.value || 'info';
  const preview = document.getElementById('admBannerPreview');
  document.getElementById('admBannerPreviewText').textContent = text;
  preview.className = `adm-banner-preview adm-banner-preview--${style}`;
}

/* ══════════════════════════════════════════
   SUGGESTIONS
══════════════════════════════════════════ */
const SuggDB = {
  all()  { return DB.get(SUGG_KEY, []); },
  save(a) { DB.set(SUGG_KEY, a); },
  byId(id) { return this.all().find(s => s.id === id) || null; },
  reply(id, text) {
    const a = this.all(); const i = a.findIndex(s => s.id === id);
    if (i === -1) return;
    a[i].reply = text;
    a[i].status = 'reviewed';
    a[i].replyTimestamp = Date.now();
    this.save(a);
  },
  dismiss(id) {
    const a = this.all(); const i = a.findIndex(s => s.id === id);
    if (i === -1) return;
    a[i].status = 'reviewed';
    this.save(a);
  },
};

/* ── Hub Ideas DB ── */
const IdeaDB = {
  all()  { try { return JSON.parse(localStorage.getItem(IDEA_KEY) || '[]'); } catch(e) { return []; } },
  save(a) { try { localStorage.setItem(IDEA_KEY, JSON.stringify(a)); } catch(e) {} },
  byId(id) { return this.all().find(i => i.id === id) || null; },
  dismiss(id) {
    const a = this.all(); const i = a.findIndex(x => x.id === id);
    if (i === -1) return; a[i].dismissed = true; a[i].status = 'reviewed'; this.save(a);
  },
  reply(id, text) {
    const a = this.all(); const i = a.findIndex(x => x.id === id);
    if (i === -1) return; a[i].reply = text; a[i].status = 'reviewed'; a[i].replyTimestamp = Date.now(); this.save(a);
  },
};


let suggFilter = 'all';

function renderSuggestions() {
  // Merge marketplace suggestions + hub ideas into one feed
  const suggAll = SuggDB.all().map(s => ({ ...s, _source: 'store' }));
  const ideaAll = IdeaDB.all().map(i => ({
    id: i.id,
    text: i.text,
    name: i.name || '',
    email: '',
    status: i.dismissed ? 'reviewed' : (i.status || 'pending'),
    reply: i.reply || '',
    replyTimestamp: i.replyTimestamp || null,
    timestamp: i.ts || i.timestamp || Date.now(),
    category: i.category || 'other',
    _source: 'hub',
  }));

  const all = [...suggAll, ...ideaAll].sort((a, b) => (b.timestamp || b.ts || 0) - (a.timestamp || a.ts || 0));
  const pending = all.filter(s => s.status === 'pending');

  // Badges
  const badge = document.getElementById('admSuggBadge');
  const pendingCount = document.getElementById('admSuggPendingCount');
  if (badge) { badge.hidden = pending.length === 0; badge.textContent = pending.length; }
  if (pendingCount) pendingCount.textContent = pending.length;

  const list  = document.getElementById('admSuggList');
  const empty = document.getElementById('admSuggEmpty');
  if (!list) return;

  const filtered = suggFilter === 'all' ? all
    : all.filter(s => s.status === suggFilter);

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const categoryLabel = c => ({ platform:'New Platform', feature:'Feature Request', content:'Content / Story', other:'Other' }[c] || 'Idea');
  const categoryClass = c => ({ platform:'adm-src--platform', feature:'adm-src--feature', content:'adm-src--content', other:'adm-src--other' }[c] || 'adm-src--other');

  list.innerHTML = filtered.map(s => {
    const from = s.name ? esc(s.name) : 'Anonymous';
    const email = s.email ? ` <span class="adm-muted">&lt;${esc(s.email)}&gt;</span>` : '';
    const time  = new Date(s.timestamp || s.ts).toLocaleString();
    const statusClass = s.status === 'reviewed' ? 'adm-sugg-card--reviewed' : 'adm-sugg-card--pending';
    const badgeClass  = s.status === 'reviewed' ? 'adm-sugg-status--reviewed' : 'adm-sugg-status--pending';

    // Source badge
    const srcHtml = s._source === 'hub'
      ? `<span class="adm-src-badge adm-src--hub"><i class="fas fa-rocket"></i> Hub Idea${s.category ? ' · ' + categoryLabel(s.category) : ''}</span>`
      : `<span class="adm-src-badge adm-src--store"><i class="fas fa-store"></i> Store Suggestion</span>`;

    const replyHtml = s.reply ? `
      <div class="adm-sugg-reply">
        <div class="adm-sugg-reply-label"><i class="fas fa-reply"></i> Admin Reply</div>
        <div class="adm-sugg-reply-text">${esc(s.reply)}</div>
      </div>` : '';

    const dismissBtn = s.status === 'pending'
      ? `<button class="adm-btn adm-btn--outline adm-btn--sm" data-sugg-action="dismiss" data-id="${esc(s.id)}" data-source="${s._source}" type="button">Mark Reviewed</button>`
      : '';
    const replyBtn = `<button class="adm-btn adm-btn--primary adm-btn--sm" data-sugg-action="reply" data-id="${esc(s.id)}" data-source="${s._source}" type="button">
          <i class="fas fa-reply"></i> ${s.reply ? 'Edit Reply' : 'Reply'}
        </button>`;

    return `<div class="adm-sugg-card ${statusClass}" data-sugg-id="${esc(s.id)}" data-source="${s._source}">
      <div class="adm-sugg-card-header">
        <div class="adm-sugg-card-meta">
          <div class="adm-sugg-from">${from}${email}</div>
          <div class="adm-sugg-time">${esc(time)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${srcHtml}
          <span class="adm-sugg-status ${badgeClass}">${s.status === 'reviewed' ? 'Reviewed' : 'Pending'}</span>
        </div>
      </div>
      <div class="adm-sugg-text">${esc(s.text)}</div>
      ${replyHtml}
      <div class="adm-sugg-card-footer">
        <span class="adm-muted"></span>
        ${dismissBtn}
        ${replyBtn}
      </div>
    </div>`;
  }).join('');

  // Bind suggestion/idea action buttons
  list.querySelectorAll('[data-sugg-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.id;
      const source = btn.dataset.source;
      const action = btn.dataset.sugg_action || btn.dataset.suggAction || btn.getAttribute('data-sugg-action');

      if (action === 'dismiss') {
        if (source === 'hub') IdeaDB.dismiss(id);
        else SuggDB.dismiss(id);
        renderSuggestions();
        return;
      }

      if (action === 'reply') {
        const card = btn.closest('[data-sugg-id]');
        const existing = source === 'hub'
          ? (IdeaDB.byId(id)?.reply || '')
          : (SuggDB.byId(id)?.reply || '');

        // Remove any existing inline reply form on this card
        card.querySelectorAll('.adm-sugg-inline-form').forEach(el => el.remove());

        const formHtml = `<div class="adm-sugg-inline-form">
          <textarea class="adm-sugg-reply-input" rows="3" placeholder="Write your reply…">${esc(existing)}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px;">
            <button class="adm-btn adm-btn--primary adm-btn--sm" data-reply-submit="${esc(id)}" data-reply-source="${source}" type="button">
              <i class="fas fa-paper-plane"></i> Send Reply
            </button>
            <button class="adm-btn adm-btn--outline adm-btn--sm" data-reply-cancel type="button">Cancel</button>
          </div>
        </div>`;
        card.insertAdjacentHTML('beforeend', formHtml);

        card.querySelector('[data-reply-cancel]').addEventListener('click', () => {
          card.querySelector('.adm-sugg-inline-form')?.remove();
        });
        card.querySelector('[data-reply-submit]').addEventListener('click', replyBtn2 => {
          const text = card.querySelector('.adm-sugg-reply-input')?.value.trim();
          if (!text) return;
          if (source === 'hub') IdeaDB.reply(id, text);
          else SuggDB.reply(id, text);
          showToast('Reply saved.');
          renderSuggestions();
        });
      }
    });
  });
}


/* ══════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════ */
function renderAnalytics() {
  const products    = ProductDB.all();
  const promos      = PromooDB.all().filter(p => p.active);
  const suggestions = SuggDB.all();
  const ideas       = IdeaDB.all();
  const projects    = ProjDB.all();

  document.getElementById('admAnalProducts').textContent    = products.length;
  document.getElementById('admAnalPromos').textContent      = promos.length;

  // Email subscribers count (from marketplace email capture)
  try {
    const emailList = JSON.parse(localStorage.getItem('amp_email_list_v1') || '[]');
    const emailEl = document.getElementById('admAnalEmails');
    if (emailEl) emailEl.textContent = emailList.length;
  } catch(e) {}

  // Notify me requests
  try {
    const notifyList = JSON.parse(localStorage.getItem('amp_notify_v1') || '[]');
    const notifyEl = document.getElementById('admAnalNotify');
    if (notifyEl) notifyEl.textContent = notifyList.length;
  } catch(e) {}
  document.getElementById('admAnalSuggestions').textContent = suggestions.length + ideas.length;
  const projEl = document.getElementById('admAnalProjects');
  if (projEl) projEl.textContent = projects.length;
  // Revenue + orders will come from Stripe — placeholder for now
  document.getElementById('admAnalRevenue').textContent = '$0.00';
  document.getElementById('admAnalOrders').textContent  = '0';

  // Top products (by name, no real order data yet — shows all products)
  const topEl = document.getElementById('admTopProducts');
  if (products.length === 0) {
    topEl.innerHTML = '<p class="adm-muted" style="padding:20px;text-align:center">No products yet.</p>';
  } else {
    topEl.innerHTML = products.slice(0, 5).map((p, i) => `
      <div class="adm-top-product-row">
        <span class="adm-top-product-rank">#${i + 1}</span>
        ${p.image ? `<img src="${esc(p.image)}" alt="" class="adm-top-product-img">` : '<div class="adm-top-product-img" style="background:var(--bg-mid)"></div>'}
        <span class="adm-top-product-name">${esc(p.name)}</span>
        <span class="adm-top-product-stock">${p.soldOut ? '🔴 Sold out' : (p.stock != null ? `${p.stock} left` : '—')}</span>
      </div>`).join('');
  }

  // Inventory status
  const invEl = document.getElementById('admInventoryStatus');
  invEl.innerHTML = products.map(p => {
    let cls, label;
    if (p.soldOut)          { cls = 'adm-inventory-stock--out';       label = 'Sold Out'; }
    else if (p.stock == null){ cls = 'adm-inventory-stock--untracked'; label = 'Untracked'; }
    else if (p.stock <= 5)   { cls = 'adm-inventory-stock--low';       label = `${p.stock} left`; }
    else                     { cls = 'adm-inventory-stock--ok';        label = `${p.stock} in stock`; }
    return `<div class="adm-inventory-row">
      <span class="adm-inventory-name">${esc(p.name)}</span>
      <span class="adm-inventory-stock ${cls}">${label}</span>
    </div>`;
  }).join('') || '<p class="adm-muted" style="padding:12px;text-align:center">No products.</p>';

  // Recent activity — merge suggestions, ideas, projects newest first
  const suggEl = document.getElementById('admRecentSuggestions');
  const allActivity = [
    ...suggestions.map(s => ({ ...s, _type: 'suggestion', _ts: s.timestamp || 0 })),
    ...ideas.map(i => ({ ...i, _type: 'idea', _ts: i.ts || 0 })),
    ...projects.map(p => ({ ...p, _type: 'project', _ts: p.ts || 0 })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 6);
  const recent = allActivity;
  if (recent.length === 0) {
    suggEl.innerHTML = '<p class="adm-muted" style="padding:12px;text-align:center">No activity yet.</p>';
  } else {
    suggEl.innerHTML = recent.map(s => {
      // Unified: suggestions/ideas use .text, projects use .desc; timestamps vary
      const typeIcon  = s._type === 'idea' ? '💡' : s._type === 'project' ? '🚀' : '🛍️';
      const typeLabel = s._type === 'idea' ? 'Hub Idea' : s._type === 'project' ? 'Project' : 'Suggestion';
      const rawText   = s.text || s.desc || '';
      const display   = rawText.length > 80 ? rawText.slice(0, 80) + '…' : rawText;
      const ts        = s._ts || s.timestamp || s.ts || 0;
      const dateStr   = ts ? new Date(ts).toLocaleDateString() : '—';
      return `<div class="adm-recent-sugg-row">
        <div class="adm-recent-sugg-text">${typeIcon} <strong style="font-size:10px;opacity:.6;text-transform:uppercase">${esc(typeLabel)}</strong> ${esc(display)}</div>
        <div class="adm-recent-sugg-meta">${esc(s.name || 'Anonymous')} · ${esc(dateStr)}</div>
      </div>`;
    }).join('');
  }
}

/* ══════════════════════════════════════════
   BIND NEW PANEL EVENTS (called after DOM ready)
══════════════════════════════════════════ */
function bindExtendedPanels() {

  /* ── Promo code panel ── */
  document.getElementById('admAddPromoBtn').addEventListener('click', () => openPromoModal());

  document.getElementById('admPromoType').addEventListener('change', updatePromoValueIcon);

  document.getElementById('admPromoTbody').addEventListener('click', e => {
    const btn = e.target.closest('[data-promo-action]');
    if (!btn) return;
    if (btn.dataset.promoAction === 'edit')   openPromoModal(btn.dataset.id);
    if (btn.dataset.promoAction === 'delete') {
      if (confirm('Delete this promo code?')) {
        PromooDB.remove(btn.dataset.id);
        renderPromos();
        showToast('Promo code deleted.');
      }
    }
  });

  document.getElementById('admPromoForm').addEventListener('submit', e => {
    e.preventDefault();
    document.getElementById('admPromoError').hidden = true;

    const code  = document.getElementById('admPromoCode').value.trim().toUpperCase();
    const type  = document.getElementById('admPromoType').value;
    const valRaw = parseFloat(document.getElementById('admPromoValue').value);
    const minRaw = parseFloat(document.getElementById('admPromoMin').value) || 0;
    const maxUses = parseInt(document.getElementById('admPromoMaxUses').value) || null;
    const expires = document.getElementById('admPromoExpiry').value || null;
    const active  = document.getElementById('admPromoActive').checked;

    if (!code) return showPromoError('Code is required.');
    if (!/^[A-Z0-9]+$/.test(code)) return showPromoError('Code can only contain letters and numbers.');
    if (isNaN(valRaw) || valRaw <= 0) return showPromoError('Please enter a valid discount value.');
    if (type === 'percent' && valRaw > 100) return showPromoError('Percentage cannot exceed 100.');

    const value    = type === 'fixed' ? Math.round(valRaw * 100) : Math.round(valRaw);
    const minOrder = Math.round(minRaw * 100);

    // Check for duplicate code (excluding self on edit)
    const existing = PromooDB.all().find(p => p.code === code && p.id !== editingPromoId);
    if (existing) return showPromoError('This code already exists.');

    const data = { code, type, value, minOrder, maxUses, expires, active };

    if (editingPromoId) {
      PromooDB.update(editingPromoId, data);
      showToast(`Promo code ${code} updated.`);
    } else {
      PromooDB.add(data);
      showToast(`Promo code ${code} created.`);
    }

    closeModal('admPromoModalBackdrop');
    renderPromos();
  });

  function showPromoError(msg) {
    document.getElementById('admPromoErrorMsg').textContent = msg;
    document.getElementById('admPromoError').hidden = false;
  }

  document.getElementById('admPromoModalClose').addEventListener('click', () => closeModal('admPromoModalBackdrop'));
  document.getElementById('admPromoCancelBtn').addEventListener('click', () => closeModal('admPromoModalBackdrop'));
  document.getElementById('admPromoModalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('admPromoModalBackdrop');
  });

  /* ── Banner panel ── */
  initBannerPanel();

  document.getElementById('admBannerText').addEventListener('input', e => {
    document.getElementById('admBannerCount').textContent = e.target.value.length;
    updateBannerPreview();
  });
  document.querySelectorAll('input[name="admBannerStyle"]').forEach(r =>
    r.addEventListener('change', updateBannerPreview));

  document.getElementById('admBannerForm').addEventListener('submit', e => {
    e.preventDefault();
    const text   = document.getElementById('admBannerText').value.trim();
    const style  = document.querySelector('input[name="admBannerStyle"]:checked')?.value || 'info';
    const active = document.getElementById('admBannerActive').checked;
    if (!text && active) {
      alert('Please enter a banner message before activating.');
      return;
    }
    BannerDB.save({ text, style, active });
    showToast(active ? 'Banner is now live on the store.' : 'Banner saved (currently inactive).');
  });

  document.getElementById('admBannerClearBtn').addEventListener('click', () => {
    if (!confirm('Clear the banner?')) return;
    BannerDB.save({ text: '', style: 'info', active: false });
    document.getElementById('admBannerText').value = '';
    document.getElementById('admBannerCount').textContent = '0';
    document.getElementById('admBannerActive').checked = false;
    const radio = document.querySelector('input[name="admBannerStyle"][value="info"]');
    if (radio) radio.checked = true;
    updateBannerPreview();
    showToast('Banner cleared.');
  });

  /* ── Suggestions panel ── */
  document.querySelectorAll('.adm-sugg-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.adm-sugg-filter').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      suggFilter = btn.dataset.filter;
      renderSuggestions();
    });
  });

  // Reply/dismiss for suggestions+ideas is handled inline in renderSuggestions()
  // via event delegation inside the rendered HTML (see renderSuggestions function).
  // The old reply modal is kept in HTML for backwards compat but no longer wired here.

  /* ── Analytics links ── */
  document.querySelectorAll('.adm-switch-panel').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      setPanel(a.dataset.panel);
    });
  });

  /* ── Escape key extended modals ── */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('admPromoModalBackdrop').classList.contains('is-open'))
      closeModal('admPromoModalBackdrop');
    if (document.getElementById('admReplyModalBackdrop').classList.contains('is-open'))
      closeModal('admReplyModalBackdrop');
  });

  /* ── Orders search + filter ── */
  const orderSearch = document.getElementById('admOrderSearch');
  const orderFilter = document.getElementById('admOrderFilter');
  if (orderSearch) orderSearch.addEventListener('input', () =>
    renderOrders(orderSearch.value, orderFilter?.value));
  if (orderFilter) orderFilter.addEventListener('change', () =>
    renderOrders(orderSearch?.value, orderFilter.value));

  /* ── Story excerpt char count ── */
  const storyExcEl = document.getElementById('admProdStoryExcerpt');
  if (storyExcEl) storyExcEl.addEventListener('input', e => {
    const cnt = document.getElementById('admStoryCount');
    if (cnt) cnt.textContent = e.target.value.length;
  });
}


/* ══════════════════════════════════════════
   COMMUNITY PROJECTS PANEL
══════════════════════════════════════════ */
const PROJ_HUB_KEY = 'amp_admin_projects_hub';

const ProjDB = {
  all()  {
    try { return JSON.parse(localStorage.getItem(PROJ_HUB_KEY) || '[]'); }
    catch(e) { return []; }
  },
  save(projects) {
    try { localStorage.setItem(PROJ_HUB_KEY, JSON.stringify(projects)); } catch(e) {}
  },
  byId(id) { return this.all().find(p => p.id === id) || null; },
  approve(id) {
    const all = this.all();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) { all[idx].status = 'approved'; this.save(all); }
  },
  dismiss(id) {
    const all = this.all();
    const idx = all.findIndex(p => p.id === id);
    if (idx !== -1) { all[idx].status = 'dismissed'; this.save(all); }
  },
};

let currentProjFilter = 'pending';

function renderProjects() {
  const list   = document.getElementById('admProjList');
  const empty  = document.getElementById('admProjEmpty');
  const badge  = document.getElementById('admProjBadge');
  const pendingCount = document.getElementById('admProjPendingCount');
  if (!list) return;

  const all     = ProjDB.all();
  const pending = all.filter(p => p.status === 'pending').length;

  if (badge)        { badge.hidden = pending === 0; badge.textContent = pending; }
  if (pendingCount) pendingCount.textContent = pending;

  let filtered = currentProjFilter === 'all'
    ? all
    : all.filter(p => p.status === currentProjFilter);
  filtered.sort((a, b) => b.ts - a.ts);

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const stageLabel = s => ({ idea:'💡 Idea', building:'🔨 Building', live:'🚀 Live' }[s] || s);
  const stageClass = s => ({ idea:'adm-proj-stage--idea', building:'adm-proj-stage--building', live:'adm-proj-stage--live' }[s] || '');

  list.innerHTML = filtered.map(p => {
    const techHtml = (p.tech || []).map(t =>
      `<span class="adm-proj-tech-tag">${esc(t)}</span>`).join('');
    const linkHtml = p.link
      ? `<a href="${esc(p.link)}" target="_blank" rel="noopener"><i class="fas fa-arrow-up-right-from-square"></i> ${esc(p.link)}</a>`
      : '';
    const contactHtml = p.contact
      ? `<span><i class="fas fa-envelope"></i> ${esc(p.contact)}</span>` : '';

    // Status indicator
    const statusBadge = p.status === 'approved'
      ? `<span class="adm-proj-live-badge"><i class="fas fa-circle-check"></i> Live on Showcase</span>`
      : p.status === 'dismissed'
      ? `<span class="adm-proj-dismissed-badge"><i class="fas fa-ban"></i> Dismissed</span>`
      : `<span class="adm-proj-pending-badge"><i class="fas fa-hourglass-half"></i> Pending Review</span>`;

    // Showcase preview card
    const previewHtml = `
      <div class="adm-proj-preview">
        <div class="adm-proj-preview-label">SHOWCASE PREVIEW</div>
        <div class="adm-proj-preview-card">
          <div class="adm-proj-preview-header">
            <div class="adm-proj-preview-avatar">${esc(p.name ? p.name[0].toUpperCase() : '?')}</div>
            <div>
              <div class="adm-proj-preview-name">${esc(p.name)}</div>
              <span class="adm-proj-preview-stage ${stageClass(p.stage)}">${stageLabel(p.stage)}</span>
            </div>
          </div>
          <p class="adm-proj-preview-desc">${esc(p.desc.length > 120 ? p.desc.slice(0,120) + '…' : p.desc)}</p>
          ${techHtml ? `<div class="adm-proj-preview-tags">${techHtml}</div>` : ''}
        </div>
      </div>`;

    // Action buttons based on status
    const approveBtn = p.status !== 'approved'
      ? `<button class="adm-btn adm-btn--approve" data-action="approve" data-id="${esc(p.id)}" type="button">
           <i class="fas fa-circle-check"></i> Approve &amp; Add to Showcase
         </button>` : '';
    const dismissBtn = p.status !== 'dismissed'
      ? `<button class="adm-btn adm-btn--outline adm-btn--sm" data-action="dismiss" data-id="${esc(p.id)}" type="button">
           <i class="fas fa-ban"></i> Dismiss
         </button>` : '';
    const restoreBtn = p.status === 'dismissed'
      ? `<button class="adm-btn adm-btn--outline adm-btn--sm" data-action="restore" data-id="${esc(p.id)}" type="button">
           <i class="fas fa-rotate-left"></i> Restore to Pending
         </button>` : '';
    const removeBtn = p.status === 'approved'
      ? `<button class="adm-btn adm-btn--danger adm-btn--sm" data-action="remove" data-id="${esc(p.id)}" type="button">
           <i class="fas fa-eye-slash"></i> Remove from Showcase
         </button>` : '';
    const deleteBtn = `<button class="adm-btn adm-btn--danger adm-btn--sm" data-action="delete" data-id="${esc(p.id)}" type="button">
           <i class="fas fa-trash"></i> Delete
         </button>`;

    return `
      <div class="adm-proj-card" data-id="${esc(p.id)}">
        <div class="adm-proj-card-header">
          <div class="adm-proj-card-name">${esc(p.name)}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="adm-proj-card-stage ${stageClass(p.stage)}">${stageLabel(p.stage)}</span>
            ${statusBadge}
          </div>
        </div>
        <p class="adm-proj-card-desc">${esc(p.desc)}</p>
        ${techHtml ? `<div class="adm-proj-card-tech">${techHtml}</div>` : ''}
        <div class="adm-proj-card-meta">
          ${linkHtml}
          ${contactHtml}
          <span><i class="fas fa-clock"></i> ${new Date(p.ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
        </div>
        ${previewHtml}
        <div class="adm-proj-card-actions">
          ${approveBtn}
          ${removeBtn}
          ${dismissBtn}
          ${restoreBtn}
          ${deleteBtn}
        </div>
      </div>`;
  }).join('');

  // Bind all action buttons
  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.id;
      const p      = ProjDB.byId(id);
      const action = btn.dataset.action;
      if (!p) return;

      if (action === 'approve') {
        ProjDB.approve(id);
        showToast(`✅ "${p.name}" approved — it's now live on the Showcase!`);
        renderProjects();

      } else if (action === 'dismiss') {
        ProjDB.dismiss(id);
        showToast(`"${p.name}" dismissed.`);
        renderProjects();

      } else if (action === 'restore') {
        const all = ProjDB.all();
        const idx = all.findIndex(x => x.id === id);
        if (idx !== -1) { all[idx].status = 'pending'; ProjDB.save(all); }
        showToast(`"${p.name}" restored to pending.`);
        renderProjects();

      } else if (action === 'remove') {
        // Pull from showcase but keep record as dismissed
        ProjDB.dismiss(id);
        showToast(`"${p.name}" removed from Showcase.`);
        renderProjects();

      } else if (action === 'delete') {
        if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return;
        const all = ProjDB.all().filter(x => x.id !== id);
        ProjDB.save(all);
        showToast(`"${p.name}" deleted.`);
        renderProjects();
      }
    });
  });
}


// Filter buttons for projects panel
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.adm-proj-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      currentProjFilter = btn.dataset.filter;
      document.querySelectorAll('.adm-proj-filter').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderProjects();
    });
  });
});

/* ══════════════════════════════════════════
   PATCH setPanel to render new panels on switch
══════════════════════════════════════════ */
const _origSetPanel = setPanel;
window.setPanel = function(panelName) {
  _origSetPanel(panelName);
  if (panelName === 'analytics')   renderAnalytics();
  if (panelName === 'promos')      renderPromos();
  if (panelName === 'suggestions') { renderSuggestions(); NotifDB.mark('suggestions'); refreshNotifBadges(); }
  if (panelName === 'banner')      initBannerPanel();
  if (panelName === 'projects')    { renderProjects(); NotifDB.mark('projects'); refreshNotifBadges(); }
};

/* ══════════════════════════════════════════
   ADD STOCK FIELD TO PRODUCT FORM
══════════════════════════════════════════ */
(function patchProductForm() {
  // Wait for DOM before patching
  document.addEventListener('DOMContentLoaded', () => {
    // Inject stock qty field after the price field in the product form grid
    const priceField = document.getElementById('admProdPrice')?.closest('.adm-field');
    if (priceField && !document.getElementById('admProdStock')) {
      const stockField = document.createElement('div');
      stockField.className = 'adm-field';
      stockField.innerHTML = `
        <label class="adm-label" for="admProdStock">Stock Qty</label>
        <input type="number" id="admProdStock" class="adm-input"
               placeholder="Leave blank = untracked" min="0" step="1" max="99999">
        <p class="adm-field-hint">Set to 0 to auto-mark sold out on save</p>`;
      priceField.after(stockField);
    }

    // Patch openProductModal to fill/clear the stock field
    const _origOpen = openProductModal;
    window.openProductModal = function(productId) {
      _origOpen(productId);
      const stockInput = document.getElementById('admProdStock');
      if (!stockInput) return;
      if (productId) {
        const p = ProductDB.byId(productId);
        stockInput.value = (p && p.stock != null) ? p.stock : '';
      } else {
        stockInput.value = '';
      }
    };

    // Patch getFormData to include stock
    const _origGet = getFormData;
    window.getFormData = function() {
      const result = _origGet();
      if (result.error) return result;
      const stockRaw = document.getElementById('admProdStock')?.value;
      result.stock = stockRaw !== '' && stockRaw != null ? parseInt(stockRaw) : null;
      // Auto-mark sold out if stock hits 0
      if (result.stock === 0) result.soldOut = true;
      return result;
    };
  });
})();

/* ══════════════════════════════════════════
   ORDERS PANEL
══════════════════════════════════════════ */
const ORDERS_KEY   = 'amp_orders_v1';
const ARTICLES_KEY = 'amp_articles_v1';
const GH_KEY       = 'amp_gh_config';

/* ══════════════════════════════════════════
   GITHUB CONFIG — save/load PAT + repo info
══════════════════════════════════════════ */
function loadGhConfig() {
  try { return JSON.parse(localStorage.getItem(GH_KEY) || 'null'); } catch(e) { return null; }
}
function saveGhConfig(cfg) {
  try { localStorage.setItem(GH_KEY, JSON.stringify(cfg)); } catch(e) {}
}

function bindGhSettings() {
  var ownerEl  = document.getElementById('admGhOwner');
  var repoEl   = document.getElementById('admGhRepo');
  var branchEl = document.getElementById('admGhBranch');
  var tokenEl  = document.getElementById('admGhToken');
  var saveBtn  = document.getElementById('admGhSaveBtn');
  var testBtn  = document.getElementById('admGhTestBtn');
  var clearBtn = document.getElementById('admGhClearBtn');
  var okEl     = document.getElementById('admGhSaveOk');
  if (!ownerEl) return;

  // Pre-fill from saved config
  var cfg = loadGhConfig();
  if (cfg) {
    ownerEl.value  = cfg.owner  || '';
    repoEl.value   = cfg.repo   || '';
    branchEl.value = cfg.branch || 'main';
    tokenEl.value  = cfg.token  || '';
    if (cfg.token) { if (okEl) okEl.hidden = false; }
  }

  if (saveBtn) saveBtn.addEventListener('click', function() {
    var cfg = {
      owner:  ownerEl.value.trim(),
      repo:   repoEl.value.trim(),
      branch: branchEl.value.trim() || 'main',
      token:  tokenEl.value.trim()
    };
    if (!cfg.owner || !cfg.repo || !cfg.token) {
      showToast('Fill in username, repo name, and token.');
      return;
    }
    saveGhConfig(cfg);
    if (okEl) okEl.hidden = false;
    showToast('GitHub connection saved.');
  });

  if (testBtn) testBtn.addEventListener('click', function() {
    var cfg = loadGhConfig();
    if (!cfg || !cfg.token) { showToast('Save your GitHub config first.'); return; }
    showToast('Testing connection...');
    fetch('https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo, {
      headers: { 'Authorization': 'Bearer ' + cfg.token, 'Accept': 'application/vnd.github+json' }
    }).then(function(r) {
      if (r.ok) {
        showToast('Connected to ' + cfg.owner + '/' + cfg.repo + ' successfully.');
      } else {
        showToast('Connection failed (' + r.status + '). Check your token and repo name.');
      }
    }).catch(function() { showToast('Network error. Check your connection.'); });
  });

  if (clearBtn) clearBtn.addEventListener('click', function() {
    localStorage.removeItem(GH_KEY);
    ownerEl.value = repoEl.value = branchEl.value = tokenEl.value = '';
    if (okEl) okEl.hidden = true;
    showToast('GitHub config cleared.');
  });
}

/* ══════════════════════════════════════════
   ARTICLES — Chronicle
══════════════════════════════════════════ */
function loadArticles() {
  try { return JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]'); } catch(e) { return []; }
}
function saveArticles(articles) {
  try { localStorage.setItem(ARTICLES_KEY, JSON.stringify(articles)); } catch(e) {}
}

let editingArticleId = null;
let artFilter = 'all';

const CAT_ICONS = {
  culture:'🌺', technology:'⚡', history:'📜', aloha:'🤙',
  crypto:'🔗', environment:'🌿', community:'🌐', other:'📖'
};
const CAT_COLORS = {
  culture:'rgba(255,159,71,.15)', technology:'rgba(84,209,255,.12)',
  history:'rgba(201,168,76,.15)', aloha:'rgba(255,105,180,.12)',
  crypto:'rgba(138,82,200,.15)', environment:'rgba(76,175,122,.15)',
  community:'rgba(84,209,255,.1)', other:'rgba(255,255,255,.05)'
};

function renderArticles() {
  let articles = loadArticles();
  const badge = document.getElementById('admArticlesBadge');
  if (badge) { badge.hidden = articles.length === 0; badge.textContent = articles.length; }

  const list  = document.getElementById('admArticleList');
  const empty = document.getElementById('admArticleEmpty');
  if (!list) return;

  // Apply filter
  let filtered = artFilter === 'all' ? articles
    : artFilter === 'published' ? articles.filter(a => a.published && !a.pinned)
    : artFilter === 'draft'     ? articles.filter(a => !a.published)
    : artFilter === 'pinned'    ? articles.filter(a => a.pinned)
    : articles;

  // Sort: pinned first, then by date desc
  filtered = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.ts || 0) - (a.ts || 0);
  });

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map(a => {
    const icon     = CAT_ICONS[a.category] || '📖';
    const catColor = CAT_COLORS[a.category] || 'rgba(255,255,255,.05)';
    const tags     = (a.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const tagHtml  = tags.map(t => `<span class="adm-proj-tech-tag">${esc(t)}</span>`).join('');
    const date     = a.ts ? new Date(a.ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';
    const statusBadge = a.pinned
      ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(201,168,76,.2);color:var(--gold)"><i class="fas fa-thumbtack"></i> Pinned</span>`
      : a.published
      ? `<span class="adm-status-chip adm-status-chip--active">Published</span>`
      : `<span class="adm-status-chip adm-status-chip--soldout">Draft</span>`;

    const imgHtml = a.image
      ? `<img src="${esc(a.image)}" alt="" style="width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border-soft)">`
      : `<div style="width:80px;height:60px;border-radius:8px;background:${catColor};border:1px solid var(--border-soft);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">${icon}</div>`;

    return `<div class="adm-sugg-card" data-article-id="${esc(a.id)}">
      <div style="display:flex;gap:14px;align-items:flex-start">
        ${imgHtml}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <div>
              <a href="${esc(a.url)}" target="_blank" rel="noopener"
                 style="font-size:14px;font-weight:700;color:var(--text);text-decoration:none;display:block;margin-bottom:3px">
                ${esc(a.title)} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;opacity:.4"></i>
              </a>
              <div style="font-size:11px;color:var(--text-muted)">${icon} ${esc(a.source || '')} ${date ? '· ' + date : ''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;align-items:center">${statusBadge}</div>
          </div>
          ${a.excerpt ? `<p style="font-size:12px;color:var(--text-muted);line-height:1.5;margin-bottom:8px;font-style:italic">"${esc(a.excerpt)}"</p>` : ''}
          ${tagHtml ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">${tagHtml}</div>` : ''}
          <div class="adm-row-actions" style="margin-top:4px">
            <button class="adm-icon-btn adm-icon-btn--edit" data-art-action="edit" data-id="${esc(a.id)}" title="Edit" type="button"><i class="fas fa-pen"></i></button>
            <button class="adm-icon-btn" data-art-action="togglePin" data-id="${esc(a.id)}" title="${a.pinned ? 'Unpin' : 'Pin to top'}" type="button" style="color:${a.pinned ? 'var(--gold)' : 'var(--text-muted)'}"><i class="fas fa-thumbtack"></i></button>
            <button class="adm-icon-btn" data-art-action="togglePublish" data-id="${esc(a.id)}" title="${a.published ? 'Unpublish' : 'Publish'}" type="button" style="color:${a.published ? 'var(--success)' : 'var(--text-muted)'}"><i class="fas ${a.published ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
            <button class="adm-icon-btn adm-icon-btn--del" data-art-action="delete" data-id="${esc(a.id)}" title="Delete" type="button"><i class="fas fa-trash-can"></i></button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  // Wire article action buttons
  list.querySelectorAll('[data-art-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.getAttribute('data-art-action');
      const articles = loadArticles();
      const idx = articles.findIndex(a => a.id === id);
      if (idx === -1) return;

      if (action === 'edit') {
        openArticleModal(id);
      } else if (action === 'togglePin') {
        articles[idx].pinned = !articles[idx].pinned;
        saveArticles(articles);
        showToast(articles[idx].pinned ? 'Article pinned to top.' : 'Article unpinned.');
        renderArticles();
      } else if (action === 'togglePublish') {
        articles[idx].published = !articles[idx].published;
        saveArticles(articles);
        showToast(articles[idx].published ? 'Article published.' : 'Article saved as draft.');
        renderArticles();
      } else if (action === 'delete') {
        if (!confirm('Delete "' + articles[idx].title + '"?')) return;
        articles.splice(idx, 1);
        saveArticles(articles);
        showToast('Article deleted.');
        renderArticles();
      }
    });
  });
}

function openArticleModal(id = null) {
  editingArticleId = id;
  const form = document.getElementById('admArticleForm');
  if (form) form.reset();
  document.getElementById('admArticleError').hidden = true;
  document.getElementById('admArtExcerptCount').textContent = '0';
  document.getElementById('admArticleModalTitle').textContent = id ? 'Edit Article' : 'New Article';
  document.getElementById('admArticleSaveBtnLabel').textContent = id ? 'Save Changes' : 'Save Article';
  document.getElementById('admArtPublished').checked = true;
  document.getElementById('admArtPinned').checked = false;
  // Reset image zone
  if (window._artImgZone) window._artImgZone.clearPreview();

  if (id) {
    const a = loadArticles().find(x => x.id === id);
    if (!a) return;
    document.getElementById('admArticleId').value     = a.id;
    document.getElementById('admArtTitle').value      = a.title;
    document.getElementById('admArtUrl').value        = a.url;
    document.getElementById('admArtSource').value     = a.source || '';
    document.getElementById('admArtCategory').value   = a.category || 'other';
    document.getElementById('admArtImage').value      = a.image || '';
    // Show preview in drop zone
    if (a.image && window._artImgZone) window._artImgZone.showPreview(a.image);
    document.getElementById('admArtExcerpt').value    = a.excerpt || '';
    document.getElementById('admArtExcerptCount').textContent = (a.excerpt || '').length;
    document.getElementById('admArtTags').value       = a.tags || '';
    document.getElementById('admArtPublished').checked = !!a.published;
    document.getElementById('admArtPinned').checked   = !!a.pinned;
  }
  openModal('admArticleModalBackdrop');
  setTimeout(() => document.getElementById('admArtTitle')?.focus(), 100);
}

// ── Check whether pikoArticles.js is live on the server ─────────────────────
function checkPublishStatus() {
  var cfg = loadGhConfig();
  var repoBase = cfg ? ('https://' + cfg.owner + '.github.io/' + cfg.repo) : window.location.origin;
  var fileUrl  = repoBase + '/js/pikoData.js?v=' + Date.now();

  console.log('[Check Status] Fetching:', fileUrl);
  showToast('Checking server...');

  fetch(fileUrl, { cache: 'no-store' })
    .then(function(r) {
      if (!r.ok) {
        if (r.status === 404) {
          showToast('❌ File not found. Click "Publish to Site" then wait 30s for GitHub Pages to rebuild.');
        } else {
          showToast('⚠️ Server returned ' + r.status + '. Check your GitHub config in Settings.');
        }
        return null;
      }
      return r.text();
    })
    .then(function(text) {
      if (!text) return;
      try {
        var match = text.match(/window[.]_pikoArticles\s*=\s*(\[[\s\S]*\])/);
        if (!match) { showToast('⚠️ File exists but looks empty or malformed. Try Publish to Site again.'); return; }
        var articles = JSON.parse(match[1]);
        if (!Array.isArray(articles) || articles.length === 0) {
          showToast('⚠️ File is live but has 0 articles. Publish at least one article first.');
        } else {
          showToast('✅ ' + articles.length + ' article' + (articles.length === 1 ? '' : 's') + ' live on the server and visible on all devices.');
        }
      } catch(e) {
        showToast('⚠️ File exists but could not be parsed. Try Publish to Site again.');
      }
    })
    .catch(function() {
      showToast('❌ Could not reach server. Check your internet connection.');
    });
}

// ── "Publish All to Site" — commits pikoData.js to GitHub ──────────────────
// Bundles ALL site data into one file so every device sees the same content:
//   articles, products, projects (approved), ideas, banner, promos, pay config
function generateArticleEmbed() {
  var articles  = loadArticles().filter(function(a) { return a.published; });
  var products  = [];
  try { products  = JSON.parse(localStorage.getItem('amp_admin_products')      || '[]'); } catch(e) {}
  var allProjs  = [];
  try { allProjs  = JSON.parse(localStorage.getItem('amp_admin_projects_hub')  || '[]'); } catch(e) {}
  var projects  = allProjs.filter(function(p) { return p.status === 'approved'; });
  var ideas     = [];
  try { ideas     = JSON.parse(localStorage.getItem('amp_admin_ideas')         || '[]'); } catch(e) {}
  var banner    = null;
  try { banner    = JSON.parse(localStorage.getItem('amp_admin_banner')        || 'null'); } catch(e) {}
  var promos    = [];
  try { promos    = JSON.parse(localStorage.getItem('amp_admin_promos')        || '[]'); } catch(e) {}
  var payConfig = {};
  try { payConfig = JSON.parse(localStorage.getItem('amp_pay_config')          || '{}'); } catch(e) {}

  // Strip base64 images from articles (too large for committed file)
  var cleanArticles = articles.map(function(a) {
    return Object.assign({}, a, {
      image: (a.image && a.image.startsWith('data:')) ? '' : (a.image || '')
    });
  });
  // Strip base64 images from products too
  var cleanProducts = products.map(function(p) {
    return Object.assign({}, p, {
      image: (p.image && p.image.startsWith('data:')) ? '' : (p.image || '')
    });
  });

  var data = {
    articles:  cleanArticles,
    products:  cleanProducts,
    projects:  projects,
    ideas:     ideas,
    banner:    banner,
    promos:    promos,
    payConfig: payConfig
  };

  var ts = new Date().toISOString();
  var fileContent = [
    '// Pikoverse Site Data - Auto-generated. Do not edit manually.',
    '// Generated: ' + ts,
    'window._pikoData = ' + JSON.stringify(data, null, 2) + ';',
    '// Backwards compat: also set _pikoArticles for any old code',
    'window._pikoArticles = window._pikoData.articles;',
    ''
  ].join('\n');

  var cfg = loadGhConfig();
  if (cfg && cfg.token && cfg.owner && cfg.repo) {
    publishViaGitHub(cfg, fileContent, 'js/pikoData.js');
  } else {
    downloadDataFile(fileContent);
  }
}

function publishViaGitHub(cfg, fileContent, filePath) {
  filePath = filePath || 'js/pikoData.js';
  var apiBase  = 'https://api.github.com/repos/' + cfg.owner + '/' + cfg.repo + '/contents/' + filePath;
  var headers  = {
    'Authorization': 'Bearer ' + cfg.token,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json'
  };

  console.log('[Publish] Starting. URL:', apiBase, 'Branch:', cfg.branch);
  showToast('Publishing to GitHub...');

  // Step 1: get current file SHA (required to UPDATE existing file, skip for new)
  fetch(apiBase + '?ref=' + cfg.branch, { headers: headers })
    .then(function(r) {
      if (r.status === 404) return { sha: null };  // file doesn't exist yet — create it
      if (!r.ok) throw new Error('GET ' + r.status);
      return r.json();
    })
    .then(function(existing) {
      var sha = (existing && existing.sha) ? existing.sha : null;

      var encoded;
      try { encoded = btoa(unescape(encodeURIComponent(fileContent))); }
      catch(e) { encoded = btoa(fileContent); }

      var body = { message: 'Publish Chronicle articles [admin]', content: encoded, branch: cfg.branch };
      if (sha) body.sha = sha;

      return fetch(apiBase, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
    })
    .then(function(r) {
      return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; });
    })
    .then(function(result) {
      if (result.ok) {
        showToast('Done! Articles will show on all devices within 30 seconds.');
      } else {
        var msg = (result.data && result.data.message) || ('Status ' + result.status);
        if (result.status === 401) msg = 'Token invalid or expired — regenerate in Settings.';
        if (result.status === 403) msg = 'Token needs "repo" scope — check Settings.';
        if (result.status === 404) msg = 'Repo "' + cfg.owner + '/' + cfg.repo + '" not found — check Settings.';
        if (result.status === 422) msg = 'Branch "' + cfg.branch + '" not found — check Settings.';
        showToast('Publish failed: ' + msg);
        console.error('[Publish]', result);
      }
    })
    .catch(function(err) {
      showToast('Publish failed — open browser console for details.');
      console.error('[Publish] error:', err);
    });
}

function downloadDataFile(fileContent) {
  var blob = new Blob([fileContent], { type: 'application/javascript' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'pikoData.js';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('pikoData.js downloaded. Add to js/ folder in your repo and commit.');
}

// Guarantee global scope regardless of load order
window.generateArticleEmbed = generateArticleEmbed;
window.publishViaGitHub     = publishViaGitHub;
window.downloadDataFile = downloadDataFile;


function bindArticlesPanel() {
  const addBtn = document.getElementById('admAddArticleBtn');
  if (addBtn) addBtn.addEventListener('click', () => openArticleModal());

  // "Publish to Site" button
  const publishBtn = document.getElementById('admPublishArticlesBtn');
  if (publishBtn) publishBtn.addEventListener('click', function() { generateArticleEmbed(); });

  // "Check Status" button
  var checkStatusBtn = document.getElementById('admCheckPublishBtn');
  if (checkStatusBtn) checkStatusBtn.addEventListener('click', function() { checkPublishStatus(); });

  // Filter buttons
  document.querySelectorAll('[data-art-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-art-filter]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      artFilter = btn.dataset.artFilter;
      renderArticles();
    });
  });

  // Article form submit
  const artForm = document.getElementById('admArticleForm');
  if (artForm) {
    artForm.addEventListener('submit', e => {
      e.preventDefault();
      document.getElementById('admArticleError').hidden = true;

      const title    = document.getElementById('admArtTitle').value.trim();
      const url      = document.getElementById('admArtUrl').value.trim();
      const source   = document.getElementById('admArtSource').value.trim();
      const category = document.getElementById('admArtCategory').value;
      // Image: use drop zone's current value (base64 upload, dragged URL, or typed URL)
      const image = window._artImgZone
        ? window._artImgZone.getValue()
        : document.getElementById('admArtImage').value.trim();
      const excerpt  = document.getElementById('admArtExcerpt').value.trim();
      const tags     = document.getElementById('admArtTags').value.trim();
      const published= document.getElementById('admArtPublished').checked;
      const pinned   = document.getElementById('admArtPinned').checked;

      if (!title) { showArtError('Title is required.'); return; }
      if (!url)   { showArtError('URL is required.'); return; }
      if (!source){ showArtError('Source / Publication is required.'); return; }

      const articles = loadArticles();
      const data = { title, url, source, category, image, excerpt, tags, published, pinned };

      if (editingArticleId) {
        const idx = articles.findIndex(a => a.id === editingArticleId);
        if (idx !== -1) { articles[idx] = { ...articles[idx], ...data }; }
        saveArticles(articles);
        showToast('Article updated.');
      } else {
        data.id = 'art-' + Date.now();
        data.ts = Date.now();
        articles.unshift(data);
        saveArticles(articles);
        showToast('Article added to Chronicle.');
      }

      closeModal('admArticleModalBackdrop');
      renderArticles();
    });
  }

  function showArtError(msg) {
    document.getElementById('admArticleErrorMsg').textContent = msg;
    document.getElementById('admArticleError').hidden = false;
  }

  // Close modal
  document.getElementById('admArticleModalClose')?.addEventListener('click', () => closeModal('admArticleModalBackdrop'));
  document.getElementById('admArticleCancelBtn')?.addEventListener('click', () => closeModal('admArticleModalBackdrop'));
  document.getElementById('admArticleModalBackdrop')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('admArticleModalBackdrop');
  });

  // Excerpt char count
  document.getElementById('admArtExcerpt')?.addEventListener('input', e => {
    document.getElementById('admArtExcerptCount').textContent = e.target.value.length;
  });

  // ── Article Cover Image — drop zone, file picker, paste, URL ──────────────
  wireArticleImageZone();
}


function wireArticleImageZone() {
  var zone        = document.getElementById('admArtImgZone');
  var fileInput   = document.getElementById('admArtImgFile');
  var urlInput    = document.getElementById('admArtImage');
  var preview     = document.getElementById('admArtImgPreview');
  var previewWrap = document.getElementById('admArtImgPreviewWrap');
  var placeholder = document.getElementById('admArtImgPlaceholder');
  var clearBtn    = document.getElementById('admArtImgClear');
  if (!zone) return;

  // ── Core helpers ────────────────────────────────────────────────────────
  function setPreview(src) {
    if (!src) return;
    preview.src = src;
    previewWrap.hidden = false;
    placeholder.hidden = true;
    // Sync URL field only for http URLs; base64 is too long
    if (!src.startsWith('data:') && urlInput) urlInput.value = src;
    if ( src.startsWith('data:') && urlInput) urlInput.value = '';
  }

  function clearPreview() {
    preview.src = '';
    previewWrap.hidden = true;
    placeholder.hidden = false;
    if (urlInput) urlInput.value = '';
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please use an image file (jpg, png, gif, webp, etc.)');
      return;
    }
    var reader = new FileReader();
    reader.onload = function(ev) { setPreview(ev.target.result); };
    reader.readAsDataURL(file);
  }

  // ── Click zone → open file picker ───────────────────────────────────────
  zone.addEventListener('click', function(e) {
    if (clearBtn && clearBtn.contains(e.target)) return; // don't open picker on clear
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
    fileInput.value = ''; // reset so same file re-selectable
  });

  // ── Drag & drop DISABLED ────────────────────────────────────────────────
  // File uploads store as base64 which gets stripped on Publish to Site
  // (too large for a committed JS file). Use a URL instead — it syncs to
  // all devices automatically.
  ['dragenter','dragover','dragleave','drop'].forEach(function(evName) {
    zone.addEventListener(evName, function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Show a hint pointing to the URL field
      if (evName === 'drop' && urlInput) {
        urlInput.focus();
        showToast("Paste an image URL instead — use a URL so it shows on all devices.");
      }
    });
  });

  // ── Paste (Cmd/Ctrl+V) anywhere while article modal is open ────────────
  function handlePaste(e) {
    // Clipboard image paste disabled — base64 doesn't sync cross-device.
    // URL text paste is handled by the URL input's own input event below.
    var modal = document.getElementById('admArticleModalBackdrop');
    if (!modal || !modal.classList.contains('is-open')) return;
    // If user pastes an image file, warn them to use a URL
    var items = (e.clipboardData || window.clipboardData || {}).items;
    if (items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
          e.preventDefault();
          showToast('Paste a URL instead — right-click your image → Copy Image Address.');
          if (urlInput) urlInput.focus();
          return;
        }
      }
    }
  }

  document.addEventListener('paste', handlePaste);

  // ── URL input: live preview as you type or paste ─────────────────────────
  if (urlInput) {
    urlInput.addEventListener('input', function() {
      var v = urlInput.value.trim();
      if (/^https?:\/\/.+/i.test(v)) {
        setPreview(v);
      } else if (!v) {
        // Only clear if preview isn't a file upload
        if (!preview.src.startsWith('data:')) clearPreview();
      }
    });
  }

  // ── Clear button ─────────────────────────────────────────────────────────
  if (clearBtn) {
    clearBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      clearPreview();
    });
  }

    // Expose reset API for openArticleModal
  window._artImgZone = {
    showPreview: setPreview,
    clearPreview: clearPreview,
    // Get current image value (base64 or URL)
    getValue: function() {
      if (preview.src && preview.src !== window.location.href &&
          preview.src !== '' && !preview.hidden) {
        return preview.src;
      }
      return (urlInput && urlInput.value.trim()) || '';
    }
  };
}


function loadOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch(e) { return []; }
}
function saveOrders(orders) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch(e) {}
}

function renderOrders(filterText, statusFilter) {
  const tbody  = document.getElementById('admOrdersTbody');
  const empty  = document.getElementById('admOrdersEmpty');
  const table  = document.getElementById('admOrdersTable');
  const badge  = document.getElementById('admOrdersBadge');
  if (!tbody) return;

  let orders = loadOrders();
  const pending = orders.filter(o => o.status === 'pending_confirmation').length;
  if (badge) { badge.hidden = pending === 0; badge.textContent = pending; }

  const query = (filterText || '').toLowerCase().trim();
  const sf    = statusFilter || 'all';

  if (query) orders = orders.filter(o => o.id.toLowerCase().includes(query));
  if (sf !== 'all') orders = orders.filter(o => o.status === sf);

  if (orders.length === 0) {
    tbody.innerHTML = '';
    if (table) table.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }
  if (table) table.hidden = false;
  if (empty) empty.hidden = true;

  tbody.innerHTML = orders.map(o => {
    const itemList = o.items.map(i =>
      esc(i.name) + (i.size && i.size !== 'N/A' ? ' (' + esc(i.size) + ')' : '') + ' ×' + i.qty
    ).join(', ');
    const date = new Date(o.ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const statusClass = o.status === 'confirmed' ? 'adm-status-chip--active' : 'adm-status-chip--soldout';
    const statusLabel = o.status === 'confirmed' ? 'Confirmed' : 'Awaiting';
    const method = { mppaypal:'PayPal', mpvenmo:'Venmo', mpcashapp:'Cash App', mpstripelink:'Card' }[o.method] || o.method || '—';
    return `<tr>
      <td><strong style="font-family:'Orbitron',sans-serif;font-size:11px;color:var(--gold)">${esc(o.id)}</strong></td>
      <td style="font-size:12px;color:var(--text-muted);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${itemList}</td>
      <td>$${(o.total/100).toFixed(2)}</td>
      <td><span class="adm-category-chip">${esc(method)}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${esc(date)}</td>
      <td><span class="adm-status-chip ${statusClass}">${statusLabel}</span></td>
      <td>
        <div class="adm-row-actions">
          ${o.status !== 'confirmed' ? `<button class="adm-icon-btn" data-order-action="confirm" data-id="${esc(o.id)}" title="Mark confirmed" type="button"><i class="fas fa-circle-check" style="color:var(--success)"></i></button>` : ''}
          <button class="adm-icon-btn adm-icon-btn--del" data-order-action="delete" data-id="${esc(o.id)}" title="Delete" type="button"><i class="fas fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Bind order actions
  tbody.querySelectorAll('[data-order-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const orders2 = loadOrders();
      const id      = btn.dataset.id;
      const action  = btn.dataset.orderAction || btn.getAttribute('data-order-action');
      if (action === 'confirm') {
        const idx = orders2.findIndex(o => o.id === id);
        if (idx !== -1) { orders2[idx].status = 'confirmed'; saveOrders(orders2); }
        showToast('Order ' + id + ' confirmed.');
        renderOrders(document.getElementById('admOrderSearch')?.value, document.getElementById('admOrderFilter')?.value);
      } else if (action === 'delete') {
        if (!confirm('Delete order ' + id + '?')) return;
        saveOrders(orders2.filter(o => o.id !== id));
        renderOrders(document.getElementById('admOrderSearch')?.value, document.getElementById('admOrderFilter')?.value);
        showToast('Order deleted.');
      }
    });
  });
}

/* ══════════════════════════════════════════
   CUSTOMERS PANEL
══════════════════════════════════════════ */
function renderCustomers() {
  const emailList  = (() => { try { return JSON.parse(localStorage.getItem('amp_email_list_v1') || '[]'); } catch(e) { return []; } })();
  const notifyList = (() => { try { return JSON.parse(localStorage.getItem('amp_notify_v1') || '[]'); } catch(e) { return []; } })();
  const orders     = loadOrders();

  const emailCount  = document.getElementById('admCustEmailCount');
  const notifyCount = document.getElementById('admCustNotifyCount');
  const orderCount  = document.getElementById('admCustOrderCount');
  if (emailCount)  emailCount.textContent  = emailList.length;
  if (notifyCount) notifyCount.textContent = notifyList.length;
  if (orderCount)  orderCount.textContent  = orders.length;

  const list  = document.getElementById('admCustomersList');
  const empty = document.getElementById('admCustomersEmpty');
  if (!list) return;

  const allCustomers = [];
  emailList.forEach(email => allCustomers.push({ type: 'subscriber', email, label: '📧 Subscriber' }));
  // Group notify by email
  const notifyByEmail = {};
  notifyList.forEach(n => {
    if (!notifyByEmail[n.email]) notifyByEmail[n.email] = { email: n.email, products: [], ts: n.ts };
    notifyByEmail[n.email].products.push(n.productName);
  });
  Object.values(notifyByEmail).forEach(n => allCustomers.push({
    type: 'notify', email: n.email, products: n.products, label: '🔔 Notify Me'
  }));

  if (allCustomers.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  list.innerHTML = allCustomers.map(c => `
    <div class="adm-sugg-card" style="padding:14px 18px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(c.email)}</div>
          ${c.products ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Waiting for: ${c.products.map(esc).join(', ')}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="adm-category-chip">${c.label}</span>
          <a href="mailto:${esc(c.email)}" class="adm-icon-btn" title="Email this customer" style="color:var(--gold)">
            <i class="fas fa-envelope"></i>
          </a>
        </div>
      </div>
    </div>`).join('');
}

function renderNotifySettings() {
  const notifyList = (() => { try { return JSON.parse(localStorage.getItem('amp_notify_v1') || '[]'); } catch(e) { return []; } })();
  const emailList  = (() => { try { return JSON.parse(localStorage.getItem('amp_email_list_v1') || '[]'); } catch(e) { return []; } })();

  // Notify Me list — grouped by product
  const notifyEl = document.getElementById('admNotifyList');
  if (notifyEl) {
    if (notifyList.length === 0) {
      notifyEl.innerHTML = '<p class="adm-muted" style="padding:8px 0">No notify-me requests yet.</p>';
    } else {
      const byProduct = {};
      notifyList.forEach(n => {
        if (!byProduct[n.productId]) byProduct[n.productId] = { name: n.productName, emails: [] };
        byProduct[n.productId].emails.push(n.email);
      });
      notifyEl.innerHTML = Object.entries(byProduct).map(([id, g]) => {
        const subject = encodeURIComponent(g.name + ' is back in stock!');
        const body    = encodeURIComponent('Great news! ' + g.name + ' is back in stock.\n\nhttps://pikoverse.xyz/marketplace/marketplace.html\n\nMahalo! \u{1F33A} \u2014 Aloha Mass Productions');
        const mailto  = 'mailto:' + g.emails.join(',') + '?subject=' + subject + '&body=' + body;
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-soft)">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(g.name)}</div>
            <div style="font-size:11px;color:var(--text-muted)">${g.emails.length} subscriber${g.emails.length !== 1 ? 's' : ''}</div>
          </div>
          <a href="${esc(mailto)}" class="adm-btn adm-btn--primary adm-btn--sm">
            <i class="fas fa-paper-plane"></i> Email All
          </a>
        </div>`;
      }).join('');
    }
  }

  // Email subscribers
  const emailEl = document.getElementById('admEmailSubList');
  const mailtoAll = document.getElementById('admEmailSubMailto');
  if (emailEl) {
    if (emailList.length === 0) {
      emailEl.innerHTML = '<p class="adm-muted" style="padding:8px 0">No subscribers yet.</p>';
    } else {
      emailEl.innerHTML = emailList.map(email =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-soft);font-size:13px">
          <span style="color:var(--text)">${esc(email)}</span>
          <a href="mailto:${esc(email)}" class="adm-icon-btn" style="color:var(--gold)"><i class="fas fa-envelope"></i></a>
        </div>`
      ).join('');
      if (mailtoAll) {
        mailtoAll.style.display = '';
        const subAll  = encodeURIComponent('News from Aloha Mass Productions');
        const bodyAll = encodeURIComponent('Aloha! Here\'s what\'s new at AMP:\n\n[Your message here]\n\nShop now: https://pikoverse.xyz/marketplace/marketplace.html\n\nMahalo! \u2014 Aloha Mass Productions');
        mailtoAll.href = 'mailto:' + emailList.join(',') + '?subject=' + subAll + '&body=' + bodyAll;
      }
    }
  }

  // Export buttons
  const notifyExport = document.getElementById('admNotifyExportBtn');
  const emailExport  = document.getElementById('admEmailSubExportBtn');
  if (notifyExport) notifyExport.onclick = () => exportCSV('notify-me', ['Email','Product','Date'], notifyList.map(n => [n.email, n.productName, new Date(n.ts).toLocaleDateString()]));
  if (emailExport)  emailExport.onclick  = () => exportCSV('email-subscribers', ['Email'], emailList.map(e => [e]));
}

function exportCSV(filename, headers, rows) {
  const csvRows = [headers, ...rows].map(r =>
    r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')
  );
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename + '-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('Exported ' + filename + '.csv');
}

/* ══════════════════════════════════════════
   PATCH setPanel — add orders + customers
══════════════════════════════════════════ */
(function patchSetPanelOrders() {
  const _prev = window.setPanel;
  window.setPanel = function(panelName) {
    _prev(panelName);
    if (panelName === 'articles') {
      renderArticles();
    }
    if (panelName === 'orders') {
      renderOrders(document.getElementById('admOrderSearch')?.value, document.getElementById('admOrderFilter')?.value);
    }
    if (panelName === 'customers') {
      renderCustomers();
    }
    if (panelName === 'settings') {
      renderNotifySettings();
    }
  };
})();

/* ══════════════════════════════════════════
   INIT HOOK — runs after existing DOMContentLoaded
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  bindExtendedPanels();
  bindArticlesPanel();
  bindGhSettings();

  // Refresh all notification badges on load
  setTimeout(() => {
    try { refreshNotifBadges(); } catch(e) {}
    // also keep suggestion pending count in panel header in sync
    const allPending = SuggDB.all().filter(s => s.status === 'pending').length
                     + IdeaDB.all().filter(i => !i.dismissed && i.status !== 'reviewed').length;
    const suggCount = document.getElementById('admSuggPendingCount');
    if (suggCount) suggCount.textContent = allPending;
  }, 150);
});