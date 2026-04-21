/* ═══════════════════════════════════════════════════════════════════
   culturalverse-lessons.js
   Rendering engine — reads CULTURALVERSE_DATA, builds everything.
   No content lives here. All content is in culturalverse-data.js

   Supabase integration:
   On init, attempts to fetch from cv_lessons table and merges any
   DB content into CULTURALVERSE_DATA in memory before rendering.
   Falls back to static file seamlessly if Supabase is unavailable.
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── State ── */
  const state = {
    activeCultureId:  null,
    activeModuleId:   null,
    activeLessonId:   null,
    filterCulture:    'all',
    completed:        JSON.parse(localStorage.getItem('cv_completed') || '[]'),
    mana:             parseInt(localStorage.getItem('cv_mana') || '0'),
    dbLoaded:         false,   // true once Supabase fetch has run (success or fail)
  };

  /* ── DOM refs ── */
  const lessonTree    = document.getElementById('lessonTree');
  const lessonWelcome = document.getElementById('lessonWelcome');
  const lessonArticle = document.getElementById('lessonArticle');
  const lessonHeader  = document.getElementById('lessonHeader');
  const lessonBody    = document.getElementById('lessonBody');
  const lessonNav     = document.getElementById('lessonNav');
  const filterWrap    = document.getElementById('cultureFilters');
  const welcomeCults  = document.getElementById('welcomeCultures');
  const sidebarFab    = document.getElementById('cvSidebarFab');
  const sidebar       = document.getElementById('cvSidebar');
  const completedCnt  = document.getElementById('completedCount');
  const manaDisplay   = document.getElementById('manaDisplay');
  const manaFill      = document.getElementById('manaFill');

  /* ═══════════════════════════════════════════════════════════════
     LOCAL ADMIN MERGE
     Merges any lessons saved locally from the admin panel
     (localStorage key: cv_admin_lessons) into CULTURALVERSE_DATA.
     This runs first — Supabase merge runs after and overrides if it
     has newer/fuller content.
  ═══════════════════════════════════════════════════════════════ */
  function mergeLocalAdminLessons() {
    try {
      const saved = JSON.parse(localStorage.getItem('cv_admin_lessons') || '{}');
      if (!Object.keys(saved).length) return;

      for (const [id, row] of Object.entries(saved)) {
        if (row.status === 'draft') continue; // skip drafts — only live lessons show
        if (!row.content && !row.title) continue;

        // Find the lesson in CULTURALVERSE_DATA
        let found = false;
        for (const culture of CULTURALVERSE_DATA.cultures) {
          for (const mod of culture.modules || []) {
            const lesson = (mod.lessons || []).find(l => l.id === id);
            if (lesson) {
              if (row.title)    lesson.title    = row.title;
              if (row.num)      lesson.num      = row.num;
              if (row.readTime) lesson.readTime = row.readTime;
              if (row.content) {
                const leadBlock = row.lead ? `<p class="lead">${row.lead}</p>\n\n` : '';
                lesson.content  = leadBlock + row.content;
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }

        // New lesson not in static data — add it
        if (!found && row.content && row.module) {
          const culture = CULTURALVERSE_DATA.cultures.find(c => c.id === row.module);
          if (culture && culture.modules[0]) {
            const leadBlock = row.lead ? `<p class="lead">${row.lead}</p>\n\n` : '';
            culture.modules[0].lessons.push({
              id:       id,
              num:      row.num || '',
              title:    row.title || id,
              readTime: row.readTime || '',
              content:  leadBlock + row.content,
            });
          }
        }
      }

      const count = Object.keys(saved).length;
      console.info(`[Culturalverse] Merged ${count} local admin lesson(s) from localStorage`);
    } catch (e) {
      console.warn('[Culturalverse] Local admin merge failed:', e.message);
    }
  }
  /* ═══════════════════════════════════════════════════════════════
     SUPABASE MERGE
     Fetches live lessons from cv_lessons table and merges content
     into the in-memory CULTURALVERSE_DATA before rendering.
     Runs once. If it fails, static data is used as-is.
  ═══════════════════════════════════════════════════════════════ */
  async function mergeSupabaseLessons(supa) {
    try {
      const { data, error } = await supa
        .from('cv_lessons')
        .select('id, module, lesson_num, title, read_time, lead_text, content, sources, mana, sort_order, status')
        .eq('status', 'live')
        .order('module')
        .order('sort_order');

      if (error || !data?.length) return;

      // Build a quick lookup map by lesson id
      const dbMap = {};
      data.forEach(row => { dbMap[row.id] = row; });

      // Walk CULTURALVERSE_DATA and overlay DB fields where they exist
      for (const culture of CULTURALVERSE_DATA.cultures) {
        for (const mod of culture.modules || []) {
          for (const lesson of mod.lessons || []) {
            const db = dbMap[lesson.id];
            if (!db) continue;

            // Override fields that exist in DB (DB is source of truth)
            if (db.title)     lesson.title    = db.title;
            if (db.lesson_num)lesson.num      = db.lesson_num;
            if (db.read_time) lesson.readTime = db.read_time;

            // Merge content: if DB has a lead_text, prepend it as the lead paragraph
            if (db.content) {
              const leadBlock = db.lead_text
                ? `<p class="lead">${db.lead_text}</p>\n\n`
                : '';
              lesson.content = leadBlock + db.content;
            }
          }
        }
      }

      // Also handle lessons that exist in DB but NOT in static data
      // (new lessons added via admin panel)
      data.forEach(row => {
        if (!row.content) return; // skip metadata-only rows
        const culture = CULTURALVERSE_DATA.cultures.find(c => c.id === row.module);
        if (!culture || culture.status !== 'live') return;

        // Check if this lesson already exists in any module
        let found = false;
        for (const mod of culture.modules) {
          if (mod.lessons.find(l => l.id === row.id)) { found = true; break; }
        }
        if (found) return;

        // New lesson — add to the first module of the culture for now
        // Admin should set module_id properly; fallback to first module
        const targetMod = culture.modules[0];
        if (!targetMod) return;

        const leadBlock = row.lead_text ? `<p class="lead">${row.lead_text}</p>\n\n` : '';
        targetMod.lessons.push({
          id:       row.id,
          num:      row.lesson_num || '',
          title:    row.title,
          readTime: row.read_time || '',
          content:  leadBlock + (row.content || ''),
        });
      });

      console.info(`[Culturalverse] Merged ${data.length} lesson(s) from Supabase`);

    } catch (err) {
      // Supabase unavailable or table doesn't exist — static data used as-is
      console.info('[Culturalverse] Supabase not available, using static data:', err.message);
    }
  }

  /* ─────────────────────────────────────────────
     FLAT LESSON LIST (for prev/next navigation)
  ───────────────────────────────────────────── */
  function getFlatLessons(filterCulture) {
    const flat = [];
    for (const culture of CULTURALVERSE_DATA.cultures) {
      if (culture.status !== 'live') continue;
      if (filterCulture !== 'all' && culture.id !== filterCulture) continue;
      for (const mod of culture.modules) {
        for (const lesson of mod.lessons) {
          flat.push({ cultureId: culture.id, moduleId: mod.id, lessonId: lesson.id, lesson, culture, mod });
        }
      }
    }
    return flat;
  }

  /* ─────────────────────────────────────────────
     CONTENT PARSER
     Converts tagged content strings → HTML
  ───────────────────────────────────────────── */
  function parseContent(raw) {
    let html = raw.trim();

    /* <facts>val::key | val::key</facts> */
    html = html.replace(/<facts>([\s\S]*?)<\/facts>/g, (_, inner) => {
      const items = inner.split('|').map(s => s.trim()).filter(Boolean);
      const cells = items.map(item => {
        const [val, key] = item.split('::').map(s => s.trim());
        return `<div class="cv-fact-item"><span class="cv-fact-item__val">${val}</span><span class="cv-fact-item__key">${key || ''}</span></div>`;
      }).join('');
      return `<div class="cv-facts-block">${cells}</div>`;
    });

    /* <callout type="gold">...</callout> */
    html = html.replace(/<callout type="(\w+)">([\s\S]*?)<\/callout>/g, (_, type, inner) =>
      `<div class="cv-callout-box ${type}">${inner.trim()}</div>`
    );

    /* <callout>...</callout> (default emerald) */
    html = html.replace(/<callout>([\s\S]*?)<\/callout>/g, (_, inner) =>
      `<div class="cv-callout-box emerald">${inner.trim()}</div>`
    );

    /* <twocol left="L" right="R">left text || right text</twocol> */
    html = html.replace(/<twocol left="([^"]*)" right="([^"]*)">([\s\S]*?)<\/twocol>/g, (_, left, right, inner) => {
      const [leftText, rightText] = inner.split('||');
      return `<div class="cv-twocol">
        <div class="cv-twocol__col"><span class="cv-twocol__label">${left}</span><p>${(leftText||'').trim()}</p></div>
        <div class="cv-twocol__col"><span class="cv-twocol__label">${right}</span><p>${(rightText||'').trim()}</p></div>
      </div>`;
    });

    /* <quote cite="Source">Text</quote> */
    html = html.replace(/<quote cite="([^"]*)">([\s\S]*?)<\/quote>/g, (_, cite, text) =>
      `<div class="cv-quote-block"><blockquote>${text.trim()}</blockquote><cite>— ${cite}</cite></div>`
    );

    /* <concepts>A · B · C</concepts> */
    html = html.replace(/<concepts>([\s\S]*?)<\/concepts>/g, (_, inner) => {
      const tags = inner.split('·').map(s => s.trim()).filter(Boolean)
        .map(t => `<span class="cv-concept-tag">${t}</span>`).join('');
      return `<div class="cv-concepts-block">${tags}</div>`;
    });

    /* Pass-through plant grid and card grid HTML (from admin panel) */
    /* These are already valid HTML — parseContent doesn't need to touch them */

    /* Wrap orphan <p> lead class */
    html = html.replace(/<p class="lead">/g, '<p class="lead">');

    return html;
  }

  /* ─────────────────────────────────────────────
     BUILD SIDEBAR FILTERS
  ───────────────────────────────────────────── */
  function buildFilters() {
    if (!filterWrap) return;
    const chips = [{ id: 'all', label: 'All', emoji: '✦' }];
    for (const c of CULTURALVERSE_DATA.cultures) {
      if (c.status === 'live') chips.push({ id: c.id, label: c.name, emoji: c.emoji });
    }
    filterWrap.innerHTML = chips.map(c =>
      `<button class="cv-filter-chip ${state.filterCulture === c.id ? 'is-active' : ''}"
         data-culture="${c.id}">${c.emoji} ${c.label}</button>`
    ).join('');

    filterWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-culture]');
      if (!btn) return;
      state.filterCulture = btn.dataset.culture;
      buildFilters();
      buildTree();
    });
  }

  /* ─────────────────────────────────────────────
     BUILD SIDEBAR TREE
  ───────────────────────────────────────────── */
  function buildTree() {
    if (!lessonTree) return;
    lessonTree.innerHTML = '';

    for (const culture of CULTURALVERSE_DATA.cultures) {
      if (state.filterCulture !== 'all' && culture.id !== state.filterCulture) continue;

      const cultureEl = document.createElement('div');
      cultureEl.className = `cv-tree-culture ${culture.status === 'live' ? '' : 'cv-tree-culture--soon'}`;
      cultureEl.dataset.theme = culture.theme || 'emerald';
      cultureEl.dataset.id    = culture.id;

      if (culture.status !== 'live') {
        cultureEl.innerHTML = `<div class="cv-tree-coming">
          <span>${culture.emoji}</span> ${culture.name}
          <span class="cv-tree-coming__badge">Soon</span>
        </div>`;
        lessonTree.appendChild(cultureEl);
        continue;
      }

      const isOpenC = state.activeCultureId === culture.id;
      cultureEl.classList.toggle('is-open', isOpenC);

      cultureEl.innerHTML = `
        <button class="cv-tree-culture__header ${isOpenC ? 'is-active' : ''}">
          <span>${culture.emoji}</span>
          <span>${culture.name}</span>
          <span class="cv-tree-culture__caret">▾</span>
        </button>
        <div class="cv-tree-modules">
          ${culture.modules.map(mod => buildModuleHTML(culture, mod)).join('')}
        </div>`;

      /* Toggle culture open/close */
      cultureEl.querySelector('.cv-tree-culture__header').addEventListener('click', () => {
        const wasOpen = cultureEl.classList.contains('is-open');
        cultureEl.classList.toggle('is-open', !wasOpen);
        if (!wasOpen) state.activeCultureId = culture.id;
      });

      /* Wire module toggles */
      cultureEl.querySelectorAll('.cv-tree-module__header').forEach(btn => {
        btn.addEventListener('click', () => {
          const modEl = btn.closest('.cv-tree-module');
          modEl.classList.toggle('is-open');
        });
      });

      /* Wire lesson clicks */
      cultureEl.querySelectorAll('.cv-tree-lesson').forEach(btn => {
        btn.addEventListener('click', () => {
          loadLesson(culture.id, btn.dataset.moduleId, btn.dataset.lessonId);
          if (window.innerWidth <= 900) closeSidebar();
        });
      });

      lessonTree.appendChild(cultureEl);
    }
  }

  function buildModuleHTML(culture, mod) {
    const isOpenM = state.activeModuleId === mod.id;
    const lessons = mod.lessons.map(lesson => {
      const done   = state.completed.includes(lesson.id);
      const active = state.activeLessonId === lesson.id;
      return `<button class="cv-tree-lesson ${active ? 'is-active' : ''} ${done ? 'is-complete' : ''}"
        data-module-id="${mod.id}" data-lesson-id="${lesson.id}">
        <span class="cv-tree-lesson__num">${lesson.num}</span>
        <span class="cv-tree-lesson__title">${lesson.title}</span>
        <span class="cv-tree-lesson__check">${done ? '✓' : ''}</span>
      </button>`;
    }).join('');

    return `<div class="cv-tree-module ${isOpenM ? 'is-open' : ''}" data-id="${mod.id}">
      <button class="cv-tree-module__header">
        <span>${mod.emoji}</span>
        <span>${mod.title}</span>
        <span class="cv-tree-module__caret">▾</span>
      </button>
      <div class="cv-tree-lessons">${lessons}</div>
    </div>`;
  }

  /* ─────────────────────────────────────────────
     BUILD WELCOME SCREEN
  ───────────────────────────────────────────── */
  function buildWelcome() {
    if (!welcomeCults) return;
    welcomeCults.innerHTML = CULTURALVERSE_DATA.cultures
      .filter(c => c.status === 'live')
      .map(c => {
        const first = c.modules[0]?.lessons[0];
        return `<button class="cv-welcome-culture-btn" data-culture="${c.id}"
          data-module="${c.modules[0]?.id}" data-lesson="${first?.id}">
          <span>${c.emoji}</span> ${c.name}
        </button>`;
      }).join('');

    welcomeCults.addEventListener('click', e => {
      const btn = e.target.closest('[data-culture]');
      if (!btn || !btn.dataset.lesson) return;
      loadLesson(btn.dataset.culture, btn.dataset.module, btn.dataset.lesson);
    });
  }

  /* ─────────────────────────────────────────────
     LOAD A LESSON
  ───────────────────────────────────────────── */
  function loadLesson(cultureId, moduleId, lessonId) {
    const culture = CULTURALVERSE_DATA.cultures.find(c => c.id === cultureId);
    if (!culture) return;
    const mod = culture.modules.find(m => m.id === moduleId);
    if (!mod) return;
    const lesson = mod.lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    state.activeCultureId = cultureId;
    state.activeModuleId  = moduleId;
    state.activeLessonId  = lessonId;

    /* Rebuild tree to reflect active state */
    buildTree();

    /* Show article */
    lessonWelcome.hidden = true;
    lessonArticle.hidden = false;

    /* Build header */
    const theme  = culture.theme || 'emerald';
    const isDone = state.completed.includes(lessonId);

    lessonHeader.innerHTML = `
      <span class="cv-lesson-article__badge cv-lesson-article__badge--${theme}">
        ${culture.emoji} ${culture.name} · ${mod.title}
      </span>
      <span class="cv-lesson-article__num">${lesson.num}</span>
      <h1 class="cv-lesson-article__title">${lesson.title}</h1>
      <div class="cv-lesson-article__meta">
        <span class="cv-lesson-article__readtime">⏱ ${lesson.readTime}</span>
        <button class="cv-lesson-article__complete-btn ${isDone ? 'is-done' : ''}"
          id="completeBtn" data-lesson="${lessonId}">
          ${isDone ? '✓ Completed' : '○ Mark Complete'}
        </button>
      </div>`;

    document.getElementById('completeBtn')?.addEventListener('click', toggleComplete);

    /* Build body */
    lessonBody.innerHTML = `<div class="cv-lesson-content theme-${theme}">${parseContent(lesson.content)}</div>`;

    /* Build prev/next nav */
    const flat = getFlatLessons('all');
    const idx  = flat.findIndex(f => f.lessonId === lessonId);
    const prev = flat[idx - 1];
    const next = flat[idx + 1];

    lessonNav.innerHTML = `
      ${prev ? `<button class="cv-lesson-nav-btn" data-culture="${prev.cultureId}" data-module="${prev.moduleId}" data-lesson="${prev.lessonId}">
        <i class="fas fa-chevron-left"></i>
        <div><span class="cv-lesson-nav-btn__label">Previous</span>
        <span class="cv-lesson-nav-btn__title">${prev.lesson.title}</span></div>
      </button>` : '<div></div>'}
      ${next ? `<button class="cv-lesson-nav-btn cv-lesson-nav-btn--next" data-culture="${next.cultureId}" data-module="${next.moduleId}" data-lesson="${next.lessonId}">
        <div><span class="cv-lesson-nav-btn__label">Next</span>
        <span class="cv-lesson-nav-btn__title">${next.lesson.title}</span></div>
        <i class="fas fa-chevron-right"></i>
      </button>` : '<div></div>'}`;

    lessonNav.querySelectorAll('[data-lesson]').forEach(btn => {
      btn.addEventListener('click', () => loadLesson(btn.dataset.culture, btn.dataset.module, btn.dataset.lesson));
    });

    /* Scroll to top of content */
    document.querySelector('.cv-lesson-main')?.scrollTo({ top: 0, behavior: 'smooth' });

    /* Update URL hash for bookmarking */
    window.location.hash = `#${lessonId}`;

    /* Dispatch event for culturalverse-profile.js */
    document.dispatchEvent(new CustomEvent('cv:lessonToggle', {
      detail: { lessonId, completed: state.completed, mana: state.mana }
    }));

    updateProfileStats();
  }

  /* ─────────────────────────────────────────────
     MARK COMPLETE
  ───────────────────────────────────────────── */
  function toggleComplete(e) {
    const lessonId = e.target.dataset.lesson;
    const btn = e.target;
    const alreadyDone = state.completed.includes(lessonId);

    if (alreadyDone) {
      state.completed = state.completed.filter(id => id !== lessonId);
      state.mana = Math.max(0, state.mana - 10);
      btn.classList.remove('is-done');
      btn.textContent = '○ Mark Complete';
    } else {
      state.completed.push(lessonId);
      state.mana = Math.min(state.mana + 10, 999);
      btn.classList.add('is-done');
      btn.textContent = '✓ Completed';
      btn.animate([{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}], {duration:300});
    }

    localStorage.setItem('cv_completed', JSON.stringify(state.completed));
    localStorage.setItem('cv_mana', state.mana.toString());

    /* Notify profile.js of completion change */
    document.dispatchEvent(new CustomEvent('cv:lessonToggle', {
      detail: { lessonId, completed: state.completed, mana: state.mana }
    }));

    buildTree();
    updateProfileStats();
  }

  /* ─────────────────────────────────────────────
     PROFILE STATS
  ───────────────────────────────────────────── */
  function updateProfileStats() {
    if (completedCnt) completedCnt.textContent = state.completed.length;
    const pct = Math.min((state.mana % 100) || (state.mana > 0 ? 100 : 0), 100);
    if (manaDisplay) manaDisplay.textContent = `${state.mana} Mana`;
    if (manaFill)    manaFill.style.width = pct + '%';
  }

  /* ─────────────────────────────────────────────
     MOBILE SIDEBAR TOGGLE
  ───────────────────────────────────────────── */
  function openSidebar()  { sidebar?.classList.add('is-open'); }
  function closeSidebar() { sidebar?.classList.remove('is-open'); }

  sidebarFab?.addEventListener('click', () => {
    sidebar?.classList.contains('is-open') ? closeSidebar() : openSidebar();
  });

  document.addEventListener('click', e => {
    if (window.innerWidth <= 900 &&
        !e.target.closest('#cvSidebar') &&
        !e.target.closest('#cvSidebarFab')) {
      closeSidebar();
    }
  });

  /* ─────────────────────────────────────────────
     HASH ROUTING — restore lesson from URL
  ───────────────────────────────────────────── */
  function routeFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    for (const culture of CULTURALVERSE_DATA.cultures) {
      for (const mod of culture.modules) {
        const lesson = mod.lessons.find(l => l.id === hash);
        if (lesson) {
          loadLesson(culture.id, mod.id, lesson.id);
          return;
        }
      }
    }
  }

  /* ─────────────────────────────────────────────
     INIT — with Supabase merge
  ───────────────────────────────────────────── */
  function initRender() {
    mergeLocalAdminLessons(); // apply any locally-saved admin edits first
    buildFilters();
    buildTree();
    buildWelcome();
    updateProfileStats();
    routeFromHash();

    if (!state.activeLessonId) {
      const first = CULTURALVERSE_DATA.cultures.find(c => c.status === 'live');
      if (first) {
        state.activeCultureId = first.id;
        state.activeModuleId  = first.modules[0]?.id;
        buildTree();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Try to get or initialize Supabase directly
    let supa = window.piko_supa;

    if (!supa && typeof supabase !== 'undefined') {
      try {
        const SUPA_URL = 'https://fmrjdvsqdfyaqtzwbbqi.supabase.co';
        const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcmpkdnNxZGZ5YXF0endiYnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTE2MzYsImV4cCI6MjA5MTE2NzYzNn0.UKyvX02bG4cNhb7U2TK96t8XFREHYYwHJIKbPK06nqs';
        window.piko_supa = supabase.createClient(SUPA_URL, SUPA_KEY);
        supa = window.piko_supa;
      } catch (e) {
        console.warn('[Culturalverse] Supabase init failed:', e.message);
      }
    }

    if (supa) {
      // Supabase ready — merge DB content then render
      await mergeSupabaseLessons(supa).catch(() => {});
    } else {
      // No Supabase — listen briefly then fall back to static
      await new Promise(resolve => {
        let done = false;
        const onReady = async (e) => {
          if (done) return; done = true;
          const sb = e.detail?.offline ? null : window.piko_supa;
          if (sb) await mergeSupabaseLessons(sb).catch(() => {});
          resolve();
        };
        window.addEventListener('piko:supa:ready', onReady, { once: true });
        setTimeout(() => { if (!done) { done = true; resolve(); } }, 1500);
      });
    }

    initRender();
  });

  window.addEventListener('hashchange', routeFromHash);

})();