/* js/ecosystem-popups.js
   Backdrop and popup are siblings in the DOM.
   Popup uses position:fixed centered via CSS — backdrop is just the dark overlay.
*/
(function() {
  'use strict';

  var backdrop = document.getElementById('ecoPopupBackdrop');
  var current  = null;

  function openPopup(id) {
    var popup = document.getElementById('eco-popup-' + id);
    if (!popup) return;
    if (current && current !== popup) closePopup();

    // Show — remove hidden attr, add is-open for CSS transition
    popup.removeAttribute('hidden');
    requestAnimationFrame(function() {
      popup.classList.add('is-open');
    });
    popup.setAttribute('aria-hidden', 'false');

    // Show backdrop
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }

    // Scroll popup to top
    popup.scrollTop = 0;

    // Lock page scroll
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    current = popup;

    // Focus close button for a11y
    var closeBtn = popup.querySelector('[data-close-popup]');
    if (closeBtn) setTimeout(function() { closeBtn.focus(); }, 150);
  }

  function closePopup() {
    if (!current) return;
    var closing = current;
    current = null;

    // Animate out
    closing.classList.remove('is-open');

    // After transition, hide fully
    setTimeout(function() {
      closing.setAttribute('hidden', '');
      closing.setAttribute('aria-hidden', 'true');
    }, 200);

    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }

    // Restore page scroll
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // Open — any [data-popup] button (skip article tags)
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-popup]');
    if (!btn || btn.tagName === 'ARTICLE') return;
    e.stopPropagation();
    openPopup(btn.getAttribute('data-popup'));
  });

  // Close — [data-close-popup] button
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