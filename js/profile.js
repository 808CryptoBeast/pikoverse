/**
 * profile.js — Pikoverse Profile System
 * Requires: js/supabase-client.js loaded first
 * Auth:     Supabase email + password
 * Fallback: localStorage when Supabase is unavailable
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════
     CONSTANTS
  ════════════════════════════════════════════ */
  var PROFILE_KEY = 'piko_profile_v1';
  var LEARN_KEY   = 'piko_learning_v1';
  var NOTIF_KEY   = 'piko_notifs_v1';
  var SAVED_KEY   = 'piko_saved_v1';
  var THEME_KEY   = 'piko_theme_v1';

  var DB = null;
  var OFFLINE = true;
  var SESSION_USER = null;
  var AUTH_SUB = null;

  var STATE = {
    profile: null,
    ideas: [],
    projects: [],
    orders: [],
    notifs: [],
    saved: [],
    learn: {},
    theme: {}
  };

  var CV = [
    'Hawaiian History',
    'Pacific Islanders',
    'Indigenous Knowledge',
    'Cultural Connections',
    'Oral Traditions',
    'Ancestral Navigation',
    'Language & Identity',
    'Modern Sovereignty'
  ];

  var DV = [
    'Bitcoin Fundamentals',
    'Ethereum & Smart Contracts',
    'XRPL Deep Dive',
    'Flare & Songbird',
    'DeFi & AMMs',
    'Web3 Security',
    'Scam Field Guide',
    'Protocol Comparison',
    'Blockchain Forensics Intro',
    'NaluLF Workflow'
  ];

  var RANKS = [
    { id: 'seedling', label: 'Seedling', icon: '🌱', min: 0,  color: '#4caf7a', bg: 'rgba(76,175,122,.15)',  border: 'rgba(76,175,122,.3)'  },
    { id: 'grower',   label: 'Grower',   icon: '🌿', min: 5,  color: '#54d1ff', bg: 'rgba(84,209,255,.15)',  border: 'rgba(84,209,255,.3)'  },
    { id: 'weaver',   label: 'Weaver',   icon: '🔮', min: 15, color: '#9d64ff', bg: 'rgba(157,100,255,.15)', border: 'rgba(157,100,255,.3)' },
    { id: 'elder',    label: 'Elder',    icon: '⭐', min: 30, color: '#f0c96a', bg: 'rgba(240,201,106,.18)', border: 'rgba(240,201,106,.4)'  }
  ];

  var BADGES = [
    { id: 'first_idea',    icon: '💡', name: 'First Idea',       desc: 'Shared your first idea with the community' },
    { id: 'project_live',  icon: '🚀', name: 'Project Live',     desc: 'Had a project approved to the showcase' },
    { id: 'chronicle_sub', icon: '📜', name: 'Chronicle Reader', desc: 'Subscribed to the Pikoverse Chronicle' },
    { id: 'early_member',  icon: '🌺', name: 'Early Member',     desc: 'Joined during the founding wave' },
    { id: 'idea_x5',       icon: '🔥', name: 'Idea Machine',     desc: 'Submitted 5 or more ideas' },
    { id: 'learner',       icon: '🎓', name: 'Knowledge Seeker', desc: 'Completed a learning module' },
    { id: 'connector',     icon: '🔗', name: 'Connector',        desc: 'Active across multiple Pikoverse areas' },
    { id: 'first_order',   icon: '🛍️', name: 'First Purchase',   desc: 'Placed your first marketplace order' }
  ];

  var THEME_PRESETS = {
    default: { themeId:'default', accent:'#f0c96a', bg:'#080b14', bg2:'#0d1220', text:'rgba(255,255,255,.88)', cardBg:'rgba(255,255,255,.03)', font:'Montserrat', customCss:'', bgMode:'default', bgUrl:'', bannerData:'', bannerUrl:'' },
    ocean:   { themeId:'ocean',   accent:'#54d1ff', bg:'#001a2e', bg2:'#003366', text:'rgba(220,240,255,.9)',  cardBg:'rgba(0,50,100,.2)',   font:'Montserrat', customCss:'', bgMode:'gradient2', bgUrl:'', bannerData:'', bannerUrl:'' },
    jungle:  { themeId:'jungle',  accent:'#4caf7a', bg:'#0a1a0a', bg2:'#0d2e1a', text:'rgba(220,255,230,.88)', cardBg:'rgba(0,60,20,.2)',    font:'Montserrat', customCss:'', bgMode:'gradient3', bgUrl:'', bannerData:'', bannerUrl:'' },
    sunset:  { themeId:'sunset',  accent:'#ff9f43', bg:'#1a0a0a', bg2:'#2e1800', text:'rgba(255,240,220,.88)', cardBg:'rgba(60,20,0,.2)',    font:'Montserrat', customCss:'', bgMode:'gradient4', bgUrl:'', bannerData:'', bannerUrl:'' },
    neon:    { themeId:'neon',    accent:'#ff6fd8', bg:'#050010', bg2:'#0d0020', text:'rgba(255,220,255,.88)', cardBg:'rgba(30,0,60,.2)',    font:'Montserrat', customCss:'', bgMode:'gradient1', bgUrl:'', bannerData:'', bannerUrl:'' },
    light:   { themeId:'light',   accent:'#4060d0', bg:'#f0f4ff', bg2:'#e0e8ff', text:'rgba(20,30,60,.9)',     cardBg:'rgba(255,255,255,.7)', font:'Montserrat', customCss:'', bgMode:'light',     bgUrl:'', bannerData:'', bannerUrl:'' }
  };

  var BG_MAP = {
    default:   'linear-gradient(135deg,#080b14,#141830)',
    stars:     '#050510',
    gradient1: 'linear-gradient(135deg,#0a0020,#200040,#000020)',
    gradient2: 'linear-gradient(135deg,#001020,#002040,#003060)',
    gradient3: 'linear-gradient(135deg,#0a1a05,#102a10,#1a3a1a)',
    gradient4: 'linear-gradient(135deg,#1a0a00,#2a1500,#1a0a00)',
    light:     'linear-gradient(135deg,#f0f4ff,#e0e8ff)'
  };

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function $(id) { return document.getElementById(id); }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function removeJSON(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function scopedKey(base) {
    var scope = SESSION_USER && SESSION_USER.id
      ? SESSION_USER.id
      : (STATE.profile && STATE.profile.email ? STATE.profile.email : 'guest');
    return base + ':' + scope;
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function toast(msg, dur) {
    var el = $('pikoProfileToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove('is-visible');
    }, dur || 3200);
  }

  function showStatus(id, msg, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'piko-auth-status piko-auth-status--' + (type || 'info');
    el.hidden = false;
  }

  function clearStatus(id) {
    var el = $(id);
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
    el.className = 'piko-auth-status';
  }

  function timeAgo(ts) {
    var t = Number(ts || 0);
    if (!t) return '';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function fmtPrice(cents) {
    return '$' + (Number(cents || 0) / 100).toFixed(2);
  }

  function getUserId() {
    return SESSION_USER && SESSION_USER.id ? SESSION_USER.id : null;
  }

  function getUserEmail() {
    if (SESSION_USER && SESSION_USER.email) return SESSION_USER.email;
    if (STATE.profile && STATE.profile.email) return STATE.profile.email;
    return '';
  }

  function supa() {
    return DB || window.piko_supa || null;
  }

  function ensureSupabaseReference() {
    if (window.piko_supa) {
      DB = window.piko_supa;
      OFFLINE = false;
    }
  }

  function defaultProfileForUser(user) {
    return {
      id: user.id || ('offline-' + Date.now()),
      email: user.email || '',
      display_name:
        (user.user_metadata && user.user_metadata.display_name) ||
        (user.email ? user.email.split('@')[0] : 'Pikoverse Member'),
      bio: '',
      avatar_url: '',
      banner_url: '',
      social: '',
      hide_email: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /* ════════════════════════════════════════════
     PASSWORD STRENGTH
  ════════════════════════════════════════════ */
  function getPasswordStrength(pw) {
    if (!pw) return { label: '', pct: 0, color: 'transparent' };
    var score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    var levels = [
      { label: '',            pct: 0,   color: 'transparent' },
      { label: 'Weak',        pct: 20,  color: '#e05252' },
      { label: 'Fair',        pct: 40,  color: '#ff9f43' },
      { label: 'Good',        pct: 60,  color: '#f0c96a' },
      { label: 'Strong',      pct: 80,  color: '#4caf7a' },
      { label: 'Very Strong', pct: 100, color: '#54d1ff' }
    ];

    return levels[Math.min(score, 5)];
  }

  function bindStrength(inputId, barId, labelId) {
    var input = $(inputId);
    var bar = $(barId);
    var label = $(labelId);
    if (!input || !bar) return;

    function update() {
      var s = getPasswordStrength(input.value);
      bar.style.width = s.pct + '%';
      bar.style.background = s.color;
      if (label) {
        label.textContent = s.label;
        label.style.color = s.color;
      }
    }

    input.addEventListener('input', update);
    update();
  }

  /* ════════════════════════════════════════════
     LOCAL USER DATA
  ════════════════════════════════════════════ */
  function loadThemeLocal() {
    var t = readJSON(scopedKey(THEME_KEY), null);
    return t ? t : Object.assign({}, THEME_PRESETS.default);
  }

  function saveThemeLocal(theme) {
    saveJSON(scopedKey(THEME_KEY), theme || THEME_PRESETS.default);
  }

  function loadLearnLocal() {
    return readJSON(scopedKey(LEARN_KEY), {});
  }

  function saveLearnLocal(learn) {
    saveJSON(scopedKey(LEARN_KEY), learn || {});
  }

  function loadNotifsLocal() {
    return readJSON(scopedKey(NOTIF_KEY), []);
  }

  function saveNotifsLocal(list) {
    saveJSON(scopedKey(NOTIF_KEY), list || []);
  }

  function loadSavedLocal() {
    return readJSON(scopedKey(SAVED_KEY), []);
  }

  function saveSavedLocal(list) {
    saveJSON(scopedKey(SAVED_KEY), list || []);
  }

  /* ════════════════════════════════════════════
     THEME + STYLE
  ════════════════════════════════════════════ */
  function applyTheme(theme) {
    var t = Object.assign({}, THEME_PRESETS.default, theme || {});
    STATE.theme = t;

    document.documentElement.style.setProperty('--pf-gold', t.accent || '#f0c96a');
    document.documentElement.style.setProperty('--pf-dark', t.bg || '#080b14');
    document.documentElement.style.setProperty('--pf-dark2', t.bg2 || '#0d1220');
    document.documentElement.style.setProperty('--pf-text', t.text || 'rgba(255,255,255,.88)');

    var body = document.body;
    if (!body) return;

    if (t.bgUrl) {
      body.style.background = 'url("' + t.bgUrl + '") center/cover fixed no-repeat';
    } else {
      body.style.background = BG_MAP[t.bgMode] || t.bg || BG_MAP.default;
    }

    body.style.color = t.text || 'rgba(255,255,255,.88)';
    body.style.fontFamily = t.font || 'Montserrat';

    var customStyle = $('pikoCustomStyle');
    if (customStyle) {
      customStyle.textContent = (customStyle.textContent || '').split('/*__PIKO_CUSTOM__*/')[0] +
        '\n/*__PIKO_CUSTOM__*/\n' + (t.customCss || '');
    }
  }

  function currentNameStyle() {
    return readJSON(scopedKey('piko_name_style_v1'), {
      color: '#ffffff',
      font: '',
      weight: '700',
      size: 28
    });
  }

  function saveNameStyle(styleObj) {
    saveJSON(scopedKey('piko_name_style_v1'), styleObj || {});
  }

  function applyNameStyle(styleObj) {
    var nameEl = $('pikoProfileName');
    var preview = $('pikoNamePreview');
    var targets = [nameEl, preview].filter(Boolean);

    targets.forEach(function (el) {
      el.style.color = styleObj.color || '';
      el.style.fontFamily = styleObj.font || '';
      el.style.fontWeight = styleObj.weight || '';
      el.style.fontSize = styleObj.size ? String(styleObj.size) + 'px' : '';
      el.style.textShadow = styleObj.color ? ('0 0 18px ' + styleObj.color + '55') : '';
    });
  }

  function setHideEmail(enabled) {
    saveJSON(scopedKey('piko_hide_email_v1'), !!enabled);
    if (STATE.profile) STATE.profile.hide_email = !!enabled;
  }

  function getHideEmail() {
    return !!readJSON(scopedKey('piko_hide_email_v1'), false);
  }

  function bannerValue() {
    var theme = STATE.theme || loadThemeLocal();
    return theme.bannerData || theme.bannerUrl || '';
  }

  /* ════════════════════════════════════════════
     PROFILE DATA
  ════════════════════════════════════════════ */
  async function ensureProfileRecord(user) {
    var cached = readJSON(PROFILE_KEY, null);
    if (OFFLINE || !user || !supa()) {
      var offlineProfile = cached && cached.email === user.email ? cached : defaultProfileForUser(user);
      saveJSON(PROFILE_KEY, offlineProfile);
      return offlineProfile;
    }

    var r = await supa().from('profiles').select('*').eq('id', user.id).maybeSingle();

    if (!r.error && r.data) {
      var remote = r.data;
      var local = cached || {};
      var merged = Object.assign({}, remote);

      var fallbackToLocal = [
        'display_name', 'bio', 'avatar_url', 'banner_url', 'social',
        'hide_email', 'created_at', 'updated_at'
      ];

      fallbackToLocal.forEach(function (k) {
        var localVal = local[k];
        var remoteVal = merged[k];
        var remoteEmpty = remoteVal === undefined || remoteVal === null || remoteVal === '';
        var localReal = localVal !== undefined && localVal !== null && localVal !== '';
        if (remoteEmpty && localReal) merged[k] = localVal;
      });

      saveJSON(PROFILE_KEY, merged);
      return merged;
    }

    var fallback = {
      id: user.id,
      email: user.email,
      display_name:
        (user.user_metadata && user.user_metadata.display_name) ||
        (user.email ? user.email.split('@')[0] : 'Pikoverse Member'),
      bio: '',
      avatar_url: '',
      banner_url: '',
      social: '',
      hide_email: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    var up = await supa().from('profiles').upsert({
      id: fallback.id,
      email: fallback.email,
      display_name: fallback.display_name,
      bio: fallback.bio,
      avatar_url: fallback.avatar_url,
      social: fallback.social
    }, { onConflict: 'id' }).select().maybeSingle();

    if (!up.error && up.data) {
      saveJSON(PROFILE_KEY, up.data);
      return up.data;
    }

    saveJSON(PROFILE_KEY, fallback);
    return fallback;
  }

  async function saveProfile() {
    if (!STATE.profile) return;
    saveJSON(PROFILE_KEY, STATE.profile);

    if (OFFLINE || !supa() || !SESSION_USER) return;

    await supa().from('profiles').upsert({
      id: SESSION_USER.id,
      email: SESSION_USER.email,
      display_name: STATE.profile.display_name || (SESSION_USER.email ? SESSION_USER.email.split('@')[0] : 'Pikoverse Member'),
      bio: STATE.profile.bio || '',
      avatar_url: STATE.profile.avatar_url || '',
      social: STATE.profile.social || ''
    }, { onConflict: 'id' });
  }

  async function fetchIdeas() {
    var email = getUserEmail().toLowerCase();
    var local = readJSON('amp_admin_ideas', []).filter(function (i) {
      return i && i.contact && String(i.contact).toLowerCase() === email;
    });

    if (OFFLINE || !supa() || !email) return local;

    try {
      var r = await supa().from('community_ideas').select('*').eq('contact', email).order('ts', { ascending: false });
      return r.error ? local : (r.data || local);
    } catch (e) {
      return local;
    }
  }

  async function fetchProjects() {
    var email = getUserEmail().toLowerCase();
    var local = readJSON('amp_admin_projects_hub', []).filter(function (p) {
      return p && p.contact && String(p.contact).toLowerCase() === email;
    });

    if (OFFLINE || !supa()) return local;

    try {
      var r = SESSION_USER
        ? await supa().from('projects').select('*').eq('user_id', SESSION_USER.id).order('created_at', { ascending: false })
        : { error: true };

      if (!r.error && r.data && r.data.length) {
        return r.data.map(function (row) {
          return {
            id: row.id || ('proj-' + row.created_at),
            name: row.name || '',
            desc: row.description || row.desc || '',
            stage: row.stage || 'idea',
            link: row.url || row.link || '',
            status: row.status || 'pending',
            contact: row.contact || getUserEmail(),
            ts: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          };
        });
      }

      var r2 = await supa().from('projects').select('*').eq('contact', getUserEmail()).order('created_at', { ascending: false });
      if (!r2.error && r2.data && r2.data.length) {
        return r2.data.map(function (row) {
          return {
            id: row.id || ('proj-' + row.created_at),
            name: row.name || '',
            desc: row.description || row.desc || '',
            stage: row.stage || 'idea',
            link: row.url || row.link || '',
            status: row.status || 'pending',
            contact: row.contact || getUserEmail(),
            ts: row.created_at ? new Date(row.created_at).getTime() : Date.now()
          };
        });
      }

      return local;
    } catch (e) {
      return local;
    }
  }

  async function fetchOrders() {
    var email = getUserEmail().toLowerCase();
    return readJSON('amp_orders_v1', []).filter(function (o) {
      var orderEmail = String(o.email || o.customer_email || o.contact || '').toLowerCase();
      return email && orderEmail === email;
    });
  }

  function addNotif(icon, text) {
    var list = loadNotifsLocal();
    list.unshift({
      id: 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      icon: icon,
      text: text,
      ts: Date.now(),
      read: false
    });
    if (list.length > 40) list.length = 40;
    saveNotifsLocal(list);
    STATE.notifs = list;
    renderNotifications();
    updateNotifBadge();
  }

  /* ════════════════════════════════════════════
     AUTH UI
  ════════════════════════════════════════════ */
  function showAuthGate() {
    var gate = $('pikoAuthGate');
    var section = $('pikoProfileSection');
    var signOut = $('pikoSignOut');
    var notif = $('pikoNotifBtn');
    var customize = $('pikoCustomizeTrigger');

    if (gate) gate.hidden = false;
    if (section) section.hidden = true;
    if (signOut) signOut.hidden = true;
    if (notif) notif.hidden = true;
    if (customize) customize.hidden = true;
  }

  function showProfileSection() {
    var gate = $('pikoAuthGate');
    var section = $('pikoProfileSection');
    var signOut = $('pikoSignOut');
    var notif = $('pikoNotifBtn');
    var customize = $('pikoCustomizeTrigger');

    if (gate) gate.hidden = true;
    if (section) section.hidden = false;
    if (signOut) signOut.hidden = false;
    if (notif) notif.hidden = false;
    if (customize) customize.hidden = false;
  }

  function initAuthTabs() {
    document.querySelectorAll('.piko-auth-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.piko-auth-tab').forEach(function (b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-auth-pane').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var tab = btn.getAttribute('data-auth-tab');
        var pane = $('pikoAuth' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (pane) pane.classList.add('is-active');
      });
    });
  }

  function initProfileTabs() {
    document.querySelectorAll('.piko-profile-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-ptab');
        document.querySelectorAll('.piko-profile-tab').forEach(function (b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-profile-pane').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var pane = $('pikoProfilePane' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (pane) pane.classList.add('is-active');
      });
    });
  }

  function initEditTabs() {
    document.querySelectorAll('.piko-edit-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-etab');
        document.querySelectorAll('.piko-edit-tab').forEach(function (b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-edit-pane').forEach(function (p) { p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var pane = $('pikoEditPane' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (pane) pane.classList.add('is-active');
      });
    });
  }

  async function initSignup() {
    var btn = $('pikoSignupBtn');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      clearStatus('pikoSignupStatus');

      var name = (($('signupName') || {}).value || '').trim();
      var email = (($('signupEmail') || {}).value || '').trim().toLowerCase();
      var pass = (($('signupPassword') || {}).value || '').trim();
      var pass2 = (($('signupPassword2') || {}).value || '').trim();

      if (!name)                        { showStatus('pikoSignupStatus', 'Please enter a display name.', 'err'); return; }
      if (!validEmail(email))           { showStatus('pikoSignupStatus', 'Please enter a valid email address.', 'err'); return; }
      if (pass.length < 8)              { showStatus('pikoSignupStatus', 'Password must be at least 8 characters.', 'err'); return; }
      if (pass !== pass2)               { showStatus('pikoSignupStatus', 'Passwords do not match.', 'err'); return; }

      ensureSupabaseReference();

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating profile…';

      if (OFFLINE || !supa()) {
        var localProfile = {
          id: 'offline-' + Date.now(),
          email: email,
          display_name: name || email.split('@')[0],
          bio: '',
          avatar_url: '',
          banner_url: '',
          social: '',
          hide_email: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        STATE.profile = localProfile;
        SESSION_USER = { id: localProfile.id, email: localProfile.email, user_metadata: { display_name: localProfile.display_name } };
        saveJSON(PROFILE_KEY, localProfile);
        addNotif('🌺', 'Welcome to Pikoverse, ' + localProfile.display_name + '!');
        showStatus('pikoSignupStatus', '✅ Local profile created on this browser.', 'ok');
        await refreshProfileView();
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create My Profile';
        return;
      }

      try {
        var r = await supa().auth.signUp({
          email: email,
          password: pass,
          options: { data: { display_name: name } }
        });

        if (r.error) throw r.error;

        if (r.data && r.data.user) {
          SESSION_USER = r.data.user;
          STATE.profile = await ensureProfileRecord(r.data.user);
          STATE.profile.display_name = name;
          await saveProfile();
          addNotif('🌺', 'Welcome to Pikoverse, ' + name + '!');

          if (r.data.session) {
            showStatus('pikoSignupStatus', '✅ Profile created! Signing you in…', 'ok');
            setTimeout(async function () {
              await refreshProfileView();
            }, 500);
          } else {
            showStatus('pikoSignupStatus', '✅ Account created. Check your email if confirmation is enabled, then sign in.', 'ok');
          }
        }
      } catch (err) {
        showStatus('pikoSignupStatus', '⚠️ ' + ((err && err.message) ? err.message : 'Could not create profile.'), 'err');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Create My Profile';
      }
    });
  }

  async function initSignin() {
    var btn = $('pikoSigninBtn');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      clearStatus('pikoSigninStatus');

      var email = (($('signinEmail') || {}).value || '').trim();
      var pass = (($('signinPassword') || {}).value || '').trim();

      if (!validEmail(email)) { showStatus('pikoSigninStatus', 'Please enter your email.', 'err'); return; }
      if (!pass)              { showStatus('pikoSigninStatus', 'Please enter your password.', 'err'); return; }

      ensureSupabaseReference();

      if (OFFLINE || !supa()) {
        if (window.PIKO_SUPA_READY === false && !window.piko_supa) {
          showStatus('pikoSigninStatus', 'Supabase is not ready or could not connect. Refresh and try again.', 'err');
          return;
        }

        var local = readJSON(PROFILE_KEY, null);
        if (local && local.email && local.email.toLowerCase() === email.toLowerCase()) {
          SESSION_USER = { id: local.id || ('offline-' + Date.now()), email: local.email, user_metadata: { display_name: local.display_name || '' } };
          STATE.profile = local;
          await refreshProfileView();
          return;
        }

        showStatus('pikoSigninStatus', 'Supabase is not available and no local profile exists on this browser.', 'err');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…';

      try {
        var r = await supa().auth.signInWithPassword({ email: email, password: pass });

        if (r.error) throw r.error;

        SESSION_USER = r.data.user;
        showStatus('pikoSigninStatus', '✅ Welcome back!', 'ok');
        setTimeout(async function () {
          await refreshProfileView();
        }, 300);
      } catch (err) {
        var msg = ((err && err.message) ? err.message : 'Could not sign in.');
        if (msg.toLowerCase().indexOf('invalid') > -1) msg = 'Wrong email or password. Please try again.';
        showStatus('pikoSigninStatus', msg, 'err');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
      }
    });

    var forgot = $('pikoForgotBtn');
    if (!forgot) return;

    forgot.addEventListener('click', async function () {
      clearStatus('pikoSigninStatus');

      var email = (($('signinEmail') || {}).value || '').trim();
      if (!validEmail(email)) {
        showStatus('pikoSigninStatus', 'Enter your email address above first.', 'err');
        return;
      }

      ensureSupabaseReference();
      if (OFFLINE || !supa()) {
        showStatus('pikoSigninStatus', 'Password reset requires Supabase to be available.', 'err');
        return;
      }

      forgot.disabled = true;
      forgot.textContent = 'Sending…';

      try {
        var r = await supa().auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/profile.html?reset=1'
        });

        if (r.error) throw r.error;
        showStatus('pikoSigninStatus', '✅ Password reset link sent to ' + email + '. Check your inbox.', 'ok');
      } catch (err) {
        showStatus('pikoSigninStatus', '⚠️ ' + ((err && err.message) ? err.message : 'Could not send password reset link.'), 'err');
      } finally {
        forgot.disabled = false;
        forgot.textContent = 'Forgot password?';
      }
    });
  }

  function initSignOut() {
    var btn = $('pikoSignOut');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      try {
        if (!OFFLINE && supa()) await supa().auth.signOut();
      } catch (e) {}

      if (AUTH_SUB && typeof AUTH_SUB.unsubscribe === 'function') {
        try { AUTH_SUB.unsubscribe(); } catch (e2) {}
      }

      removeJSON(PROFILE_KEY);
      SESSION_USER = null;
      STATE.profile = null;
      showAuthGate();
      toast('Signed out.');
    });
  }

  function handlePasswordReset() {
    if (window.location.search.indexOf('reset=1') === -1) return;

    window.history.replaceState({}, '', window.location.pathname);

    var panel = document.createElement('div');
    panel.id = 'pikoResetPanel';
    panel.style.cssText = 'position:fixed;inset:0;background:rgba(8,11,20,.96);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px;';
    panel.innerHTML = '' +
      '<div style="width:min(460px,100%);background:#0d1220;border:1px solid rgba(240,201,106,.18);border-radius:16px;padding:28px;">' +
        '<h2 style="margin:0 0 8px;font-family:Orbitron,sans-serif;color:#f0c96a;font-size:18px;">Set New Password</h2>' +
        '<p style="margin:0 0 18px;font-size:13px;color:rgba(255,255,255,.62);">Choose a new password for your Pikoverse account.</p>' +
        '<div style="margin-bottom:12px;"><input id="resetNewPass" type="password" placeholder="New password" maxlength="128" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;"></div>' +
        '<div style="margin-bottom:18px;"><input id="resetNewPass2" type="password" placeholder="Confirm new password" maxlength="128" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;"></div>' +
        '<div id="resetPanelStatus" style="font-size:13px;margin-bottom:14px;color:rgba(255,255,255,.7);"></div>' +
        '<button id="resetPanelSave" type="button" style="width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#c9a84c,#f0c96a);color:#080b14;font-weight:800;">Save New Password</button>' +
      '</div>';

    document.body.appendChild(panel);

    $('resetPanelSave').addEventListener('click', async function () {
      var np = (($('resetNewPass') || {}).value || '').trim();
      var np2 = (($('resetNewPass2') || {}).value || '').trim();
      var status = $('resetPanelStatus');

      if (np.length < 8) { if (status) status.textContent = 'Password must be at least 8 characters.'; return; }
      if (np !== np2)    { if (status) status.textContent = 'Passwords do not match.'; return; }
      if (OFFLINE || !supa()) { if (status) status.textContent = 'Supabase is not available.'; return; }

      $('resetPanelSave').disabled = true;
      $('resetPanelSave').textContent = 'Saving…';

      try {
        var r = await supa().auth.updateUser({ password: np });
        if (r.error) throw r.error;
        if (status) status.textContent = '✅ Password updated! You can sign in now.';
        setTimeout(function () {
          if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
          toast('Password updated.');
        }, 1000);
      } catch (err) {
        if (status) status.textContent = '⚠️ ' + ((err && err.message) ? err.message : 'Could not update password.');
      } finally {
        if ($('resetPanelSave')) {
          $('resetPanelSave').disabled = false;
          $('resetPanelSave').textContent = 'Save New Password';
        }
      }
    });
  }

  /* ════════════════════════════════════════════
     SCORE / RANK / BADGES
  ════════════════════════════════════════════ */
  function calcScore() {
    var ideas = STATE.ideas.length;
    var approved = STATE.projects.filter(function (p) { return p.status === 'approved' || p.status === 'live'; }).length;
    var orders = STATE.orders.length;
    var badges = earnedBadgeIds().length;
    return (ideas * 1) + (approved * 3) + (orders * 1) + (badges * 2);
  }

  function getRank(score) {
    for (var i = RANKS.length - 1; i >= 0; i--) {
      if (score >= RANKS[i].min) return RANKS[i];
    }
    return RANKS[0];
  }

  function earnedBadgeIds() {
    var earned = [];
    var ideas = STATE.ideas.length;
    var approved = STATE.projects.filter(function (p) { return p.status === 'approved' || p.status === 'live'; }).length;
    var orders = STATE.orders.length;
    var learn = STATE.learn || {};
    var profile = STATE.profile || {};
    var subbed = readJSON('amp_email_list_v1', []).indexOf(getUserEmail()) > -1;

    if (ideas >= 1) earned.push('first_idea');
    if (approved >= 1) earned.push('project_live');
    if (orders >= 1) earned.push('first_order');
    if (ideas >= 5) earned.push('idea_x5');
    if ((learn.culturalverse || []).length || (learn.digitalverse || []).length) earned.push('learner');
    if (subbed) earned.push('chronicle_sub');

    var created = profile.created_at;
    if (created) {
      if (Date.now() - new Date(created).getTime() < 90 * 24 * 60 * 60 * 1000) {
        earned.push('early_member');
      }
    }

    var platformsUsed = 0;
    if (ideas > 0) platformsUsed++;
    if (approved > 0 || STATE.projects.length > 0) platformsUsed++;
    if (orders > 0) platformsUsed++;
    if (((learn.culturalverse || []).length + (learn.digitalverse || []).length) > 0) platformsUsed++;
    if (platformsUsed >= 3) earned.push('connector');

    return earned;
  }

  function updateNotifBadge() {
    var count = (STATE.notifs || []).filter(function (n) { return !n.read; }).length;
    if ($('pikoNotifBadge')) {
      $('pikoNotifBadge').textContent = String(count);
      $('pikoNotifBadge').hidden = count < 1;
    }
    if ($('tabNotifCount')) {
      $('tabNotifCount').textContent = String(count);
      $('tabNotifCount').style.display = count < 1 ? 'none' : '';
    }
  }

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  function renderHeader() {
    var p = STATE.profile || {};
    var name = p.display_name || getUserEmail() || 'Pikoverse Member';
    var created = p.created_at;
    var hideEmail = getHideEmail();

    if ($('pikoProfileName')) $('pikoProfileName').textContent = name;
    if ($('pikoProfileBio')) $('pikoProfileBio').textContent = p.bio || '';
    if ($('pikoProfileSocial')) {
      $('pikoProfileSocial').textContent = p.social || '';
      $('pikoProfileSocial').hidden = !p.social;
    }

    if ($('pikoProfileEmail')) {
      $('pikoProfileEmail').textContent = hideEmail ? '' : (getUserEmail() || '');
      $('pikoProfileEmail').hidden = hideEmail;
    }

    if ($('pikoProfileJoined')) {
      $('pikoProfileJoined').textContent = '🌺 Joined ' + (created ? new Date(created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently');
    }

    if ($('pikoProfileAvatarInitial')) $('pikoProfileAvatarInitial').textContent = name.charAt(0).toUpperCase();
    if ($('pikoIdCardAvatar')) $('pikoIdCardAvatar').textContent = name.charAt(0).toUpperCase();

    var avatarImg = $('pikoProfileAvatarImg');
    if (avatarImg) {
      if (p.avatar_url) {
        avatarImg.src = p.avatar_url;
        avatarImg.hidden = false;
        if ($('pikoProfileAvatarInitial')) $('pikoProfileAvatarInitial').style.display = 'none';
        avatarImg.onerror = function () {
          avatarImg.hidden = true;
          if ($('pikoProfileAvatarInitial')) $('pikoProfileAvatarInitial').style.display = '';
        };
      } else {
        avatarImg.hidden = true;
        avatarImg.removeAttribute('src');
        if ($('pikoProfileAvatarInitial')) $('pikoProfileAvatarInitial').style.display = '';
      }
    }

    if ($('pikoNavAvatarImg')) {
      $('pikoNavAvatarImg').src = p.avatar_url || 'assets/goldenp.jpg';
      $('pikoNavAvatarImg').onerror = function () { this.src = 'assets/AMP Tiki.jpg'; };
    }

    var banner = bannerValue();
    if ($('pikoBanner')) {
      if (banner) {
        $('pikoBanner').style.background = 'url("' + banner + '") center/cover no-repeat';
      } else {
        $('pikoBanner').style.background = '';
      }
    }

    applyNameStyle(currentNameStyle());

    var rank = getRank(calcScore());
    if ($('pikoRankBadge')) {
      $('pikoRankBadge').textContent = rank.icon + ' ' + rank.label;
      $('pikoRankBadge').style.color = rank.color;
      $('pikoRankBadge').style.background = rank.bg;
      $('pikoRankBadge').style.borderColor = rank.border;
    }
  }

  function renderStats() {
    if ($('statIdeas')) $('statIdeas').textContent = String(STATE.ideas.length);
    if ($('statProjects')) $('statProjects').textContent = String(STATE.projects.length);
    if ($('statScore')) $('statScore').textContent = String(calcScore());
    if ($('statBadges')) $('statBadges').textContent = String(earnedBadgeIds().length);
  }

  function renderIdCard() {
    var p = STATE.profile || {};
    var name = p.display_name || getUserEmail() || 'Member';
    var rank = getRank(calcScore());

    if ($('pikoIdCardName')) $('pikoIdCardName').textContent = name;
    if ($('pikoIdCardMeta')) $('pikoIdCardMeta').textContent = rank.icon + ' ' + rank.label + ' · Pikoverse Member';
    if ($('pikoIdCardScore')) $('pikoIdCardScore').textContent = 'Score: ' + calcScore();

    if ($('pikoIdCardAvatar')) {
      if (p.avatar_url) {
        $('pikoIdCardAvatar').innerHTML = '<img src="' + esc(p.avatar_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
      } else {
        $('pikoIdCardAvatar').innerHTML = '';
        $('pikoIdCardAvatar').textContent = name.charAt(0).toUpperCase();
      }
    }

    if ($('pikoIdCardBanner')) {
      var banner = bannerValue();
      $('pikoIdCardBanner').style.background = banner
        ? ('url("' + banner + '") center/cover no-repeat')
        : 'linear-gradient(135deg,#080b14,#141830)';
    }
  }

  function renderTimeline() {
    var el = $('pikoTimeline');
    if (!el) return;

    var items = [];

    STATE.ideas.forEach(function (i) {
      items.push({
        type: 'idea',
        text: '💡 Shared idea: "' + String(i.text || '').slice(0, 70) + (String(i.text || '').length > 70 ? '…' : '') + '"',
        ts: i.ts || Date.now()
      });
    });

    STATE.projects.forEach(function (p) {
      items.push({
        type: 'project',
        text: '🚀 Submitted project: "' + String(p.name || 'Untitled Project') + '"',
        ts: p.ts || Date.now()
      });
    });

    STATE.orders.forEach(function (o) {
      items.push({
        type: 'order',
        text: '🛍️ Placed order — ' + fmtPrice(o.total || 0),
        ts: o.ts || Date.now()
      });
    });

    earnedBadgeIds().forEach(function (id) {
      var b = BADGES.find(function (x) { return x.id === id; });
      if (b) items.push({
        type: 'badge',
        text: '🏅 Earned badge: ' + b.icon + ' ' + b.name,
        ts: STATE.profile && STATE.profile.created_at ? new Date(STATE.profile.created_at).getTime() : Date.now()
      });
    });

    items.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });

    if (!items.length) {
      el.innerHTML = '<p class="piko-profile-empty">Your activity will appear here as you engage with the community.</p>';
      return;
    }

    el.innerHTML = items.slice(0, 20).map(function (item) {
      return '' +
        '<div class="piko-activity-item">' +
          '<div class="piko-activity-icon piko-activity-icon--comment"><i class="fas fa-bolt"></i></div>' +
          '<div>' +
            '<div class="piko-activity-text">' + esc(item.text) + '</div>' +
            '<div class="piko-activity-meta">' + timeAgo(item.ts) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function renderRank() {
    var score = calcScore();
    var rank = getRank(score);
    var next = null;
    for (var i = 0; i < RANKS.length; i++) {
      if (RANKS[i].min > score) {
        next = RANKS[i];
        break;
      }
    }

    var pct = next ? Math.min(100, Math.round(((score - rank.min) / Math.max(1, next.min - rank.min)) * 100)) : 100;

    if ($('rankIcon')) $('rankIcon').textContent = rank.icon;
    if ($('rankLabel')) $('rankLabel').textContent = rank.label;
    if ($('rankSub')) $('rankSub').textContent = next ? ('Keep contributing to reach ' + next.label) : 'Top rank reached';
    if ($('rankBarFill')) $('rankBarFill').style.width = pct + '%';
    if ($('rankNext')) $('rankNext').textContent = next ? (score + ' / ' + next.min + ' points to ' + next.label) : 'You have reached the highest rank';
  }

  function renderBadges() {
    var grid = $('pikoBadgesGrid');
    if (!grid) return;

    var earned = earnedBadgeIds();
    if (!earned.length) {
      grid.innerHTML = '<p class="piko-profile-empty">Your badges will appear here as you participate.</p>';
      return;
    }

    grid.innerHTML = earned.map(function (id) {
      var b = BADGES.find(function (x) { return x.id === id; });
      if (!b) return '';
      return '' +
        '<div class="piko-badge-card">' +
          '<div class="piko-badge-icon">' + b.icon + '</div>' +
          '<div class="piko-badge-name">' + esc(b.name) + '</div>' +
          '<div class="piko-badge-desc">' + esc(b.desc) + '</div>' +
        '</div>';
    }).join('');
  }

  function renderPlatforms() {
    var wrap = $('pikoPlatformsGrid');
    if (!wrap) return;

    var learn = STATE.learn || {};
    var cvDone = (learn.culturalverse || []).length;
    var dvDone = (learn.digitalverse || []).length;

    wrap.innerHTML = '' +
      '<a class="piko-platform-card" href="index.html"><strong>Pikoverse Hub</strong><span>' + esc((STATE.ideas.length + STATE.projects.length) + ' submissions') + '</span></a>' +
      '<a class="piko-platform-card" href="marketplace/index.html"><strong>AMP Marketplace</strong><span>' + esc(STATE.orders.length + ' orders') + '</span></a>' +
      '<a class="piko-platform-card" href="culturalverse.html"><strong>Culturalverse</strong><span>' + esc(cvDone + ' modules complete') + '</span></a>' +
      '<a class="piko-platform-card" href="digitalverse/index.html"><strong>DigitalVerse</strong><span>' + esc(dvDone + ' modules complete') + '</span></a>';
  }

  function renderNotifications() {
    var wrap = $('pikoNotifList');
    if (!wrap) return;

    if (!STATE.notifs.length) {
      wrap.innerHTML = '<p class="piko-profile-empty">No notifications yet.</p>';
      updateNotifBadge();
      return;
    }

    wrap.innerHTML = STATE.notifs.map(function (n) {
      return '' +
        '<div class="piko-notif-item' + (n.read ? '' : ' is-unread') + '">' +
          '<div class="piko-notif-icon">' + esc(n.icon || '🔔') + '</div>' +
          '<div class="piko-notif-content">' +
            '<div class="piko-notif-text">' + esc(n.text || '') + '</div>' +
            '<div class="piko-notif-meta">' + timeAgo(n.ts || Date.now()) + '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    updateNotifBadge();
  }

  function renderSaved() {
    var wrap = $('pikoSavedGrid');
    if (!wrap) return;

    if (!STATE.saved.length) {
      wrap.innerHTML = '<p class="piko-profile-empty">Bookmark Chronicle articles, ecosystem cards, and marketplace items to find them here.</p>';
      return;
    }

    wrap.innerHTML = STATE.saved.map(function (s, idx) {
      return '' +
        '<div class="piko-saved-card">' +
          '<div class="piko-saved-head">' +
            '<strong>' + esc(s.title || 'Saved item') + '</strong>' +
            '<button class="piko-saved-remove" data-sidx="' + idx + '" type="button">×</button>' +
          '</div>' +
          '<p>' + esc(s.type || 'Bookmark') + '</p>' +
          (s.href ? '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">Open</a>' : '') +
        '</div>';
    }).join('');

    wrap.querySelectorAll('.piko-saved-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-sidx'), 10);
        STATE.saved.splice(idx, 1);
        saveSavedLocal(STATE.saved);
        renderSaved();
      });
    });
  }

  function renderOrders() {
    var wrap = $('pikoProfileOrdersList');
    if (!wrap) return;

    if (!STATE.orders.length) {
      wrap.innerHTML = '<p class="piko-profile-empty">No orders yet. <a href="marketplace/marketplace.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>';
      return;
    }

    wrap.innerHTML = STATE.orders.map(function (o) {
      var status = String(o.status || 'pending').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      var statusCls = (o.status === 'confirmed') ? 'confirmed' : 'pending';
      var itemsText = (o.items || []).map(function (i) {
        return (i.name || 'Item') + (i.size ? ' (' + i.size + ')' : '') + ' ×' + (i.qty || 1);
      }).join(', ');

      return '' +
        '<div class="piko-order-card">' +
          '<div class="piko-order-card-header">' +
            '<span class="piko-order-id">' + esc(o.id || '') + '</span>' +
            '<span class="piko-order-status piko-order-status--' + statusCls + '">' + esc(status) + '</span>' +
          '</div>' +
          '<div class="piko-order-items">' + esc(itemsText) + '</div>' +
          '<div class="piko-order-total">' + fmtPrice(o.total || 0) + ' · ' + (o.ts ? new Date(o.ts).toLocaleDateString() : '') + '</div>' +
        '</div>';
    }).join('');
  }

  function renderIdeas() {
    var wrap = $('pikoProfileIdeasList');
    if (!wrap) return;

    if (!STATE.ideas.length) {
      wrap.innerHTML = '<p class="piko-profile-empty">No ideas shared yet. What are you thinking?</p>';
      return;
    }

    wrap.innerHTML = STATE.ideas.map(function (i) {
      return '' +
        '<div class="piko-profile-idea-card">' +
          esc(i.text || '') +
          '<div class="piko-profile-idea-meta">' +
            '<span>' + esc(i.category || 'Idea') + '</span>' +
            '<span>' + timeAgo(i.ts || Date.now()) + '</span>' +
            (i.reply ? '<span style="color:#f0c96a"><i class="fas fa-star"></i> AMP replied</span>' : '') +
          '</div>' +
        '</div>';
    }).join('');
  }

  function renderProjects() {
    var wrap = $('pikoProfileProjectsGrid');
    if (!wrap) return;

    if (!STATE.projects.length) {
      wrap.innerHTML = '<p class="piko-profile-empty">No projects submitted yet. Share what you\'re building!</p>';
      return;
    }

    var stageColors = { idea: '#f0c96a', building: '#54d1ff', live: '#4caf7a', approved: '#4caf7a' };

    wrap.innerHTML = STATE.projects.map(function (p) {
      var col = stageColors[p.stage] || '#f0c96a';
      return '' +
        '<div class="ecosystem-project-card">' +
          '<div class="epc-header">' +
            '<span class="epc-name">' + esc(p.name || 'Untitled Project') + '</span>' +
            '<span class="epc-stage" style="background:' + col + '22;color:' + col + '">' + esc(p.stage || 'idea') + '</span>' +
          '</div>' +
          '<p class="epc-desc">' + esc(p.desc || '') + '</p>' +
          '<div class="piko-profile-idea-meta">' +
            '<span style="color:' + ((p.status === 'approved' || p.status === 'live') ? '#4caf7a' : '#ffb347') + '">' +
              ((p.status === 'approved' || p.status === 'live') ? '✓ On Showcase' : '⏳ Pending Review') +
            '</span>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function renderLearning() {
    var learn = STATE.learn || {};
    renderTrack('culturalverse', CV, learn.culturalverse || []);
    renderTrack('digitalverse', DV, learn.digitalverse || []);
  }

  function renderTrack(trackId, modules, completed) {
    var progressEl = $(trackId + 'Progress');
    var wrap = $(trackId + 'Modules');
    if (!wrap) return;

    var pct = modules.length ? Math.round((completed.length / modules.length) * 100) : 0;
    if (progressEl) progressEl.style.width = pct + '%';

    wrap.innerHTML = modules.map(function (mod) {
      var done = completed.indexOf(mod) > -1;
      return '' +
        '<button class="piko-learn-module piko-learn-module--' + (done ? 'done' : 'todo') + '" data-track="' + esc(trackId) + '" data-module="' + esc(mod) + '" type="button">' +
          '<i class="fas fa-' + (done ? 'circle-check' : 'circle') + '"></i> ' + esc(mod) +
        '</button>';
    }).join('');

    wrap.querySelectorAll('.piko-learn-module').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var track = btn.getAttribute('data-track');
        var moduleName = btn.getAttribute('data-module');
        var learn = loadLearnLocal();
        var list = learn[track] || [];
        var idx = list.indexOf(moduleName);

        if (idx > -1) list.splice(idx, 1);
        else list.push(moduleName);

        learn[track] = list;
        STATE.learn = learn;
        saveLearnLocal(learn);

        renderLearning();
        renderStats();
        renderRank();
        renderBadges();
        addNotif('🎓', (idx > -1 ? 'Marked incomplete: ' : 'Completed: ') + moduleName);
      });
    });
  }

  function renderAll() {
    renderHeader();
    renderStats();
    renderIdCard();
    renderTimeline();
    renderRank();
    renderBadges();
    renderPlatforms();
    renderNotifications();
    renderSaved();
    renderOrders();
    renderIdeas();
    renderProjects();
    renderLearning();
    updateNotifBadge();
  }

  /* ════════════════════════════════════════════
     CUSTOMIZE / PANEL
  ════════════════════════════════════════════ */
  function openPanel(tabName) {
    var backdrop = $('pikoCustomizeBackdrop');
    var panel = $('pikoCustomizePanel');
    if (backdrop) backdrop.classList.add('is-open');
    if (panel) panel.classList.add('is-open');

    if (tabName) {
      document.querySelectorAll('.piko-edit-tab').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-etab') === tabName);
      });
      document.querySelectorAll('.piko-edit-pane').forEach(function (p) {
        p.classList.toggle('is-active', p.id === 'pikoEditPane' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
      });
    }

    hydratePanelFields();
  }

  function closePanel() {
    var backdrop = $('pikoCustomizeBackdrop');
    var panel = $('pikoCustomizePanel');
    if (backdrop) backdrop.classList.remove('is-open');
    if (panel) panel.classList.remove('is-open');
  }

  function hydratePanelFields() {
    var p = STATE.profile || {};
    var theme = STATE.theme || loadThemeLocal();
    var nameStyle = currentNameStyle();

    if ($('editName')) $('editName').value = p.display_name || '';
    if ($('editBio')) $('editBio').value = p.bio || '';
    if ($('editAvatarUrl')) $('editAvatarUrl').value = p.avatar_url || '';
    if ($('editSocial')) $('editSocial').value = p.social || '';
    if ($('hideEmailToggle')) $('hideEmailToggle').checked = getHideEmail();

    if ($('nameStyleColor')) $('nameStyleColor').value = nameStyle.color || '#ffffff';
    if ($('nameStyleFont')) $('nameStyleFont').value = nameStyle.font || '';
    if ($('nameStyleWeight')) $('nameStyleWeight').value = nameStyle.weight || '700';
    if ($('nameStyleSize')) $('nameStyleSize').value = String(nameStyle.size || 28);
    if ($('nameStyleSizeVal')) $('nameStyleSizeVal').textContent = String(nameStyle.size || 28) + 'px';
    if ($('pikoNamePreview')) $('pikoNamePreview').textContent = p.display_name || 'Your Name';
    applyNameStyle(nameStyle);

    if ($('customAccentColor')) $('customAccentColor').value = theme.accent || '#f0c96a';
    if ($('customBgColor')) $('customBgColor').value = theme.bg || '#080b14';
    if ($('customCardBgColor')) $('customCardBgColor').value = theme.bg2 || '#0d1220';
    if ($('customBgUrl')) $('customBgUrl').value = theme.bgUrl || '';
    if ($('customCssInput')) $('customCssInput').value = theme.customCss || '';

    document.querySelectorAll('.piko-theme-preset').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-theme') === (theme.themeId || 'default'));
    });
    document.querySelectorAll('.piko-color-preset').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-color') === (theme.accent || '#f0c96a'));
    });
    document.querySelectorAll('.piko-font-option').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-font') === (theme.font || 'Montserrat'));
    });
    document.querySelectorAll('.piko-bg-option').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-bg') === (theme.bgMode || 'default'));
    });
  }

  function initPanelActions() {
    var trigger = $('pikoCustomizeTrigger');
    if (trigger) trigger.addEventListener('click', function () { openPanel('profile'); });

    if ($('pikoCustomizeClose')) $('pikoCustomizeClose').addEventListener('click', closePanel);
    if ($('pikoCustomizeBackdrop')) {
      $('pikoCustomizeBackdrop').addEventListener('click', function (e) {
        if (e.target === $('pikoCustomizeBackdrop')) closePanel();
      });
    }

    document.querySelectorAll('.piko-theme-preset').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.piko-theme-preset').forEach(function (x) { x.classList.remove('is-active'); });
        el.classList.add('is-active');
        var id = el.getAttribute('data-theme');
        var preset = THEME_PRESETS[id] ? Object.assign({}, THEME_PRESETS[id]) : Object.assign({}, THEME_PRESETS.default);
        STATE.theme = Object.assign({}, STATE.theme || {}, preset);
        applyTheme(STATE.theme);
      });
    });

    document.querySelectorAll('.piko-color-preset').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.piko-color-preset').forEach(function (x) { x.classList.remove('is-active'); });
        el.classList.add('is-active');
        if ($('customAccentColor')) $('customAccentColor').value = el.getAttribute('data-color') || '#f0c96a';
      });
    });

    document.querySelectorAll('.piko-font-option').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.piko-font-option').forEach(function (x) { x.classList.remove('is-active'); });
        el.classList.add('is-active');
      });
    });

    document.querySelectorAll('.piko-bg-option').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.piko-bg-option').forEach(function (x) { x.classList.remove('is-active'); });
        el.classList.add('is-active');
      });
    });

    if ($('pikoApplyCustomize')) {
      $('pikoApplyCustomize').addEventListener('click', function () {
        var activeTheme = document.querySelector('.piko-theme-preset.is-active');
        var activeFont = document.querySelector('.piko-font-option.is-active');
        var activeBg = document.querySelector('.piko-bg-option.is-active');

        var base = activeTheme
          ? Object.assign({}, THEME_PRESETS[activeTheme.getAttribute('data-theme')] || THEME_PRESETS.default)
          : Object.assign({}, THEME_PRESETS.default);

        var next = Object.assign({}, base, {
          accent: (($('customAccentColor') || {}).value || base.accent),
          bg: (($('customBgColor') || {}).value || base.bg),
          bg2: (($('customCardBgColor') || {}).value || base.bg2),
          font: activeFont ? activeFont.getAttribute('data-font') : (base.font || 'Montserrat'),
          bgMode: activeBg ? activeBg.getAttribute('data-bg') : (base.bgMode || 'default'),
          bgUrl: (($('customBgUrl') || {}).value || '').trim(),
          customCss: (($('customCssInput') || {}).value || '')
        });

        if (STATE.theme && STATE.theme.bannerData) next.bannerData = STATE.theme.bannerData;
        if (STATE.theme && STATE.theme.bannerUrl) next.bannerUrl = STATE.theme.bannerUrl;

        STATE.theme = next;
        saveThemeLocal(next);
        applyTheme(next);
        addNotif('🎨', 'Appearance updated');
        toast('Appearance saved.');
        closePanel();
      });
    }

    if ($('pikoResetCustomize')) {
      $('pikoResetCustomize').addEventListener('click', function () {
        STATE.theme = Object.assign({}, THEME_PRESETS.default);
        saveThemeLocal(STATE.theme);
        applyTheme(STATE.theme);
        hydratePanelFields();
        toast('Appearance reset.');
      });
    }
  }

  function initNameStyleEditor() {
    var color = $('nameStyleColor');
    var font = $('nameStyleFont');
    var weight = $('nameStyleWeight');
    var size = $('nameStyleSize');
    var sizeVal = $('nameStyleSizeVal');

    function currentStyle() {
      return {
        color: color ? color.value : '#ffffff',
        font: font ? font.value : '',
        weight: weight ? weight.value : '700',
        size: size ? (parseInt(size.value, 10) || 28) : 28
      };
    }

    function preview() {
      var styleObj = currentStyle();
      if (sizeVal) sizeVal.textContent = String(styleObj.size) + 'px';
      if ($('pikoNamePreview')) $('pikoNamePreview').textContent = (STATE.profile && STATE.profile.display_name) || 'Your Name';
      applyNameStyle(styleObj);
    }

    [color, font, weight, size].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', preview);
      el.addEventListener('change', preview);
    });

    if ($('pikoSaveStyleBtn')) {
      $('pikoSaveStyleBtn').addEventListener('click', function () {
        var styleObj = currentStyle();
        saveNameStyle(styleObj);
        applyNameStyle(styleObj);
        showStatus('pikoStyleStatus', '✅ Name style saved.', 'ok');
        addNotif('🎨', 'Name style updated');
      });
    }
  }

  function initProfileEdit() {
    if ($('pikoSaveProfileBtn')) {
      $('pikoSaveProfileBtn').addEventListener('click', async function () {
        clearStatus('pikoSaveStatus');

        if (!STATE.profile) {
          showStatus('pikoSaveStatus', 'No active profile loaded.', 'err');
          return;
        }

        var name = (($('editName') || {}).value || '').trim();
        if (!name) {
          showStatus('pikoSaveStatus', 'Display name is required.', 'err');
          return;
        }

        STATE.profile.display_name = name;
        STATE.profile.bio = (($('editBio') || {}).value || '').trim();
        STATE.profile.avatar_url = (($('editAvatarUrl') || {}).value || '').trim();
        STATE.profile.social = (($('editSocial') || {}).value || '').trim();
        setHideEmail(!!(($('hideEmailToggle') || {}).checked));

        await saveProfile();
        renderHeader();
        renderIdCard();
        renderTimeline();
        showStatus('pikoSaveStatus', '✅ Profile saved.', 'ok');
        addNotif('✨', 'Profile updated');
      });
    }

    if ($('pikoCancelEditBtn')) {
      $('pikoCancelEditBtn').addEventListener('click', function () {
        hydratePanelFields();
        clearStatus('pikoSaveStatus');
      });
    }

    if ($('pikoAvatarEditBtn') && $('pikoAvatarFile')) {
      $('pikoAvatarEditBtn').addEventListener('click', function () {
        $('pikoAvatarFile').click();
      });

      $('pikoAvatarFile').addEventListener('change', function () {
        var file = $('pikoAvatarFile').files && $('pikoAvatarFile').files[0];
        if (!file || !STATE.profile) return;

        var reader = new FileReader();
        reader.onload = async function () {
          STATE.profile.avatar_url = reader.result;
          await saveProfile();
          renderHeader();
          renderIdCard();
          addNotif('🖼️', 'Avatar updated');
          toast('Avatar updated.');
        };
        reader.readAsDataURL(file);
      });
    }

    if ($('pikoBannerEditBtn') && $('pikoBannerFile')) {
      $('pikoBannerEditBtn').addEventListener('click', function () {
        $('pikoBannerFile').click();
      });

      $('pikoBannerFile').addEventListener('change', function () {
        var file = $('pikoBannerFile').files && $('pikoBannerFile').files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function () {
          var theme = loadThemeLocal();
          theme.bannerData = reader.result;
          STATE.theme = theme;
          saveThemeLocal(theme);
          renderHeader();
          renderIdCard();
          addNotif('🌄', 'Banner updated');
          toast('Banner updated.');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  function initAccountSettings() {
    bindStrength('newPassword', 'changePwStrengthBar', 'changePwStrengthLabel');

    if ($('pikoChangePwBtn')) {
      $('pikoChangePwBtn').addEventListener('click', async function () {
        clearStatus('pikoChangePwStatus');

        var cur = (($('currentPassword') || {}).value || '').trim();
        var np = (($('newPassword') || {}).value || '').trim();
        var np2 = (($('newPassword2') || {}).value || '').trim();

        if (!cur)              { showStatus('pikoChangePwStatus', 'Enter your current password.', 'err'); return; }
        if (np.length < 8)     { showStatus('pikoChangePwStatus', 'New password must be at least 8 characters.', 'err'); return; }
        if (np !== np2)        { showStatus('pikoChangePwStatus', 'New passwords do not match.', 'err'); return; }
        if (np === cur)        { showStatus('pikoChangePwStatus', 'New password must be different from your current one.', 'err'); return; }
        if (OFFLINE || !supa() || !SESSION_USER) { showStatus('pikoChangePwStatus', 'Password change requires Supabase.', 'err'); return; }

        var btn = $('pikoChangePwBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

        try {
          var reauth = await supa().auth.signInWithPassword({ email: getUserEmail(), password: cur });
          if (reauth.error) throw new Error('Current password is incorrect.');

          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
          var r = await supa().auth.updateUser({ password: np });
          if (r.error) throw r.error;

          showStatus('pikoChangePwStatus', '✅ Password updated successfully!', 'ok');
          ['currentPassword', 'newPassword', 'newPassword2'].forEach(function (id) {
            if ($(id)) $(id).value = '';
          });
          addNotif('🔐', 'Password changed successfully');
        } catch (err) {
          showStatus('pikoChangePwStatus', ((err && err.message) ? err.message : 'Could not change password.'), 'err');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
        }
      });
    }

    if ($('pikoChangeEmailBtn')) {
      $('pikoChangeEmailBtn').addEventListener('click', async function () {
        clearStatus('pikoChangeEmailStatus');

        var newEmail = (($('newEmail') || {}).value || '').trim().toLowerCase();
        var pw = (($('emailChangePw') || {}).value || '').trim();

        if (!validEmail(newEmail)) { showStatus('pikoChangeEmailStatus', 'Enter a valid new email address.', 'err'); return; }
        if (!pw)                   { showStatus('pikoChangeEmailStatus', 'Enter your current password to confirm.', 'err'); return; }
        if (OFFLINE || !supa() || !SESSION_USER) { showStatus('pikoChangeEmailStatus', 'Email change requires Supabase.', 'err'); return; }

        var btn = $('pikoChangeEmailBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

        try {
          var reauth = await supa().auth.signInWithPassword({ email: getUserEmail(), password: pw });
          if (reauth.error) throw new Error('Current password is incorrect.');

          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…';
          var r = await supa().auth.updateUser({ email: newEmail });
          if (r.error) throw r.error;

          showStatus('pikoChangeEmailStatus', '✅ Email change requested. Check your inbox to confirm.', 'ok');
          addNotif('📧', 'Email change requested to ' + newEmail);
        } catch (err) {
          showStatus('pikoChangeEmailStatus', ((err && err.message) ? err.message : 'Could not update email.'), 'err');
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-envelope"></i> Update Email';
        }
      });
    }
  }

  /* ════════════════════════════════════════════
     NOTIFICATIONS + SHARE
  ════════════════════════════════════════════ */
  function initNotifBell() {
    if ($('pikoNotifBtn')) {
      $('pikoNotifBtn').addEventListener('click', function () {
        document.querySelectorAll('.piko-profile-tab').forEach(function (b) { b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-profile-pane').forEach(function (p) { p.classList.remove('is-active'); });
        if ($('pikoProfilePaneNotifications')) $('pikoProfilePaneNotifications').classList.add('is-active');
      });
    }

    if ($('pikoMarkAllRead')) {
      $('pikoMarkAllRead').addEventListener('click', function () {
        STATE.notifs = (STATE.notifs || []).map(function (n) {
          n.read = true;
          return n;
        });
        saveNotifsLocal(STATE.notifs);
        renderNotifications();
      });
    }
  }

  function initShareCard() {
    var btn = $('pikoShareCardBtn');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      var text = ((STATE.profile && STATE.profile.display_name) || 'Pikoverse Member') +
        ' • ' + getRank(calcScore()).label +
        ' • Score ' + calcScore();

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'My Pikoverse Card',
            text: text,
            url: window.location.href
          });
          return;
        } catch (e) {}
      }

      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(text + ' — ' + window.location.href);
          toast('Profile card copied to clipboard.');
        } catch (e2) {
          toast('Could not copy profile card.');
        }
      }
    });
  }

  /* ════════════════════════════════════════════
     MODAL
  ════════════════════════════════════════════ */
  function openModal(html) {
    var overlay = $('pikoModalOverlay');
    var content = $('pikoModalContent');
    if (!overlay || !content) return;
    content.innerHTML = html;
    overlay.hidden = false;
  }

  function closeModal() {
    var overlay = $('pikoModalOverlay');
    var content = $('pikoModalContent');
    if (!overlay || !content) return;
    overlay.hidden = true;
    content.innerHTML = '';
  }

  function openIdeaModal() {
    openModal(
      '<h3 class="piko-modal-title"><i class="fas fa-lightbulb"></i> Share an Idea</h3>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">Category</label><select id="modalIdeaCategory" class="piko-auth-input"><option value="platform">Platform</option><option value="feature">Feature</option><option value="content">Content</option><option value="other">Other</option></select></div>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">Your Idea</label><textarea id="modalIdeaText" class="piko-auth-input" rows="4" maxlength="500" placeholder="Share your idea…"></textarea></div>' +
      '<div class="piko-auth-status" id="modalIdeaStatus" hidden></div>' +
      '<button class="piko-auth-btn" id="modalIdeaSubmit" type="button"><i class="fas fa-paper-plane"></i> Share with Community</button>'
    );

    var btn = $('modalIdeaSubmit');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      var text = (($('modalIdeaText') || {}).value || '').trim();
      var cat = (($('modalIdeaCategory') || {}).value || 'other');
      if (!text) { showStatus('modalIdeaStatus', 'Please write your idea first.', 'err'); return; }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sharing…';

      var idea = {
        id: 'idea-' + Date.now(),
        text: text,
        name: (STATE.profile && STATE.profile.display_name) || (getUserEmail().split('@')[0] || 'Member'),
        contact: getUserEmail(),
        shareContact: false,
        category: cat,
        ts: Date.now(),
        dismissed: false,
        reply: '',
        status: 'pending'
      };

      var ideas = readJSON('amp_admin_ideas', []);
      ideas.unshift(idea);
      saveJSON('amp_admin_ideas', ideas);

      if (!OFFLINE && supa() && SESSION_USER) {
        try {
          await supa().from('community_ideas').insert({
            id: idea.id,
            user_id: SESSION_USER.id,
            text: idea.text,
            name: idea.name,
            contact: idea.contact,
            share_contact: false,
            category: idea.category,
            ts: idea.ts,
            status: 'pending'
          });
        } catch (e) {}
      }

      STATE.ideas = await fetchIdeas();
      renderIdeas();
      renderTimeline();
      renderStats();
      renderRank();
      renderBadges();
      addNotif('💡', 'Idea shared with the community');
      closeModal();
    });
  }

  function openProjectModal() {
    openModal(
      '<h3 class="piko-modal-title"><i class="fas fa-rocket"></i> Submit a Project</h3>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">Project Name</label><input id="modalProjectName" class="piko-auth-input" type="text" maxlength="80" placeholder="Your project name"></div>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">Description</label><textarea id="modalProjectDesc" class="piko-auth-input" rows="4" maxlength="400" placeholder="Tell the community what you are building…"></textarea></div>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">Stage</label><select id="modalProjectStage" class="piko-auth-input"><option value="idea">💡 Idea</option><option value="building">🔧 Building</option><option value="live">🚀 Live</option></select></div>' +
      '<div class="piko-auth-field"><label class="piko-auth-label">URL <span style="opacity:.5">(optional)</span></label><input id="modalProjectUrl" class="piko-auth-input" type="url" maxlength="200" placeholder="https://…"></div>' +
      '<div class="piko-auth-status" id="modalProjectStatus" hidden></div>' +
      '<button class="piko-auth-btn" id="modalProjectSubmit" type="button"><i class="fas fa-rocket"></i> Submit Project</button>'
    );

    var btn = $('modalProjectSubmit');
    if (!btn) return;

    btn.addEventListener('click', async function () {
      var name = (($('modalProjectName') || {}).value || '').trim();
      var desc = (($('modalProjectDesc') || {}).value || '').trim();
      var stage = (($('modalProjectStage') || {}).value || 'idea');
      var url = (($('modalProjectUrl') || {}).value || '').trim();

      if (!name) { showStatus('modalProjectStatus', 'Please enter a project name.', 'err'); return; }
      if (!desc) { showStatus('modalProjectStatus', 'Please add a short description.', 'err'); return; }

      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

      var project = {
        id: 'proj-' + Date.now(),
        name: name,
        desc: desc,
        stage: stage,
        link: url,
        status: 'pending',
        contact: getUserEmail(),
        ts: Date.now()
      };

      var projects = readJSON('amp_admin_projects_hub', []);
      projects.unshift(project);
      saveJSON('amp_admin_projects_hub', projects);

      if (!OFFLINE && supa() && SESSION_USER) {
        try {
          await supa().from('projects').insert({
            user_id: SESSION_USER.id,
            contact: getUserEmail(),
            name: project.name,
            description: project.desc,
            stage: project.stage,
            status: 'pending',
            url: project.link,
            created_at: new Date().toISOString()
          });
        } catch (e) {}
      }

      STATE.projects = await fetchProjects();
      renderProjects();
      renderTimeline();
      renderStats();
      renderRank();
      renderBadges();
      addNotif('🚀', 'Project submitted for review');
      closeModal();
    });
  }

  function initModalLinks() {
    var ideaBtn = $('pikoSubmitIdeaBtn');
    var projectBtn = $('pikoSubmitProjectBtn');

    if (ideaBtn) ideaBtn.addEventListener('click', openIdeaModal);
    if (projectBtn) projectBtn.addEventListener('click', openProjectModal);

    if ($('pikoModalClose')) $('pikoModalClose').addEventListener('click', closeModal);
    if ($('pikoModalOverlay')) {
      $('pikoModalOverlay').addEventListener('click', function (e) {
        if (e.target === $('pikoModalOverlay')) closeModal();
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeModal();
        closePanel();
      }
    });
  }

  /* ════════════════════════════════════════════
     AUTH SESSION
  ════════════════════════════════════════════ */
  async function checkExistingSession() {
    ensureSupabaseReference();

    if (OFFLINE || !supa()) {
      var cached = readJSON(PROFILE_KEY, null);
      if (cached && cached.email) {
        STATE.profile = cached;
        SESSION_USER = { id: cached.id || ('offline-' + Date.now()), email: cached.email, user_metadata: { display_name: cached.display_name || '' } };
        await refreshProfileView();
      } else {
        showAuthGate();
      }
      return;
    }

    try {
      var res = await supa().auth.getUser();
      if (res.error || !res.data || !res.data.user) {
        showAuthGate();
        return;
      }
      SESSION_USER = res.data.user;
      await refreshProfileView();
    } catch (e) {
      showAuthGate();
    }
  }

  function initAuthListener() {
    if (!supa() || AUTH_SUB) return;

    var sub = supa().auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_OUT') {
        SESSION_USER = null;
        STATE.profile = null;
        removeJSON(PROFILE_KEY);
        showAuthGate();
        return;
      }

      if (session && session.user) {
        SESSION_USER = session.user;
        refreshProfileView();
      }
    });

    AUTH_SUB = sub && sub.data ? sub.data.subscription : null;
  }

  /* ════════════════════════════════════════════
     REFRESH
  ════════════════════════════════════════════ */
  async function refreshProfileView() {
    if (!SESSION_USER) {
      showAuthGate();
      return;
    }

    STATE.profile = await ensureProfileRecord(SESSION_USER);
    STATE.learn = loadLearnLocal();
    STATE.theme = loadThemeLocal();
    STATE.notifs = loadNotifsLocal();
    STATE.saved = loadSavedLocal();
    STATE.ideas = await fetchIdeas();
    STATE.projects = await fetchProjects();
    STATE.orders = await fetchOrders();

    applyTheme(STATE.theme);
    showProfileSection();
    renderAll();
  }

  /* ════════════════════════════════════════════
     GLOBAL UI
  ════════════════════════════════════════════ */
  function initGlobalUI() {
    bindStrength('signupPassword', 'signupStrengthBar', 'signupStrengthLabel');

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.piko-pw-toggle');
      if (!btn) return;
      var target = document.getElementById(btn.getAttribute('data-target'));
      if (!target) return;
      var show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      var icon = btn.querySelector('i');
      if (icon) icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var id = document.activeElement && document.activeElement.id ? document.activeElement.id : '';
      if (['signupName', 'signupEmail', 'signupPassword', 'signupPassword2'].indexOf(id) > -1 && $('pikoSignupBtn')) {
        $('pikoSignupBtn').click();
      }
      if (['signinEmail', 'signinPassword'].indexOf(id) > -1 && $('pikoSigninBtn')) {
        $('pikoSigninBtn').click();
      }
    });
  }

  /* ════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════ */
  function boot() {
    applyTheme(loadThemeLocal());
    initGlobalUI();
    initAuthTabs();
    initProfileTabs();
    initEditTabs();
    initSignup();
    initSignin();
    initSignOut();
    initPanelActions();
    initNameStyleEditor();
    initProfileEdit();
    initAccountSettings();
    initNotifBell();
    initShareCard();
    initModalLinks();
    handlePasswordReset();
  }

  window.addEventListener('piko:supa:ready', function (e) {
    OFFLINE = !!(e.detail && e.detail.offline);
    DB = window.piko_supa || DB;
    initAuthListener();
    checkExistingSession();
  });

  document.addEventListener('DOMContentLoaded', function () {
    boot();

    setTimeout(function () {
      ensureSupabaseReference();
      if (window.PIKO_SUPA_READY) {
        initAuthListener();
        checkExistingSession();
      } else if (!window.piko_supa) {
        showAuthGate();
      }
    }, 300);
  });

})();