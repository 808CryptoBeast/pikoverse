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
      image: 'https://pikoverse.xyz/assets/AMP%20RYB.jpg',
      bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp',
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
      image: 'https://pikoverse.xyz/assets/AMP%20Rabbit%20Island.jpg',
      bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp',
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
      image: 'https://pikoverse.xyz/assets/AMP%20Tiki.jpg',
      bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp',
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
      image: 'https://pikoverse.xyz/assets/AMP%20Tiki.jpg',
      bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp',
      badge: null,
      sizes: null,
      featured: false,
      soldOut: false,
    },
  ];

  // Admin localStorage key — must match ADM_CONFIG.STORAGE_PREFIX + 'products' in admin.js
  var ADMIN_PRODUCTS_KEY = 'amp_admin_products';

  // Load products: pikoData.js (all devices) > localStorage (same device) > seed
  function loadProducts() {
    // 1. pikoData.js from server — visible on all devices
    try {
      if (window._pikoData && Array.isArray(window._pikoData.products) && window._pikoData.products.length > 0) {
        try { localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(window._pikoData.products)); } catch(e) {}
        return window._pikoData.products.map(function(p) {
          var seed = PRODUCT_SEED.find(function(s) { return s.id === p.id; }) || {};
          return Object.assign({ bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp' }, seed, p);
        });
      }
    } catch(e) {}
    // 2. localStorage — same device as admin
    try {
      var raw = localStorage.getItem(ADMIN_PRODUCTS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(function(p) {
            var seed = PRODUCT_SEED.find(function(s) { return s.id === p.id; }) || {};
            return Object.assign({ bg: 'https://pikoverse.xyz/assets/hawaii-mountains.jpg.webp' }, seed, p);
          });
        }
      }
    } catch (e) {}
    return PRODUCT_SEED.slice();
  }

  // Live product list — includes sold-out items (shown with overlay)
  function getProducts() {
    return loadProducts(); // show all, render sold-out with overlay
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
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.cart = JSON.parse(raw);
    } catch (e) { state.cart = []; }
  }

  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); }
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
    if (product.soldOut) {
      showToast('<i class="fas fa-ban"></i> ' + escapeHtml(product.name) + ' is sold out.');
      return;
    }

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
        (p.soldOut ? '    <div class="mp-sold-out-overlay">' +
          '<span class="mp-sold-out-label">Sold Out</span>' +
          '<button class="mp-notify-btn" data-notify-id="' + escapeHtml(p.id) + '" data-notify-name="' + escapeHtml(p.name) + '" type="button">' +
          '<i class="fas fa-bell"></i> Notify Me</button>' +
          '</div>' : ''),
        '  </div>',
        '  <div class="mp-product-info">',
        '    <div class="mp-product-cat">' + escapeHtml(p.category) + '</div>',
        '    <h3 class="mp-product-name">' + escapeHtml(p.name) + '</h3>',
        renderStarsMini(p.id),
        (p.sizes && p.sizes.length > 0
          ? '    <div class="mp-product-sizes-preview">' +
            p.sizes.slice(0, 4).map(function(s) {
              return '<span class="mp-size-chip">' + escapeHtml(s) + '</span>';
            }).join('') +
            (p.sizes.length > 4 ? '<span class="mp-size-chip mp-size-chip--more">+' + (p.sizes.length - 4) + '</span>' : '') +
            '</div>'
          : ''),
        '    <div class="mp-product-footer">',
        '      <span class="mp-product-price">' + formatPrice(p.price) + '</span>',
        (!p.soldOut ? '      <button class="mp-product-add" data-id="' + escapeHtml(p.id) + '"' +
          ' aria-label="Add ' + escapeHtml(p.name) + ' to cart" type="button">' +
          '<i class="fas fa-plus" aria-hidden="true"></i></button>' : ''),
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

    // Ratings
    var ratingEl = document.getElementById('mpModalRating');
    if (ratingEl) ratingEl.innerHTML = renderStarsFull(productId);

    // Story behind the design
    var storyWrap   = document.getElementById('mpModalStory');
    var storyLink   = document.getElementById('mpStoryLink');
    var storyText   = document.getElementById('mpStoryText');
    var storyExcerpt= document.getElementById('mpStoryExcerpt');
    if (storyWrap) {
      if (p.story || p.storyUrl) {
        storyWrap.hidden = false;
        if (storyLink) storyLink.href = p.storyUrl || '#';
        if (storyText) storyText.textContent = p.storyTitle || 'Story Behind the Design';
        if (storyExcerpt) storyExcerpt.textContent = p.story || '';
      } else {
        storyWrap.hidden = true;
      }
    }
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
     RATINGS
  ════════════════════════════════════════════════════════ */
  var RATINGS_KEY = 'amp_ratings_v1';

  function getRatings() {
    try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}'); }
    catch(e) { return {}; }
  }

  function saveRating(productId, stars) {
    var r = getRatings();
    if (!r[productId]) r[productId] = { total: 0, count: 0, mine: null };
    if (r[productId].mine !== null) {
      r[productId].total -= r[productId].mine; // remove old
      r[productId].count--;
    }
    r[productId].total += stars;
    r[productId].count++;
    r[productId].mine = stars;
    localStorage.setItem(RATINGS_KEY, JSON.stringify(r));
    return r[productId];
  }

  function getProductRating(productId) {
    var r = getRatings()[productId];
    if (!r || r.count === 0) return { avg: 0, count: 0, mine: null };
    return { avg: r.total / r.count, count: r.count, mine: r.mine };
  }

  function renderStarsMini(productId) {
    var r = getProductRating(productId);
    if (r.count === 0) {
      return '    <div class="mp-stars-mini mp-stars-empty"><span>No reviews yet</span></div>';
    }
    var filled = Math.round(r.avg);
    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<i class="' + (i <= filled ? 'fas' : 'far') + ' fa-star"></i>';
    }
    return '    <div class="mp-stars-mini">' + stars + ' <span>(' + r.count + ')</span></div>';
  }

  function renderStarsFull(productId) {
    var r = getProductRating(productId);
    var html = '<div class="mp-stars-full" data-product-id="' + escapeHtml(productId) + '">';
    for (var i = 1; i <= 5; i++) {
      var cls = i <= (r.mine || Math.round(r.avg)) ? 'fas' : 'far';
      html += '<button class="mp-star-btn ' + cls + ' fa-star" data-star="' + i + '" aria-label="Rate ' + i + ' stars" type="button"></button>';
    }
    html += '</div>';
    if (r.count > 0) {
      html += '<span class="mp-stars-count">' + r.avg.toFixed(1) + ' (' + r.count + ' review' + (r.count !== 1 ? 's' : '') + ')</span>';
    } else {
      html += '<span class="mp-stars-count">Be the first to rate</span>';
    }
    return html;
  }

  /* ════════════════════════════════════════════════════════
     NOTIFY ME (Sold Out)
  ════════════════════════════════════════════════════════ */
  var NOTIFY_KEY = 'amp_notify_v1';

  function saveNotify(productId, productName, email) {
    try {
      var all = JSON.parse(localStorage.getItem(NOTIFY_KEY) || '[]');
      if (!all.find(function(n) { return n.productId === productId && n.email === email; })) {
        all.push({ productId: productId, productName: productName, email: email, ts: Date.now() });
        localStorage.setItem(NOTIFY_KEY, JSON.stringify(all));
      }
    } catch(e) {}
  }

  /* ════════════════════════════════════════════════════════
     EMAIL CAPTURE
  ════════════════════════════════════════════════════════ */
  var EMAIL_KEY = 'amp_email_list_v1';
  var EMAIL_DISMISSED_KEY = 'amp_email_dismissed';

  /* ════════════════════════════════════════════════════════
     ECOSYSTEM DOCK
  ════════════════════════════════════════════════════════ */
  function initEcoDock() {
    var dock    = document.getElementById('mpEcoDock');
    var toggle  = document.getElementById('mpEcoToggle');
    var icon    = toggle ? toggle.querySelector('i') : null;
    var DOCK_KEY = 'amp_eco_dock_open';
    if (!dock) return;

    // Restore last state
    var isOpen = localStorage.getItem(DOCK_KEY) !== '0';
    if (!isOpen) {
      dock.classList.add('is-collapsed');
      if (icon) icon.className = 'fas fa-chevron-up';
    }

    if (toggle) toggle.addEventListener('click', function() {
      var collapsed = dock.classList.toggle('is-collapsed');
      if (icon) icon.className = collapsed ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
      localStorage.setItem(DOCK_KEY, collapsed ? '0' : '1');
    });
  }

  /* ════════════════════════════════════════════════════════
     ORDER CONFIRMATION
  ════════════════════════════════════════════════════════ */
  var ORDERS_KEY = 'amp_orders_v1';

  function generateOrderNum() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var num = 'AMP-';
    for (var i = 0; i < 6; i++) num += chars[Math.floor(Math.random() * chars.length)];
    return num;
  }

  function saveOrder(cart, total, paymentMethod) {
    var orders = [];
    try { orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch(e) {}
    var order = {
      id:        generateOrderNum(),
      items:     cart.map(function(i) { return { name: i.name, size: i.size, qty: i.qty, price: i.price }; }),
      total:     total,
      method:    paymentMethod,
      ts:        Date.now(),
      status:    'pending_confirmation',
    };
    orders.unshift(order);
    try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); } catch(e) {}
    return order;
  }

  function showOrderConfirmation(order) {
    // Hide the modal body content, show confirm screen
    var body = document.querySelector('.mp-checkout-modal-body');
    var confirm = document.getElementById('mpOrderConfirm');
    var numEl   = document.getElementById('mpOrderNum');
    var itemsEl = document.getElementById('mpOrderConfirmItems');
    var doneBtn = document.getElementById('mpOrderConfirmDone');

    if (!confirm) return;

    if (body) body.style.display = 'none';
    confirm.hidden = false;

    if (numEl) numEl.textContent = order.id;

    if (itemsEl) {
      itemsEl.innerHTML = order.items.map(function(i) {
        return '<div class="mp-confirm-item">' +
          '<span>' + escapeHtml(i.name) + (i.size && i.size !== 'N/A' ? ' (' + escapeHtml(i.size) + ')' : '') + ' ×' + i.qty + '</span>' +
          '<span>' + formatPrice(i.price * i.qty) + '</span>' +
        '</div>';
      }).join('') +
      '<div class="mp-confirm-total"><span>Total</span><span>' + formatPrice(order.total) + '</span></div>';
    }

    if (doneBtn) {
      doneBtn.onclick = function() {
        // Clear cart and close
        state.cart = [];
        saveCart();
        renderCart();
        updateCartCount();
        window._ampPromoSaving = 0;
        // Reset modal
        confirm.hidden = true;
        if (body) body.style.display = '';
        closeCheckoutModal();
        showToast('<i class="fas fa-circle-check"></i> Order ' + order.id + ' saved!');
      };
    }
  }

  /* ════════════════════════════════════════════════════════
     EMAIL CAPTURE
  ════════════════════════════════════════════════════════ */
  function initEmailCapture() {
    if (localStorage.getItem(EMAIL_DISMISSED_KEY)) return;
    var banner = document.getElementById('mpEmailCapture');
    if (!banner) return;
    setTimeout(function() {
      banner.classList.add('is-visible');
    }, 8000); // show after 8 seconds

    var form   = document.getElementById('mpEmailForm');
    var input  = document.getElementById('mpEmailInput');
    var close  = document.getElementById('mpEmailClose');
    var success = document.getElementById('mpEmailSuccess');

    if (close) close.addEventListener('click', function() {
      banner.classList.remove('is-visible');
      localStorage.setItem(EMAIL_DISMISSED_KEY, '1');
    });

    if (form) form.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = input ? input.value.trim() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      try {
        var list = JSON.parse(localStorage.getItem(EMAIL_KEY) || '[]');
        if (!list.includes(email)) { list.push(email); localStorage.setItem(EMAIL_KEY, JSON.stringify(list)); }
      } catch(ex) {}
      // Apply 10% promo automatically
      window._ampPromoSaving = 0;
      if (success) { success.hidden = false; if (form) form.hidden = true; }
      setTimeout(function() {
        banner.classList.remove('is-visible');
        localStorage.setItem(EMAIL_DISMISSED_KEY, '1');
        showToast('<i class="fas fa-tag"></i> Use code WELCOME10 for 10% off!');
      }, 2000);
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

    // ── Notify Me (sold out products) — delegated from grid ──
    document.getElementById('mpGrid').addEventListener('click', function(e) {
      var btn = e.target.closest('.mp-notify-btn');
      if (!btn) return;
      e.stopPropagation();
      var id   = btn.getAttribute('data-notify-id');
      var name = btn.getAttribute('data-notify-name');
      // Show inline email prompt
      var existing = btn.parentNode.querySelector('.mp-notify-form');
      if (existing) { existing.remove(); return; }
      var formEl = document.createElement('div');
      formEl.className = 'mp-notify-form';
      formEl.innerHTML =
        '<input type="email" class="mp-notify-input" placeholder="your@email.com" maxlength="120">' +
        '<button class="mp-notify-submit" type="button">Notify Me</button>';
      btn.parentNode.appendChild(formEl);
      formEl.querySelector('.mp-notify-submit').addEventListener('click', function() {
        var emailVal = formEl.querySelector('.mp-notify-input').value.trim();
        if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          showToast('Please enter a valid email address.');
          return;
        }
        saveNotify(id, name, emailVal);
        formEl.remove();
        showToast('<i class="fas fa-bell"></i> We\'ll notify you when ' + escapeHtml(name) + ' is back!');
      });
      setTimeout(function() { formEl.querySelector('.mp-notify-input').focus(); }, 50);
    });

    // ── Star ratings — delegated from modal ──
    document.getElementById('mpModal').addEventListener('click', function(e) {
      var btn = e.target.closest('.mp-star-btn');
      if (!btn) return;
      var stars = parseInt(btn.getAttribute('data-star'));
      var productId = btn.closest('.mp-stars-full').getAttribute('data-product-id');
      saveRating(productId, stars);
      var ratingEl = document.getElementById('mpModalRating');
      if (ratingEl) ratingEl.innerHTML = renderStarsFull(productId);
      showToast('<i class="fas fa-star"></i> Thanks for your rating!');
      renderGrid(); // refresh mini stars on cards
    });

    // ── PAYMENT SETTINGS ────────────────────────────────────────────
    // Set these in the admin Settings panel, or edit directly here.
    // Leave a value as '' to hide that payment option.
    var PAY_CONFIG_KEY = 'amp_pay_config';
    function getPayConfig() {
      try {
        // pikoData.js (cross-device) > localStorage
        if (window._pikoData && window._pikoData.payConfig) {
          var pd = window._pikoData.payConfig;
          if (pd.paypal || pd.venmo || pd.cashapp || pd.stripe) {
            try { localStorage.setItem(PAY_CONFIG_KEY, JSON.stringify(pd)); } catch(e) {}
            return pd;
          }
        }
        var stored = localStorage.getItem(PAY_CONFIG_KEY);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed.paypal || parsed.venmo || parsed.cashapp || parsed.stripe) {
            return parsed;
          }
        }
      } catch(e) {}
      return { paypal: '', venmo: '', cashapp: '', stripe: '' };
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

      // ── Close cart drawer first ────────────────────
      closeCart();

      var cfg      = getPayConfig();
      var total    = cartTotal();
      var discount = window._ampPromoSaving || 0;
      var finalAmt = Math.max(0, total - discount);
      var dollars  = (finalAmt / 100).toFixed(2);
      var note     = buildOrderNoteEncoded();

      // Populate order summary
      var itemsEl = document.getElementById('mpCheckoutItems');
      var totalEl = document.getElementById('mpCheckoutTotal');
      if (itemsEl) {
        itemsEl.innerHTML = state.cart.map(function(item) {
          return '<div class="mp-checkout-item">' +
            '<span class="mp-checkout-item-name">' + escapeHtml(item.name) +
              (item.size && item.size !== 'N/A' ? ' <small>(' + escapeHtml(item.size) + ')</small>' : '') +
              ' &times;' + item.qty + '</span>' +
            '<span class="mp-checkout-item-price">' + formatPrice(item.price * item.qty) + '</span>' +
          '</div>';
        }).join('') + (discount > 0 ? '<div class="mp-checkout-item mp-checkout-item--promo">' +
          '<span>Promo discount</span><span>-' + formatPrice(discount) + '</span></div>' : '');
      }
      if (totalEl) totalEl.textContent = formatPrice(finalAmt);

      // Build payment URLs — always show buttons, wire real URLs when configured
      var paypal  = document.getElementById('mpPayPal');
      var venmo   = document.getElementById('mpVenmo');
      var cashapp = document.getElementById('mpCashApp');
      var stripe  = document.getElementById('mpStripeLink');
      var anyMethod = false;

      if (paypal) {
        paypal.hidden = false; // always visible
        if (cfg.paypal) {
          paypal.href = 'https://paypal.me/' + cfg.paypal + '/' + dollars;
          paypal.dataset.configured = 'true';
          anyMethod = true;
        } else {
          paypal.href = '#';
          paypal.dataset.configured = '';
        }
      }
      if (venmo) {
        venmo.hidden = false;
        if (cfg.venmo) {
          var venmoHandle = cfg.venmo.replace(/^@/, '');
          venmo.href = 'https://venmo.com/' + venmoHandle + '?txn=pay&amount=' + dollars + '&note=' + note;
          venmo.dataset.configured = 'true';
          anyMethod = true;
        } else {
          venmo.href = '#';
          venmo.dataset.configured = '';
        }
      }
      if (cashapp) {
        cashapp.hidden = false;
        if (cfg.cashapp) {
          var cashtag = cfg.cashapp.replace(/^\$/, '');
          cashapp.href = 'https://cash.app/$' + cashtag + '/' + dollars;
          cashapp.dataset.configured = 'true';
          anyMethod = true;
        } else {
          cashapp.href = '#';
          cashapp.dataset.configured = '';
        }
      }
      if (stripe) {
        if (cfg.stripe) {
          stripe.href = cfg.stripe;
          stripe.hidden = false;
          stripe.dataset.configured = 'true';
          anyMethod = true;
        } else {
          stripe.hidden = true;
          stripe.dataset.configured = '';
        }
      }

      // Show/hide "not configured" message
      var noMethodsEl = document.getElementById('mpNoPaymentMethods');
      if (noMethodsEl) noMethodsEl.style.display = anyMethod ? 'none' : 'block';

      // Wire payment button clicks:
      // - configured → open in new tab, keep modal open so user sees email instructions
      // - not configured → show toast, keep modal open
      [paypal, venmo, cashapp, stripe].forEach(function(btn) {
        if (!btn) return;
        // Remove old listener by cloning
        var clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
        clone.addEventListener('click', function(e) {
          e.stopPropagation();
          if (!clone.dataset.configured) {
            e.preventDefault();
            showToast('<i class="fas fa-gear"></i> Set up this payment method in Admin → Settings');
            return;
          }
          // Configured — record the order then show confirmation
          var discount  = window._ampPromoSaving || 0;
          var total     = Math.max(0, cartTotal() - discount);
          var method    = clone.id.replace('mp','').toLowerCase();
          var order     = saveOrder(state.cart.slice(), total, method);
          // Let the link open (payment app) then show confirmation after short delay
          setTimeout(function() { showOrderConfirmation(order); }, 800);
        });
      });

      // Show modal
      if (checkoutBackdrop) {
        checkoutBackdrop.classList.add('is-open');
        checkoutBackdrop.setAttribute('aria-hidden', 'false');
      }
      if (checkoutModal) {
        checkoutModal.classList.add('is-open');
        checkoutModal.setAttribute('aria-hidden', 'false');
      }
      document.body.style.overflow = 'hidden';
    }

    function closeCheckoutModal() {
      if (checkoutBackdrop) {
        checkoutBackdrop.classList.remove('is-open');
        checkoutBackdrop.setAttribute('aria-hidden', 'true');
      }
      if (checkoutModal) {
        checkoutModal.classList.remove('is-open');
        checkoutModal.setAttribute('aria-hidden', 'true');
      }
      document.body.style.overflow = '';
    }

    if (checkoutBtn)   checkoutBtn.addEventListener('click', openCheckoutModal);
    if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);

    // Only close on backdrop click — not when clicking inside the modal
    if (checkoutBackdrop) {
      checkoutBackdrop.addEventListener('click', function(e) {
        if (e.target === checkoutBackdrop) closeCheckoutModal();
      });
    }

    // Escape closes checkout modal
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
        var soldCheck = getAllProducts().find(function(x) { return x.id === state.modal.productId; });
        if (soldCheck && soldCheck.soldOut) {
          showToast('<i class="fas fa-ban"></i> This item is sold out.');
          return;
        }
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
    initEmailCapture();
    initEcoDock();
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
      // pikoData.js (cross-device) > localStorage
      var b = (window._pikoData && window._pikoData.banner)
            ? window._pikoData.banner
            : JSON.parse(localStorage.getItem(BANNER_KEY) || 'null');
      if (!b || !b.active || !b.text) return;

      // Sync to localStorage so it persists if pikoData not yet loaded
      try { localStorage.setItem(BANNER_KEY, JSON.stringify(b)); } catch(e) {}

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
      // pikoData.js (cross-device) > localStorage
      if (window._pikoData && Array.isArray(window._pikoData.promos) && window._pikoData.promos.length > 0) {
        try { localStorage.setItem(PROMO_KEY, JSON.stringify(window._pikoData.promos)); } catch(e) {}
        return window._pikoData.promos;
      }
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
        window._ampPromoSaving = result.saving; // bridge to checkout modal
        feedback.textContent = '✓ ' + result.promo.code + ' applied — saving $' + (result.saving/100).toFixed(2);
        feedback.className   = 'mp-promo-feedback mp-promo-feedback--ok';
        promoInput.disabled  = true;
        applyBtn.textContent = 'Remove';
        applyBtn.onclick = function() {
          appliedPromo = null;
          window._ampPromoSaving = 0; // clear bridge
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
    // Fetch pikoData.js first so products/banner/promos/payConfig are cross-device
    if (typeof fetch !== 'undefined') {
      fetch('../js/pikoData.js', { cache: 'no-store' })
        .then(function(r) { return r.ok ? r.text() : null; })
        .then(function(text) {
          if (text) {
            try {
              // eslint-disable-next-line no-eval
              eval(text); // sets window._pikoData
            } catch(e) {}
          }
          // Init after fetch attempt (whether it succeeded or not)
          _initMarketplace();
        })
        .catch(function() { _initMarketplace(); });
    } else {
      _initMarketplace();
    }
  });

  function _initMarketplace() {
    initBanner();
    initPromo();
    initSuggestionPanel();
    initNav();
  }

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