/* ═══════════════════════════════════════════════════════
   DigitalVerse — main.js
   Handles: year, lesson toggles, scroll-to, progress bar,
            entrance animations
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Current year in footer ── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ─────────────────────────────────────────────
     LESSON TOGGLE
     Opens/closes a lesson accordion item by id.
  ───────────────────────────────────────────── */
  window.toggleLesson = function (id) {
    const item = document.getElementById(id);
    if (!item) return;
    item.classList.toggle('open');
  };

  /* ─────────────────────────────────────────────
     SCROLL TO SECTION
     Smooth-scrolls to any element by id.
  ───────────────────────────────────────────── */
  window.scrollToId = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ─────────────────────────────────────────────
     READING PROGRESS BAR
     Updates the fill width based on scroll position.
  ───────────────────────────────────────────── */
  const progressFill = document.getElementById('progressFill');

  function updateProgress() {
    if (!progressFill) return;
    const doc          = document.documentElement;
    const scrollTop    = doc.scrollTop || document.body.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    const pct          = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    progressFill.style.width = pct + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });

  /* ─────────────────────────────────────────────
     ENTRANCE ANIMATIONS
     Cards and lesson modules fade + slide in on
     first intersection with the viewport.
  ───────────────────────────────────────────── */
  function initEntranceAnimations() {
    const targets = document.querySelectorAll(
      '.card, .lesson-module, .ct-card, .glossary-item'
    );

    if (!('IntersectionObserver' in window)) {
      // Fallback: just show everything
      targets.forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    targets.forEach((el) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  }

  /* ─────────────────────────────────────────────
     NAV ACTIVE STATE
     Highlights the current nav link based on
     which section is visible in the viewport.
  ───────────────────────────────────────────── */
  function initNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__links a[href^="#"]');

    if (!sections.length || !navLinks.length) return;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              link.classList.toggle(
                'nav-active',
                link.getAttribute('href') === '#' + id
              );
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );

    sections.forEach((section) => sectionObserver.observe(section));
  }

  /* ─────────────────────────────────────────────
     INIT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initEntranceAnimations();
    initNavHighlight();
  });

})();