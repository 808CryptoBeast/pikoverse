/* ═══════════════════════════════════════════════════════════
   culturalverse.js
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Year ── */
  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ═══════════════════════════════════════════════════════
     STARFIELD CANVAS
  ═══════════════════════════════════════════════════════ */
  (function initStarfield() {
    const canvas = document.getElementById('starfield');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, stars = [], raf;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function mkStar() {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.2,
        // Twinkle
        o: Math.random(),
        oSpeed: (Math.random() * 0.008 + 0.002) * (Math.random() < 0.5 ? 1 : -1),
        // Slow drift
        dx: (Math.random() - 0.5) * 0.04,
        dy: (Math.random() - 0.5) * 0.04,
        // Color — mostly white, occasional tints
        hue: Math.random() < 0.15 ? (Math.random() < 0.5 ? 145 : 35) : 0,
        sat: Math.random() < 0.15 ? 60 : 0
      };
    }

    function buildStars(n) {
      stars = [];
      for (let i = 0; i < n; i++) stars.push(mkStar());
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        // Twinkle
        s.o += s.oSpeed;
        if (s.o > 1)  { s.o = 1;  s.oSpeed = -s.oSpeed; }
        if (s.o < 0.1){ s.o = 0.1; s.oSpeed = -s.oSpeed; }

        // Drift
        s.x += s.dx; s.y += s.dy;
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = H; if (s.y > H) s.y = 0;

        // Glow for brighter stars
        if (s.r > 1.1) {
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
          const color = s.sat > 0
            ? `hsla(${s.hue},${s.sat}%,75%,`
            : 'rgba(230,235,255,';
          g.addColorStop(0,   color + (s.o * 0.5) + ')');
          g.addColorStop(1,   color + '0)');
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }

        // Star dot
        const col = s.sat > 0
          ? `hsla(${s.hue},${s.sat}%,85%,${s.o})`
          : `rgba(220,228,255,${s.o})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    function init() {
      resize();
      buildStars(280);
      if (raf) cancelAnimationFrame(raf);
      draw();
    }

    window.addEventListener('resize', () => { resize(); buildStars(280); });
    init();
  })();

  /* ═══════════════════════════════════════════════════════
     READING PROGRESS BAR
  ═══════════════════════════════════════════════════════ */
  const progressFill = document.getElementById('progressFill');
  window.addEventListener('scroll', () => {
    if (!progressFill) return;
    const doc = document.documentElement;
    const scrollTop    = doc.scrollTop || document.body.scrollTop;
    const scrollHeight = doc.scrollHeight - doc.clientHeight;
    progressFill.style.width = (scrollHeight > 0 ? scrollTop / scrollHeight * 100 : 0) + '%';
  }, { passive: true });

  /* ═══════════════════════════════════════════════════════
     MOBILE NAV TOGGLE
  ═══════════════════════════════════════════════════════ */
  const mobileBtn  = document.getElementById('cvMobileToggle');
  const navLinks   = document.getElementById('cvNavLinks');

  if (mobileBtn && navLinks) {
    mobileBtn.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      mobileBtn.classList.toggle('is-open', open);
      mobileBtn.setAttribute('aria-expanded', open);
    });
    // Close on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.cv-nav__links') && !e.target.closest('#cvMobileToggle')) {
        navLinks.classList.remove('is-open');
        mobileBtn.classList.remove('is-open');
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     PROFILE PANEL
  ═══════════════════════════════════════════════════════ */
  const profileToggle = document.getElementById('cvProfileToggle');
  const profilePanel  = document.getElementById('cvProfile');
  const profileBg     = document.getElementById('cvProfileBg');
  const profileClose  = document.getElementById('cvProfileClose');

  function openProfile() {
    profilePanel?.classList.add('is-open');
    profileBg?.classList.add('is-open');
    profilePanel?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeProfile() {
    profilePanel?.classList.remove('is-open');
    profileBg?.classList.remove('is-open');
    profilePanel?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  profileToggle?.addEventListener('click', () => {
    profilePanel?.classList.contains('is-open') ? closeProfile() : openProfile();
  });
  profileClose?.addEventListener('click', closeProfile);
  profileBg?.addEventListener('click', closeProfile);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProfile(); });

  /* ═══════════════════════════════════════════════════════
     SCROLL REVEAL
  ═══════════════════════════════════════════════════════ */
  if ('IntersectionObserver' in window) {
    const targets = document.querySelectorAll(
      '.cv-culture-card, .cv-eco-card, .cv-stat, .cv-soon-card, .cv-about__text, .cv-about__stats'
    );
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('is-visible'), (i % 4) * 80);
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.06 });
    targets.forEach(t => obs.observe(t));
  } else {
    document.querySelectorAll(
      '.cv-culture-card, .cv-eco-card, .cv-stat, .cv-soon-card, .cv-about__text, .cv-about__stats'
    ).forEach(el => el.classList.add('is-visible'));
  }

  /* ═══════════════════════════════════════════════════════
     NAV ACTIVE HIGHLIGHT ON SCROLL
  ═══════════════════════════════════════════════════════ */
  const sections = document.querySelectorAll('section[id]');
  const navBtns  = document.querySelectorAll('.cv-nav__btn');

  if (sections.length && 'IntersectionObserver' in window) {
    const sObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navBtns.forEach(b => b.style.color = '');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => sObs.observe(s));
  }

  /* ═══════════════════════════════════════════════════════
     SMOOTH SCROLL for anchor links
  ═══════════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Close mobile nav if open
        navLinks?.classList.remove('is-open');
        mobileBtn?.classList.remove('is-open');
      }
    });
  });

})();

/* ═══════════════════════════════════════════════════════
   LIVING KNOWLEDGE MATRIX POPUP
═══════════════════════════════════════════════════════ */
(function initMatrixPopup() {
  const popup  = document.getElementById('cvMatrixPopup');
  const bg     = document.getElementById('cvMatrixPopupBg');
  const closeA = document.getElementById('cvMatrixPopupClose');
  const closeB = document.getElementById('cvMatrixPopupCloseBtn');

  if (!popup || !bg) return;

  function openMatrixPopup(e) {
    if (e) e.preventDefault();
    popup.classList.add('is-open');
    bg.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMatrixPopup() {
    popup.classList.remove('is-open');
    bg.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  [
    'cvMatrixPopupOpen',
    'cvMatrixPopupOpenNav',
    'cvMatrixPopupOpenHero',
    'cvMatrixPopupOpenTop',
    'cvMatrixPopupOpenProfile',
    'cvMatrixPopupOpenKanaka',
    'cvMatrixPopupOpenSection',
    'cvMatrixPopupOpenFooter'
  ].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', openMatrixPopup);
  });

  if (closeA) closeA.addEventListener('click', closeMatrixPopup);
  if (closeB) closeB.addEventListener('click', closeMatrixPopup);
  bg.addEventListener('click', closeMatrixPopup);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMatrixPopup();
  });
})();