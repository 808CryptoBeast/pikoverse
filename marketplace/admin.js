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
    image: 'assets/AMP RYB.jpg',
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
    image: 'assets/AMP Rabbit Island.jpg',
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
    image: 'assets/AMPTTiki.jpg',
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
    image: 'assets/AMP Tiki.jpg',
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
const ProductDB = {
  load() {
    const stored = DB.get('products');
    if (stored) return stored;
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
  el.classList.remove('is-open');
  el.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function setPanel(panelName) {
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

  return { name, category, price, badge, description: desc, featured, image, sizes };
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

  renderProducts();
  setPanel('products');
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
    const btn = document.getElementById('admLoginBtn');
    const resetBtn = () => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
    };
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

    try {
      const username = document.getElementById('admUsername').value.trim();
      const password = document.getElementById('admPassword').value;

      const ok = await Auth.checkPassword(username, password);
      if (ok) {
        Auth.startSession({ name: username, method: 'password' });
        enterDashboard({ name: username });
        // Note: don't resetBtn here — login screen is hidden
      } else {
        showLoginError('Incorrect username or password.');
        resetBtn();
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

  /* ── Export button ── */
  document.getElementById('admExportBtn').addEventListener('click', exportProducts);

  /* ── Escape key closes open modals ── */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('admProductModalBackdrop').classList.contains('is-open'))
      closeModal('admProductModalBackdrop');
    if (document.getElementById('admDeleteBackdrop').classList.contains('is-open'))
      closeModal('admDeleteBackdrop');
  });
});