/* ═══════════════════════════════════════════════════════════════
   SUPABASE — Community Board (ideas + comments)
   Set your URL and anon key in Admin → Settings → Community Board
   or paste them directly here for quick setup.
═══════════════════════════════════════════════════════════════ */
var SUPABASE_URL  = localStorage.getItem('amp_supabase_url')  || '';
var SUPABASE_KEY  = localStorage.getItem('amp_supabase_key')  || '';

function sbReady() { return !!(SUPABASE_URL && SUPABASE_KEY); }

function sbFetch(path, method, body) {
  method = method || 'GET';
  var opts = {
    method: method,
    headers: {
      'apikey':        SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        method === 'POST' ? 'return=representation' : '',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(SUPABASE_URL + '/rest/v1' + path, opts)
    .then(function(r) { return r.ok ? r.json() : r.json().then(function(e) { throw e; }); });
}

// Fetch all non-dismissed ideas (newest first)
function sbLoadIdeas(cat) {
  var filter = '?select=*&status=neq.dismissed&order=ts.desc';
  if (cat && cat !== 'all') filter += '&category=eq.' + encodeURIComponent(cat);
  return sbFetch('/community_ideas' + filter);
}

// Submit a new idea
function sbSubmitIdea(idea) {
  return sbFetch('/community_ideas', 'POST', idea);
}

// Fetch comments for an idea
function sbLoadComments(ideaId) {
  return sbFetch('/idea_comments?idea_id=eq.' + encodeURIComponent(ideaId) + '&order=ts.asc');
}

// Submit a comment
function sbSubmitComment(comment) {
  return sbFetch('/idea_comments', 'POST', comment);
}

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

    // Connect button if submitter shared contact
    var connectHtml = '';
    if (idea.shareContact && idea.contact) {
      var isEmail = idea.contact.indexOf('@') > -1;
      var href = isEmail ? 'mailto:' + encodeURIComponent(idea.contact) : '#';
      var label = isEmail ? 'Email' : 'Connect';
      connectHtml = '<a href="' + href + '" class="piko-idea-connect" target="_blank" rel="noopener">' +
        '<i class="fas fa-paper-plane"></i> ' + label + ' with ' + esc(idea.name || 'Submitter') +
      '</a>';
    }

    return '<div class="piko-idea-card" data-id="' + esc(idea.id) + '">' +
      '<div class="piko-idea-header">' +
        '<span class="piko-idea-category ' + catClass + '">' + esc(catLabel) + '</span>' +
        '<span class="piko-idea-date">' + fmtDate(idea.ts) + '</span>' +
      '</div>' +
      '<p class="piko-idea-text">' + esc(idea.text) + '</p>' +
      replyHtml +
      '<div class="piko-idea-footer">' +
        '<div class="piko-idea-author">' +
          '<div class="piko-idea-author-avatar">' + esc(authorInitial) + '</div>' +
          authorName +
        '</div>' +
        connectHtml +
      '</div>' +
    '</div>';
  }



  /* ─────────────────────────────────────────────
     COMMUNITY IDEAS BOARD (public-facing wall)
  ───────────────────────────────────────────── */
  var boardCat = 'all';

  function renderCommunityBoard() {
    var grid  = document.getElementById('pikoBoardGrid');
    var empty = document.getElementById('pikoBoardEmpty');
    if (!grid) return;

    if (sbReady()) {
      // ── Supabase path — cross-device ──
      grid.innerHTML = '<div class="piko-board-loading"><i class="fas fa-spinner fa-spin"></i> Loading community ideas...</div>';
      sbLoadIdeas(boardCat).then(function(ideas) {
        renderBoardCards(ideas, grid, empty);
      }).catch(function(err) {
        console.warn('[Board] Supabase error, falling back to local:', err);
        renderBoardLocal(grid, empty);
      });
      return;
    }

    // ── Fallback: localStorage ──
    renderBoardLocal(grid, empty);
  }

  function renderBoardLocal(grid, empty) {
    var ideas = loadIdeas()
      .filter(function(i) { return !i.dismissed && i.status !== 'dismissed'; })
      .sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });

    if (boardCat !== 'all') {
      ideas = ideas.filter(function(i) { return i.category === boardCat; });
    }
    renderBoardCards(ideas, grid, empty);
  }

  function renderBoardCards(ideas, grid, empty) {
    if (!ideas || ideas.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    var catColors = { platform:'rgba(201,168,76,.12)', feature:'rgba(84,209,255,.10)', content:'rgba(76,175,122,.10)', other:'rgba(255,255,255,.05)' };
    var catTextColors = { platform:'#f0c96a', feature:'#54d1ff', content:'#4caf7a', other:'rgba(255,255,255,.5)' };
    var catIcons = { platform:'🚀', feature:'⚡', content:'📖', other:'💡' };

    grid.innerHTML = ideas.map(function(idea) {
      var cat    = idea.category || 'other';
      var label  = cat.charAt(0).toUpperCase() + cat.slice(1);
      var icon   = catIcons[cat] || '💡';
      var bg     = catColors[cat] || catColors.other;
      var col    = catTextColors[cat] || catTextColors.other;
      var initial = idea.name ? idea.name[0].toUpperCase() : '?';
      var author  = idea.name || 'Anonymous';
      var date    = idea.ts ? new Date(idea.ts).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';

      var replyHtml = '';
      if (idea.reply) {
        replyHtml = '<div class="piko-idea-reply" style="margin-top:12px">' +
          '<div class="piko-idea-reply-label"><i class="fas fa-star"></i> AMP Team replied</div>' +
          '<div class="piko-idea-reply-text">' + esc(idea.reply) + '</div>' +
          '</div>';
      }

      var connectHtml = '';
      if (idea.share_contact && idea.contact) {
        var isEmail = idea.contact.indexOf('@') > -1 && idea.contact.indexOf('http') === -1;
        var href = isEmail ? 'mailto:' + encodeURIComponent(idea.contact) : esc(idea.contact);
        connectHtml = '<a href="' + href + '" class="piko-idea-connect" target="_blank" rel="noopener">' +
          '<i class="fas fa-paper-plane"></i> Connect with ' + esc(author) + '</a>';
      }

      // Comment section — only shown when Supabase is configured
      var commentSection = sbReady()
        ? '<div class="piko-board-comments" id="piko-comments-' + esc(idea.id) + '">' +
            '<div class="piko-board-comments-list" id="piko-clist-' + esc(idea.id) + '">' +
              '<span class="piko-board-comments-loading">Loading comments…</span>' +
            '</div>' +
            '<div class="piko-board-comment-form">' +
              '<input type="text" class="piko-comment-name" placeholder="Your name (optional)" maxlength="60">' +
              '<textarea class="piko-comment-text" placeholder="Share your thoughts on this idea…" rows="2" maxlength="400"></textarea>' +
              '<button class="piko-comment-submit" data-idea-id="' + esc(idea.id) + '">' +
                '<i class="fas fa-paper-plane"></i> Post Comment' +
              '</button>' +
            '</div>' +
          '</div>'
        : '';

      return '<div class="piko-board-card" data-idea-id="' + esc(idea.id) + '">' +
        '<div class="piko-board-card-header">' +
          '<span class="piko-board-cat" style="background:' + bg + ';color:' + col + '">' + icon + ' ' + esc(label) + '</span>' +
          '<span class="piko-board-date">' + esc(date) + '</span>' +
        '</div>' +
        '<p class="piko-board-text">' + esc(idea.text) + '</p>' +
        replyHtml +
        '<div class="piko-board-footer">' +
          '<div class="piko-idea-author">' +
            '<div class="piko-idea-author-avatar">' + esc(initial) + '</div>' + esc(author) +
          '</div>' +
          connectHtml +
        '</div>' +
        commentSection +
      '</div>';
    }).join('');

    // Load comments for each card (if Supabase ready)
    if (sbReady()) {
      ideas.forEach(function(idea) {
        loadAndRenderComments(idea.id);
      });

      // Wire comment submit buttons
      grid.querySelectorAll('.piko-comment-submit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var ideaId = btn.dataset.ideaId;
          var card   = btn.closest('.piko-board-card');
          var text   = card.querySelector('.piko-comment-text').value.trim();
          var name   = card.querySelector('.piko-comment-name').value.trim();
          if (!text) return;
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          sbSubmitComment({
            id:      'cmt-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
            idea_id: ideaId,
            text:    text,
            name:    name || null,
            ts:      Date.now(),
          }).then(function() {
            card.querySelector('.piko-comment-text').value = '';
            card.querySelector('.piko-comment-name').value = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
            loadAndRenderComments(ideaId);
          }).catch(function(err) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
            console.warn('Comment submit error:', err);
          });
        });
      });
    }
  }

  function loadAndRenderComments(ideaId) {
    var listEl = document.getElementById('piko-clist-' + ideaId);
    if (!listEl) return;
    sbLoadComments(ideaId).then(function(comments) {
      if (!comments || comments.length === 0) {
        listEl.innerHTML = '<span class="piko-board-no-comments">No comments yet — be the first!</span>';
        return;
      }
      listEl.innerHTML = comments.map(function(c) {
        var name    = c.name || 'Anonymous';
        var initial = name[0].toUpperCase();
        var date    = c.ts ? new Date(c.ts).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';
        return '<div class="piko-comment-card">' +
          '<div class="piko-comment-header">' +
            '<div class="piko-idea-author">' +
              '<div class="piko-idea-author-avatar" style="background:rgba(84,209,255,.12);color:#54d1ff;border-color:rgba(84,209,255,.2)">' + esc(initial) + '</div>' +
              esc(name) +
            '</div>' +
            '<span class="piko-board-date">' + esc(date) + '</span>' +
          '</div>' +
          '<p class="piko-comment-text">' + esc(c.text) + '</p>' +
        '</div>';
      }).join('');
    }).catch(function() {
      listEl.innerHTML = '<span class="piko-board-no-comments">Could not load comments.</span>';
    });
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
    var isEmail = p.contact && p.contact.indexOf('@') > -1;
    var contactHtml = p.contact
      ? (isEmail
          ? '<a href="mailto:' + encodeURIComponent(p.contact) + '" class="piko-idea-connect"><i class="fas fa-paper-plane"></i> Connect with ' + esc(p.name) + '</a>'
          : '<span><i class="fas fa-user"></i> ' + esc(p.contact) + '</span>')
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
          contact: (document.getElementById('pikoIdeaContact')?.value || '').trim(),
          shareContact: !!(document.getElementById('pikoIdeaShareContact')?.checked),
          category: document.getElementById('pikoIdeaCategory')?.value || 'other',
          ts: Date.now(),
          dismissed: false,
          reply: '',
          status: 'pending',
        };
        function finishIdeaSubmit() {
          ideaForm.reset();
          ideaForm.hidden = true;
          if (ideaSuccess) ideaSuccess.hidden = false;
          var idBox  = document.getElementById('pikoIdeaIdBox');
          var idCode = document.getElementById('pikoIdeaIdCode');
          if (idBox && idCode) { idCode.textContent = idea.id; idBox.hidden = false; }
          refreshPulse();
          renderCommunityBoard();
        }

        if (sbReady()) {
          // Supabase — visible on all devices immediately
          var sbIdea = {
            id:            idea.id,
            text:          idea.text,
            name:          idea.name || null,
            contact:       idea.contact || null,
            share_contact: idea.shareContact || false,
            category:      idea.category,
            ts:            idea.ts,
            status:        'pending',
            reply:         null,
          };
          sbSubmitIdea(sbIdea)
            .then(function() { finishIdeaSubmit(); })
            .catch(function(err) {
              console.warn('[Idea] Supabase submit failed, saving locally:', err);
              var ideas = loadIdeas(); ideas.push(idea); saveIdeas(ideas);
              finishIdeaSubmit();
            });
        } else {
          // Fallback: localStorage only
          var ideas = loadIdeas();
          ideas.push(idea);
          saveIdeas(ideas);
          finishIdeaSubmit();
        }
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

    // Wire comment buttons and load comments for each project (Supabase only)
    if (sbReady()) {
      approved.forEach(function(p) {
        loadAndRenderComments('proj-' + p.id);
      });
      grid.querySelectorAll('.piko-comment-submit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var ideaId = btn.dataset.ideaId;
          var card   = btn.closest('.ecosystem-project-card');
          var text   = card.querySelector('.piko-comment-text').value.trim();
          var name   = card.querySelector('.piko-comment-name').value.trim();
          if (!text) return;
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          sbSubmitComment({
            id:      'cmt-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
            idea_id: ideaId,
            text:    text,
            name:    name || null,
            ts:      Date.now(),
          }).then(function() {
            card.querySelector('.piko-comment-text').value = '';
            card.querySelector('.piko-comment-name').value = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
            loadAndRenderComments(ideaId);
          }).catch(function() {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
          });
        });
      });
    }
    }
  }

  /* ─────────────────────────────────────────────
     MOBILE NAV — hamburger toggles dropdown
  ───────────────────────────────────────────── */
  function initMobileNav() {
    var toggle   = document.getElementById('mobileMenuToggle');
    var dropdown = document.getElementById('mobileNavDropdown');
    if (!toggle || !dropdown) return;

    // Toggle open/close
    toggle.addEventListener('click', function() {
      var isOpen = dropdown.classList.toggle('is-open');
      toggle.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      dropdown.setAttribute('aria-hidden', !isOpen);
    });

    // Close on any nav item tap + smooth scroll
    dropdown.querySelectorAll('.mnd-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        var href = item.getAttribute('href');
        if (href && href.startsWith('#')) {
          e.preventDefault();
          // Close menu
          dropdown.classList.remove('is-open');
          toggle.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          dropdown.setAttribute('aria-hidden', 'true');
          // Smooth scroll
          var target = document.getElementById(href.slice(1));
          if (target) target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Close on outside tap
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#mobileMenuToggle') && !e.target.closest('#mobileNavDropdown')) {
        dropdown.classList.remove('is-open');
        toggle.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        dropdown.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ─────────────────────────────────────────────
     CHRONICLE — Article Feed
  ───────────────────────────────────────────── */
  var CHRON_PAGE_SIZE = 9;
  var chronCat = 'all';
  var chronPage = 1;

  function loadArticles() {
    // Priority: _pikoData.articles (from pikoData.js fetch) > _pikoArticles > localStorage
    var embedded = [];
    try {
      var src = (window._pikoData && window._pikoData.articles) ? window._pikoData.articles
              : (window._pikoArticles && Array.isArray(window._pikoArticles)) ? window._pikoArticles
              : [];
      embedded = src;
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

  var chronIndex = 0; // current carousel position

  function renderChronicle() {
    var grid  = document.getElementById('pikoChronicleGrid');
    var empty = document.getElementById('pikoChronicleEmpty');
    if (!grid) return;

    var all = loadArticles()
      .filter(function(a) { return a.published; })
      .sort(function(a, b) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.ts || 0) - (a.ts || 0);
      });

    var filtered = chronCat === 'all' ? all : all.filter(function(a) { return a.category === chronCat; });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      updateCarouselControls(0);
      return;
    }
    if (empty) empty.hidden = true;

    // All articles shown — carousel handles paging
    var paged = filtered;

    var catIcons  = { culture:'🌺', technology:'⚡', history:'📜', aloha:'🤙', crypto:'🔗', environment:'🌿', community:'🌐', other:'📖' };
    var catLabels = { culture:'Culture', technology:'Technology', history:'History', aloha:'Aloha', crypto:'Web3', environment:'Environment', community:'Community', other:'Other' };

    // Reset carousel to start when category changes
    chronIndex = Math.min(chronIndex, Math.max(0, paged.length - 1));

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

    // Update carousel position and controls
    updateCarouselControls(filtered.length);
  }

  function updateCarouselControls(total) {
    var isMobile = window.innerWidth <= 768;
    var prevBtn  = document.getElementById('pikoChronPrev');
    var nextBtn  = document.getElementById('pikoChronNext');
    var dotsEl   = document.getElementById('pikoChronDots');
    var grid     = document.getElementById('pikoChronicleGrid');

    // Desktop arrows — hide/show groups of 3
    if (prevBtn && nextBtn && !isMobile) {
      var pages   = Math.ceil(total / 3);
      var curPage = Math.floor(chronIndex / 3);
      if (curPage >= pages) { curPage = Math.max(0, pages - 1); chronIndex = curPage * 3; }
      prevBtn.disabled = curPage <= 0;
      nextBtn.disabled = curPage >= pages - 1;
      if (grid) {
        var cards = grid.querySelectorAll('.piko-chron-card');
        var start = curPage * 3;
        cards.forEach(function(card, i) {
          card.style.display = (i >= start && i < start + 3) ? '' : 'none';
        });
      }
    }

    // Mobile dots — driven by scroll position
    if (isMobile && dotsEl && grid) {
      dotsEl.innerHTML = '';
      if (total > 1) {
        for (var p = 0; p < total; p++) {
          var dot = document.createElement('button');
          dot.className = 'piko-chron-dot' + (p === chronIndex ? ' is-active' : '');
          dot.setAttribute('aria-label', 'Article ' + (p + 1));
          dot.setAttribute('data-idx', p);
          dot.addEventListener('click', (function(idx) {
            return function() {
              var cards = grid.querySelectorAll('.piko-chron-card');
              if (cards[idx]) {
                cards[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                chronIndex = idx;
                updateCarouselControls(total);
              }
            };
          })(p));
          dotsEl.appendChild(dot);
        }
      }

      // Listen to scroll to update active dot
      if (!grid._scrollListener) {
        grid._scrollListener = function() {
          var cards = grid.querySelectorAll('.piko-chron-card');
          if (!cards.length) return;
          var cardW = cards[0].offsetWidth + 12; // 12 = gap
          var idx   = Math.round(grid.scrollLeft / cardW);
          if (idx !== chronIndex) {
            chronIndex = idx;
            var dots = dotsEl.querySelectorAll('.piko-chron-dot');
            dots.forEach(function(d, i) { d.classList.toggle('is-active', i === idx); });
          }
        };
        grid.addEventListener('scroll', grid._scrollListener, { passive: true });
      }
    }
  }

  function initChronicle() {
    // Render immediately with whatever is already in localStorage
    renderChronicle();

    // Wire filter buttons
    document.querySelectorAll('[data-chron-cat]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-chron-cat]').forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        chronCat  = btn.getAttribute('data-chron-cat');
        chronPage = 1;
        chronIndex = 0;
        renderChronicle();
      });
    });

    // Prev/Next arrow buttons
    var prevBtn = document.getElementById('pikoChronPrev');
    var nextBtn = document.getElementById('pikoChronNext');
    var isMobile = function() { return window.innerWidth <= 768; };

    function getTotalFiltered() {
      return loadArticles()
        .filter(function(a) { return a.published; })
        .filter(function(a) { return chronCat === 'all' || a.category === chronCat; }).length;
    }

    if (prevBtn) prevBtn.addEventListener('click', function() {
      var perPage = isMobile() ? 1 : 3;
      if (chronIndex >= perPage) {
        chronIndex -= perPage;
        updateCarouselControls(getTotalFiltered());
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', function() {
      var perPage = isMobile() ? 1 : 3;
      var total   = getTotalFiltered();
      var pages   = Math.ceil(total / perPage);
      var curPage = Math.floor(chronIndex / perPage);
      if (curPage < pages - 1) {
        chronIndex += perPage;
        updateCarouselControls(total);
      }
    });

    // CSS scroll-snap handles all touch swiping natively on mobile
    // No JS needed for swipe — just update dots on resize
    window.addEventListener('resize', function() {
      chronIndex = 0;
      renderChronicle();
    }, { passive: true });

    // ── Fetch pikoData.js from server ────────────────────────────────────
    // Loads all site data committed via Admin "Publish All to Site"
    // Syncs articles, products, projects, ideas across ALL devices
    if (typeof fetch !== 'undefined') {
      fetch('./js/pikoData.json', { cache: 'no-store' })
        .then(function(r) { return r.ok ? r.text() : null; })
        .then(function(text) {
          if (!text) return;
          try {
            // Pure JSON.parse — no eval(), no antivirus warnings
            var d = JSON.parse(text);
            if (d && typeof d === 'object') {
              window._pikoData = d;
              if (Array.isArray(d.articles) && d.articles.length > 0) {
                window._pikoArticles = d.articles;
                chronPage = 1;
                renderChronicle();
              }
              if (Array.isArray(d.projects)) {
                syncProjectsFromData(d.projects);
              }
              if (Array.isArray(d.ideas)) {
                syncIdeasFromData(d.ideas);
              }
              if (d.banner) {
                syncBannerFromData(d.banner);
              }
            }
          } catch(e) {}
        })
        .catch(function() {});
    }
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
     CROSS-DEVICE SYNC HELPERS
  ───────────────────────────────────────────── */
  function syncProjectsFromData(serverProjects) {
    // Merge server-approved projects into localStorage so showcase renders them
    try {
      var local = JSON.parse(localStorage.getItem(PROJ_KEY) || '[]');
      serverProjects.forEach(function(sp) {
        var idx = local.findIndex(function(lp) { return lp.id === sp.id; });
        if (idx !== -1) { local[idx] = Object.assign({}, local[idx], sp); }
        else            { local.push(sp); }
      });
      localStorage.setItem(PROJ_KEY, JSON.stringify(local));
      renderShowcaseWall();
    } catch(e) {}
  }

  function syncIdeasFromData(serverIdeas) {
    // Merge admin replies from server into localStorage so users see reply status
    try {
      var local = JSON.parse(localStorage.getItem(IDEA_KEY) || '[]');
      serverIdeas.forEach(function(si) {
        var idx = local.findIndex(function(li) { return li.id === si.id; });
        if (idx !== -1) { local[idx] = Object.assign({}, local[idx], { reply: si.reply, status: si.status }); }
      });
      localStorage.setItem(IDEA_KEY, JSON.stringify(local));
    } catch(e) {}
  }

  function syncBannerFromData(bannerData) {
    // Update the announcement banner if it's changed server-side
    try {
      if (bannerData && bannerData.text && bannerData.active) {
        var el = document.getElementById('site-banner') || document.getElementById('ampBanner');
        if (el) { el.hidden = false; }
      }
    } catch(e) {}
  }

  /* ─────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    initDock();
  renderCommunityBoard();

  // ── Community Board filters ──
  document.querySelectorAll('[data-board-cat]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('[data-board-cat]').forEach(function(b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');
      boardCat = btn.getAttribute('data-board-cat');
      renderCommunityBoard();
    });
  });

    initMobileNav();
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