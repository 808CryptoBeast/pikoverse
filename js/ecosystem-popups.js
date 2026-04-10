/* js/ecosystem-popups.js */
(function() {
  'use strict';

  var backdrop   = document.getElementById('ecoPopupBackdrop');
  var current    = null;

  function openPopup(id) {
    var popup = document.getElementById('eco-popup-' + id);
    if (!popup) return;
    if (current) closePopup();

    // Show popup — use both hidden removal AND is-open class for compatibility
    popup.removeAttribute('hidden');
    popup.setAttribute('aria-hidden', 'false');

    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }

    document.body.style.overflow = 'hidden';
    current = popup;

    // Focus close button
    var btn = popup.querySelector('[data-close-popup]');
    if (btn) setTimeout(function() { btn.focus(); }, 80);
  }

  function closePopup() {
    if (!current) return;
    current.setAttribute('hidden', '');
    current.setAttribute('aria-hidden', 'true');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    current = null;
  }

  // Open on data-popup button click
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-popup]');
    if (!btn || btn.tagName === 'ARTICLE') return;
    e.stopPropagation();
    openPopup(btn.getAttribute('data-popup'));
  });

  // Close on data-close-popup
  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-close-popup]')) {
      e.stopPropagation();
      closePopup();
    }
  });

  // Close on backdrop click
  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closePopup();
    });
  }

  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && current) closePopup();
  });

  window._pikoEcoPopup = { open: openPopup, close: closePopup };
})();