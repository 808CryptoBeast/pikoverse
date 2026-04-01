/**
 * marketplace.js
 * Place in: js/marketplace.js
 *
 * Security notes:
 * - All user input is sanitised before being inserted into the DOM (escapeHtml)
 * - Cart data is stored in sessionStorage only (never localStorage by default)
 *   so it clears when the browser tab closes — change STORAGE_KEY logic if
 *   you want persistence across sessions.
 * - No payment data is ever handled client-side. Checkout redirects to your
 *   payment processor (Stripe / PayPal etc.) via server-side session.
 * - Content Security Policy headers should be set server-side to restrict
 *   script execution to known origins.
 */

(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════
     PRODUCT DATA
     Products are managed via the Admin panel (admin.html).
     The admin saves to localStorage under 'amp_admin_products'.
     The fallback seed below is only used on first run before
     the admin has saved anything.
     All prices in USD cents to avoid floating point issues.
  ════════════════════════════════════════════════════════ */

  // Fallback seed — matches the admin's DEFAULT_PRODUCTS
  var PRODUCT_SEED = [
    {
      id: 'amp-ryb-shirt',
      name: 'AMP RYB T-Shirt',
      category: 'shirts',
      price: 3500,
      description: 'Beyond fabric and tech — AMP carries heritage forward through design. Premium heavyweight cotton, screen-printed with culturally rooted artwork.',
      image: 'assets/AMP RYB.jpg',
      bg: 'https://808cryptobeast.github.io/pikoverse/assets/hawaii-mountains.jpg.webp',
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
      description: 'Aloha in motion — culture expressed through identity, story, and presence. Structured 6-panel cap with embroidered Rabbit Island artwork.',
      image: 'assets/AMP Rabbit Island.jpg',
      bg: 'https://808cryptobeast.github.io/pikoverse/assets/hawaii-mountains.jpg.webp',
      badge: 'new',
      sizes: ['One Size'],
      featured: true,
      soldOut: false,
    },
    {
      id: 'amp-tiki-sticker',
      name: 'AMP Tiki Sticker Pack',
      category: 'stickers',
      price: 800,
      description: 'Weatherproof vinyl stickers. Three designs, rooted in Aloha Mass Productions visual identity. Stick them anywhere.',
      image: 'assets/AMP Tiki.jpg',
      bg: 'https://808cryptobeast.github.io/pikoverse/assets/hawaii-mountains.jpg.webp',
      badge: null,
      sizes: null,
      featured: false,
      soldOut: false,
    },
    {
      id: 'amp-tote',
      name: 'AMP Canvas Tote',
      category: 'accessories',
      price: 2200,
      description: 'Heavy canvas tote with AMP logo and cultural motif. Large enough for a full market run, strong enough for years of use.',
      image: 'assets/AMP Tiki.jpg',
      bg: 'https://808cryptobeast.github.io/pikoverse/assets/hawaii-mountains.jpg.webp',
      badge: null,
      sizes: null,
      featured: false,
      soldOut: false,
    },
  ];

  // Admin localStorage key — must match ADM_CONFIG.STORAGE_PREFIX + 'products' in admin.js
  var ADMIN_PRODUCTS_KEY = 'amp_admin_products';

  // Load products from admin localStorage, fall back to seed
  function loadProducts() {
    try {
      var raw = localStorage.getItem(ADMIN_PRODUCTS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge in any missing fields from seed (e.g. bg) that admin doesn't set
          return parsed.map(function(p) {
            var seed = PRODUCT_SEED.find(function(s) { return s.id === p.id; }) || {};
            return Object.assign({ bg: 'https://808cryptobeast.github.io/pikoverse/assets/hawaii-mountains.jpg.webp' }, seed, p);
          });
        }
      }
    } catch (e) { /* fall through to seed */ }
    return PRODUCT_SEED.slice();
  }

  // Live product list — filtered to exclude sold-out items for shoppers
  // (Admin can still see all including sold-out via admin.html)
  function getProducts() {
    return loadProducts().filter(function(p) { return !p.soldOut; });
  }

  // For cart lookups we need ALL products including sold-out (cart may hold them)
  function getAllProducts() {
    return loadProducts();
  }

  var PRODUCTS = getProducts(); // initial load

  /* ════════════════════════════════════════════════════════
     STATE
  ════════════════════════════════════════════════════════ */
  var state = {
    category: 'all',
    search: '',
    sort: 'featured',
    cart: [],            // [{ productId, name, image, price, size, qty }]
    wishlist: new Set(),
    modal: { productId: null, qty: 1, size: null },
  };

  var STORAGE_KEY = 'amp_cart_v1';

  /* ════════════════════════════════════════════════════════
     SECURITY — sanitise any string before DOM insertion
  ════════════════════════════════════════════════════════ */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#039;');
  }

  function formatPrice(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  /* ════════════════════════════════════════════════════════
     CART — PERSISTENCE (sessionStorage)
  ════════════════════════════════════════════════════════ */
  function loadCart() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) state.cart = JSON.parse(raw);
    } catch (e) { state.cart = []; }
  }

  function saveCart() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); }
    catch (e) { /* storage unavailable — silent fail */ }
  }

  /* ════════════════════════════════════════════════════════
     CART LOGIC
  ════════════════════════════════════════════════════════ */
  function cartKey(productId, size) {
    return productId + '__' + (size || 'none');
  }

  function addToCart(productId, size, qty) {
    var product = getAllProducts().find(function (p) { return p.id === productId; });
    if (!product) return;

    qty = Math.max(1, Math.min(99, parseInt(qty) || 1));
    var key = cartKey(productId, size);
    var existing = state.cart.find(function (i) { return cartKey(i.productId, i.size) === key; });

    if (existing) {
      existing.qty = Math.min(99, existing.qty + qty);
    } else {
      state.cart.push({
        productId: productId,
        name: product.name,
        image: product.image,
        price: product.price,
        size: size || null,
        qty: qty,
      });
    }

    saveCart();
    renderCart();
    updateCartCount();
    showToast('<i class="fas fa-check"></i> Added to cart');
  }

  function removeFromCart(productId, size) {
    var key = cartKey(productId, size);
    state.cart = state.cart.filter(function (i) { return cartKey(i.productId, i.size) !== key; });
    saveCart();
    renderCart();
    updateCartCount();
  }

  function changeCartQty(productId, size, delta) {
    var key = cartKey(productId, size);
    var item = state.cart.find(function (i) { return cartKey(i.productId, i.size) === key; });
    if (!item) return;
    item.qty = Math.max(1, Math.min(99, item.qty + delta));
    saveCart();
    renderCart();
    updateCartCount();
  }

  function cartTotal() {
    return state.cart.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
  }

  function cartItemCount() {
    return state.cart.reduce(function (sum, i) { return sum + i.qty; }, 0);
  }

  /* ════════════════════════════════════════════════════════
     RENDER — PRODUCT GRID
  ════════════════════════════════════════════════════════ */
  function filteredProducts() {
    var result = getProducts().slice();

    // Category filter
    if (state.category !== 'all') {
      result = result.filter(function (p) { return p.category === state.category; });
    }

    // Search filter
    if (state.search.trim()) {
      var term = state.search.trim().toLowerCase();
      result = result.filter(function (p) {
        return p.name.toLowerCase().includes(term) ||
               p.description.toLowerCase().includes(term) ||
               p.category.toLowerCase().includes(term);
      });
    }

    // Sort
    result = result.slice().sort(function (a, b) {
      switch (state.sort) {
        case 'price-asc':  return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'name-asc':   return a.name.localeCompare(b.name);
        default:           return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      }
    });

    return result;
  }

  function badgeHtml(badge) {
    if (!badge) return '';
    var cls = 'mp-product-badge--' + escapeHtml(badge);
    var label = badge.charAt(0).toUpperCase() + badge.slice(1);
    return '<span class="mp-product-badge ' + cls + '">' + escapeHtml(label) + '</span>';
  }

  function renderGrid() {
    var grid    = document.getElementById('mpGrid');
    var empty   = document.getElementById('mpEmpty');
    var emptyTerm = document.getElementById('mpEmptyTerm');
    var count   = document.getElementById('mpResultsCount');
    if (!grid) return;

    var products = filteredProducts();

    if (!products.length) {
      grid.innerHTML = '';
      if (empty)     empty.removeAttribute('hidden');
      if (emptyTerm) emptyTerm.textContent = escapeHtml(state.search);
      if (count)     count.textContent = '0 products found';
      return;
    }

    if (empty) empty.setAttribute('hidden', '');
    if (count) {
      count.textContent = products.length === 1
        ? '1 product'
        : products.length + ' products';
    }

    grid.innerHTML = products.map(function (p) {
      var bgStyle = p.bg ? ' style="background-image:url(\'' + escapeHtml(p.bg) + '\')"' : '';
      return [
        '<div class="mp-product-card" role="listitem" tabindex="0"',
        '     data-id="' + escapeHtml(p.id) + '"',
        '     aria-label="' + escapeHtml(p.name) + ' — ' + formatPrice(p.price) + '">',
        '  <div class="mp-product-img-wrap">',
        '    <div class="mp-product-bg"' + bgStyle + '></div>',
        '    <img class="mp-product-img" src="' + escapeHtml(p.image) + '"',
        '         alt="' + escapeHtml(p.name) + '" loading="lazy">',
        badgeHtml(p.badge),
        '    <button class="mp-product-quick" data-id="' + escapeHtml(p.id) + '"',
        '            aria-label="Quick view ' + escapeHtml(p.name) + '" type="button">',
        '      <i class="fas fa-eye" aria-hidden="true"></i>',
        '    </button>',
        '  </div>',
        '  <div class="mp-product-info">',
        '    <div class="mp-product-cat">' + escapeHtml(p.category) + '</div>',
        '    <h3 class="mp-product-name">' + escapeHtml(p.name) + '</h3>',
        '    <div class="mp-product-footer">',
        '      <span class="mp-product-price">' + formatPrice(p.price) + '</span>',
        '      <button class="mp-product-add" data-id="' + escapeHtml(p.id) + '"',
        '              aria-label="Add ' + escapeHtml(p.name) + ' to cart" type="button">',
        '        <i class="fas fa-plus" aria-hidden="true"></i>',
        '      </button>',
        '    </div>',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    // Wire card click -> modal, quick-view button, add button
    grid.querySelectorAll('.mp-product-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        // Don't open modal when clicking quick-view or add buttons
        if (e.target.closest('.mp-product-quick') || e.target.closest('.mp-product-add')) return;
        openModal(card.getAttribute('data-id'));
      });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal(card.getAttribute('data-id'));
        }
      });
    });

    grid.querySelectorAll('.mp-product-quick').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openModal(btn.getAttribute('data-id'));
      });
    });

    grid.querySelectorAll('.mp-product-add').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var p  = getAllProducts().find(function (p) { return p.id === id; });
        if (!p) return;
        // If product has sizes, open modal to select size first
        if (p.sizes && p.sizes.length > 1) {
          openModal(id);
        } else {
          addToCart(id, p.sizes ? p.sizes[0] : null, 1);
        }
      });
    });
  }

  /* ════════════════════════════════════════════════════════
     MODAL
  ════════════════════════════════════════════════════════ */
  function openModal(productId) {
    var p = getAllProducts().find(function (p) { return p.id === productId; });
    if (!p) return;

    state.modal.productId = productId;
    state.modal.qty  = 1;
    state.modal.size = p.sizes ? p.sizes[0] : null;

    // Tag the modal with the product id so CSS can target per-product styles
    var modal = document.getElementById('mpModal');
    if (modal) modal.setAttribute('data-product', productId);

    var img     = document.getElementById('mpModalImg');
    var title   = document.getElementById('mpModalTitle');
    var desc    = document.getElementById('mpModalDesc');
    var price   = document.getElementById('mpModalPrice');
    var catEl   = document.getElementById('mpModalCat');
    var badgeEl = document.getElementById('mpModalBadge');
    var sizesEl = document.getElementById('mpModalSizes');
    var sizeGrid= document.getElementById('mpSizeGrid');
    var qtyVal  = document.getElementById('mpQtyVal');
    var wishBtn = document.getElementById('mpWishlist');

    if (img)     { img.src = p.image; img.alt = escapeHtml(p.name); }
    if (title)   title.textContent = p.name;
    if (desc)    desc.textContent  = p.description;
    if (price)   price.textContent = formatPrice(p.price);
    if (catEl)   catEl.textContent = p.category;
    if (qtyVal)  qtyVal.textContent = '1';

    // Badge
    if (badgeEl) {
      if (p.badge) {
        var cls = 'mp-product-badge--' + p.badge;
        badgeEl.className = 'mp-modal-badge ' + cls;
        badgeEl.textContent = p.badge.charAt(0).toUpperCase() + p.badge.slice(1);
      } else {
        badgeEl.className = 'mp-modal-badge';
        badgeEl.textContent = '';
      }
    }

    // Sizes
    if (p.sizes && p.sizes.length > 0) {
      if (sizesEl) sizesEl.removeAttribute('hidden');
      if (sizeGrid) {
        sizeGrid.innerHTML = p.sizes.map(function (s) {
          var selected = s === state.modal.size ? ' is-selected' : '';
          return '<button class="mp-size-btn' + selected + '" data-size="' + escapeHtml(s) + '" type="button">' + escapeHtml(s) + '</button>';
        }).join('');

        sizeGrid.querySelectorAll('.mp-size-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            sizeGrid.querySelectorAll('.mp-size-btn').forEach(function (b) { b.classList.remove('is-selected'); });
            btn.classList.add('is-selected');
            state.modal.size = btn.getAttribute('data-size');
          });
        });
      }
    } else {
      if (sizesEl) sizesEl.setAttribute('hidden', '');
    }

    // Wishlist state
    if (wishBtn) {
      wishBtn.classList.toggle('is-saved', state.wishlist.has(productId));
    }

    var backdrop = document.getElementById('mpModalBackdrop');
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      // Trap focus
      setTimeout(function () {
        var close = document.getElementById('mpModalClose');
        if (close) close.focus();
      }, 50);
    }

    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var backdrop = document.getElementById('mpModalBackdrop');
    var modal    = document.getElementById('mpModal');
    // Blur any focused element inside modal before hiding to avoid aria-hidden + focus conflict
    if (document.activeElement && backdrop && backdrop.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (modal) modal.removeAttribute('data-product');
    document.body.style.overflow = '';
    state.modal.productId = null;
  }

  /* ════════════════════════════════════════════════════════
     CART RENDER
  ════════════════════════════════════════════════════════ */
  function renderCart() {
    var body     = document.getElementById('mpCartBody');
    var subtotal = document.getElementById('mpCartSubtotal');
    var footer   = document.getElementById('mpCartFooter');
    if (!body) return;

    if (!state.cart.length) {
      body.innerHTML = [
        '<div class="mp-cart-empty">',
        '  <i class="fas fa-shopping-bag" aria-hidden="true"></i>',
        '  <p>Your cart is empty</p>',
        '</div>',
      ].join('');
      if (footer) footer.style.display = 'none';
      return;
    }

    if (footer) footer.style.display = '';

    body.innerHTML = state.cart.map(function (item) {
      return [
        '<div class="mp-cart-item" data-key="' + escapeHtml(cartKey(item.productId, item.size)) + '">',
        '  <img class="mp-cart-item-img" src="' + escapeHtml(item.image) + '"',
        '       alt="' + escapeHtml(item.name) + '" loading="lazy">',
        '  <div>',
        '    <div class="mp-cart-item-name">' + escapeHtml(item.name) + '</div>',
        '    <div class="mp-cart-item-meta">' + (item.size ? escapeHtml(item.size) : '') + '</div>',
        '    <div class="mp-cart-item-qty">',
        '      <button class="mp-cart-qty-btn" data-action="down" data-id="' + escapeHtml(item.productId) + '" data-size="' + escapeHtml(item.size || '') + '" aria-label="Decrease quantity" type="button">−</button>',
        '      <span class="mp-cart-item-qty-val">' + item.qty + '</span>',
        '      <button class="mp-cart-qty-btn" data-action="up"   data-id="' + escapeHtml(item.productId) + '" data-size="' + escapeHtml(item.size || '') + '" aria-label="Increase quantity" type="button">+</button>',
        '    </div>',
        '  </div>',
        '  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">',
        '    <span class="mp-cart-item-price">' + formatPrice(item.price * item.qty) + '</span>',
        '    <button class="mp-cart-item-remove" data-id="' + escapeHtml(item.productId) + '" data-size="' + escapeHtml(item.size || '') + '" aria-label="Remove ' + escapeHtml(item.name) + '" type="button">',
        '      <i class="fas fa-trash-can" aria-hidden="true"></i>',
        '    </button>',
        '  </div>',
        '</div>',
      ].join('');
    }).join('');

    if (subtotal) subtotal.textContent = formatPrice(cartTotal());

    // Wire qty + remove buttons
    body.querySelectorAll('.mp-cart-qty-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var delta = btn.getAttribute('data-action') === 'up' ? 1 : -1;
        var id    = btn.getAttribute('data-id');
        var size  = btn.getAttribute('data-size') || null;
        changeCartQty(id, size, delta);
      });
    });

    body.querySelectorAll('.mp-cart-item-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id   = btn.getAttribute('data-id');
        var size = btn.getAttribute('data-size') || null;
        removeFromCart(id, size);
      });
    });
  }

  function updateCartCount() {
    var el = document.getElementById('mpCartCount');
    if (!el) return;
    var count = cartItemCount();
    el.textContent = count > 0 ? count : '';
    if (count > 0) {
      el.removeAttribute('data-zero');
      el.style.display = 'flex';
    } else {
      el.setAttribute('data-zero', 'true');
      el.style.display = 'none';
    }
    el.classList.add('pop');
    setTimeout(function () { el.classList.remove('pop'); }, 300);
  }

  /* ════════════════════════════════════════════════════════
     CART DRAWER OPEN / CLOSE
  ════════════════════════════════════════════════════════ */
  function openCart() {
    var drawer   = document.getElementById('mpCartDrawer');
    var backdrop = document.getElementById('mpCartBackdrop');
    if (drawer)   { drawer.classList.add('is-open');   drawer.setAttribute('aria-hidden', 'false'); }
    if (backdrop) { backdrop.classList.add('is-open'); }
    document.body.style.overflow = 'hidden';
    renderCart();
  }

  function closeCart() {
    var drawer   = document.getElementById('mpCartDrawer');
    var backdrop = document.getElementById('mpCartBackdrop');
    // Blur focused element before hiding cart
    if (document.activeElement && drawer && drawer.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    if (drawer)   { drawer.classList.remove('is-open');   drawer.setAttribute('aria-hidden', 'true'); }
    if (backdrop) { backdrop.classList.remove('is-open'); }
    document.body.style.overflow = '';
  }

  /* ════════════════════════════════════════════════════════
     TOAST
  ════════════════════════════════════════════════════════ */
  var toastTimer;
  function showToast(html) {
    var toast = document.getElementById('mpToast');
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('is-visible');
    toast.setAttribute('aria-hidden', 'false');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
      toast.setAttribute('aria-hidden', 'true');
    }, 2800);
  }

  /* ════════════════════════════════════════════════════════
     URL CATEGORY PARAM (for links from index.html)
  ════════════════════════════════════════════════════════ */
  function readUrlParams() {
    try {
      var params = new URLSearchParams(window.location.search);
      var cat = params.get('category');
      if (cat && ['all','shirts','hats','stickers','accessories'].includes(cat)) {
        state.category = cat;
      }
    } catch (e) {}
  }

  function syncCategoryButtons() {
    document.querySelectorAll('.mp-cat-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-cat') === state.category);
    });
  }

  /* ════════════════════════════════════════════════════════
     WIRE EVENTS
  ════════════════════════════════════════════════════════ */
  function wireEvents() {

    // Category buttons
    document.querySelectorAll('.mp-cat-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.category = btn.getAttribute('data-cat') || 'all';
        syncCategoryButtons();
        renderGrid();
      });
    });

    // Search
    var searchEl = document.getElementById('mpSearch');
    var clearBtn = document.getElementById('mpSearchClear');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        // Sanitise: strip HTML tags from search input
        state.search = searchEl.value.replace(/<[^>]*>/g, '').slice(0, 80);
        if (clearBtn) {
          clearBtn.hidden = !state.search;
        }
        renderGrid();
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (searchEl) { searchEl.value = ''; }
        state.search = '';
        clearBtn.hidden = true;
        renderGrid();
        searchEl && searchEl.focus();
      });
    }

    // Sort
    var sortEl = document.getElementById('mpSort');
    if (sortEl) {
      sortEl.addEventListener('change', function () {
        state.sort = sortEl.value;
        renderGrid();
      });
    }

    // Empty state reset
    var emptyReset = document.getElementById('mpEmptyReset');
    if (emptyReset) {
      emptyReset.addEventListener('click', function () {
        if (searchEl) { searchEl.value = ''; }
        state.search = '';
        if (clearBtn) clearBtn.hidden = true;
        renderGrid();
      });
    }

    // Cart open/close
    var cartBtn      = document.getElementById('mpCartBtn');
    var cartClose    = document.getElementById('mpCartClose');
    var cartContinue = document.getElementById('mpCartContinue');
    var cartBackdrop = document.getElementById('mpCartBackdrop');
    if (cartBtn)      cartBtn.addEventListener('click', openCart);
    if (cartClose)    cartClose.addEventListener('click', closeCart);
    if (cartContinue) cartContinue.addEventListener('click', closeCart);
    if (cartBackdrop) cartBackdrop.addEventListener('click', closeCart);

    // ── PAYMENT SETTINGS ────────────────────────────────────────────
    // Set these in the admin Settings panel, or edit directly here.
    // Leave a value as '' to hide that payment option.
    var PAY_CONFIG_KEY = 'amp_pay_config';
    function getPayConfig() {
      try {
        var stored = localStorage.getItem(PAY_CONFIG_KEY);
        if (stored) return JSON.parse(stored);
      } catch(e) {}
      return {
        paypal:   '',   // e.g. 'alohamassproductions'  → paypal.me/alohamassproductions
        venmo:    '',   // e.g. 'AlohaMP'               → venmo.com/u/AlohaMP
        cashapp:  '',   // e.g. '$AlohaMP'              → cash.app/$AlohaMP
        stripe:   '',   // full Stripe Payment Link URL → https://buy.stripe.com/xxxx
      };
    }

    // ── CHECKOUT MODAL ────────────────────────────────────────────
    var checkoutBtn      = document.getElementById('mpCheckoutBtn');
    var checkoutBackdrop = document.getElementById('mpCheckoutBackdrop');
    var checkoutModal    = document.getElementById('mpCheckoutModal');
    var checkoutClose    = document.getElementById('mpCheckoutModalClose');

    function buildOrderNote() {
      // Human-readable order note for payment app memo field
      var lines = state.cart.map(function(item) {
        return item.name + (item.size && item.size !== 'N/A' ? ' (' + item.size + ')' : '') + ' x' + item.qty;
      });
      return 'AMP Order: ' + lines.join(', ');
    }

    function buildOrderNoteEncoded() {
      return encodeURIComponent(buildOrderNote());
    }

    function openCheckoutModal() {
      if (!state.cart.length) {
        showToast('<i class="fas fa-info-circle"></i> Your cart is empty');
        return;
      }

      var cfg     = getPayConfig();
      var total   = cartTotal();
      var discount = state.promoDiscount || 0;
      var finalAmt = Math.max(0, total - discount);
      var dollars  = (finalAmt / 100).toFixed(2);
      var note     = buildOrderNoteEncoded();

      // Populate order summary
      var itemsEl = document.getElementById('mpCheckoutItems');
      var totalEl = document.getElementById('mpCheckoutTotal');
      if (itemsEl) {
        itemsEl.innerHTML = state.cart.map(function(item) {
          return '<div class="mp-checkout-item">' +
            '<span class="mp-checkout-item-name">' + escHtml(item.name) +
              (item.size && item.size !== 'N/A' ? ' <small>(' + escHtml(item.size) + ')</small>' : '') +
              ' &times;' + item.qty + '</span>' +
            '<span class="mp-checkout-item-price">' + formatPrice(item.price * item.qty) + '</span>' +
          '</div>';
        }).join('') + (discount > 0 ? '<div class="mp-checkout-item mp-checkout-item--promo">' +
          '<span>Promo discount</span><span>-' + formatPrice(discount) + '</span></div>' : '');
      }
      if (totalEl) totalEl.textContent = formatPrice(finalAmt);

      // Build payment URLs
      var paypal  = document.getElementById('mpPayPal');
      var venmo   = document.getElementById('mpVenmo');
      var cashapp = document.getElementById('mpCashApp');
      var stripe  = document.getElementById('mpStripeLink');

      if (paypal) {
        if (cfg.paypal) {
          paypal.href = 'https://paypal.me/' + cfg.paypal + '/' + dollars;
          paypal.hidden = false;
        } else {
          paypal.hidden = true;
        }
      }
      if (venmo) {
        if (cfg.venmo) {
          var venmoHandle = cfg.venmo.replace(/^@/, '');
          venmo.href = 'https://venmo.com/' + venmoHandle + '?txn=pay&amount=' + dollars + '&note=' + note;
          venmo.hidden = false;
        } else {
          venmo.hidden = true;
        }
      }
      if (cashapp) {
        if (cfg.cashapp) {
          var cashtag = cfg.cashapp.replace(/^\$/, '');
          cashapp.href = 'https://cash.app/$' + cashtag + '/' + dollars;
          cashapp.hidden = false;
        } else {
          cashapp.hidden = true;
        }
      }
      if (stripe) {
        if (cfg.stripe) {
          // Stripe Payment Links don't take amount params — just open the link
          // Customer will see the configured price. Note goes in Stripe metadata.
          stripe.href = cfg.stripe;
          stripe.hidden = false;
        } else {
          stripe.hidden = true;
        }
      }

      // Show modal
      if (checkoutBackdrop) { checkoutBackdrop.classList.add('is-open'); checkoutBackdrop.setAttribute('aria-hidden','false'); }
      if (checkoutModal)    { checkoutModal.classList.add('is-open');    checkoutModal.setAttribute('aria-hidden','false'); }
      document.body.style.overflow = 'hidden';
    }

    function closeCheckoutModal() {
      if (checkoutBackdrop) { checkoutBackdrop.classList.remove('is-open'); checkoutBackdrop.setAttribute('aria-hidden','true'); }
      if (checkoutModal)    { checkoutModal.classList.remove('is-open');    checkoutModal.setAttribute('aria-hidden','true'); }
      document.body.style.overflow = '';
    }

    if (checkoutBtn)      checkoutBtn.addEventListener('click', openCheckoutModal);
    if (checkoutClose)    checkoutClose.addEventListener('click', closeCheckoutModal);
    if (checkoutBackdrop) checkoutBackdrop.addEventListener('click', function(e) {
      if (e.target === checkoutBackdrop) closeCheckoutModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && checkoutModal && checkoutModal.classList.contains('is-open')) {
        closeCheckoutModal();
      }
    });

    // Modal close
    var modalClose   = document.getElementById('mpModalClose');
    var modalBackdrop= document.getElementById('mpModalBackdrop');
    if (modalClose)    modalClose.addEventListener('click', closeModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    // Modal qty
    var qtyDown = document.getElementById('mpQtyDown');
    var qtyUp   = document.getElementById('mpQtyUp');
    var qtyVal  = document.getElementById('mpQtyVal');
    if (qtyDown) {
      qtyDown.addEventListener('click', function () {
        state.modal.qty = Math.max(1, state.modal.qty - 1);
        if (qtyVal) qtyVal.textContent = state.modal.qty;
      });
    }
    if (qtyUp) {
      qtyUp.addEventListener('click', function () {
        state.modal.qty = Math.min(99, state.modal.qty + 1);
        if (qtyVal) qtyVal.textContent = state.modal.qty;
      });
    }

    // Modal add to cart
    var addBtn = document.getElementById('mpAddToCart');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (!state.modal.productId) return;
        var p = getAllProducts().find(function (p) { return p.id === state.modal.productId; });
        if (!p) return;

        // Require size selection if applicable
        if (p.sizes && p.sizes.length > 1 && !state.modal.size) {
          showToast('<i class="fas fa-exclamation-circle"></i> Please select a size');
          return;
        }

        addToCart(state.modal.productId, state.modal.size, state.modal.qty);
        closeModal();
      });
    }

    // Modal wishlist
    var wishBtn = document.getElementById('mpWishlist');
    if (wishBtn) {
      wishBtn.addEventListener('click', function () {
        if (!state.modal.productId) return;
        if (state.wishlist.has(state.modal.productId)) {
          state.wishlist.delete(state.modal.productId);
          wishBtn.classList.remove('is-saved');
          showToast('Removed from wishlist');
        } else {
          state.wishlist.add(state.modal.productId);
          wishBtn.classList.add('is-saved');
          showToast('<i class="fas fa-heart"></i> Saved to wishlist');
        }
      });
    }

    // Keyboard: Escape closes any open overlay
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var backdrop = document.getElementById('mpModalBackdrop');
      var drawer   = document.getElementById('mpCartDrawer');
      if (backdrop && backdrop.classList.contains('is-open')) { closeModal(); return; }
      if (drawer   && drawer.classList.contains('is-open'))   { closeCart();  return; }
    });

    // Footer category links
    document.querySelectorAll('[data-cat-link]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var cat = a.getAttribute('data-cat-link');
        state.category = cat;
        syncCategoryButtons();
        renderGrid();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Mobile nav toggle (same as main site)
    var toggle = document.getElementById('mobile-menu-toggle');
    var links  = document.getElementById('nav-links');
    var nav    = toggle && toggle.closest('nav');
    if (toggle && links) {
      function closeMenu() {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<i class="fas fa-bars"></i>';
      }
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.innerHTML = open ? '<i class="fas fa-xmark"></i>' : '<i class="fas fa-bars"></i>';
      });
      document.addEventListener('click', function (e) {
        if (nav && !nav.contains(e.target)) closeMenu();
      });
    }
  }

  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  function init() {
    loadCart();
    readUrlParams();
    syncCategoryButtons();
    renderGrid();
    renderCart();
    updateCartCount();
    wireEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ============================================================
   MARKETPLACE EXTENSIONS — Banner, Promo Codes, Suggestions
   ============================================================ */

(function() {
  'use strict';

  var BANNER_KEY = 'amp_admin_banner';
  var PROMO_KEY  = 'amp_admin_promos';
  var SUGG_KEY   = 'amp_admin_suggestions';

  /* ── Banner ── */
  function initBanner() {
    try {
      var raw = localStorage.getItem(BANNER_KEY);
      if (!raw) return;
      var b = JSON.parse(raw);
      if (!b.active || !b.text) return;

      var el   = document.getElementById('mpBanner');
      var text = document.getElementById('mpBannerText');
      if (!el || !text) return;

      text.textContent = b.text;
      el.className = 'mp-banner mp-banner--' + (b.style || 'info');
      el.hidden = false;

      document.getElementById('mpBannerClose').addEventListener('click', function() {
        el.hidden = true;
      });
    } catch(e) {}
  }

  /* ── Promo codes ── */
  var appliedPromo = null;

  function getPromos() {
    try {
      var raw = localStorage.getItem(PROMO_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function applyPromo(code, subtotalCents) {
    var promos  = getPromos();
    var now     = new Date();
    var promo   = promos.find(function(p) { return p.code === code.toUpperCase() && p.active; });

    if (!promo)  return { ok: false, msg: 'Promo code not found or inactive.' };
    if (promo.expires && new Date(promo.expires) < now)
      return { ok: false, msg: 'This promo code has expired.' };
    if (promo.maxUses && promo.uses >= promo.maxUses)
      return { ok: false, msg: 'This promo code has reached its usage limit.' };
    if (promo.minOrder && subtotalCents < promo.minOrder)
      return { ok: false, msg: 'Minimum order of $' + (promo.minOrder/100).toFixed(2) + ' required.' };

    var saving = promo.type === 'percent'
      ? Math.round(subtotalCents * promo.value / 100)
      : Math.min(promo.value, subtotalCents);

    return { ok: true, promo: promo, saving: saving };
  }

  function getCartSubtotalCents() {
    try {
      var raw = sessionStorage.getItem('amp_cart_v1');
      if (!raw) return 0;
      var cart = JSON.parse(raw);
      return cart.reduce(function(sum, item) { return sum + item.price * item.qty; }, 0);
    } catch(e) { return 0; }
  }

  function renderPromoSavings() {
    var savingsRow = document.getElementById('mpPromoSavings');
    var savingsAmt = document.getElementById('mpPromoSavingsAmt');
    if (!savingsRow) return;
    if (appliedPromo) {
      savingsRow.hidden = false;
      savingsAmt.textContent = '-$' + (appliedPromo.saving / 100).toFixed(2);
    } else {
      savingsRow.hidden = true;
    }
  }

  function initPromo() {
    var applyBtn   = document.getElementById('mpPromoApply');
    var promoInput = document.getElementById('mpPromoInput');
    var feedback   = document.getElementById('mpPromoFeedback');
    if (!applyBtn) return;

    applyBtn.addEventListener('click', function() {
      var code = promoInput.value.trim();
      if (!code) return;

      var subtotal = getCartSubtotalCents();
      var result   = applyPromo(code, subtotal);

      feedback.hidden = false;
      if (result.ok) {
        appliedPromo = result;
        feedback.textContent = '✓ ' + result.promo.code + ' applied — saving $' + (result.saving/100).toFixed(2);
        feedback.className   = 'mp-promo-feedback mp-promo-feedback--ok';
        promoInput.disabled  = true;
        applyBtn.textContent = 'Remove';
        applyBtn.onclick = function() {
          appliedPromo = null;
          promoInput.value    = '';
          promoInput.disabled = false;
          feedback.hidden     = true;
          applyBtn.textContent = 'Apply';
          applyBtn.onclick    = null;
          initPromo();
          renderPromoSavings();
        };
      } else {
        appliedPromo = null;
        feedback.textContent = result.msg;
        feedback.className   = 'mp-promo-feedback mp-promo-feedback--err';
      }
      renderPromoSavings();
    });

    promoInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); applyBtn.click(); }
    });
  }

  /* ── Suggestions ── */
  function getSuggestions() {
    try {
      var raw = localStorage.getItem(SUGG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveSuggestion(sugg) {
    try {
      var all = getSuggestions();
      sugg.id        = 'sugg_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
      sugg.timestamp = Date.now();
      sugg.status    = 'pending';
      sugg.reply     = null;
      all.push(sugg);
      localStorage.setItem(SUGG_KEY, JSON.stringify(all));
      return true;
    } catch(e) { return false; }
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function timeAgo(ts) {
    var secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60)  return 'just now';
    if (secs < 3600) return Math.floor(secs/60) + 'm ago';
    if (secs < 86400) return Math.floor(secs/3600) + 'h ago';
    return Math.floor(secs/86400) + 'd ago';
  }

  function renderSuggWall() {
    var wall = document.getElementById('mpSuggWall');
    if (!wall) return;
    // Only show reviewed suggestions (ones the admin has actioned/replied to)
    // and pending ones that have been public for > 0s (all of them for transparency)
    var all = getSuggestions().slice().reverse();
    if (all.length === 0) {
      wall.innerHTML = '<p style="font-size:12px;color:rgba(255,255,255,.3);text-align:center;padding:16px">No suggestions yet — be the first!</p>';
      return;
    }

    wall.innerHTML = all.map(function(s) {
      var from = s.name ? escHtml(s.name) : 'Anonymous';
      var replyHtml = s.reply ? (
        '<div class="mp-sugg-item-reply">' +
          '<div class="mp-sugg-item-reply-label"><i class="fas fa-reply"></i> AMP Team</div>' +
          '<div class="mp-sugg-item-reply-text">' + escHtml(s.reply) + '</div>' +
        '</div>'
      ) : '';
      return '<div class="mp-sugg-item">' +
        '<div class="mp-sugg-item-meta">' +
          '<span class="mp-sugg-item-from">' + from + '</span>' +
          '<span class="mp-sugg-item-date">' + timeAgo(s.timestamp) + '</span>' +
        '</div>' +
        '<div class="mp-sugg-item-text">' + escHtml(s.text) + '</div>' +
        replyHtml +
      '</div>';
    }).join('');
  }

  function initSuggestionPanel() {
    var fab     = document.getElementById('mpSuggFab');
    var panel   = document.getElementById('mpSuggPanel');
    var backdrop = document.getElementById('mpSuggBackdrop');
    var closeBtn = document.getElementById('mpSuggClose');
    var form    = document.getElementById('mpSuggForm');
    var formWrap    = document.getElementById('mpSuggFormWrap');
    var successWrap = document.getElementById('mpSuggSuccessWrap');
    var backBtn = document.getElementById('mpSuggBackBtn');
    var textArea = document.getElementById('mpSuggText');
    var countEl  = document.getElementById('mpSuggCount');
    var errWrap  = document.getElementById('mpSuggErrWrap');
    var errMsg   = document.getElementById('mpSuggErr');

    if (!fab) return;

    function openPanel() {
      panel.classList.add('is-open');
      backdrop.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      renderSuggWall();
    }
    function closePanel() {
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    fab.addEventListener('click', openPanel);
    closeBtn.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);

    textArea.addEventListener('input', function() {
      countEl.textContent = textArea.value.length;
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      errWrap.hidden = true;

      var text  = textArea.value.trim();
      var name  = document.getElementById('mpSuggName').value.trim();
      var email = document.getElementById('mpSuggEmail').value.trim();

      if (!text) {
        errMsg.textContent = 'Please enter your suggestion.';
        errWrap.hidden = false;
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errMsg.textContent = 'Please enter a valid email address.';
        errWrap.hidden = false;
        return;
      }

      var ok = saveSuggestion({ text: text, name: name || null, email: email || null });
      if (!ok) {
        errMsg.textContent = 'Something went wrong. Please try again.';
        errWrap.hidden = false;
        return;
      }

      formWrap.hidden    = true;
      successWrap.hidden = false;
      renderSuggWall();
    });

    backBtn.addEventListener('click', function() {
      formWrap.hidden    = false;
      successWrap.hidden = true;
      form.reset();
      countEl.textContent = '0';
      errWrap.hidden = true;
      renderSuggWall();
    });
  }

  /* ── Boot ── */
  document.addEventListener('DOMContentLoaded', function() {
    initBanner();
    initPromo();
    initSuggestionPanel();
    initNav();
  });

  function initNav() {
    var hamburger = document.getElementById('mpNavHamburger');
    var mobileMenu = document.getElementById('mpNavMobile');
    if (!hamburger || !mobileMenu) return;

    function openMenu() {
      hamburger.classList.add('is-open');
      mobileMenu.classList.add('is-open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      hamburger.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      hamburger.classList.remove('is-open');
      mobileMenu.classList.remove('is-open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', function() {
      if (mobileMenu.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    // Close on outside click
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#mpNavHamburger') && !e.target.closest('#mpNavMobile')) {
        closeMenu();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

})();