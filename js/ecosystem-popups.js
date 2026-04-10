/* js/ecosystem-popups.js
   Handles open/close for all ecosystem card Deeper Dive popups.
   Uses data-popup="id" to open, data-close-popup to close.
*/
(function() {
  'use strict';

  var backdrop = document.getElementById('ecoPopupBackdrop');
  var currentPopup = null;

  function openPopup(id) {
    var popup = document.getElementById('eco-popup-' + id);
    if (!popup) return;

    // Close any open popup first
    if (currentPopup) closePopup();

    popup.hidden = false;
    popup.setAttribute('aria-hidden', 'false');
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    currentPopup = popup;

    // Focus the close button for accessibility
    var closeBtn = popup.querySelector('[data-close-popup]');
    if (closeBtn) setTimeout(function() { closeBtn.focus(); }, 100);
  }

  function closePopup() {
    if (!currentPopup) return;
    currentPopup.hidden = true;
    currentPopup.setAttribute('aria-hidden', 'true');
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    currentPopup = null;
  }

  // Open — delegate from any data-popup button
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-popup]');
    if (!btn) return;
    // Ignore if it's the card itself (article[data-popup]) — only buttons
    if (btn.tagName === 'ARTICLE') return;
    e.stopPropagation();
    openPopup(btn.getAttribute('data-popup'));
  });

  // Close — delegate from data-close-popup buttons
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

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && currentPopup) closePopup();
  });

  // Expose globally for any other scripts
  window._pikoEcoPopup = { open: openPopup, close: closePopup };

})();