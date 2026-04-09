/**
 * profile.js — Pikoverse User Profile System
 * Place in: js/profile.js
 * 
 * Features:
 * - Email magic-link auth (via Cloudflare Worker)
 * - Profile CRUD (name, bio, avatar, social)
 * - Activity feed (ideas, projects, comments, upvotes)
 * - Order history from D1 + localStorage
 * - Learning progress (Culturalverse + DigitalVerse modules)
 * - LocalStorage fallback for everything
 */

(function() {
  'use strict';

  /* ── Config ── */
  var WORKER_URL   = localStorage.getItem('amp_worker_url')   || '';
  var SUPABASE_URL = localStorage.getItem('amp_supabase_url') || '';
  var SUPABASE_KEY = localStorage.getItem('amp_supabase_key') || '';
  var PROFILE_KEY  = 'piko_profile_v1';
  var LEARN_KEY    = 'piko_learning_v1';

  /* ── Helpers ── */
  function esc(str) {
    return String(str || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function toast(msg) {
    var el = document.getElementById('pikoProfileToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.classList.remove('is-visible'); }, 3000);
  }

  function timeAgo(ts) {
    var secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 60)    return 'just now';
    if (secs < 3600)  return Math.floor(secs/60) + 'm ago';
    if (secs < 86400) return Math.floor(secs/3600) + 'h ago';
    return Math.floor(secs/86400) + 'd ago';
  }

  function fmtPrice(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  /* ── Profile storage ── */
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch(e) { return null; }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function isLoggedIn() {
    var p = loadProfile();
    return !!(p && p.email);
  }

  /* ── Check for magic link token in URL ── */
  function checkMagicLink() {
    try {
      var params = new URLSearchParams(window.location.search);
      var token  = params.get('verify');
      if (!token) return;

      // Remove token from URL
      var url = new URL(window.location.href);
      url.searchParams.delete('verify');
      window.history.replaceState({}, '', url.toString());

      // Verify with Worker
      if (!WORKER_URL) {
        // LocalStorage fallback — find profile with this token
        var p = loadProfile();
        if (p && p.pendingToken === token) {
          p.verified = true;
          delete p.pendingToken;
          saveProfile(p);
          toast('✅ Email verified! Welcome to Pikoverse.');
          showProfile(p);
        }
        return;
      }

      showStatus('pikoSigninStatus', 'Verifying your link…', 'info');
      fetch(WORKER_URL + '/api/members/verify/' + encodeURIComponent(token))
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.member) {
            var profile = Object.assign(loadProfile() || {}, d.member, { verified: true });
            saveProfile(profile);
            toast('✅ Welcome back, ' + (profile.display_name || 'friend') + '!');
            showProfile(profile);
          } else {
            toast('⚠️ Link expired or already used. Request a new one.');
          }
        }).catch(function() {
          toast('Could not verify — check your connection.');
        });
    } catch(e) {}
  }

  /* ── UI helpers ── */
  function showStatus(elId, msg, type) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = 'piko-auth-status piko-auth-status--' + (type || 'info');
    el.hidden = false;
  }

  function showAuthGate() {
    document.getElementById('pikoAuthGate').hidden    = false;
    document.getElementById('pikoProfileSection').hidden = true;
    var signOutBtn = document.getElementById('pikoSignOut');
    if (signOutBtn) signOutBtn.hidden = true;
  }

  function showProfile(profile) {
    document.getElementById('pikoAuthGate').hidden       = true;
    document.getElementById('pikoProfileSection').hidden = false;
    var signOutBtn = document.getElementById('pikoSignOut');
    if (signOutBtn) signOutBtn.hidden = false;

    renderProfileHeader(profile);
    renderActivity(profile);
    renderOrders(profile);
    renderIdeas(profile);
    renderProjects(profile);
    renderLearning();
  }

  /* ── Profile header ── */
  function renderProfileHeader(profile) {
    var nameEl    = document.getElementById('pikoProfileName');
    var emailEl   = document.getElementById('pikoProfileEmail');
    var bioEl     = document.getElementById('pikoProfileBio');
    var joinedEl  = document.getElementById('pikoProfileJoined');
    var initEl    = document.getElementById('pikoProfileAvatarInitial');
    var imgEl     = document.getElementById('pikoProfileAvatarImg');

    var name = profile.display_name || profile.email || 'Pikoverse Member';
    if (nameEl)   nameEl.textContent   = name;
    if (emailEl)  emailEl.textContent  = profile.email || '';
    if (bioEl)    bioEl.textContent    = profile.bio || '';
    if (joinedEl) joinedEl.textContent = '🌺 Joined ' + (profile.joined_ts
      ? new Date(profile.joined_ts).toLocaleDateString('en-US', { month:'long', year:'numeric' })
      : 'recently');

    // Avatar
    if (initEl) initEl.textContent = name[0].toUpperCase();
    if (imgEl && profile.avatar_url) {
      imgEl.src    = profile.avatar_url;
      imgEl.hidden = false;
      if (initEl) initEl.style.display = 'none';
      imgEl.onerror = function() { imgEl.hidden = true; if (initEl) initEl.style.display = ''; };
    }
  }

  /* ── Activity ── */
  function renderActivity(profile) {
    var list = document.getElementById('pikoActivityList');
    if (!list) return;

    var items = [];

    // Ideas from Supabase or localStorage
    try {
      var ideas = JSON.parse(localStorage.getItem('amp_community_posts') || '[]');
      var userIdeas = ideas.filter(function(i) {
        return i.contact && profile.email && i.contact.toLowerCase() === profile.email.toLowerCase();
      });
      userIdeas.forEach(function(i) {
        items.push({ type:'idea', text: '💡 Shared an idea: "' + i.text.slice(0,60) + '…"', ts: i.ts || Date.now() });
      });
    } catch(e) {}

    // Orders
    try {
      var orders = JSON.parse(localStorage.getItem('amp_orders_v1') || '[]');
      orders.forEach(function(o) {
        items.push({ type:'order', text: '🛍️ Placed order ' + o.id + ' — ' + fmtPrice(o.total), ts: o.ts || Date.now() });
      });
    } catch(e) {}

    items.sort(function(a,b) { return (b.ts||0) - (a.ts||0); });

    if (!items.length) {
      list.innerHTML = '<p class="piko-profile-empty">Your community activity will appear here as you submit ideas, projects, and comments.</p>';
      return;
    }

    var iconMap = { idea:'fas fa-lightbulb', project:'fas fa-rocket', comment:'fas fa-comment', order:'fas fa-bag-shopping' };
    var classMap = { idea:'idea', project:'project', comment:'comment', order:'order' };

    list.innerHTML = items.slice(0,12).map(function(item) {
      var iconCls = iconMap[item.type] || 'fas fa-bolt';
      var cardCls = classMap[item.type] || 'comment';
      return '<div class="piko-activity-item">' +
        '<div class="piko-activity-icon piko-activity-icon--' + cardCls + '">' +
          '<i class="' + iconCls + '"></i>' +
        '</div>' +
        '<div>' +
          '<div class="piko-activity-text">' + esc(item.text) + '</div>' +
          '<div class="piko-activity-meta">' + timeAgo(item.ts) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Orders ── */
  function renderOrders(profile) {
    var list = document.getElementById('pikoProfileOrdersList');
    if (!list) return;

    var orders = [];
    try { orders = JSON.parse(localStorage.getItem('amp_orders_v1') || '[]'); } catch(e) {}

    // Also try Worker D1
    if (WORKER_URL && profile.email) {
      fetch(WORKER_URL + '/api/orders?email=' + encodeURIComponent(profile.email), {
        headers: { 'X-Admin-Secret': localStorage.getItem('amp_worker_secret') || '' }
      }).then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.orders && d.orders.length) {
            renderOrderCards(list, d.orders.map(function(o) {
              return { id: o.id, items: JSON.parse(o.items_json || '[]'), total: o.total, status: o.status, ts: o.ts };
            }));
          }
        }).catch(function(){});
    }

    if (!orders.length) {
      list.innerHTML = '<p class="piko-profile-empty">No orders yet. <a href="marketplace/marketplace.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>';
      return;
    }
    renderOrderCards(list, orders);
  }

  function renderOrderCards(list, orders) {
    list.innerHTML = orders.map(function(o) {
      var statusCls = o.status === 'confirmed' ? 'confirmed' : 'pending';
      var statusLabel = (o.status || 'pending').replace('_', ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      var itemsText = (o.items || []).map(function(i) {
        return i.name + (i.size ? ' (' + i.size + ')' : '') + ' ×' + i.qty;
      }).join(', ');
      return '<div class="piko-order-card">' +
        '<div class="piko-order-card-header">' +
          '<span class="piko-order-id">' + esc(o.id) + '</span>' +
          '<span class="piko-order-status piko-order-status--' + statusCls + '">' + esc(statusLabel) + '</span>' +
        '</div>' +
        '<div class="piko-order-items">' + esc(itemsText) + '</div>' +
        '<div class="piko-order-total">' + fmtPrice(o.total) + ' · ' + (o.ts ? new Date(o.ts).toLocaleDateString() : '') + '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Ideas ── */
  function renderIdeas(profile) {
    var list = document.getElementById('pikoProfileIdeasList');
    if (!list) return;

    var ideas = [];
    try { ideas = JSON.parse(localStorage.getItem('amp_admin_ideas') || '[]'); } catch(e) {}

    // Filter to ideas by this user (match by contact/email)
    if (profile.email) {
      ideas = ideas.filter(function(i) {
        return i.contact && i.contact.toLowerCase() === profile.email.toLowerCase();
      });
    } else {
      ideas = [];
    }

    if (!ideas.length) {
      list.innerHTML = '<p class="piko-profile-empty">No ideas shared yet. <button onclick="document.getElementById(\'pikoSubmitIdeaBtn\').click()" style="background:none;border:none;color:#f0c96a;cursor:pointer;font-size:inherit">Share your first idea →</button></p>';
      return;
    }

    list.innerHTML = ideas.map(function(i) {
      return '<div class="piko-profile-idea-card">' +
        esc(i.text) +
        '<div class="piko-profile-idea-meta">' +
          '<span>' + (i.category || 'Idea') + '</span>' +
          '<span>' + (i.ts ? timeAgo(i.ts) : '') + '</span>' +
          (i.reply ? '<span style="color:#f0c96a"><i class="fas fa-star"></i> AMP replied</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Projects ── */
  function renderProjects(profile) {
    var grid = document.getElementById('pikoProfileProjectsGrid');
    if (!grid) return;

    var projects = [];
    try { projects = JSON.parse(localStorage.getItem('amp_admin_projects_hub') || '[]'); } catch(e) {}

    if (profile.email) {
      projects = projects.filter(function(p) {
        return p.contact && p.contact.toLowerCase() === profile.email.toLowerCase();
      });
    } else {
      projects = [];
    }

    if (!projects.length) {
      grid.innerHTML = '<p class="piko-profile-empty">No projects submitted yet. Share what you\'re building with the community!</p>';
      return;
    }

    var stageColors = { idea:'#f0c96a', building:'#54d1ff', live:'#4caf7a' };
    grid.innerHTML = projects.map(function(p) {
      var col = stageColors[p.stage] || '#f0c96a';
      return '<div class="ecosystem-project-card" style="background:rgba(255,255,255,.03)">' +
        '<div class="epc-header">' +
          '<span class="epc-name">' + esc(p.name) + '</span>' +
          '<span class="epc-stage" style="background:' + col + '22;color:' + col + '">' + (p.stage||'idea') + '</span>' +
        '</div>' +
        '<p class="epc-desc">' + esc(p.desc) + '</p>' +
        '<div class="piko-profile-idea-meta">' +
          '<span style="color:' + (p.status==='approved' ? '#4caf7a' : '#ffb347') + '">' +
            (p.status==='approved' ? '✓ On Showcase' : '⏳ Pending Review') +
          '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── Learning progress ── */
  var CULTURALVERSE_MODULES = [
    'Hawaiian History', 'Pacific Islanders', 'Indigenous Knowledge',
    'Cultural Connections', 'Oral Traditions', 'Ancestral Navigation',
    'Language & Identity', 'Modern Sovereignty',
  ];
  var DIGITALVERSE_MODULES = [
    'Bitcoin Fundamentals', 'Ethereum & Smart Contracts', 'XRPL Deep Dive',
    'Flare & Songbird', 'DeFi & AMMs', 'Web3 Security',
    'Scam Field Guide', 'Protocol Comparison',
    'Blockchain Forensics Intro', 'NaluLF Workflow',
  ];

  function loadLearning() {
    try { return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}'); } catch(e) { return {}; }
  }

  function renderLearning() {
    var learn = loadLearning();
    renderTrack('culturalverse', CULTURALVERSE_MODULES, learn.culturalverse || []);
    renderTrack('digitalverse',  DIGITALVERSE_MODULES,  learn.digitalverse  || []);
  }

  function renderTrack(trackId, modules, completed) {
    var progressEl = document.getElementById(trackId + 'Progress');
    var modulesEl  = document.getElementById(trackId + 'Modules');
    if (!modulesEl) return;

    var pct = modules.length ? Math.round(completed.length / modules.length * 100) : 0;
    if (progressEl) progressEl.style.width = pct + '%';

    modulesEl.innerHTML = modules.map(function(mod) {
      var done = completed.includes(mod);
      return '<button class="piko-learn-module piko-learn-module--' + (done ? 'done' : 'todo') + '" ' +
        'data-track="' + esc(trackId) + '" data-module="' + esc(mod) + '" type="button">' +
        '<i class="fas fa-' + (done ? 'circle-check' : 'circle') + '"></i> ' +
        esc(mod) +
      '</button>';
    }).join('');

    // Wire toggle
    modulesEl.querySelectorAll('.piko-learn-module').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var track  = btn.dataset.track;
        var module = btn.dataset.module;
        var learn  = loadLearning();
        var list   = learn[track] || [];
        var idx    = list.indexOf(module);
        if (idx > -1) list.splice(idx, 1);
        else          list.push(module);
        learn[track] = list;
        localStorage.setItem(LEARN_KEY, JSON.stringify(learn));
        renderTrack(track, track === 'culturalverse' ? CULTURALVERSE_MODULES : DIGITALVERSE_MODULES, list);
        toast(idx > -1 ? module + ' marked incomplete' : '✅ ' + module + ' complete!');
      });
    });
  }

  /* ── Auth tabs ── */
  function initAuthTabs() {
    document.querySelectorAll('.piko-auth-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.piko-auth-tab').forEach(function(b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-auth-pane').forEach(function(p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var pane = document.getElementById('pikoAuth' + btn.dataset.authTab.charAt(0).toUpperCase() + btn.dataset.authTab.slice(1));
        if (pane) pane.classList.add('is-active');
      });
    });
  }

  /* ── Profile tabs ── */
  function initProfileTabs() {
    document.querySelectorAll('.piko-profile-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.piko-profile-tab').forEach(function(b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-profile-pane').forEach(function(p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var paneId = 'pikoProfilePane' + btn.dataset.ptab.charAt(0).toUpperCase() + btn.dataset.ptab.slice(1);
        var pane = document.getElementById(paneId);
        if (pane) pane.classList.add('is-active');
      });
    });
  }

  /* ── Sign up ── */
  function initSignup() {
    var btn = document.getElementById('pikoSignupBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var name  = (document.getElementById('signupName')?.value || '').trim();
      var email = (document.getElementById('signupEmail')?.value || '').trim();
      if (!email || !email.includes('@')) {
        showStatus('pikoSignupStatus', 'Please enter a valid email address.', 'err'); return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating profile…';

      var ts = Date.now();
      var profile = {
        email:        email,
        display_name: name || email.split('@')[0],
        bio:          '',
        avatar_url:   '',
        social:       '',
        joined_ts:    ts,
        verified:     false,
        pendingToken: 'local-' + Math.random().toString(36).slice(2),
      };

      // Try Worker first
      if (WORKER_URL) {
        fetch(WORKER_URL + '/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, displayName: name, joinedTs: ts }),
        }).then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.ok) {
              profile.verified = false;
              saveProfile(profile);
              showStatus('pikoSignupStatus',
                '✅ Profile created! Check your email for a verification link.\n\nMagic link: ' + d.magicLink,
                'ok');
            } else {
              throw new Error(d.error || 'Server error');
            }
          }).catch(function(e) {
            // Fallback: local-only
            profile.verified = true;
            saveProfile(profile);
            showStatus('pikoSignupStatus', '✅ Profile created! (Offline mode — no email sent)', 'ok');
            setTimeout(function() { showProfile(profile); }, 1500);
          }).finally(function() {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create My Profile';
          });
      } else {
        // No Worker — local only
        profile.verified = true;
        saveProfile(profile);
        showStatus('pikoSignupStatus', '✅ Profile created!', 'ok');
        setTimeout(function() { showProfile(profile); }, 1200);
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create My Profile';
      }
    });
  }

  /* ── Sign in ── */
  function initSignin() {
    var btn = document.getElementById('pikoSigninBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
      var email = (document.getElementById('signinEmail')?.value || '').trim();
      if (!email || !email.includes('@')) {
        showStatus('pikoSigninStatus', 'Please enter your email.', 'err'); return;
      }

      // Check if we have a local profile
      var local = loadProfile();
      if (local && local.email && local.email.toLowerCase() === email.toLowerCase()) {
        showStatus('pikoSigninStatus', '✅ Welcome back! Logging you in…', 'ok');
        setTimeout(function() { showProfile(local); }, 800);
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending link…';

      if (WORKER_URL) {
        fetch(WORKER_URL + '/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email }),
        }).then(function(r) { return r.json(); })
          .then(function(d) {
            if (d.ok) {
              // Save skeleton profile
              saveProfile({ email: email, verified: false });
              showStatus('pikoSigninStatus',
                '✅ Check your email for a sign-in link!\n\nLink: ' + d.magicLink, 'ok');
            }
          }).catch(function() {
            showStatus('pikoSigninStatus', 'Could not reach server. Try again.', 'err');
          }).finally(function() {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-envelope"></i> Send Sign-In Link';
          });
      } else {
        showStatus('pikoSigninStatus', 'Worker not configured. Set it up in Admin → Settings.', 'err');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-envelope"></i> Send Sign-In Link';
      }
    });
  }

  /* ── Sign out ── */
  function initSignOut() {
    var btn = document.getElementById('pikoSignOut');
    if (!btn) return;
    btn.addEventListener('click', function() {
      localStorage.removeItem(PROFILE_KEY);
      showAuthGate();
      toast('Signed out.');
    });
  }

  /* ── Edit profile ── */
  function initEditProfile() {
    var editBtn    = document.getElementById('pikoEditProfileBtn');
    var cancelBtn  = document.getElementById('pikoCancelEditBtn');
    var saveBtn    = document.getElementById('pikoSaveProfileBtn');
    var form       = document.getElementById('pikoProfileEditForm');
    var avatarBtn  = document.getElementById('pikoAvatarEditBtn');
    var avatarFile = document.getElementById('pikoAvatarFile');

    if (editBtn) editBtn.addEventListener('click', function() {
      var p = loadProfile() || {};
      var nameEl    = document.getElementById('editName');
      var bioEl     = document.getElementById('editBio');
      var avatarEl  = document.getElementById('editAvatarUrl');
      var socialEl  = document.getElementById('editSocial');
      if (nameEl)   nameEl.value   = p.display_name || '';
      if (bioEl)    bioEl.value    = p.bio || '';
      if (avatarEl) avatarEl.value = p.avatar_url || '';
      if (socialEl) socialEl.value = p.social || '';
      if (form) form.hidden = false;
    });

    if (cancelBtn) cancelBtn.addEventListener('click', function() {
      if (form) form.hidden = true;
    });

    if (saveBtn) saveBtn.addEventListener('click', function() {
      var p    = loadProfile() || {};
      var name = (document.getElementById('editName')?.value || '').trim();
      p.display_name = name || p.display_name;
      p.bio          = (document.getElementById('editBio')?.value || '').trim();
      p.avatar_url   = (document.getElementById('editAvatarUrl')?.value || '').trim();
      p.social       = (document.getElementById('editSocial')?.value || '').trim();
      saveProfile(p);
      renderProfileHeader(p);
      if (form) form.hidden = true;
      toast('✅ Profile updated!');

      // Sync to Worker if available
      if (WORKER_URL) {
        fetch(WORKER_URL + '/api/members/' + encodeURIComponent(p.email) + '/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: p.display_name, bio: p.bio, avatarUrl: p.avatar_url, social: p.social }),
        }).catch(function(){});
      }
    });

    // Avatar upload (convert to data URL, store locally)
    if (avatarBtn && avatarFile) {
      avatarBtn.addEventListener('click', function() { avatarFile.click(); });
      avatarFile.addEventListener('change', function() {
        var file = avatarFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          var p = loadProfile() || {};
          p.avatar_url = e.target.result;
          saveProfile(p);
          renderProfileHeader(p);
          toast('✅ Avatar updated!');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ── Quick links from profile ── */
  function initProfileLinks() {
    var submitIdeaBtn    = document.getElementById('pikoSubmitIdeaBtn');
    var submitProjectBtn = document.getElementById('pikoSubmitProjectBtn');
    if (submitIdeaBtn)    submitIdeaBtn.addEventListener('click', function() {
      window.location.href = 'index.html#ideas';
    });
    if (submitProjectBtn) submitProjectBtn.addEventListener('click', function() {
      window.location.href = 'index.html#showcase';
    });
  }

  /* ── Add profile link to hub nav ── */
  function addProfileLink() {
    // This runs on profile.html — nothing to do here
  }

  /* ── Init ── */
  function init() {
    initAuthTabs();
    initProfileTabs();
    initSignup();
    initSignin();
    initSignOut();
    initEditProfile();
    initProfileLinks();
    checkMagicLink();

    if (isLoggedIn()) {
      showProfile(loadProfile());
    } else {
      showAuthGate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();