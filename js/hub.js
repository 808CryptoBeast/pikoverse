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
  var POST_KEY       = 'amp_community_posts';    // direct community posts
  var ARTICLES_KEY   = 'amp_articles_v1';        // curated articles (written by admin)
  var SUBMISSIONS_KEY= 'amp_submissions_v1';     // user submission tracking by ID
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

  function loadPosts() {
    try { return JSON.parse(localStorage.getItem(POST_KEY) || '[]'); } catch(e) { return []; }
  }
  function savePosts(posts) {
    try { localStorage.setItem(POST_KEY, JSON.stringify(posts)); } catch(e) {}
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

    // Community posts (newest first, highest priority)
    loadPosts()
      .filter(function (p) { return !p.hidden; })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })
      .slice(0, 6)
      .forEach(function (p) {
        items.push({
          type:  'community',
          text:  p.title + (p.body ? ' — ' + p.body.slice(0, 80) + (p.body.length > 80 ? '…' : '') : ''),
          name:  p.name || 'Community Member',
          link:  p.link || null,
          ts:    p.ts || 0,
        });
      });

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
          ts:   i.ts,
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
          ts:   s.ts,
        });
      });

    // Sort all by time, most recent first
    items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return items.slice(0, 12);
  }

  function renderPulseItem(item) {
    var iconMap = { idea: '💡', suggestion: '🛍️', community: '🌺', platform: '🌐', project: '🚀', other: '💬' };
    var icon = iconMap[item.type] || '💬';
    var typeClass = 'piko-pulse-type--' + (item.type === 'community' ? 'other' : item.type);
    var label = item.type === 'idea' ? 'New idea' : 'Store suggestion';

    return '<div class="piko-pulse-item">' +
      '<div class="piko-pulse-type ' + typeClass + '">' + icon + '</div>' +
      '<div class="piko-pulse-content">' +
        '<div class="piko-pulse-text">' + esc(item.text) +
          (item.link ? ' <a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="piko-pulse-link" style="color:rgba(255,210,122,.7);font-size:11px;margin-left:4px"><i class="fas fa-arrow-up-right-from-square"></i></a>' : '') +
          '</div>' +
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
        // Show submission ID for tracking
        var idBox  = document.getElementById('pikoIdeaIdBox');
        var idCode = document.getElementById('pikoIdeaIdCode');
        if (idBox && idCode) { idCode.textContent = idea.id; idBox.hidden = false; }
        refreshPulse();
      });
    }
    if (ideaAgain) {
      ideaAgain.addEventListener('click', function() {
        if (ideaForm) ideaForm.hidden = false;
        if (ideaSuccess) ideaSuccess.hidden = true;
      });
    }

    // Community Post form
    var postForm    = document.getElementById('pikoPostForm');
    var postSuccess = document.getElementById('pikoPostSuccess');
    var postAgain   = document.getElementById('pikoPostAgain');
    var postCount   = document.getElementById('pikoPostCount');

    var postBodyEl = document.getElementById('pikoPostBody');
    if (postBodyEl && postCount) {
      postBodyEl.addEventListener('input', function() {
        postCount.textContent = postBodyEl.value.length;
      });
    }

    if (postForm) {
      postForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var errEl = document.getElementById('pikoPostErr');
        var title = (document.getElementById('pikoPostTitle')?.value || '').trim();
        var body  = (document.getElementById('pikoPostBody')?.value  || '').trim();
        if (!title) {
          if (errEl) { errEl.textContent = 'Please add a title for your post.'; errEl.hidden = false; }
          return;
        }
        if (!body) {
          if (errEl) { errEl.textContent = 'Please write a message.'; errEl.hidden = false; }
          return;
        }
        if (errEl) errEl.hidden = true;
        var post = {
          id:    'post-' + Date.now(),
          title: title,
          body:  body,
          link:  (document.getElementById('pikoPostLink')?.value  || '').trim(),
          name:  (document.getElementById('pikoPostName')?.value  || '').trim(),
          ts:    Date.now(),
          hidden: false,
        };
        var posts = loadPosts();
        posts.unshift(post);
        savePosts(posts);
        postForm.reset();
        if (postCount) postCount.textContent = '0';
        postForm.hidden = true;
        if (postSuccess) postSuccess.hidden = false;
        refreshPulse();
      });
    }
    if (postAgain) {
      postAgain.addEventListener('click', function() {
        if (postForm) { postForm.hidden = false; postForm.reset(); }
        if (postSuccess) postSuccess.hidden = true;
        if (postCount) postCount.textContent = '0';
      });
    }

    // Wire pulse "Post" button to open modal on community post tab
    var pulsePostBtn = document.getElementById('pikoPulsePostBtn');
    if (pulsePostBtn) {
      pulsePostBtn.addEventListener('click', function() {
        openModal('post');
        // Close pulse panel
        var panel = document.getElementById('pikoPulsePanel');
        var toggle = document.getElementById('pikoPulseToggle');
        if (panel) panel.classList.remove('is-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
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
     CHRONICLE — Article Feed
  ───────────────────────────────────────────── */
  var CHRON_PAGE_SIZE = 9;
  var chronCat = 'all';
  var chronPage = 1;

  function loadArticles() {
    // Merge embedded site articles (window._pikoArticles, set in index.html)
    // with any locally added/edited articles in localStorage.
    // This allows articles published by admin to be visible on ALL devices.
    var embedded = [];
    try {
      if (window._pikoArticles && Array.isArray(window._pikoArticles)) {
        embedded = window._pikoArticles;
      }
    } catch(e) {}

    var local = [];
    try { local = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]'); } catch(e) {}

    // Merge: local overrides embedded (by id). Local-only additions included.
    if (!embedded.length) return local;
    if (!local.length)    return embedded;

    var merged = embedded.slice();
    local.forEach(function(la) {
      var existIdx = merged.findIndex(function(e) { return e.id === la.id; });
      if (existIdx !== -1) {
        merged[existIdx] = la; // local edit wins
      } else {
        merged.push(la); // local-only addition
      }
    });
    return merged;
  }

  function renderChronicle() {
    var grid  = document.getElementById('pikoChronicleGrid');
    var empty = document.getElementById('pikoChronicleEmpty');
    var more  = document.getElementById('pikoChronicleMore');
    if (!grid) return;

    var all = loadArticles()
      .filter(function(a) { return a.published; })
      .sort(function(a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.ts || 0) - (a.ts || 0);
      });

    var filtered = chronCat === 'all' ? all : all.filter(function(a) { return a.category === chronCat; });
    var paged    = filtered.slice(0, chronPage * CHRON_PAGE_SIZE);

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      if (more)  more.hidden  = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (more)  more.hidden  = paged.length >= filtered.length;

    var catIcons  = { culture:'🌺', technology:'⚡', history:'📜', aloha:'🤙', crypto:'🔗', environment:'🌿', community:'🌐', other:'📖' };
    var catLabels = { culture:'Culture', technology:'Technology', history:'History', aloha:'Aloha', crypto:'Web3', environment:'Environment', community:'Community', other:'Other' };

    grid.innerHTML = paged.map(function(a) {
      var icon  = catIcons[a.category]  || '📖';
      var label = catLabels[a.category] || 'Other';
      var tags  = (a.tags || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean).slice(0, 3);
      var imgStyle = a.image
        ? 'background-image:url(' + JSON.stringify(a.image) + ');background-size:cover;background-position:center'
        : '';
      var date = a.ts ? new Date(a.ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '';

      return '<a href="' + esc(a.url) + '" target="_blank" rel="noopener" class="piko-chron-card' + (a.pinned ? ' piko-chron-card--pinned' : '') + '">' +
        '<div class="piko-chron-card-img" style="' + esc(imgStyle) + '">' +
          (a.image ? '' : '<span class="piko-chron-default-icon">' + icon + '</span>') +
          (a.pinned ? '<span class="piko-chron-pin-badge"><i class="fas fa-thumbtack"></i> Pinned</span>' : '') +
        '</div>' +
        '<div class="piko-chron-card-body">' +
          '<div class="piko-chron-meta">' +
            '<span class="piko-chron-cat">' + icon + ' ' + esc(label) + '</span>' +
            '<span class="piko-chron-source">' + esc(a.source || '') + '</span>' +
            (date ? '<span class="piko-chron-date">' + esc(date) + '</span>' : '') +
          '</div>' +
          '<h3 class="piko-chron-title">' + esc(a.title) + '</h3>' +
          (a.excerpt ? '<p class="piko-chron-excerpt">"' + esc(a.excerpt) + '"</p>' : '') +
          (tags.length ? '<div class="piko-chron-tags">' + tags.map(function(t) { return '<span class="piko-chron-tag">' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="piko-chron-read">Read Article <i class="fas fa-arrow-right"></i></div>' +
        '</div>' +
      '</a>';
    }).join('');
  }

  function initChronicle() {
    renderChronicle();

    // Filter buttons
    document.querySelectorAll('[data-chron-cat]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-chron-cat]').forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        chronCat  = btn.getAttribute('data-chron-cat');
        chronPage = 1;
        renderChronicle();
      });
    });

    // Load more
    var moreBtn = document.getElementById('pikoChronicleMoreBtn');
    if (moreBtn) moreBtn.addEventListener('click', function() {
      chronPage++;
      renderChronicle();
    });
  }

  /* ─────────────────────────────────────────────
     SUBMISSION TRACKING — check your submission
  ───────────────────────────────────────────── */
  function initSubmissionChecker() {
    var checkBtn   = document.getElementById('pikoCheckSubBtn');
    var checkInput = document.getElementById('pikoCheckSubInput');
    var checkResult= document.getElementById('pikoCheckSubResult');
    if (!checkBtn || !checkInput) return;

    checkBtn.addEventListener('click', function() {
      var rawId = (checkInput.value || '').trim();
      if (!rawId) {
        showCheckResult(checkResult, 'error', 'Please enter your submission ID.');
        return;
      }
      // Search ideas
      var ideas = loadIdeas();
      var idea  = ideas.find(function(i) { return i.id === rawId; });

      // Search projects
      var projs = [];
      try { projs = JSON.parse(localStorage.getItem('amp_admin_projects_hub') || '[]'); } catch(e) {}
      var proj = projs.find(function(p) { return p.id === rawId; });

      if (idea) {
        var replyHtml = idea.reply
          ? '<div class="piko-check-reply"><div class="piko-check-reply-label">💬 AMP Team Replied</div><div class="piko-check-reply-text">' + esc(idea.reply) + '</div></div>'
          : '<p class="piko-check-pending">Your idea is being reviewed. Check back soon!</p>';
        showCheckResult(checkResult, 'found',
          '<div class="piko-check-card">' +
          '<div class="piko-check-type">💡 Hub Idea</div>' +
          '<div class="piko-check-text">' + esc(idea.text) + '</div>' +
          '<div class="piko-check-status ' + (idea.status === 'reviewed' ? 'reviewed' : 'pending') + '">' +
            (idea.status === 'reviewed' ? '✅ Reviewed' : '⏳ Pending') +
          '</div>' + replyHtml + '</div>'
        );
      } else if (proj) {
        var statusMap = { pending:'⏳ Pending Review', approved:'✅ Live on Showcase', dismissed:'❌ Not selected this round' };
        showCheckResult(checkResult, 'found',
          '<div class="piko-check-card">' +
          '<div class="piko-check-type">🚀 Project Submission</div>' +
          '<div class="piko-check-text"><strong>' + esc(proj.name) + '</strong><br>' + esc(proj.desc) + '</div>' +
          '<div class="piko-check-status ' + (proj.status || 'pending') + '">' + (statusMap[proj.status] || '⏳ Pending Review') + '</div>' +
          (proj.status === 'approved' ? '<p style="font-size:12px;color:#4caf7a;margin-top:8px">Your project is featured on the Showcase! 🎉</p>' : '') +
          '</div>'
        );
      } else {
        showCheckResult(checkResult, 'error', 'No submission found with that ID. Check that you copied it correctly.');
      }
    });

    // Allow Enter key
    checkInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); checkBtn.click(); }
    });
  }

  function showCheckResult(el, type, html) {
    if (!el) return;
    el.className = 'piko-check-result piko-check-result--' + type;
    el.innerHTML = html;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ─────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initDock();
    initSubmitModal();
    renderShowcaseWall();
    initPulse();
    seedPulse();
    initChronicle();
    initSubmissionChecker();

    // Wire the empty showcase state button to open the modal
    var emptyBtn = document.getElementById('pikoOpenSubmitEmpty');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', function() {
        var backdrop = document.getElementById('pikoSubmitBackdrop');
        if (backdrop) {
          backdrop.classList.add('is-open');
          backdrop.setAttribute('aria-hidden', 'false');
          document.body.style.overflow = 'hidden';
          // Switch to project tab
          document.querySelectorAll('.piko-modal-tab').forEach(function(b) {
            b.classList.toggle('is-active', b.dataset.tab === 'project');
          });
          document.querySelectorAll('.piko-tab-pane').forEach(function(p) {
            p.classList.toggle('is-active', p.id === 'pikoTabProject');
          });
        }
      });
    }
  });

  /* ─────────────────────────────────────────────
     SEED PULSE — curated entries shown on first visit
     so the feed is never empty for new visitors
  ───────────────────────────────────────────── */
  function seedPulse() {
    var SEED_KEY = 'amp_pulse_seeded_v1';
    if (localStorage.getItem(SEED_KEY)) return; // only seed once

    var seeds = [
      {
        id: 'seed-rootstall',
        text: "Root Stall launched \u2014 Hawai\u02BBi's first digital farmers market is live.",
        name: 'AMP Team',
        category: 'platform',
        ts: Date.now() - 1000 * 60 * 60 * 24 * 3,
        dismissed: false,
        reply: '',
        status: 'reviewed',
      },
      {
        id: 'seed-ikeverse',
        text: 'Ikeverse beta is open — indigenous cultures, ancient histories, and emerging tech.',
        name: 'AMP Team',
        category: 'platform',
        ts: Date.now() - 1000 * 60 * 60 * 24 * 7,
        dismissed: false,
        reply: '',
        status: 'reviewed',
      },
      {
        id: 'seed-pikoverse',
        text: 'Pikoverse — Ka Ulana ʻIke — the gateway ecosystem is now live.',
        name: 'Aloha Mass Productions',
        category: 'platform',
        ts: Date.now() - 1000 * 60 * 60 * 24 * 14,
        dismissed: false,
        reply: '',
        status: 'reviewed',
      },
    ];

    var ideas = loadIdeas();
    // Only add seeds that don't already exist
    seeds.forEach(function(seed) {
      if (!ideas.find(function(i) { return i.id === seed.id; })) {
        ideas.push(seed);
      }
    });
    saveIdeas(ideas);
    localStorage.setItem(SEED_KEY, '1');
  }

})();