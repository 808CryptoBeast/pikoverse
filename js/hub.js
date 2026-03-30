/* ============================================================
   PIKOVERSE HUB — hub.js
   Place in: js/hub.js
   Add to index.html: <script src="js/hub.js" defer></script>
   ============================================================ */

'use strict';

(function () {

  /* ─────────────────────────────────────────────
     STORAGE — same prefix convention as admin.js
  ───────────────────────────────────────────── */
  var IDEA_KEY       = 'amp_admin_ideas';        // community ideas
  var SUGG_KEY       = 'amp_admin_suggestions';  // marketplace suggestions (read-only here)
  var PROJ_KEY       = 'amp_admin_projects_hub';   // community project submissions

  function loadIdeas() {
    try {
      var raw = localStorage.getItem(IDEA_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveIdeas(ideas) {
    try { localStorage.setItem(IDEA_KEY, JSON.stringify(ideas)); } catch (e) {}
  }

  function loadSuggestions() {
    try {
      var raw = localStorage.getItem(SUGG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /* ─────────────────────────────────────────────
     XSS sanitise
  ───────────────────────────────────────────── */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ─────────────────────────────────────────────
     DATES
  ───────────────────────────────────────────── */
  function timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /* ─────────────────────────────────────────────
     1. DOCK — highlight active section on scroll
  ───────────────────────────────────────────── */
  function initDock() {
    var nodes = document.querySelectorAll('.dock-node[data-section]');
    if (!nodes.length) return;

    var sections = [];
    nodes.forEach(function (node) {
      var id = node.dataset.section;
      var el = document.getElementById(id);
      if (el) sections.push({ node: node, el: el });
    });

    function onScroll() {
      var scrollY = window.scrollY + 120;
      var active = null;
      sections.forEach(function (s) {
        if (s.el.offsetTop <= scrollY) active = s;
      });
      nodes.forEach(function (n) { n.classList.remove('is-active'); });
      if (active) active.node.classList.add('is-active');
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ─────────────────────────────────────────────
     2. COMMUNITY IDEAS WALL
  ───────────────────────────────────────────── */
  function categoryClass(cat) {
    var map = { platform: 'platform', feature: 'feature', content: 'content' };
    return map[cat] || 'other';
  }

  function renderIdeaCard(idea) {
    var catClass = 'piko-idea-category--' + categoryClass(idea.category);
    var catLabel = idea.category
      ? idea.category.charAt(0).toUpperCase() + idea.category.slice(1)
      : 'Other';
    var authorInitial = idea.name ? idea.name[0].toUpperCase() : '?';
    var authorName    = idea.name ? esc(idea.name) : 'Anonymous';

    var replyHtml = '';
    if (idea.reply) {
      replyHtml = '<div class="piko-idea-reply">' +
        '<div class="piko-idea-reply-label"><i class="fas fa-star"></i> AMP Team</div>' +
        '<div class="piko-idea-reply-text">' + esc(idea.reply) + '</div>' +
        '</div>';
    }

    return '<div class="piko-idea-card" data-id="' + esc(idea.id) + '">' +
      '<div class="piko-idea-header">' +
        '<span class="piko-idea-category ' + catClass + '">' + esc(catLabel) + '</span>' +
        '<span class="piko-idea-date">' + fmtDate(idea.ts) + '</span>' +
      '</div>' +
      '<p class="piko-idea-text">' + esc(idea.text) + '</p>' +
      '<div class="piko-idea-footer">' +
        '<div class="piko-idea-author">' +
          '<div class="piko-idea-author-avatar">' + esc(authorInitial) + '</div>' +
          authorName +
        '</div>' +
      '</div>' +
      replyHtml +
    '</div>';
  }

      /* ─────────────────────────────────────────────
     3. LIVE PULSE FEED
  ───────────────────────────────────────────── */
  function buildPulseItems() {
    var items = [];

    // Ideas (newest 5)
    loadIdeas()
      .filter(function (i) { return !i.dismissed; })
      .sort(function (a, b) { return b.ts - a.ts; })
      .slice(0, 5)
      .forEach(function (i) {
        items.push({
          type: 'idea',
          text: i.text,
          name: i.name || 'Anonymous',
          ts: i.ts,
        });
      });

    // Marketplace suggestions (newest 5, only reviewed ones)
    loadSuggestions()
      .filter(function (s) { return s.status === 'reviewed' || s.reply; })
      .sort(function (a, b) { return b.ts - a.ts; })
      .slice(0, 5)
      .forEach(function (s) {
        items.push({
          type: 'suggestion',
          text: s.text,
          name: s.name || 'Anonymous',
          ts: s.ts,
        });
      });

    // Sort all by time
    items.sort(function (a, b) { return b.ts - a.ts; });
    return items.slice(0, 8);
  }

  function renderPulseItem(item) {
    var icon = item.type === 'idea' ? '💡' : '🛍️';
    var typeClass = 'piko-pulse-type--' + item.type;
    var label = item.type === 'idea' ? 'New idea' : 'Store suggestion';

    return '<div class="piko-pulse-item">' +
      '<div class="piko-pulse-type ' + typeClass + '">' + icon + '</div>' +
      '<div class="piko-pulse-content">' +
        '<div class="piko-pulse-text">' + esc(item.text) + '</div>' +
        '<div class="piko-pulse-meta">' + label + ' · ' + timeAgo(item.ts) + '</div>' +
      '</div>' +
    '</div>';
  }

  function refreshPulse() {
    var list  = document.getElementById('pikoPulseList');
    var empty = document.getElementById('pikoPulseEmpty');
    if (!list) return;

    var items = buildPulseItems();
    if (items.length === 0) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      list.innerHTML = items.map(renderPulseItem).join('');
    }
  }

  function initPulse() {
    var toggle    = document.getElementById('pikoPulseToggle');
    var panel     = document.getElementById('pikoPulsePanel');
    var refreshBtn = document.getElementById('pikoPulseRefresh');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
      if (open) refreshPulse();
    });

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        refreshBtn.style.transform = 'rotate(360deg)';
        refreshBtn.style.transition = 'transform .4s ease';
        refreshPulse();
        setTimeout(function () {
          refreshBtn.style.transform = '';
          refreshBtn.style.transition = '';
        }, 400);
      });
    }

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#pikoPulseToggle') && !e.target.closest('#pikoPulsePanel')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Auto refresh every 30s
    setInterval(function () {
      if (panel.classList.contains('is-open')) refreshPulse();
    }, 30000);
  }

  /* ─────────────────────────────────────────────
     ADMIN INTEGRATION
     The admin panel can reply to ideas from the
     admin.js Suggestions panel. Ideas are stored
     under IDEA_KEY and share the same shape as
     marketplace suggestions so admin.js can read
     both from one place.

     To hook into admin: in admin.js, after loading
     suggestions with SuggDB.all(), also call:
       var ideas = JSON.parse(localStorage.getItem('amp_admin_ideas') || '[]');
     then merge or show them in the Suggestions panel.
  ───────────────────────────────────────────── */


  /* ─────────────────────────────────────────────
     PROJECT SUBMISSIONS
  ───────────────────────────────────────────── */
  function loadProjects() {
    try {
      var raw = localStorage.getItem(PROJ_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveProjects(projects) {
    try { localStorage.setItem(PROJ_KEY, JSON.stringify(projects)); } catch (e) {}
  }

  // Tag input controller
  function initTagInput(inputId, hiddenId, wrapId) {
    var input  = document.getElementById(inputId);
    var hidden = document.getElementById(hiddenId);
    var wrap   = document.getElementById(wrapId);
    if (!input || !hidden || !wrap) return;

    var tags = [];

    function render() {
      hidden.value = JSON.stringify(tags);
      wrap.innerHTML = tags.map(function(t, i) {
        return '<span class="hub-tag">' + esc(t) +
          '<button class="hub-tag-remove" data-idx="' + i +
          '" type="button" aria-label="Remove ' + esc(t) + '">×</button></span>';
      }).join('');
      // re-bind remove buttons
      wrap.querySelectorAll('.hub-tag-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
          tags.splice(parseInt(btn.dataset.idx), 1);
          render();
        });
      });
    }

    input.addEventListener('keydown', function(e) {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        var t = input.value.trim().replace(/,/g, '');
        if (t && tags.length < 8 && !tags.includes(t)) {
          tags.push(t);
          render();
        }
        input.value = '';
      }
    });
  }

    function stageLabel(stage) {
    return { idea: 'Idea', building: 'Building', live: 'Live' }[stage] || stage;
  }

  function renderProjectCard(p) {
    var stageClass = 'epc-stage--' + (p.stage || 'idea');
    var initial    = p.name ? p.name[0].toUpperCase() : '?';
    var tagsHtml   = (p.tech || []).map(function(t) {
      return '<span class="epc-tag">' + esc(t) + '</span>';
    }).join('');
    var linkHtml = p.link
      ? '<a href="' + esc(p.link) + '" class="epc-link" target="_blank" rel="noopener noreferrer">' +
        '<i class="fas fa-arrow-up-right-from-square"></i> View Project</a>'
      : '';
    var contactHtml = p.contact
      ? '<span><i class="fas fa-envelope"></i> ' + esc(p.contact) + '</span>'
      : '';

    return '<div class="ecosystem-project-card">' +
      '<div class="epc-header">' +
        '<span class="epc-name">' + esc(p.name) + '</span>' +
        '<span class="epc-stage ' + stageClass + '">' + stageLabel(p.stage) + '</span>' +
      '</div>' +
      '<p class="epc-desc">' + esc(p.desc) + '</p>' +
      (tagsHtml ? '<div class="epc-tags">' + tagsHtml + '</div>' : '') +
      '<div class="epc-footer">' +
        '<div class="epc-author">' +
          '<div class="epc-author-avatar">' + esc(initial) + '</div>' +
          (contactHtml || 'Community') +
        '</div>' +
        linkHtml +
      '</div>' +
    '</div>';
  }

    /* ─────────────────────────────────────────────
     COMBINED SUBMIT MODAL
  ───────────────────────────────────────────── */
  function initSubmitModal() {
    var backdrop = document.getElementById('pikoSubmitBackdrop');
    var closeBtn = document.getElementById('pikoModalClose');
    var fab      = document.getElementById('pikoShareFab');
    var inlineBtn = document.getElementById('pikoOpenSubmit');
    if (!backdrop) return;

    function openModal(tab) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (tab) switchTab(tab);
    }
    function closeModal() {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    if (fab)       fab.addEventListener('click', function() { openModal('project'); });
    if (inlineBtn) inlineBtn.addEventListener('click', function() { openModal('project'); });
    if (closeBtn)  closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    // Tabs
    document.querySelectorAll('.piko-modal-tab').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });
    function switchTab(name) {
      document.querySelectorAll('.piko-modal-tab').forEach(function(b) {
        b.classList.toggle('is-active', b.dataset.tab === name);
      });
      document.querySelectorAll('.piko-tab-pane').forEach(function(p) {
        p.classList.toggle('is-active', p.id === 'pikoTab' + name.charAt(0).toUpperCase() + name.slice(1));
      });
    }

    // Idea form
    var ideaForm = document.getElementById('pikoIdeaForm');
    var ideaSuccess = document.getElementById('pikoIdeaSuccess');
    var ideaAgain   = document.getElementById('pikoIdeaAgain');
    if (ideaForm) {
      ideaForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var errEl = document.getElementById('pikoIdeaErr');
        var text  = (document.getElementById('pikoIdeaText')?.value || '').trim();
        if (!text) {
          if (errEl) { errEl.textContent = 'Please write your idea first.'; errEl.hidden = false; }
          return;
        }
        if (errEl) errEl.hidden = true;
        var idea = {
          id: 'idea-' + Date.now(),
          text: text,
          name: (document.getElementById('pikoIdeaName')?.value || '').trim(),
          category: document.getElementById('pikoIdeaCategory')?.value || 'other',
          ts: Date.now(),
          dismissed: false,
          reply: '',
          status: 'pending',
        };
        var ideas = loadIdeas();
        ideas.push(idea);
        saveIdeas(ideas);
        ideaForm.reset();
        ideaForm.hidden = true;
        if (ideaSuccess) ideaSuccess.hidden = false;
        refreshPulse();
      });
    }
    if (ideaAgain) {
      ideaAgain.addEventListener('click', function() {
        if (ideaForm) ideaForm.hidden = false;
        if (ideaSuccess) ideaSuccess.hidden = true;
      });
    }

    // Project form
    var projForm    = document.getElementById('pikoProjectForm');
    var projSuccess = document.getElementById('pikoProjectSuccess');
    var projAgain   = document.getElementById('pikoProjectAgain');
    var stageInput  = document.getElementById('pikoProjectStageValue');

    // Stage pills
    document.querySelectorAll('.hub-stage-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.hub-stage-btn').forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (stageInput) stageInput.value = btn.dataset.stage;
      });
    });
    var firstStage = document.querySelector('.hub-stage-btn');
    if (firstStage) { firstStage.classList.add('is-active'); }

    initTagInput('pikoProjectTechInput', 'pikoProjectTechValue', 'pikoProjectTechTags');

    if (projForm) {
      projForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var errEl = document.getElementById('pikoProjectErr');
        var name  = (document.getElementById('pikoProjectName')?.value || '').trim();
        var desc  = (document.getElementById('pikoProjectDesc')?.value || '').trim();
        if (!name) {
          if (errEl) { errEl.textContent = 'Project name is required.'; errEl.hidden = false; }
          return;
        }
        if (!desc) {
          if (errEl) { errEl.textContent = 'Please add a short description.'; errEl.hidden = false; }
          return;
        }
        if (errEl) errEl.hidden = true;

        var techRaw = document.getElementById('pikoProjectTechValue')?.value || '[]';
        var tech = [];
        try { tech = JSON.parse(techRaw); } catch(e) {}

        var project = {
          id: 'proj-' + Date.now(),
          name: name,
          desc: desc,
          stage: stageInput?.value || 'idea',
          link: (document.getElementById('pikoProjectLink')?.value || '').trim(),
          contact: (document.getElementById('pikoProjectContact')?.value || '').trim(),
          tech: tech,
          ts: Date.now(),
          status: 'pending',
        };
        var projects = loadProjects();
        projects.push(project);
        saveProjects(projects);

        projForm.reset();
        document.querySelectorAll('.hub-stage-btn').forEach(function(b) { b.classList.remove('is-active'); });
        if (firstStage) { firstStage.classList.add('is-active'); if (stageInput) stageInput.value = firstStage.dataset.stage; }
        var tagsWrap = document.getElementById('pikoProjectTechTags');
        if (tagsWrap) tagsWrap.innerHTML = '';
        var techVal = document.getElementById('pikoProjectTechValue');
        if (techVal) techVal.value = '[]';

        projForm.hidden = true;
        if (projSuccess) projSuccess.hidden = false;
        renderShowcaseWall();
        refreshPulse();
      });
    }
    if (projAgain) {
      projAgain.addEventListener('click', function() {
        if (projForm) projForm.hidden = false;
        if (projSuccess) projSuccess.hidden = true;
      });
    }
  }

  /* ─────────────────────────────────────────────
     SHOWCASE WALL (community approved projects)
  ───────────────────────────────────────────── */
  function renderShowcaseWall() {
    var grid    = document.getElementById('pikoShowcaseGrid');
    var empty   = document.getElementById('pikoShowcaseEmpty');
    var countEl = document.getElementById('pikoShowcaseCount');
    if (!grid) return;

    var approved = loadProjects().filter(function(p) { return p.status === 'approved'; });
    approved.sort(function(a, b) { return b.ts - a.ts; });

    if (countEl) countEl.textContent = approved.length;
    if (approved.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
    } else {
      if (empty) empty.hidden = true;
      grid.innerHTML = approved.map(renderProjectCard).join('');
    }
  }

  /* ─────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initDock();
    initSubmitModal();
    renderShowcaseWall();
    initPulse();
  });

})();