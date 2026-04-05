/* ═══════════════════════════════════════════════════════════════
   ecosystem-popups.js
   Add:  <script src="js/ecosystem-popups.js"></script>
   to your index.html BEFORE the closing </body> tag,
   after the other script tags.
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const backdrop = document.getElementById('ecoPopupBackdrop');
  let activePopup = null;
  let previousFocus = null;

  /* ── Open a popup by its data-popup id ── */
  function openPopup(id) {
    const popup = document.getElementById('eco-popup-' + id);
    if (!popup || !backdrop) return;

    // Store where focus was so we can return it on close
    previousFocus = document.activeElement;

    // Close any currently open popup first
    if (activePopup && activePopup !== popup) closePopup();

    // Show
    popup.removeAttribute('hidden');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Trigger CSS transition on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        popup.classList.add('is-open');
        activePopup = popup;

        // Move focus into the popup (accessibility)
        const firstFocusable = popup.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) firstFocusable.focus();
      });
    });
  }

  /* ── Close whichever popup is currently open ── */
  function closePopup() {
    if (!activePopup) return;

    activePopup.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';

    const closing = activePopup;
    activePopup = null;

    // Wait for CSS transition before hiding from DOM
    const onTransitionEnd = () => {
      closing.setAttribute('hidden', '');
      closing.removeEventListener('transitionend', onTransitionEnd);
    };
    closing.addEventListener('transitionend', onTransitionEnd);

    // Return focus to where it was
    if (previousFocus) previousFocus.focus();
  }

  /* ── Keyboard trap: keep Tab inside popup ── */
  function trapFocus(e) {
    if (!activePopup) return;
    const focusable = Array.from(
      activePopup.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* ─────────────────────────────────────────────
     EVENT LISTENERS
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    /* Open: any element with  data-popup="[id]"  that is a button or
       any ecosystem-card with that attribute (clicking card header area) */
    document.addEventListener('click', function (e) {

      // Explicit trigger buttons
      const triggerBtn = e.target.closest('[data-popup].eco-popup-btn');
      if (triggerBtn) {
        e.stopPropagation();
        openPopup(triggerBtn.getAttribute('data-popup'));
        return;
      }

      // Close button inside popup
      if (e.target.closest('[data-close-popup]')) {
        closePopup();
        return;
      }

      // Clicking the backdrop
      if (e.target === backdrop) {
        closePopup();
      }
    });

    /* Keyboard: Escape closes, Tab traps focus */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && activePopup) {
        closePopup();
      }
      if (e.key === 'Tab' && activePopup) {
        trapFocus(e);
      }
    });

    /* Prevent scroll events inside popup from closing or propagating */
    document.querySelectorAll('.eco-popup').forEach(function (popup) {
      popup.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    });

  }); // end DOMContentLoaded

  /* Expose for any external calls if needed */
  window.ecoPopup = { open: openPopup, close: closePopup };

})();