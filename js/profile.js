/**
 * profile.js — Pikoverse Profile System (Full Edition)
 * js/profile.js
 *
 * Requires: js/supabase-client.js loaded first
 * Auth:     Supabase email + password
 * Fallback: localStorage when Supabase not configured
 *
 * Features:
 *   - Email + password auth (sign up / sign in / sign out)
 *   - Password strength meter
 *   - Change email (with confirmation notification)
 *   - Change password (with notification)
 *   - Forgot / reset password via email link
 *   - Profile CRUD (name, bio, avatar, banner, social)
 *   - Rank + badge system
 *   - Community timeline
 *   - Connected platforms progress
 *   - Realtime notifications via Supabase
 *   - Saved / bookmarks
 *   - Learning progress (Culturalverse + DigitalVerse)
 *   - MySpace-style theme customization
 *   - Pikoverse ID card + share
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

  var RANKS = [
    { id:'seedling', label:'Seedling', icon:'🌱', min:0,  color:'#4caf7a', bg:'rgba(76,175,122,.15)',  border:'rgba(76,175,122,.3)'  },
    { id:'grower',   label:'Grower',   icon:'🌿', min:5,  color:'#54d1ff', bg:'rgba(84,209,255,.15)',  border:'rgba(84,209,255,.3)'  },
    { id:'weaver',   label:'Weaver',   icon:'🔮', min:15, color:'#9d64ff', bg:'rgba(157,100,255,.15)', border:'rgba(157,100,255,.3)' },
    { id:'elder',    label:'Elder',    icon:'⭐', min:30, color:'#f0c96a', bg:'rgba(240,201,106,.18)', border:'rgba(240,201,106,.4)' },
  ];

  var BADGE_DEFS = [
    { id:'first_idea',    icon:'💡', name:'First Idea',       desc:'Shared your first idea with the community' },
    { id:'project_live',  icon:'🚀', name:'Project Live',     desc:'Had a project approved to the showcase' },
    { id:'chronicle_sub', icon:'📜', name:'Chronicle Reader', desc:'Subscribed to the Pikoverse Chronicle' },
    { id:'early_member',  icon:'🌺', name:'Early Member',     desc:'Joined during the founding wave' },
    { id:'idea_x5',       icon:'🔥', name:'Idea Machine',     desc:'Submitted 5 or more ideas' },
    { id:'learner',       icon:'🎓', name:'Knowledge Seeker', desc:'Completed a learning track module' },
    { id:'connector',     icon:'🔗', name:'Connector',        desc:'Active across 3+ Pikoverse platforms' },
    { id:'first_order',   icon:'🛍️', name:'First Purchase',   desc:'Made your first AMP Marketplace order' },
  ];

  var THEMES = {
    default: { bg:'#080b14', bg2:'#0d1220', accent:'#f0c96a', text:'rgba(255,255,255,.88)', cardBg:'rgba(255,255,255,.03)', glow:'rgba(240,201,106,.15)' },
    ocean:   { bg:'#001a2e', bg2:'#003366', accent:'#54d1ff', text:'rgba(220,240,255,.9)',  cardBg:'rgba(0,50,100,.2)',     glow:'rgba(84,209,255,.15)'  },
    jungle:  { bg:'#0a1a0a', bg2:'#0d2e1a', accent:'#4caf7a', text:'rgba(220,255,230,.88)', cardBg:'rgba(0,60,20,.2)',     glow:'rgba(76,175,122,.15)'  },
    sunset:  { bg:'#1a0a0a', bg2:'#2e1800', accent:'#ff9f43', text:'rgba(255,240,220,.88)', cardBg:'rgba(60,20,0,.2)',     glow:'rgba(255,159,67,.15)'  },
    neon:    { bg:'#050010', bg2:'#0d0020', accent:'#ff6fd8', text:'rgba(255,220,255,.88)', cardBg:'rgba(30,0,60,.2)',     glow:'rgba(255,111,216,.15)' },
    light:   { bg:'#f0f4ff', bg2:'#e0e8ff', accent:'#4060d0', text:'rgba(20,30,60,.9)',    cardBg:'rgba(255,255,255,.7)',  glow:'rgba(64,96,208,.1)'    },
  };

  var BG_MAP = {
    default:   'linear-gradient(135deg,#080b14,#141830)',
    stars:     '#050510',
    gradient1: 'linear-gradient(135deg,#0a0020,#200040,#000020)',
    gradient2: 'linear-gradient(135deg,#001020,#002040,#003060)',
    gradient3: 'linear-gradient(135deg,#0a1a05,#102a10,#1a3a1a)',
    gradient4: 'linear-gradient(135deg,#1a0a00,#2a1500,#1a0a00)',
  };

  var CV = ['Hawaiian History','Pacific Islanders','Indigenous Knowledge','Cultural Connections','Oral Traditions','Ancestral Navigation','Language & Identity','Modern Sovereignty'];
  var DV = ['Bitcoin Fundamentals','Ethereum & Smart Contracts','XRPL Deep Dive','Flare & Songbird','DeFi & AMMs','Web3 Security','Scam Field Guide','Protocol Comparison','Blockchain Forensics Intro','NaluLF Workflow'];

  /* ════════════════════════════════════════════
     SUPABASE + APP STATE
  ════════════════════════════════════════════ */
  var DB              = null;
  var OFFLINE         = true;
  var SESSION_USER    = null;
  var _realtimeSub    = null;
  var _showingProfile = false; /* lock: prevents double showProfile() from race */
  var _profilePreRendered = false; /* tracks if we pre-rendered from localStorage */

  function supa() { return DB; }

  var STATE = {
    profile:  null,
    ideas:    [],
    projects: [],
    orders:   [],
    notifs:   [],
    saved:    [],
    learn:    {},
    theme:    {},
  };

  function getUserId()    { return SESSION_USER ? SESSION_USER.id    : null; }
  function getUserEmail() { return SESSION_USER ? SESSION_USER.email : (STATE.profile ? STATE.profile.email : null); }

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(id) { return document.getElementById(id); }

  function toast(msg, dur) {
    var el = $('pikoProfileToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove('is-visible'); }, dur || 3500);
  }

  function timeAgo(ts) {
    var s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60)    return 'just now';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  function fmtPrice(c) { return '$' + (c / 100).toFixed(2); }
  function loadJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch(e) { return d; } }
  function saveJSON(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  function showStatus(id, msg, type) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'piko-auth-status piko-auth-status--' + (type || 'info');
    el.hidden      = false;
  }
  function clearStatus(id) { var el = $(id); if (el) { el.hidden = true; el.textContent = ''; } }

  /* ════════════════════════════════════════════
     PASSWORD STRENGTH METER
  ════════════════════════════════════════════ */
  function getPasswordStrength(pw) {
    if (!pw) return { score:0, label:'', color:'transparent', pct:0 };
    var score = 0;
    if (pw.length >= 8)           score++;
    if (pw.length >= 12)          score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^A-Za-z0-9]/.test(pw))  score++;
    var levels = [
      { label:'',           color:'transparent', pct:0   },
      { label:'Weak',       color:'#e05252',     pct:20  },
      { label:'Fair',       color:'#ff9f43',     pct:40  },
      { label:'Good',       color:'#f0c96a',     pct:60  },
      { label:'Strong',     color:'#4caf7a',     pct:80  },
      { label:'Very Strong',color:'#54d1ff',     pct:100 },
    ];
    return levels[Math.min(score, 5)];
  }

  function initPasswordStrength(inputId, barId, labelId) {
    var input = $(inputId), bar = $(barId), lbl = $(labelId);
    if (!input || !bar) return;
    input.addEventListener('input', function() {
      var s = getPasswordStrength(input.value);
      bar.style.width      = s.pct + '%';
      bar.style.background = s.color;
      bar.style.transition = 'width .3s ease, background .3s ease';
      if (lbl) { lbl.textContent = s.label; lbl.style.color = s.color; }
    });
  }

  /* ════════════════════════════════════════════
     DATABASE LAYER
  ════════════════════════════════════════════ */
  var DB_LAYER = {

    getProfile: async function(userId) {
      var cached = loadJSON(PROFILE_KEY, null);
      if (OFFLINE || !userId) return cached;
      var r = await supa().from('profiles').select('*').eq('id', userId).single();
      if (r.error || !r.data) return cached;

      /* SMART MERGE:
         - Start with Supabase data as the base (authoritative for IDs, timestamps)
         - For string/content fields: only overwrite local if Supabase value is non-empty
           This prevents an empty DB row (from failed upserts) wiping out local data */
      var remote = r.data;
      var local  = cached || {};
      var merged = Object.assign({}, remote); /* start with Supabase base */

      /* For these fields: local wins if it has real data and Supabase is empty */
      var preferLocal = ['display_name','bio','avatar_url','banner_url','social',
                         'nameStyle','name_style','hideEmail','hide_email','joined_ts'];
      preferLocal.forEach(function(k) {
        var localVal  = local[k];
        var remoteVal = merged[k];
        var localHasData  = localVal  !== undefined && localVal  !== null && localVal  !== '';
        var remoteHasData = remoteVal !== undefined && remoteVal !== null && remoteVal !== '';
        if (localHasData && !remoteHasData) {
          merged[k] = localVal; /* keep local data — Supabase has nothing */
        }
      });

      saveJSON(PROFILE_KEY, merged);
      return merged;
    },

    upsertProfile: async function(profile) {
      saveJSON(PROFILE_KEY, profile); /* always write localStorage first */
      if (OFFLINE || !SESSION_USER) return profile;

      /* Build the theme payload — encode name_style + hide_email into theme JSONB
         so we don't need those as separate columns (avoids silent upsert failures) */
      var themeForDB = Object.assign({}, loadJSON(THEME_KEY, {}));
      /* Encode profile customisation into theme JSONB */
      if (profile.nameStyle  || profile.name_style)  themeForDB._nameStyle  = profile.nameStyle || profile.name_style;
      if (profile.hideEmail  !== undefined)           themeForDB._hideEmail  = profile.hideEmail;
      if (profile.hide_email !== undefined)           themeForDB._hideEmail  = profile.hide_email;
      /* Strip base64 banner — too large for JSONB, kept in localStorage only */
      if (themeForDB.bannerBg && themeForDB.bannerBg.startsWith('url(data:')) {
        delete themeForDB.bannerBg;
      }

      /* Only use columns that are guaranteed to exist in the profiles table.
         Use empty string fallbacks for NOT NULL columns (bio, avatar_url, social)
         Use display_name fallback to email prefix so it's never null/empty. */
      var payload = {
        id:           SESSION_USER.id,
        email:        SESSION_USER.email,
        display_name: profile.display_name || SESSION_USER.email.split('@')[0],
        bio:          profile.bio          || '',
        avatar_url:   profile.avatar_url   || '',
        banner_url:   profile.banner_url   || '',
        social:       profile.social       || '',
        theme:        themeForDB,
        updated_at:   new Date().toISOString(),
      };

      var r = await supa().from('profiles').upsert(payload, { onConflict:'id' });
      if (r.error) {
        console.error('[Profile] upsert FAILED:', r.error.message, r.error);
        /* If upsert fails, data is still in localStorage — not lost, just not in DB */
      } else {
        console.log('[Profile] saved to Supabase ✓ display_name:', payload.display_name);
      }
      return profile;
    },

    getMyIdeas: async function(userId, email) {
      if (OFFLINE || !email) {
        var local = loadJSON('amp_admin_ideas', []);
        return email ? local.filter(function(i){ return i.contact && i.contact.toLowerCase() === email.toLowerCase(); }) : [];
      }
      var r = await supa().from('community_ideas').select('*').eq('contact', email).order('ts', {ascending:false});
      if (r.error) {
        var local = loadJSON('amp_admin_ideas', []);
        return local.filter(function(i){ return i.contact && i.contact.toLowerCase() === email.toLowerCase(); });
      }
      return r.data || [];
    },

    getMyProjects: async function(userId, email) {
      if (OFFLINE || !userId) {
        var local = loadJSON('amp_admin_projects_hub', []);
        return email ? local.filter(function(p){ return p.contact && p.contact.toLowerCase() === email.toLowerCase(); }) : [];
      }
      var r = await supa().from('projects').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      if (r.error || !r.data || !r.data.length) {
        var r2 = await supa().from('projects').select('*').eq('contact', email).order('created_at', {ascending:false});
        return r2.data || loadJSON('amp_admin_projects_hub', []).filter(function(p){
          return p.contact && p.contact.toLowerCase() === email.toLowerCase();
        });
      }
      return r.data || [];
    },

    getOrders: async function(userId) {
      if (OFFLINE || !userId) return loadJSON('amp_orders_v1', []);
      var r = await supa().from('orders').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      if (r.error || !r.data || !r.data.length) return loadJSON('amp_orders_v1', []);
      return r.data || [];
    },

    getNotifs: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(NOTIF_KEY, []);
      var r = await supa().from('notifications').select('*').eq('user_id', userId).order('created_at', {ascending:false}).limit(30);
      return r.data || [];
    },

    addNotif: async function(userId, icon, text) {
      var notifs = loadJSON(NOTIF_KEY, []);
      var n = { id: Date.now().toString(36), icon:icon, text:text, ts:Date.now(), read:false };
      notifs.unshift(n);
      if (notifs.length > 30) notifs.length = 30;
      saveJSON(NOTIF_KEY, notifs);
      if (!OFFLINE && userId) {
        await supa().from('notifications').insert({ user_id:userId, icon:icon, text:text, read:false, created_at:new Date().toISOString() });
      }
    },

    markNotifsRead: async function(userId, ids) {
      var notifs = loadJSON(NOTIF_KEY, []);
      notifs.forEach(function(n){ if (!ids || ids.includes(n.id)) n.read = true; });
      saveJSON(NOTIF_KEY, notifs);
      if (!OFFLINE && userId) {
        if (ids) await supa().from('notifications').update({read:true}).in('id', ids);
        else     await supa().from('notifications').update({read:true}).eq('user_id', userId);
      }
    },

    getSaved: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(SAVED_KEY, []);
      var r = await supa().from('saved_items').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      return r.data || [];
    },

    removeSaved: async function(userId, id, localIdx) {
      var saved = loadJSON(SAVED_KEY, []);
      if (localIdx !== undefined) saved.splice(localIdx, 1);
      saveJSON(SAVED_KEY, saved);
      if (!OFFLINE && userId && id) await supa().from('saved_items').delete().eq('id', id);
    },

    getLearning: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(LEARN_KEY, {});
      var r = await supa().from('learning_progress').select('*').eq('user_id', userId).single();
      if (r.error || !r.data) return loadJSON(LEARN_KEY, {});
      var l = { culturalverse: r.data.culturalverse || [], digitalverse: r.data.digitalverse || [] };
      saveJSON(LEARN_KEY, l);
      return l;
    },

    saveLearning: async function(userId, learn) {
      saveJSON(LEARN_KEY, learn);
      if (OFFLINE || !userId) return;
      await supa().from('learning_progress').upsert({
        user_id: userId, culturalverse: learn.culturalverse || [],
        digitalverse: learn.digitalverse || [], updated_at: new Date().toISOString(),
      }, { onConflict:'user_id' });
    },

    saveTheme: async function(userId, theme) {
      saveJSON(THEME_KEY, theme); /* always save full theme (incl. base64 banner) to localStorage */
      if (OFFLINE || !userId) return;
      /* Strip base64 banner before saving to Supabase — too large for JSONB.
         If a Storage URL (bannerUrl) exists, that goes into the DB instead. */
      var themeForDB = Object.assign({}, theme);
      if (themeForDB.bannerBg && themeForDB.bannerBg.startsWith('url(data:')) {
        delete themeForDB.bannerBg; /* keep only bannerUrl (Storage URL) if present */
      }
      var r = await supa().from('profiles').update({ theme: themeForDB, updated_at: new Date().toISOString() }).eq('id', userId);
      if (r.error) console.warn('[Profile] saveTheme error:', r.error.message);
    },

    loadTheme: async function(userId) {
      var localTheme = loadJSON(THEME_KEY, {});
      if (OFFLINE || !userId) return localTheme;
      var r = await supa().from('profiles').select('theme,display_name,avatar_url,bio,social').eq('id', userId).single();
      if (r.error || !r.data) return localTheme;
      var remoteTheme = r.data.theme || {};
      /* Restore nameStyle + hideEmail from theme JSONB back into profile */
      if (remoteTheme._nameStyle) {
        var lp = loadJSON(PROFILE_KEY, {});
        lp.nameStyle   = remoteTheme._nameStyle;
        lp.name_style  = remoteTheme._nameStyle;
        saveJSON(PROFILE_KEY, lp);
      }
      if (remoteTheme._hideEmail !== undefined) {
        var lp2 = loadJSON(PROFILE_KEY, {});
        lp2.hideEmail  = remoteTheme._hideEmail;
        lp2.hide_email = remoteTheme._hideEmail;
        saveJSON(PROFILE_KEY, lp2);
      }
      /* Restore bannerBg from bannerUrl (Supabase Storage — cross-device) */
      if (remoteTheme.bannerUrl) {
        remoteTheme.bannerBg = 'url(' + remoteTheme.bannerUrl + ') center/cover no-repeat';
      }
      /* If DB has no bannerUrl/bannerBg, keep localStorage base64 banner */
      if (!remoteTheme.bannerBg && localTheme.bannerBg) {
        remoteTheme.bannerBg = localTheme.bannerBg;
      }
      /* Merge: remote wins for all fields */
      var merged = Object.assign({}, localTheme, remoteTheme);
      saveJSON(THEME_KEY, merged);
      return merged;
    },
  };

  /* ════════════════════════════════════════════
     SCORE / RANK / BADGES
  ════════════════════════════════════════════ */
  function calcScore(ideas, approved, orders, badges) { return (ideas*1)+(approved*3)+(orders*1)+(badges*2); }

  function getRank(score) {
    for (var i = RANKS.length-1; i >= 0; i--) { if (score >= RANKS[i].min) return RANKS[i]; }
    return RANKS[0];
  }

  function getEarnedBadgeIds(ideas, approved, orders, learn, profile) {
    var e = [];
    if (ideas >= 1)    e.push('first_idea');
    if (approved >= 1) e.push('project_live');
    if (orders >= 1)   e.push('first_order');
    if (ideas >= 5)    e.push('idea_x5');
    var created = profile && (profile.created_at || profile.joined_ts);
    if (created && Date.now()-new Date(created).getTime() < 90*24*60*60*1000) e.push('early_member');
    if ((learn.culturalverse||[]).length>0 || (learn.digitalverse||[]).length>0) e.push('learner');
    if (profile && profile.chronicle_sub) e.push('chronicle_sub');
    return e;
  }

  function updateNotifBadge() {
    var n = STATE.notifs.filter(function(x){ return !x.read; }).length;
    var b = $('pikoNotifBadge'), t = $('tabNotifCount');
    if (b) { b.textContent = n; b.hidden = n===0; }
    if (t) { t.textContent = n; t.style.display = n===0 ? 'none' : ''; }
  }

  /* ════════════════════════════════════════════
     RENDER ENGINE
  ════════════════════════════════════════════ */
  function renderAll() {
    renderHeader(); renderStats(); renderIdCard(); renderTimeline();
    renderRank(); renderBadges(); renderPlatforms(); renderNotifications();
    renderSaved(); renderOrders(); renderIdeas(); renderProjects();
    renderLearningFromState(); updateNotifBadge();
    updateNavAvatar(); updateIdCardBanner(); applyHideEmail();
  }

  function renderHeader() {
    var p = STATE.profile || {};
    var name = p.display_name || getUserEmail() || 'Pikoverse Member';
    var ts   = p.created_at || p.joined_ts;

    var set = function(id,v){ var el=$(id); if(el) el.textContent=v||''; };
    set('pikoProfileName',  name);
    var emailEl = $('pikoProfileEmail');
    if (emailEl) {
      if (p.hide_email) {
        emailEl.textContent = '';
        emailEl.hidden = true;
      } else {
        emailEl.textContent = getUserEmail() || '';
        emailEl.hidden = false;
      }
    }
    set('pikoProfileBio',   p.bio||'');

    var social = $('pikoProfileSocial');
    if (social) { social.textContent = p.social||''; social.hidden = !p.social; }
    var joined = $('pikoProfileJoined');
    if (joined) joined.textContent = '🌺 Joined '+(ts?new Date(ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently');

    var init = $('pikoProfileAvatarInitial'), img = $('pikoProfileAvatarImg');
    if (init) init.textContent = name[0].toUpperCase();
    if (img && p.avatar_url) {
      img.src=p.avatar_url; img.hidden=false; if(init) init.style.display='none';
      img.onerror=function(){ img.hidden=true; if(init) init.style.display=''; };
    } else if (img) { img.hidden=true; if(init) init.style.display=''; }

    var approved = STATE.projects.filter(function(p){ return p.status==='approved'; }).length;
    var earned   = getEarnedBadgeIds(STATE.ideas.length, approved, STATE.orders.length, STATE.learn, STATE.profile);
    var score    = calcScore(STATE.ideas.length, approved, STATE.orders.length, earned.length);
    var rank     = getRank(score);
    /* Apply custom name style */
    var nameEl = $('pikoProfileName');
    if (nameEl && p.name_style) {
      nameEl.style.color      = p.name_style.color      || '';
      nameEl.style.fontSize   = p.name_style.size       || '';
      nameEl.style.fontFamily = p.name_style.font       || '';
      nameEl.style.fontWeight = p.name_style.weight     || '';
    }

    var rb       = $('pikoRankBadge');
    if (rb) { rb.textContent=rank.icon+' '+rank.label; rb.style.cssText='--rank-color:'+rank.color+';--rank-bg:'+rank.bg+';--rank-border:'+rank.border; }
    /* Apply saved name style */
    var savedNs = p.nameStyle || p.name_style || {};
    if (Object.keys(savedNs).length) applyNameStyleToPage(savedNs);

    /* Update nav avatar */
    updateNavAvatar(p.avatar_url || null);

    /* Update ID card banner */
    var idBanner = $('pikoIdCardBanner');
    if (idBanner && STATE.theme && STATE.theme.bannerBg) {
      idBanner.style.background = STATE.theme.bannerBg;
      idBanner.style.backgroundSize = 'cover';
      idBanner.style.backgroundPosition = 'center';
    }

    var badgesEl = $('pikoProfileBadges');
    if (!badgesEl) return;
    var chips = [
      '<span class="piko-profile-badge piko-profile-badge--member"><i class="fas fa-star"></i> Pikoverse Member</span>',
      '<span class="piko-profile-badge piko-profile-badge--joined">🌺 Joined '+(ts?new Date(ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently')+'</span>',
    ];
    BADGE_DEFS.forEach(function(b){ if(earned.includes(b.id)) chips.push('<span class="piko-profile-badge piko-profile-badge--earned">'+b.icon+' '+b.name+'</span>'); });
    badgesEl.innerHTML = chips.join('');
  }

  function renderStats() {
    var approved = STATE.projects.filter(function(p){ return p.status==='approved'; }).length;
    var earned   = getEarnedBadgeIds(STATE.ideas.length, approved, STATE.orders.length, STATE.learn, STATE.profile);
    var score    = calcScore(STATE.ideas.length, approved, STATE.orders.length, earned.length);
    var set = function(id,v){ var el=$(id); if(el) el.textContent=v; };
    set('statIdeas',STATE.ideas.length); set('statProjects',STATE.projects.length);
    set('statScore',score); set('statBadges',earned.length);
  }

  function renderIdCard() {
    var p=STATE.profile||{}, name=p.display_name||getUserEmail()||'Member';
    var approved=STATE.projects.filter(function(x){ return x.status==='approved'; }).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    var score=calcScore(STATE.ideas.length,approved,STATE.orders.length,earned.length), rank=getRank(score);
    var a=$('pikoIdCardAvatar'),n=$('pikoIdCardName'),m=$('pikoIdCardMeta'),s=$('pikoIdCardScore');
    if(a){
      if(p.avatar_url) {
        var initial = esc(name[0].toUpperCase());
        a.innerHTML = '<img src="' + esc(p.avatar_url) + '" crossorigin="anonymous"'
          + ' style="width:100%;height:100%;object-fit:cover;border-radius:50%"'
          + ' onerror="this.style.display=\'none\';this.parentNode.textContent=\''+initial+'\'">';
      } else {
        a.innerHTML = '';
        a.textContent = name[0].toUpperCase();
      }
    }
    if(n) n.textContent=name;
    if(m) m.textContent=rank.icon+' '+rank.label+' · Pikoverse Member';
    if(s) s.textContent='Score: '+score+' pts';
  }

  function renderTimeline() {
    var el=$('pikoTimeline'); if(!el) return;
    var items=[];
    STATE.ideas.forEach(function(i){ items.push({type:'idea',text:'Shared idea: "'+String(i.text||'').slice(0,70)+'"',ts:i.ts||i.created_at||Date.now(),status:i.reply?'replied':'pending'}); });
    STATE.projects.forEach(function(p){ items.push({type:'project',text:'Submitted project: "'+esc(p.name)+'"',ts:p.created_at||p.ts||Date.now(),status:p.status||'pending'}); });
    STATE.orders.forEach(function(o){ items.push({type:'order',text:'Placed order — '+fmtPrice(o.total||0),ts:o.created_at||o.ts||Date.now()}); });
    var approved=STATE.projects.filter(function(p){ return p.status==='approved'; }).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    earned.forEach(function(bid){ var d=BADGE_DEFS.find(function(b){ return b.id===bid; }); if(d) items.push({type:'badge',text:'Earned badge: '+d.icon+' '+d.name,ts:STATE.profile&&(STATE.profile.created_at||STATE.profile.joined_ts)||Date.now()}); });
    items.sort(function(a,b){ return new Date(b.ts)-new Date(a.ts); });
    if(!items.length){ el.innerHTML='<p class="piko-profile-empty">Your timeline will fill as you engage with the community.</p>'; return; }
    var icons={idea:'fa-lightbulb',project:'fa-rocket',order:'fa-bag-shopping',badge:'fa-medal',comment:'fa-comment'};
    el.innerHTML=items.slice(0,20).map(function(item){
      var sh=''; if(item.status){ var cls=item.status==='approved'?'approved':item.status==='replied'?'replied':'pending'; var lbl=item.status==='approved'?'✓ Approved':item.status==='replied'?'⭐ Replied':'⏳ Pending'; sh='<span class="piko-timeline-status piko-timeline-status--'+cls+'">'+lbl+'</span>'; }
      return '<div class="piko-timeline-item"><div class="piko-timeline-dot piko-timeline-dot--'+item.type+'"><i class="fas '+(icons[item.type]||'fa-bolt')+'"></i></div><div class="piko-timeline-text">'+esc(item.text)+'<div class="piko-timeline-meta">'+timeAgo(item.ts)+'&ensp;'+sh+'</div></div></div>';
    }).join('');
  }

  function renderRank() {
    var approved=STATE.projects.filter(function(p){ return p.status==='approved'; }).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    var score=calcScore(STATE.ideas.length,approved,STATE.orders.length,earned.length), rank=getRank(score);
    var next=null; for(var i=0;i<RANKS.length;i++){ if(RANKS[i].min>score){ next=RANKS[i]; break; } }
    var fill=next?Math.min(100,Math.round((score-rank.min)/(next.min-rank.min)*100)):100;
    var set=function(id,v){ var el=$(id); if(el) el.textContent=v; };
    set('rankIcon',rank.icon); set('rankLabel',rank.label);
    set('rankSub',next?'Keep contributing to reach '+next.label:'Maximum rank achieved! 🎉');
    set('rankNext',next?score+' / '+next.min+' points to '+next.label:'Elder — Top rank!');
    var br=$('rankBarFill'); if(br) br.style.width=fill+'%';
  }

  function renderBadges() {
    var grid=$('pikoBadgesGrid'); if(!grid) return;
    var approved=STATE.projects.filter(function(p){ return p.status==='approved'; }).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    grid.innerHTML=BADGE_DEFS.map(function(b){ var has=earned.includes(b.id); return '<div class="piko-badge-card'+(has?' is-earned':'')+'"><div class="piko-badge-icon">'+b.icon+'</div><div class="piko-badge-name">'+esc(b.name)+'</div><div class="piko-badge-desc">'+esc(b.desc)+'</div></div>'; }).join('');
  }

  function renderPlatforms() {
    var grid=$('pikoPlatformsGrid'); if(!grid) return;
    var platforms=[
      {icon:'⚛',name:'Ikeverse',       status:'Active',link:'https://ikeverse.pikoverse.xyz/',progress:Math.min(100,(STATE.learn.culturalverse||[]).length*12),stat:(STATE.learn.culturalverse||[]).length+' modules done'},
      {icon:'⚡',name:'DigitalVerse',   status:'Active',link:'digitalverse/index.html',         progress:Math.min(100,(STATE.learn.digitalverse||[]).length*10), stat:(STATE.learn.digitalverse||[]).length+' modules done'},
      {icon:'📜',name:'Chronicle',      status:'Live',  link:'chronicle/index.html',            progress:0,stat:'Subscribe for drops'},
      {icon:'🛍️',name:'AMP Marketplace',status:'Live',  link:'marketplace/marketplace.html',    progress:Math.min(100,STATE.orders.length*20),stat:STATE.orders.length+' orders'},
      {icon:'🌐',name:'Community Board',status:'Active',link:'index.html#ideas',                progress:Math.min(100,STATE.ideas.length*10),stat:STATE.ideas.length+' ideas shared'},
      {icon:'🚀',name:'Showcase',       status:'Active',link:'index.html#showcase',             progress:Math.min(100,STATE.projects.length*25),stat:STATE.projects.length+' projects'},
    ];
    grid.innerHTML=platforms.map(function(p){ return '<div class="piko-platform-card"><div class="piko-platform-card-header"><div class="piko-platform-icon">'+p.icon+'</div><div><div class="piko-platform-name">'+esc(p.name)+'</div><div class="piko-platform-status"><span class="piko-platform-status-dot"></span>'+esc(p.status)+'</div></div></div><div class="piko-platform-progress"><div class="piko-platform-progress-fill" style="width:'+p.progress+'%"></div></div><div class="piko-platform-stat">'+esc(p.stat)+'</div><a href="'+esc(p.link)+'" class="piko-platform-link">Open <i class="fas fa-arrow-right"></i></a></div>'; }).join('');
  }

  function renderNotifications() {
    var list=$('pikoNotifList'); if(!list) return;
    if(!STATE.notifs.length){ list.innerHTML='<p class="piko-profile-empty">No notifications yet. Stay active in the community!</p>'; return; }
    list.innerHTML=STATE.notifs.map(function(n){ var id=n.id||n.created_at; return '<div class="piko-notif-item'+(n.read?'':' is-unread')+'" data-id="'+esc(String(id))+'"><div class="piko-notif-icon">'+esc(n.icon||'🔔')+'</div><div class="piko-notif-text">'+esc(n.text)+'</div><div class="piko-notif-time">'+timeAgo(n.created_at||n.ts||Date.now())+'</div></div>'; }).join('');
    list.querySelectorAll('.piko-notif-item').forEach(function(el){ el.addEventListener('click',function(){ var id=el.dataset.id; STATE.notifs.forEach(function(n){ if(String(n.id||n.created_at)===id) n.read=true; }); DB_LAYER.markNotifsRead(getUserId(),[id]); renderNotifications(); updateNotifBadge(); }); });
  }

  function renderSaved() {
    var grid=$('pikoSavedGrid'); if(!grid) return;
    if(!STATE.saved.length){ grid.innerHTML='<p class="piko-profile-empty" style="grid-column:1/-1">Bookmark Chronicle articles, ecosystem cards, and marketplace items to find them here.</p>'; return; }
    grid.innerHTML=STATE.saved.map(function(item,i){ return '<div class="piko-saved-card"><div class="piko-saved-icon">'+esc(item.icon||'📌')+'</div><div style="flex:1"><div class="piko-saved-title">'+esc(item.title)+'</div><div class="piko-saved-meta">'+esc(item.meta||'')+'</div></div><button class="piko-saved-remove" data-i="'+i+'" data-id="'+esc(String(item.id||''))+'" type="button"><i class="fas fa-xmark"></i></button></div>'; }).join('');
    grid.querySelectorAll('.piko-saved-remove').forEach(function(btn){ btn.addEventListener('click',function(e){ e.stopPropagation(); var i=+btn.dataset.i,id=btn.dataset.id; STATE.saved.splice(i,1); DB_LAYER.removeSaved(getUserId(),id,i); renderSaved(); toast('Removed from saved'); }); });
  }

  function renderOrders() {
    var list=$('pikoProfileOrdersList'); if(!list) return;
    if(!STATE.orders.length){ list.innerHTML='<p class="piko-profile-empty">No orders yet. <a href="marketplace/marketplace.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>'; return; }
    list.innerHTML=STATE.orders.map(function(o){ var sc=o.status==='confirmed'?'confirmed':'pending'; var sl=(o.status||'pending').replace(/_/g,' ').replace(/\b\w/g,function(c){ return c.toUpperCase(); }); var items=o.items_json||o.items||[]; var it=Array.isArray(items)?items.map(function(i){ return i.name+(i.size?' ('+i.size+')':'')+' ×'+(i.qty||1); }).join(', '):String(items); return '<div class="piko-order-card"><div class="piko-order-card-header"><span class="piko-order-id">'+esc(o.id||'')+'</span><span class="piko-order-status piko-order-status--'+sc+'">'+esc(sl)+'</span></div><div class="piko-order-items">'+esc(it)+'</div><div class="piko-order-total">'+fmtPrice(o.total||0)+' · '+(o.created_at||o.ts?new Date(o.created_at||o.ts).toLocaleDateString():'')+'</div></div>'; }).join('');
  }

  function renderIdeas() {
    var list=$('pikoProfileIdeasList'); if(!list) return;
    if(!STATE.ideas.length){ list.innerHTML='<p class="piko-profile-empty">No ideas shared yet. What are you thinking?</p>'; return; }
    list.innerHTML=STATE.ideas.map(function(i){ return '<div class="piko-profile-idea-card">'+esc(i.text)+'<div class="piko-profile-idea-meta"><span>'+esc(i.category||'Idea')+'</span><span>'+timeAgo(i.created_at||i.ts||Date.now())+'</span>'+(i.reply?'<span style="color:#f0c96a">⭐ AMP replied</span>':'')+'</div></div>'; }).join('');
  }

  function renderProjects() {
    var grid=$('pikoProfileProjectsGrid'); if(!grid) return;
    if(!STATE.projects.length){ grid.innerHTML='<p class="piko-profile-empty">No projects submitted yet. Share what you\'re building!</p>'; return; }
    var sc={idea:'#f0c96a',building:'#54d1ff',live:'#4caf7a'};
    grid.innerHTML=STATE.projects.map(function(p){ var col=sc[p.stage]||'#f0c96a'; return '<div class="ecosystem-project-card" style="background:rgba(255,255,255,.03)"><div class="epc-header"><span class="epc-name">'+esc(p.name)+'</span><span class="epc-stage" style="background:'+col+'22;color:'+col+'">'+esc(p.stage||'idea')+'</span></div><p class="epc-desc">'+esc(p.desc||p.description||'')+'</p><div class="piko-profile-idea-meta"><span style="color:'+(p.status==='approved'?'#4caf7a':'#ffb347')+'">'+(p.status==='approved'?'✓ On Showcase':'⏳ Pending Review')+'</span></div></div>'; }).join('');
  }

  function renderLearningFromState() {
    renderTrack('culturalverse', CV, STATE.learn.culturalverse||[]);
    renderTrack('digitalverse',  DV, STATE.learn.digitalverse||[]);
  }

  function renderTrack(id, modules, completed) {
    var pEl=$(id+'Progress'), mEl=$(id+'Modules'); if(!mEl) return;
    var pct=modules.length?Math.round(completed.length/modules.length*100):0;
    if(pEl) pEl.style.width=pct+'%';
    mEl.innerHTML=modules.map(function(m){ var done=completed.includes(m); return '<button class="piko-learn-module piko-learn-module--'+(done?'done':'todo')+'" data-track="'+id+'" data-module="'+esc(m)+'" type="button"><i class="fas fa-'+(done?'circle-check':'circle')+'"></i> '+esc(m)+'</button>'; }).join('');
    mEl.querySelectorAll('.piko-learn-module').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var list=STATE.learn[id]||[], idx=list.indexOf(btn.dataset.module);
        if(idx>-1) list.splice(idx,1); else list.push(btn.dataset.module);
        STATE.learn[id]=list;
        await DB_LAYER.saveLearning(getUserId(),STATE.learn);
        renderTrack(id,id==='culturalverse'?CV:DV,list);
        toast(idx>-1?btn.dataset.module+' marked incomplete':'✅ '+btn.dataset.module+' complete!');
        if(idx===-1){ await DB_LAYER.addNotif(getUserId(),'🎓','Learning: '+btn.dataset.module+' completed!'); STATE.notifs=await DB_LAYER.getNotifs(getUserId()); updateNotifBadge(); }
      });
    });
  }

  /* ════════════════════════════════════════════
     AUTH UI
  ════════════════════════════════════════════ */
  function updateNavAvatar(avatarUrl) {
    var img = $('pikoNavAvatarImg');
    if (!img) return;
    if (avatarUrl) {
      img.src = avatarUrl;
      img.onerror = function(){ img.src='assets/goldenp.jpg'; };
    } else {
      img.src = 'assets/goldenp.jpg';
    }
  }

  function showAuthGate() {
    $('pikoAuthGate').hidden=false; $('pikoProfileSection').hidden=true;
    var s=$('pikoSignOut'); if(s) s.hidden=true;
    var t=$('pikoCustomizeTrigger'); if(t) t.hidden=true;
    var nb=$('pikoNotifBtn'); if(nb) nb.hidden=true;
    updateNavAvatar(null); /* reset to logo */
  }

  async function showProfile() {
    /* Lock: prevent duplicate calls from onAuthStateChange + checkExistingSession race */
    if (_showingProfile) return;
    _showingProfile = true;

    var gate    = $('pikoAuthGate');
    var section = $('pikoProfileSection');
    if (gate)    { gate.hidden    = true;  gate.style.display    = 'none'; }
    if (section) { section.hidden = false; section.style.display = 'block'; }
    var s=$('pikoSignOut');          if(s)  { s.hidden=false;  s.style.display=''; s.style.pointerEvents='auto'; }
    var t=$('pikoCustomizeTrigger'); if(t)  { t.hidden=false;  t.style.display=''; }
    var nb=$('pikoNotifBtn');        if(nb) { nb.hidden=false; nb.style.display=''; }

    /* If we pre-rendered from localStorage, skip straight to data fetch */
    if (_profilePreRendered) {
      /* Already showing stale data — just refresh from Supabase */
      await loadAllData();
    } else {
      await loadAllData();
    }

    /* Merge banner — check multiple sources in priority order */
    var localTheme = loadJSON(THEME_KEY, {});
    /* Priority 1: Supabase Storage URL in theme (cross-device) */
    if (STATE.theme.bannerUrl && !STATE.theme.bannerBg) {
      STATE.theme.bannerBg = 'url(' + STATE.theme.bannerUrl + ') center/cover no-repeat';
    }
    /* Priority 2: profile.banner_url if theme has nothing */
    if (!STATE.theme.bannerBg && STATE.profile && STATE.profile.banner_url) {
      STATE.theme.bannerBg = 'url(' + STATE.profile.banner_url + ') center/cover no-repeat';
    }
    /* Priority 3: local base64 banner (same device only) */
    if (!STATE.theme.bannerBg && localTheme.bannerBg) {
      STATE.theme.bannerBg = localTheme.bannerBg;
    }
    /* Also restore _nameStyle and _hideEmail from theme JSONB into profile */
    if (STATE.theme._nameStyle && STATE.profile) {
      STATE.profile.nameStyle   = STATE.theme._nameStyle;
      STATE.profile.name_style  = STATE.theme._nameStyle;
    }
    if (STATE.theme._hideEmail !== undefined && STATE.profile) {
      STATE.profile.hideEmail   = STATE.theme._hideEmail;
      STATE.profile.hide_email  = STATE.theme._hideEmail;
    }

    applyTheme(STATE.theme);
    renderAll();

    /* Re-apply banner explicitly after render — most reliable approach */
    var bannerBg = STATE.theme.bannerBg || localTheme.bannerBg || '';
    if (bannerBg) {
      var bnEl = $('pikoBanner');
      if (bnEl) {
        bnEl.style.background           = bannerBg;
        bnEl.style.backgroundSize       = 'cover';
        bnEl.style.backgroundPosition   = 'center';
      }
      var idBnEl = $('pikoIdCardBanner');
      if (idBnEl) {
        idBnEl.style.background         = bannerBg;
        idBnEl.style.backgroundSize     = 'cover';
        idBnEl.style.backgroundPosition = 'center';
      }
    }

    subscribeRealtime();
    _showingProfile = false; /* release lock for future sign-out/sign-in cycles */
  }

  async function loadAllData() {
    var uid=getUserId(), email=getUserEmail();
    var results=await Promise.all([
      DB_LAYER.getProfile(uid), DB_LAYER.getMyIdeas(uid,email),
      DB_LAYER.getMyProjects(uid,email), DB_LAYER.getOrders(uid),
      DB_LAYER.getNotifs(uid), DB_LAYER.getSaved(uid),
      DB_LAYER.getLearning(uid), DB_LAYER.loadTheme(uid),
    ]);
    STATE.profile=results[0]; STATE.ideas=results[1]; STATE.projects=results[2];
    STATE.orders=results[3]; STATE.notifs=results[4]; STATE.saved=results[5];
    STATE.learn=results[6]; STATE.theme=results[7];
  }

  function subscribeRealtime() {
    if(OFFLINE||!supa()||!SESSION_USER) return;
    if(_realtimeSub) supa().removeChannel(_realtimeSub);
    _realtimeSub=supa().channel('profile-notifs-'+SESSION_USER.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+SESSION_USER.id},
        async function(payload){ var n=payload.new; STATE.notifs.unshift({id:n.id,icon:n.icon,text:n.text,ts:n.created_at,read:false}); renderNotifications(); updateNotifBadge(); toast(n.icon+' '+n.text,4000); })
      .subscribe();
  }

  /* ════════════════════════════════════════════
     SESSION CHECK
  ════════════════════════════════════════════ */
  async function checkExistingSession() {
    if(OFFLINE){ var local=loadJSON(PROFILE_KEY,null); if(local&&local.email&&local.verified!==false){ STATE.profile=local; await showProfile(); } else { showAuthGate(); } return; }
    var r=await supa().auth.getSession();
    if(r.data&&r.data.session&&r.data.session.user){ SESSION_USER=r.data.session.user; await showProfile(); }
    else showAuthGate();
  }

  function initAuthListeners() {
    if(OFFLINE||!supa()) return;
    supa().auth.onAuthStateChange(async function(event,session){
      if (event === 'SIGNED_IN' && session) {
        SESSION_USER = session.user;
        await showProfile();
      } else if (event === 'INITIAL_SESSION' && session && session.user) {
        /* INITIAL_SESSION is handled by checkExistingSession — skip here
           to prevent the double-load race condition */
        SESSION_USER = session.user;
        /* Only show profile if checkExistingSession hasn't already done it */
        if (!_showingProfile && !_profilePreRendered) {
          await showProfile();
        }
      } else if (event === 'SIGNED_OUT') {
        SESSION_USER = null;
        STATE.profile=null; STATE.ideas=[]; STATE.projects=[];
        STATE.orders=[]; STATE.notifs=[]; STATE.saved=[];
        STATE.learn={}; STATE.theme={};
        showAuthGate();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        SESSION_USER = session.user;
      } else if (event === 'USER_UPDATED' && session) {
        /* Email confirmed or password changed — refresh profile */
        SESSION_USER = session.user;
        var p = STATE.profile || {};
        p.email = session.user.email;
        STATE.profile = p;
        saveJSON(PROFILE_KEY, p);
        toast('✅ Account updated!');
        renderHeader();
      }
    });
  }

  /* ════════════════════════════════════════════
     SIGN UP
  ════════════════════════════════════════════ */
  function initSignup() {
    var btn=$('pikoSignupBtn'); if(!btn) return;
    initPasswordStrength('signupPassword','signupStrengthBar','signupStrengthLabel');

    btn.addEventListener('click', async function(){
      var name  = (($('signupName')     ||{}).value||'').trim();
      var email = (($('signupEmail')    ||{}).value||'').trim();
      var pass  = (($('signupPassword') ||{}).value||'').trim();
      var pass2 = (($('signupPassword2')||{}).value||'').trim();

      if(!email||!email.includes('@'))  { showStatus('pikoSignupStatus','Please enter a valid email address.','err'); return; }
      if(pass.length<8)                  { showStatus('pikoSignupStatus','Password must be at least 8 characters.','err'); return; }
      if(pass!==pass2)                   { showStatus('pikoSignupStatus','Passwords do not match.','err'); return; }

      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating profile…';

      if(OFFLINE){
        var p={email:email,display_name:name||email.split('@')[0],bio:'',avatar_url:'',social:'',joined_ts:Date.now(),verified:true};
        saveJSON(PROFILE_KEY,p); showStatus('pikoSignupStatus','✅ Profile created!','ok');
        await DB_LAYER.addNotif(null,'🌺','Welcome to Pikoverse, '+(name||email.split('@')[0])+'!');
        setTimeout(function(){ STATE.profile=p; (async function(){ await showProfile(); })(); },1000);
        btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile'; return;
      }

      var r=await supa().auth.signUp({ email:email, password:pass, options:{ data:{ display_name:name||email.split('@')[0] } } });
      btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';

      if(r.error){ showStatus('pikoSignupStatus','⚠️ '+r.error.message,'err'); }
      else if(r.data&&r.data.user){
        SESSION_USER=r.data.user;
        showStatus('pikoSignupStatus','✅ Profile created! Signing you in…','ok');
        await DB_LAYER.addNotif(r.data.user.id,'🌺','Welcome to Pikoverse, '+(name||email.split('@')[0])+'!');
        setTimeout(async function(){ await showProfile(); },800);
      }
    });
  }

  /* ════════════════════════════════════════════
     SIGN IN
  ════════════════════════════════════════════ */
  function initSignin() {
    var btn=$('pikoSigninBtn'); if(!btn) return;

    btn.addEventListener('click', async function(){
      var email=(($('signinEmail')   ||{}).value||'').trim();
      var pass =(($('signinPassword')||{}).value||'').trim();

      if(!email||!email.includes('@')){ showStatus('pikoSigninStatus','Please enter your email.','err'); return; }
      if(!pass)                        { showStatus('pikoSigninStatus','Please enter your password.','err'); return; }

      if(OFFLINE){
        var local=loadJSON(PROFILE_KEY,null);
        if(local&&local.email&&local.email.toLowerCase()===email.toLowerCase()){ STATE.profile=local; await showProfile(); return; }
        showStatus('pikoSigninStatus','No local profile found. Create one first.','err'); return;
      }

      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing in…';
      var r=await supa().auth.signInWithPassword({email:email,password:pass});
      btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In';

      if(r.error){
        showStatus('pikoSigninStatus', r.error.message.toLowerCase().includes('invalid')?'Wrong email or password. Please try again.':'⚠️ '+r.error.message, 'err');
      } else {
        SESSION_USER=r.data.user;
        showStatus('pikoSigninStatus','✅ Welcome back!','ok');
        setTimeout(async function(){ await showProfile(); },500);
      }
    });

    /* Forgot password */
    var forgot=$('pikoForgotBtn'); if(!forgot) return;
    forgot.addEventListener('click', async function(){
      var email=(($('signinEmail')||{}).value||'').trim();
      if(!email||!email.includes('@')){ showStatus('pikoSigninStatus','Enter your email address above first.','err'); return; }
      forgot.disabled=true; forgot.textContent='Sending…';
      var r=await supa().auth.resetPasswordForEmail(email,{ redirectTo:window.location.origin+'/profile.html?reset=1' });
      forgot.disabled=false; forgot.textContent='Forgot password?';
      showStatus('pikoSigninStatus', r.error?'⚠️ '+r.error.message:'✅ Password reset link sent to '+email+'. Check your inbox.', r.error?'err':'ok');
    });
  }

  /* ════════════════════════════════════════════
     SIGN OUT
  ════════════════════════════════════════════ */
  function initSignOut() {
    var btn=$('pikoSignOut'); if(!btn) return;
    btn.addEventListener('click', async function(){
      /* Wrap in try/catch — redirect must always happen even if signOut hangs */
      try { if (!OFFLINE && supa()) await supa().auth.signOut(); } catch(e) {}
      /* Clear session data — keep theme so banner/colors persist for next login */
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(NOTIF_KEY);
      localStorage.removeItem(LEARN_KEY);
      SESSION_USER = null;
      STATE.profile = null;
      toast('Signed out. See you soon! 🌺');
      /* Short delay so toast is visible, then redirect to hub */
      setTimeout(function(){ window.location.replace('/index.html'); }, 800);
    });
  }

  /* ════════════════════════════════════════════
     PASSWORD RESET REDIRECT (?reset=1)
  ════════════════════════════════════════════ */
  function handlePasswordReset() {
    if(!window.location.search.includes('reset=1')) return;
    window.history.replaceState({},'',window.location.pathname);

    var panel=document.createElement('div');
    panel.id='pikoResetPanel';
    panel.style.cssText='position:fixed;inset:0;background:rgba(8,11,20,.97);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px;';
    panel.innerHTML=[
      '<div style="width:min(440px,100%);background:#0d1220;border:1px solid rgba(240,201,106,.2);border-radius:16px;padding:36px;">',
        '<h2 style="font-family:Orbitron,sans-serif;font-size:18px;color:#f0c96a;margin:0 0 6px;">Set New Password</h2>',
        '<p style="font-size:13px;color:rgba(255,255,255,.5);margin:0 0 24px;">Choose a strong password for your Pikoverse account.</p>',
        '<div style="position:relative;margin-bottom:10px;">',
          '<input type="password" id="resetNewPass" placeholder="New password (min 8 characters)" maxlength="128" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 44px 12px 14px;color:#fff;font-size:14px;box-sizing:border-box;outline:none;">',
          '<button data-target="resetNewPass" class="piko-pw-toggle" type="button" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:14px;"><i class="fas fa-eye"></i></button>',
        '</div>',
        '<div style="height:4px;background:rgba(255,255,255,.07);border-radius:2px;margin-bottom:4px;overflow:hidden;"><div id="resetStrengthBar" style="height:100%;width:0;border-radius:2px;"></div></div>',
        '<div id="resetStrengthLabel" style="font-size:11px;color:rgba(255,255,255,.35);margin-bottom:14px;height:14px;"></div>',
        '<div style="position:relative;margin-bottom:20px;">',
          '<input type="password" id="resetConfirmPass" placeholder="Confirm new password" maxlength="128" style="width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 44px 12px 14px;color:#fff;font-size:14px;box-sizing:border-box;outline:none;">',
          '<button data-target="resetConfirmPass" class="piko-pw-toggle" type="button" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:14px;"><i class="fas fa-eye"></i></button>',
        '</div>',
        '<div id="resetPanelStatus" style="font-size:13px;margin-bottom:16px;display:none;padding:10px 14px;border-radius:8px;"></div>',
        '<button id="resetSubmitBtn" type="button" style="width:100%;background:linear-gradient(135deg,#c9a84c,#f0c96a);color:#080b14;font-weight:800;font-size:14px;border:none;padding:14px;border-radius:10px;cursor:pointer;">Set New Password</button>',
      '</div>',
    ].join('');
    document.body.appendChild(panel);

    initPasswordStrength('resetNewPass','resetStrengthBar','resetStrengthLabel');

    /* pw-toggle inside panel */
    panel.querySelectorAll('.piko-pw-toggle').forEach(function(btn){
      btn.addEventListener('click',function(){
        var inp=document.getElementById(btn.dataset.target); if(!inp) return;
        var show=inp.type==='password'; inp.type=show?'text':'password';
        btn.querySelector('i').className=show?'fas fa-eye-slash':'fas fa-eye';
      });
    });

    var submitBtn=$('resetSubmitBtn'), statusEl=$('resetPanelStatus');
    submitBtn.addEventListener('click', async function(){
      var np=(($('resetNewPass')    ||{}).value||'').trim();
      var np2=(($('resetConfirmPass')||{}).value||'').trim();
      var setErr=function(m){ statusEl.textContent=m; statusEl.style.cssText='display:block;background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.25);color:#e05252;padding:10px 14px;border-radius:8px;'; };
      var setOk =function(m){ statusEl.textContent=m; statusEl.style.cssText='display:block;background:rgba(76,175,122,.1);border:1px solid rgba(76,175,122,.25);color:#4caf7a;padding:10px 14px;border-radius:8px;'; };

      if(np.length<8){ setErr('Password must be at least 8 characters.'); return; }
      if(np!==np2)   { setErr('Passwords do not match.'); return; }

      submitBtn.disabled=true; submitBtn.textContent='Saving…';
      var r=await supa().auth.updateUser({password:np});

      if(r.error){ setErr('⚠️ '+r.error.message); submitBtn.disabled=false; submitBtn.textContent='Set New Password'; }
      else {
        setOk('✅ Password updated! You are now signed in.');
        if(SESSION_USER) await DB_LAYER.addNotif(SESSION_USER.id,'🔐','Your password was successfully reset.');
        setTimeout(function(){ panel.remove(); toast('✅ Password updated!'); },1500);
      }
    });
  }

  /* ════════════════════════════════════════════
     ACCOUNT SETTINGS — CHANGE PASSWORD + EMAIL
  ════════════════════════════════════════════ */
  function initAccountSettings() {

    /* ── Change Password ── */
    var changePwBtn=$('pikoChangePwBtn');
    if(changePwBtn){
      initPasswordStrength('newPassword','changePwStrengthBar','changePwStrengthLabel');

      changePwBtn.addEventListener('click', async function(){
        var cur=(($('currentPassword')||{}).value||'').trim();
        var np =(($('newPassword')    ||{}).value||'').trim();
        var np2=(($('newPassword2')   ||{}).value||'').trim();
        clearStatus('pikoChangePwStatus');

        if(!cur)           { showStatus('pikoChangePwStatus','Enter your current password.','err'); return; }
        if(np.length<8)    { showStatus('pikoChangePwStatus','New password must be at least 8 characters.','err'); return; }
        if(np!==np2)       { showStatus('pikoChangePwStatus','New passwords do not match.','err'); return; }
        if(np===cur)       { showStatus('pikoChangePwStatus','New password must be different from your current one.','err'); return; }

        changePwBtn.disabled=true; changePwBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verifying…';

        /* Re-authenticate to confirm current password */
        var reauth=await supa().auth.signInWithPassword({email:getUserEmail(),password:cur});
        if(reauth.error){
          showStatus('pikoChangePwStatus','Current password is incorrect.','err');
          changePwBtn.disabled=false; changePwBtn.innerHTML='<i class="fas fa-key"></i> Update Password'; return;
        }

        changePwBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…';
        var r=await supa().auth.updateUser({password:np});
        changePwBtn.disabled=false; changePwBtn.innerHTML='<i class="fas fa-key"></i> Update Password';

        if(r.error){ showStatus('pikoChangePwStatus','⚠️ '+r.error.message,'err'); }
        else {
          showStatus('pikoChangePwStatus','✅ Password updated successfully!','ok');
          ['currentPassword','newPassword','newPassword2'].forEach(function(id){ var el=$(id); if(el) el.value=''; });
          await DB_LAYER.addNotif(getUserId(),'🔐','Your password was changed. If this wasn\'t you, contact support immediately.');
          STATE.notifs=await DB_LAYER.getNotifs(getUserId()); updateNotifBadge();
          toast('🔐 Password updated');
        }
      });
    }

    /* ── Change Email ── */
    var changeEmailBtn=$('pikoChangeEmailBtn');
    if(changeEmailBtn){
      changeEmailBtn.addEventListener('click', async function(){
        var newEmail=(($('newEmail')     ||{}).value||'').trim();
        var pwConf  =(($('emailChangePw')||{}).value||'').trim();
        clearStatus('pikoChangeEmailStatus');

        if(!newEmail||!newEmail.includes('@')){ showStatus('pikoChangeEmailStatus','Enter a valid new email address.','err'); return; }
        if(newEmail.toLowerCase()===getUserEmail().toLowerCase()){ showStatus('pikoChangeEmailStatus','That\'s already your current email address.','err'); return; }
        if(!pwConf){ showStatus('pikoChangeEmailStatus','Enter your current password to confirm.','err'); return; }

        changeEmailBtn.disabled=true; changeEmailBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verifying…';

        var reauth=await supa().auth.signInWithPassword({email:getUserEmail(),password:pwConf});
        if(reauth.error){
          showStatus('pikoChangeEmailStatus','Password is incorrect.','err');
          changeEmailBtn.disabled=false; changeEmailBtn.innerHTML='<i class="fas fa-envelope"></i> Update Email'; return;
        }

        changeEmailBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…';
        /* Supabase sends confirmation link to the NEW address before switching */
        var r=await supa().auth.updateUser({email:newEmail});
        changeEmailBtn.disabled=false; changeEmailBtn.innerHTML='<i class="fas fa-envelope"></i> Update Email';

        if(r.error){ showStatus('pikoChangeEmailStatus','⚠️ '+r.error.message,'err'); }
        else {
          showStatus('pikoChangeEmailStatus','✅ Confirmation email sent to '+newEmail+'. Click the link in that email to complete the change.','ok');
          var ne=$('newEmail'); if(ne) ne.value='';
          var ep=$('emailChangePw'); if(ep) ep.value='';
          await DB_LAYER.addNotif(getUserId(),'📧','Email change requested to '+newEmail+'. Check your new inbox to confirm. If this wasn\'t you, contact support.');
          STATE.notifs=await DB_LAYER.getNotifs(getUserId()); updateNotifBadge();
          toast('📧 Confirmation sent to '+newEmail);
        }
      });
    }
  }

  /* ════════════════════════════════════════════
     EDIT PROFILE
  ════════════════════════════════════════════ */
  /* ════════════════════════════════════════════
     EDIT PROFILE — tabbed panel
  ════════════════════════════════════════════ */
  function initEditProfile() {
    var editBtn    = $('pikoEditProfileBtn');
    var cancelBtn  = $('pikoCancelEditBtn');
    var saveBtn    = $('pikoSaveProfileBtn');
    var saveStyleBtn = $('pikoSaveStyleBtn');
    var form       = $('pikoProfileEditForm');
    var avatarBtn  = $('pikoAvatarEditBtn');
    var avatarFile = $('pikoAvatarFile');
    var bannerBtn  = $('pikoBannerEditBtn');
    var bannerFile = $('pikoBannerFile');

    /* ── Sub-tabs inside edit form ── */
    document.querySelectorAll('.piko-edit-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.piko-edit-tab').forEach(function(b){ b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-edit-pane').forEach(function(p){ p.style.display='none'; });
        btn.classList.add('is-active');
        var pane = $('pikoEditPane'+btn.dataset.etab.charAt(0).toUpperCase()+btn.dataset.etab.slice(1));
        if (pane) pane.style.display = 'block';
      });
    });

    /* Open edit form */
    if (editBtn) editBtn.addEventListener('click', function(){
      var p = STATE.profile || {};
      ($('editName')      ||{}).value = p.display_name || '';
      ($('editBio')       ||{}).value = p.bio          || '';
      ($('editAvatarUrl') ||{}).value = p.avatar_url   || '';
      ($('editSocial')    ||{}).value = p.social       || '';
      var hE = $('hideEmailToggle'); if (hE) hE.checked = !!(p.hide_email || p.hideEmail);
      var ns = p.nameStyle || p.name_style || {};
      var nc = $('nameStyleColor');  if (nc) nc.value = ns.color  || '#ffffff';
      var nf = $('nameStyleFont');   if (nf) nf.value = ns.font   || '';
      var nw = $('nameStyleWeight'); if (nw) nw.value = ns.weight || '700';
      var nz = $('nameStyleSize');   if (nz) nz.value = parseInt(ns.size) || 28;
      document.querySelectorAll('.piko-edit-pane').forEach(function(p){ p.style.display='none'; });
      var first = $('pikoEditPaneProfile'); if (first) first.style.display = 'block';
      document.querySelectorAll('.piko-edit-tab').forEach(function(b){ b.classList.remove('is-active'); });
      var firstTab = document.querySelector('.piko-edit-tab'); if (firstTab) firstTab.classList.add('is-active');
      updateNamePreviewFromState();
      if (form) { form.hidden = false; form.style.display = 'block'; }
    });

    /* Close */
    if (cancelBtn) cancelBtn.addEventListener('click', function(){
      if (form) { form.hidden = true; form.style.display = 'none'; }
    });

    /* Save Profile */
    if (saveBtn) saveBtn.addEventListener('click', async function(){
      var p = Object.assign({}, STATE.profile || {});
      var name = (($('editName') || {}).value || '').trim();
      if (name) p.display_name = name;
      p.bio       = (($('editBio')       || {}).value || '').trim();
      p.social    = (($('editSocial')    || {}).value || '').trim();
      var av = (($('editAvatarUrl') || {}).value || '').trim();
      if (av) p.avatar_url = av;
      var hE = $('hideEmailToggle'); p.hide_email = hE ? hE.checked : false; p.hideEmail = p.hide_email;

      saveBtn.disabled  = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

      STATE.profile = p;
      await DB_LAYER.upsertProfile(p);

      saveBtn.disabled  = false;
      saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';
      showStatus('pikoSaveStatus', '✅ Profile saved!', 'ok');
      renderAll();
      toast('✅ Profile updated!');
      setTimeout(function(){ clearStatus('pikoSaveStatus'); }, 3000);
    });

    /* Save Name Style separately */
    if (saveStyleBtn) saveStyleBtn.addEventListener('click', async function(){
      var ns = readNameStyle();
      var p  = Object.assign({}, STATE.profile || {});
      p.nameStyle = ns; p.name_style = ns;
      STATE.profile = p;
      applyNameStyleToPage(ns);
      await DB_LAYER.upsertProfile(p);
      showStatus('pikoStyleStatus', '✅ Style saved!', 'ok');
      toast('✅ Name style saved!');
      setTimeout(function(){ clearStatus('pikoStyleStatus'); }, 3000);
    });

    /* Avatar upload */
    if (avatarBtn && avatarFile) {
      avatarBtn.addEventListener('click', function(){ avatarFile.click(); });
      avatarFile.addEventListener('change', async function(){
        var file = avatarFile.files[0]; if (!file) return;
        if (!OFFLINE && supa() && SESSION_USER) {
          var path = 'avatars/'+SESSION_USER.id+'/'+Date.now()+'.'+file.name.split('.').pop();
          var up = await supa().storage.from('pikoverse-public').upload(path, file, {upsert:true});
          if (!up.error) {
            var url = supa().storage.from('pikoverse-public').getPublicUrl(path).data.publicUrl;
            STATE.profile = STATE.profile || {}; STATE.profile.avatar_url = url;
            await DB_LAYER.upsertProfile(STATE.profile);
            renderAll(); toast('✅ Avatar updated!'); return;
          }
        }
        var reader = new FileReader();
        reader.onload = async function(e){
          STATE.profile = STATE.profile || {}; STATE.profile.avatar_url = e.target.result;
          await DB_LAYER.upsertProfile(STATE.profile);
          renderAll(); toast('✅ Avatar updated!');
        };
        reader.readAsDataURL(file);
      });
    }

    /* Banner upload — tries Supabase Storage first (cross-device URL),
       falls back to base64 in localStorage (same-device only)           */
    if (bannerBtn && bannerFile) {
      bannerBtn.addEventListener('click', function(){ bannerFile.click(); });
      bannerFile.addEventListener('change', async function(){
        var file = bannerFile.files[0]; if (!file) return;
        toast('⏳ Uploading banner…');

        /* Try Supabase Storage upload first */
        if (!OFFLINE && supa() && SESSION_USER) {
          var path = 'banners/' + SESSION_USER.id + '/banner.' + (file.name.split('.').pop() || 'jpg');
          var up   = await supa().storage.from('pikoverse-public').upload(path, file, { upsert: true });
          if (!up.error) {
            var url = supa().storage.from('pikoverse-public').getPublicUrl(path).data.publicUrl;
            /* Store as a proper URL — works on any device */
            STATE.theme = STATE.theme || {};
            STATE.theme.bannerUrl = url;
            STATE.theme.bannerBg  = 'url(' + url + ') center/cover no-repeat';
            saveJSON(THEME_KEY, STATE.theme);
            /* Apply immediately */
            var bnEl = $('pikoBanner');
            if (bnEl) { bnEl.style.background = STATE.theme.bannerBg; bnEl.style.backgroundSize = 'cover'; bnEl.style.backgroundPosition = 'center'; }
            await DB_LAYER.saveTheme(getUserId(), STATE.theme);
            updateIdCardBanner();
            toast('✅ Banner updated!');
            return;
          }
        }

        /* Fallback: base64 in localStorage only */
        var reader = new FileReader();
        reader.onload = async function(e){
          STATE.theme = STATE.theme || {};
          STATE.theme.bannerBg = 'url(' + e.target.result + ') center/cover no-repeat';
          /* bannerUrl stays empty so cross-device knows no Storage URL exists */
          saveJSON(THEME_KEY, STATE.theme);
          var bnEl = $('pikoBanner');
          if (bnEl) { bnEl.style.background = STATE.theme.bannerBg; bnEl.style.backgroundSize = 'cover'; bnEl.style.backgroundPosition = 'center'; }
          /* Save theme to DB (base64 stripped server-side — only URL stored in DB) */
          await DB_LAYER.saveTheme(getUserId(), STATE.theme);
          updateIdCardBanner();
          toast('✅ Banner saved locally!');
        };
        reader.readAsDataURL(file);
      });
    }
  }

  /* ── Name style helpers ── */
  function readNameStyle() {
    return {
      color:  ($('nameStyleColor')  || {}).value || '#ffffff',
      font:   ($('nameStyleFont')   || {}).value || '',
      weight: ($('nameStyleWeight') || {}).value || '700',
      size:   (($('nameStyleSize')  || {}).value || '28') + 'px',
    };
  }

  function applyNameStyleToPage(ns) {
    var el = $('pikoProfileName'); if (!el) return;
    el.style.color      = ns.color  || '';
    el.style.fontFamily = ns.font   || '';
    el.style.fontWeight = ns.weight || '';
    el.style.fontSize   = ns.size   || '';
    updateNavAvatar(); /* also refresh nav name with style */
  }

  function updateNamePreviewFromState() {
    var preview = $('pikoNamePreview'); if (!preview) return;
    var p = STATE.profile || {};
    preview.textContent = p.display_name || getUserEmail() || 'Your Name';
    var ns = p.nameStyle || p.name_style || {};
    if (ns.color)  preview.style.color      = ns.color;
    if (ns.font)   preview.style.fontFamily = ns.font || 'inherit';
    if (ns.weight) preview.style.fontWeight = ns.weight;
    if (ns.size)   preview.style.fontSize   = ns.size;
  }

  function initNameStyleEditor() {
    var inputs = ['nameStyleColor','nameStyleFont','nameStyleWeight','nameStyleSize'];
    inputs.forEach(function(id){
      var el = $(id); if (!el) return;
      el.addEventListener('input', function(){
        var ns  = readNameStyle();
        var prev = $('pikoNamePreview'); if (!prev) return;
        prev.textContent = ($('editName')||{}).value || (STATE.profile&&STATE.profile.display_name) || 'Your Name';
        prev.style.color      = ns.color  || '';
        prev.style.fontFamily = ns.font   || 'inherit';
        prev.style.fontWeight = ns.weight || '700';
        prev.style.fontSize   = ns.size   || '28px';
        var lbl = $('nameStyleSizeVal');
        if (lbl && id === 'nameStyleSize') lbl.textContent = el.value + 'px';
      });
    });
  }

  /* ════════════════════════════════════════════
     TABS
  ════════════════════════════════════════════ */
  function initAuthTabs() {
    document.querySelectorAll('.piko-auth-tab').forEach(function(btn){
      btn.addEventListener('click',function(){
        document.querySelectorAll('.piko-auth-tab').forEach(function(b){ b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-auth-pane').forEach(function(p){ p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var pane=$('pikoAuth'+btn.dataset.authTab.charAt(0).toUpperCase()+btn.dataset.authTab.slice(1));
        if(pane) pane.classList.add('is-active');
      });
    });
  }

  function initProfileTabs() {
    document.querySelectorAll('.piko-profile-tab').forEach(function(btn){
      btn.addEventListener('click',function(){
        document.querySelectorAll('.piko-profile-tab').forEach(function(b){ b.classList.remove('is-active'); });
        document.querySelectorAll('.piko-profile-pane').forEach(function(p){ p.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var pane=$('pikoProfilePane'+btn.dataset.ptab.charAt(0).toUpperCase()+btn.dataset.ptab.slice(1));
        if(pane) pane.classList.add('is-active');
      });
    });
  }


  /* ════════════════════════════════════════════
     NAV AVATAR — syncs with profile image
  ════════════════════════════════════════════ */
  function updateNavAvatar() {
    var navImg = $('pikoNavAvatarImg') || $('pikoNavAvatar');
    if (!navImg) return;
    var p   = STATE.profile || {};
    var src = p.avatar_url || '';
    if (src) {
      navImg.src = src;
      navImg.classList.add('has-profile');
      navImg.style.border = '2px solid var(--pf-custom-accent, var(--pf-gold))';
      navImg.style.boxShadow = '0 0 0 2px var(--pf-custom-glow, rgba(240,201,106,.15))';
      navImg.onerror = function(){
        navImg.src = 'assets/goldenp.jpg';
        navImg.classList.remove('has-profile');
        navImg.style.border = '';
        navImg.style.boxShadow = '';
      };
    } else {
      navImg.src = 'assets/goldenp.jpg';
      navImg.classList.remove('has-profile');
    }
    /* Nav text: show display name when logged in */
    var navSpan = document.querySelector('.piko-profile-nav-logo span');
    if (navSpan && p.display_name) navSpan.textContent = p.display_name;
  }

  /* ════════════════════════════════════════════
     ID CARD BANNER BG
  ════════════════════════════════════════════ */
  function updateIdCardBanner() {
    var bannerEl  = $('pikoBanner');
    var cardBanner = $('pikoIdCardBanner');
    if (!cardBanner) return;
    /* Use the banner's computed background or STATE.theme.bannerBg */
    var bg = (STATE.theme && STATE.theme.bannerBg) || '';
    if (!bg && bannerEl) {
      var style = bannerEl.style.background || bannerEl.style.backgroundImage || '';
      bg = style;
    }
    if (bg) {
      cardBanner.style.background = bg;
      cardBanner.style.backgroundSize = 'cover';
      cardBanner.style.backgroundPosition = 'center';
    } else {
      cardBanner.style.background = 'linear-gradient(135deg,#0d1220,#141830)';
    }
  }

  /* ════════════════════════════════════════════
     NAME STYLE — live preview + save
  ════════════════════════════════════════════ */
  function initNameStyleEditor() {
    var colorIn  = $('nameStyleColor');
    var fontIn   = $('nameStyleFont');
    var weightIn = $('nameStyleWeight');
    var sizeIn   = $('nameStyleSize');
    var sizeVal  = $('nameStyleSizeVal');
    var preview  = $('pikoNamePreview');

    function updatePreview() {
      if (!preview) return;
      preview.textContent = ($('editName')||{}).value || (STATE.profile && STATE.profile.display_name) || 'Your Name';
      if (colorIn)  preview.style.color      = colorIn.value;
      if (fontIn)   preview.style.fontFamily = fontIn.value || 'inherit';
      if (weightIn) preview.style.fontWeight = weightIn.value;
      if (sizeIn)   { preview.style.fontSize = sizeIn.value + 'px'; if (sizeVal) sizeVal.textContent = sizeIn.value + 'px'; }
    }

    [colorIn, fontIn, weightIn, sizeIn].forEach(function(el){ if(el) el.addEventListener('input', updatePreview); });
    var nameIn = $('editName'); if (nameIn) nameIn.addEventListener('input', updatePreview);

    /* Populate from saved theme on open */
    var editBtn = $('pikoEditProfileBtn');
    if (editBtn) {
      var origClick = editBtn.onclick;
      editBtn.addEventListener('click', function() {
        var ns = STATE.profile && STATE.profile.nameStyle || {};
        if (colorIn  && ns.color)  colorIn.value  = ns.color;
        if (fontIn   && ns.font)   fontIn.value   = ns.font;
        if (weightIn && ns.weight) weightIn.value = ns.weight;
        if (sizeIn   && ns.size)   sizeIn.value   = parseInt(ns.size) || 28;
        setTimeout(updatePreview, 50);
      });
    }
  }

  function applyNameStyle() {
    var ns = readNameStyle();
    var nameEl = $('pikoProfileName');
    if (nameEl) {
      if (ns.color)  nameEl.style.color      = ns.color;
      if (ns.font)   nameEl.style.fontFamily = ns.font || 'inherit';
      if (ns.weight) nameEl.style.fontWeight = ns.weight;
      if (ns.size)   nameEl.style.fontSize   = ns.size;
    }
    return ns;
  }

  /* ════════════════════════════════════════════
     HIDE EMAIL TOGGLE
  ════════════════════════════════════════════ */
  function applyHideEmail() {
    var emailEl = $('pikoProfileEmail');
    if (!emailEl) return;
    var hide = STATE.profile && STATE.profile.hideEmail;
    emailEl.style.display = hide ? 'none' : '';
  }

  /* ════════════════════════════════════════════
     INLINE IDEA SUBMISSION
  ════════════════════════════════════════════ */
  function initIdeaForm() {
    var showBtn    = $('pikoSubmitIdeaBtn');
    var form       = $('pikoIdeaForm');
    var cancelBtn  = $('pikoIdeaCancelBtn');
    var submitBtn  = $('pikoIdeaSubmitBtn');
    var textEl     = $('ideaText');
    var countEl    = $('ideaCharCount');

    if (showBtn) showBtn.addEventListener('click', function(){
      if (form) form.hidden = !form.hidden;
      if (!form.hidden && textEl) textEl.focus();
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function(){ if(form) form.hidden = true; });

    if (textEl && countEl) {
      textEl.addEventListener('input', function(){ countEl.textContent = textEl.value.length; });
    }

    if (submitBtn) submitBtn.addEventListener('click', async function(){
      var text = (textEl || {}).value || '';
      var cat  = ($('ideaCategory')||{}).value || 'other';
      if (text.trim().length < 10) { showStatus('pikoIdeaStatus','Please write at least 10 characters.','err'); return; }

      submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

      var ideaObj = {
        id:       'idea-' + Date.now(),
        text:     text.trim(),
        name:     (STATE.profile && STATE.profile.display_name) || getUserEmail() || 'Anonymous',
        contact:  getUserEmail() || '',
        category: cat,
        ts:       Date.now(),
        dismissed: false,
        reply:    '',
        status:   'pending',
      };

      /* Write to Supabase community_ideas + localStorage */
      var localIdeas = loadJSON('amp_admin_ideas', []);
      localIdeas.unshift(ideaObj); saveJSON('amp_admin_ideas', localIdeas);

      if (!OFFLINE && supa() && SESSION_USER) {
        await supa().from('community_ideas').insert({
          id: ideaObj.id, text: ideaObj.text, name: ideaObj.name,
          contact: SESSION_USER.email, shareContact: false,
          category: cat, ts: ideaObj.ts, dismissed: false, reply: '', status: 'pending',
          user_id: SESSION_USER.id,
        });
      }

      STATE.ideas = await DB_LAYER.getMyIdeas(getUserId(), getUserEmail());
      renderIdeas(); renderTimeline(); renderStats(); renderRank(); renderBadges();

      showStatus('pikoIdeaStatus','✅ Idea submitted! AMP will review it shortly.','ok');
      if (textEl) textEl.value = ''; if (countEl) countEl.textContent = '0';
      submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Idea';
      await DB_LAYER.addNotif(getUserId(),'💡','Your idea was submitted and is pending review.');
      STATE.notifs = await DB_LAYER.getNotifs(getUserId()); updateNotifBadge();
      setTimeout(function(){ if(form) form.hidden = true; clearStatus('pikoIdeaStatus'); }, 3000);
    });
  }

  /* ════════════════════════════════════════════
     INLINE PROJECT SUBMISSION + TEMPLATES
  ════════════════════════════════════════════ */
  var PROJECT_TEMPLATES = {
    app:       { name:'My App / Tool', desc:'A digital tool or application that solves a problem for the community.', stage:'building' },
    art:       { name:'My Creative Project', desc:'An artistic or creative work — visual, audio, or mixed media.', stage:'idea' },
    education: { name:'Learning Resource', desc:'An educational resource, course, or guide for the Pikoverse community.', stage:'idea' },
    community: { name:'Community Initiative', desc:'A project that brings people together or builds community connection.', stage:'idea' },
    business:  { name:'My Business / Venture', desc:'A business idea or entrepreneurial project in the Pikoverse ecosystem.', stage:'idea' },
    blank:     { name:'', desc:'', stage:'idea' },
  };

  function initProjectForm() {
    var showBtn      = $('pikoSubmitProjectBtn');
    var templates    = $('pikoProjectTemplates');
    var form         = $('pikoProjectForm');
    var cancelBtn    = $('pikoProjectCancelBtn');
    var submitBtn    = $('pikoProjectSubmitBtn');

    if (showBtn) showBtn.addEventListener('click', function(){
      if (templates) { templates.hidden = false; }
      if (form) form.hidden = true;
    });

    document.querySelectorAll('.piko-template-card').forEach(function(card){
      card.addEventListener('click', function(){
        var tmpl = PROJECT_TEMPLATES[card.dataset.template] || PROJECT_TEMPLATES.blank;
        var nameEl  = $('projectName');
        var descEl  = $('projectDesc');
        var stageEl = $('projectStage');
        if (nameEl)  nameEl.value  = tmpl.name;
        if (descEl)  descEl.value  = tmpl.desc;
        if (stageEl) stageEl.value = tmpl.stage;
        if (templates) templates.hidden = true;
        if (form) { form.hidden = false; if (nameEl) nameEl.focus(); }
      });
    });

    if (cancelBtn) cancelBtn.addEventListener('click', function(){
      if (form) form.hidden = true;
      if (templates) templates.hidden = true;
    });

    if (submitBtn) submitBtn.addEventListener('click', async function(){
      var name  = (($('projectName') ||{}).value||'').trim();
      var desc  = (($('projectDesc') ||{}).value||'').trim();
      var stage = ($('projectStage')||{}).value || 'idea';
      var url   = (($('projectUrl')  ||{}).value||'').trim();

      if (!name) { showStatus('pikoProjectStatus','Please give your project a name.','err'); return; }
      if (!desc) { showStatus('pikoProjectStatus','Please add a short description.','err'); return; }

      submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

      var proj = {
        id:      'proj-' + Date.now(),
        name:    name,
        desc:    desc,
        stage:   stage,
        url:     url || '',
        contact: getUserEmail() || '',
        status:  'pending',
        ts:      Date.now(),
      };

      /* localStorage */
      var localProjs = loadJSON('amp_admin_projects_hub', []);
      localProjs.unshift(proj); saveJSON('amp_admin_projects_hub', localProjs);

      /* Supabase */
      if (!OFFLINE && supa() && SESSION_USER) {
        await supa().from('projects').insert({
          user_id: SESSION_USER.id, contact: SESSION_USER.email,
          name: name, description: desc, stage: stage, url: url || null, status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      STATE.projects = await DB_LAYER.getMyProjects(getUserId(), getUserEmail());
      renderProjects(); renderTimeline(); renderStats(); renderRank(); renderBadges();

      showStatus('pikoProjectStatus','✅ Project submitted! AMP will review and add it to the showcase.','ok');
      ['projectName','projectDesc','projectUrl'].forEach(function(id){ var el=$(id); if(el) el.value=''; });
      submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Project';
      await DB_LAYER.addNotif(getUserId(),'🚀','Your project "'+name+'" was submitted for review!');
      STATE.notifs = await DB_LAYER.getNotifs(getUserId()); updateNotifBadge();
      setTimeout(function(){ if(form) form.hidden = true; if(templates) templates.hidden = true; clearStatus('pikoProjectStatus'); }, 3000);
    });
  }

  /* ════════════════════════════════════════════
     SHARE / NOTIF BELL / CUSTOMIZE
  ════════════════════════════════════════════ */
  function initShareCard() {
    var btn = $('pikoShareCardBtn'); if (!btn) return;

    btn.addEventListener('click', async function() {
      var p       = STATE.profile || {};
      var name    = p.display_name || getUserEmail() || 'Member';
      var approved= STATE.projects.filter(function(x){ return x.status==='approved'; }).length;
      var earned  = getEarnedBadgeIds(STATE.ideas.length, approved, STATE.orders.length, STATE.learn, STATE.profile);
      var score   = calcScore(STATE.ideas.length, approved, STATE.orders.length, earned.length);
      var rank    = getRank(score);

      /* ── Try to capture the ID card as an image using html2canvas ── */
      var card = $('pikoIdCard') || $('pikoIdCardWrap') || document.querySelector('.piko-id-card');

      if (card && typeof html2canvas !== 'undefined') {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Capturing…';
        try {
          /* Wait for all images in the card to finish loading */
          var imgs = card.querySelectorAll('img');
          await Promise.all(Array.from(imgs).map(function(img) {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise(function(res) { img.onload = res; img.onerror = res; });
          }));

          var canvas = await html2canvas(card, {
            backgroundColor: '#080b14',
            scale: 2,
            useCORS: true,
            allowTaint: false,
            logging: false,
          });

          canvas.toBlob(async function(blob) {
            var file     = new File([blob], 'pikoverse-id.png', { type: 'image/png' });
            var shareText= '🌺 ' + name + ' is a ' + rank.label + ' on Pikoverse! Score: ' + score + ' pts';
            var shareUrl = 'https://pikoverse.xyz/profile.html';

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({ title: 'My Pikoverse ID Card', text: shareText, url: shareUrl, files: [file] });
              } catch(err) {
                if (err.name !== 'AbortError') { _downloadCardCanvas(canvas); toast('✅ ID card downloaded!'); }
              }
            } else {
              _downloadCardCanvas(canvas);
              if (navigator.clipboard) navigator.clipboard.writeText(shareText + ' — ' + shareUrl).catch(function(){});
              toast('✅ ID card downloaded! Link copied.');
            }
          }, 'image/png');

        } catch(err) {
          console.warn('[ShareCard] html2canvas error:', err);
          _fallbackShareText(name, rank, score);
        } finally {
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-share-nodes"></i> Share My Card';
        }
        return;
      }

      /* No card element or html2canvas not loaded — text share fallback */
      _fallbackShareText(name, rank, score);
    });
  }

  function _downloadCardCanvas(canvas) {
    var a = document.createElement('a');
    a.download = 'pikoverse-id.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function _fallbackShareText(name, rank, score) {
    var text = '🌺 ' + name + ' is a ' + rank.label + ' on Pikoverse! Score: ' + score + ' pts — pikoverse.xyz/profile.html';
    if (navigator.share) {
      navigator.share({ title: 'My Pikoverse ID', text: text, url: 'https://pikoverse.xyz/profile.html' }).catch(function(){});
    } else {
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function(){});
      toast('✅ Profile link copied to clipboard!');
    }
  }
  function initNotifBell() {
    var btn=$('pikoNotifBtn'); if(!btn) return;
    btn.addEventListener('click',function(){
      document.querySelectorAll('.piko-profile-tab').forEach(function(b){ b.classList.remove('is-active'); });
      document.querySelectorAll('.piko-profile-pane').forEach(function(p){ p.classList.remove('is-active'); });
      var tab=document.querySelector('[data-ptab="notifications"]'), pane=$('pikoProfilePaneNotifications');
      if(tab) tab.classList.add('is-active');
      if(pane){ pane.classList.add('is-active'); pane.scrollIntoView({behavior:'smooth',block:'start'}); }
    });
    var ma=$('pikoMarkAllRead'); if(!ma) return;
    ma.addEventListener('click', async function(){
      STATE.notifs.forEach(function(x){ x.read=true; });
      await DB_LAYER.markNotifsRead(getUserId(),null);
      renderNotifications(); updateNotifBadge(); toast('All notifications marked as read');
    });
  }

  function applyTheme(t) {
    if(!t||!Object.keys(t).length) return;
    var r=document.documentElement;
    if(t.accent)  r.style.setProperty('--pf-custom-accent',  t.accent);
    if(t.bg)      r.style.setProperty('--pf-custom-bg',      t.bg);
    if(t.bg2)     r.style.setProperty('--pf-custom-bg2',     t.bg2);
    if(t.text)    r.style.setProperty('--pf-custom-text',    t.text);
    if(t.glow)    r.style.setProperty('--pf-custom-glow',    t.glow);
    if(t.cardBg)  r.style.setProperty('--pf-custom-card-bg', t.cardBg);
    if(t.font)    r.style.setProperty('--pf-custom-font',    t.font);
    if(t.bgImage) document.body.style.background=t.bgImage;
    if(t.bannerBg){ var bn=$('pikoBanner'); if(bn) bn.style.background=t.bannerBg; }
    var st=$('pikoCustomStyle'); if(st) st.textContent=t.css||'';
    /* Keep ID card banner in sync */
    if(t.bannerBg){ var idBanner=$('pikoIdCardBanner'); if(idBanner){ idBanner.style.background=t.bannerBg; idBanner.style.backgroundSize='cover'; idBanner.style.backgroundPosition='center'; } }
  }

  /* Customize panel controls — module-level so apply button can close panel */
  var _openCustomize  = function(){};
  var _closeCustomize = function(){};

  function initCustomize() {
    var trigger  = $('pikoCustomizeTrigger');
    var panel    = $('pikoCustomizePanel');
    var close    = $('pikoCustomizeClose');
    var backdrop = $('pikoCustomizeBackdrop');

    _openCustomize  = function() {
      if (panel)    panel.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
    };
    _closeCustomize = function() {
      if (panel)    panel.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
    };

    if (trigger) trigger.addEventListener('click', function(){
      /* Default to Profile tab when opened from the nav palette button */
      document.querySelectorAll('.piko-edit-tab').forEach(function(b){ b.classList.remove('is-active'); });
      document.querySelectorAll('.piko-edit-pane').forEach(function(p){ p.style.display='none'; });
      var profileTab  = document.querySelector('[data-etab="profile"]');
      var profilePane = $('pikoEditPaneProfile');
      if (profileTab)  profileTab.classList.add('is-active');
      if (profilePane) profilePane.style.display = 'block';
      /* Populate fields with current profile data */
      var p = STATE.profile || {};
      ($('editName')      ||{}).value = p.display_name || '';
      ($('editBio')       ||{}).value = p.bio          || '';
      ($('editAvatarUrl') ||{}).value = p.avatar_url   || '';
      ($('editSocial')    ||{}).value = p.social       || '';
      var hE = $('hideEmailToggle'); if (hE) hE.checked = !!(p.hide_email || p.hideEmail);
      var ns = p.nameStyle || p.name_style || {};
      var nc = $('nameStyleColor');  if (nc) nc.value = ns.color  || '#ffffff';
      var nf = $('nameStyleFont');   if (nf) nf.value = ns.font   || '';
      var nw = $('nameStyleWeight'); if (nw) nw.value = ns.weight || '700';
      var nz = $('nameStyleSize');   if (nz) nz.value = parseInt(ns.size) || 28;
      updateNamePreviewFromState();
      _openCustomize();
    });
    if (close)    close.addEventListener('click',    _closeCustomize);
    if (backdrop) backdrop.addEventListener('click', _closeCustomize);

    document.querySelectorAll('.piko-theme-preset').forEach(function(el){
      el.addEventListener('click',function(){
        document.querySelectorAll('.piko-theme-preset').forEach(function(e){ e.classList.remove('is-active'); }); el.classList.add('is-active');
        var t=THEMES[el.dataset.theme]||THEMES.default;
        var acc=$('customAccentColor'),bg=$('customBgColor'),cb=$('customCardBgColor');
        if(acc) acc.value=t.accent||'#f0c96a'; if(bg) bg.value=t.bg||'#080b14';
        if(cb){ try{ cb.value=t.bg2||'#0d1220'; }catch(e){} }
      });
    });
    document.querySelectorAll('.piko-color-preset').forEach(function(el){
      el.addEventListener('click',function(){ document.querySelectorAll('.piko-color-preset').forEach(function(e){ e.classList.remove('is-active'); }); el.classList.add('is-active'); var acc=$('customAccentColor'); if(acc) acc.value=el.dataset.color; });
    });
    document.querySelectorAll('.piko-font-option').forEach(function(el){
      el.addEventListener('click',function(){ document.querySelectorAll('.piko-font-option').forEach(function(e){ e.classList.remove('is-active'); }); el.classList.add('is-active'); });
    });
    document.querySelectorAll('.piko-bg-option').forEach(function(el){
      el.addEventListener('click',function(){ document.querySelectorAll('.piko-bg-option').forEach(function(e){ e.classList.remove('is-active'); }); el.classList.add('is-active'); });
    });

    var apply=$('pikoApplyCustomize');
    if(apply) apply.addEventListener('click', async function(){
      var themeEl=document.querySelector('.piko-theme-preset.is-active');
      var themeId=themeEl?themeEl.dataset.theme:'default';
      var base=THEMES[themeId]||THEMES.default;
      var accent=($('customAccentColor')||{}).value||base.accent;
      var bg=($('customBgColor')||{}).value||base.bg;
      var cb=$('customCardBgColor'); var cardBg=cb?cb.value:base.cardBg;
      var fontEl=document.querySelector('.piko-font-option.is-active'); var font=fontEl?fontEl.dataset.font:'Montserrat';
      var bgEl=document.querySelector('.piko-bg-option.is-active'); var bgOpt=bgEl?bgEl.dataset.bg:'default';
      var bgUrl=($('customBgUrl')||{}).value||'';
      var css=($('customCssInput')||{}).value||'';
      var bgImage=bgUrl?'url('+bgUrl+') center/cover no-repeat fixed':(BG_MAP[bgOpt]||bg);
      var t={accent:accent,bg:bg,bg2:cardBg,text:base.text,glow:accent+'26',cardBg:'rgba(255,255,255,.03)',font:font,bgImage:bgImage,css:css,themeId:themeId};
      var applyBtn2=$('pikoApplyCustomize');
      if(applyBtn2){ applyBtn2.disabled=true; applyBtn2.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…'; }
      STATE.theme=t;
      await DB_LAYER.saveTheme(getUserId(),t);
      applyTheme(t);
      if(applyBtn2){ applyBtn2.disabled=false; applyBtn2.innerHTML='<i class="fas fa-check"></i> Apply & Save'; }
      _closeCustomize();
      toast('✅ Profile customized!');
      /* Re-apply banner so it persists */
      if(t.bannerBg){ var bn=$('pikoBanner'); if(bn) bn.style.background=t.bannerBg; }
      updateIdCardBanner();
    });

    var reset=$('pikoResetCustomize');
    if(reset) reset.addEventListener('click', async function(){
      STATE.theme={}; await DB_LAYER.saveTheme(getUserId(),{});
      document.documentElement.removeAttribute('style'); document.body.removeAttribute('style');
      var bn=$('pikoBanner'); if(bn) bn.removeAttribute('style');
      var st=$('pikoCustomStyle'); if(st) st.textContent='';
      toast('Theme reset to default'); _closeCustomize();
    });
  }

  /* ════════════════════════════════════════════
     GLOBAL UI (pw toggle + enter key)
  ════════════════════════════════════════════ */
  function initGlobalUI() {
    /* Password show/hide */
    document.addEventListener('click',function(e){
      var btn=e.target.closest('.piko-pw-toggle'); if(!btn) return;
      var input=document.getElementById(btn.dataset.target); if(!input) return;
      var show=input.type==='password'; input.type=show?'text':'password';
      btn.querySelector('i').className=show?'fas fa-eye-slash':'fas fa-eye';
    });

    /* Enter key submits forms */
    document.addEventListener('keydown',function(e){
      if(e.key!=='Enter') return;
      var id=document.activeElement&&document.activeElement.id;
      if(!id) return;
      if(['signupName','signupEmail','signupPassword','signupPassword2'].includes(id)){ var b=$('pikoSignupBtn'); if(b) b.click(); }
      if(['signinEmail','signinPassword'].includes(id)){ var b=$('pikoSigninBtn'); if(b) b.click(); }
    });

    /* ── Nav retract on scroll down, reveal on scroll up ── */
    var nav         = document.querySelector('.piko-profile-nav');
    var lastScrollY = 0;
    var scrollTimer = null;

    window.addEventListener('scroll', function(){
      var currentY = window.scrollY;
      var delta    = currentY - lastScrollY;

      if (!nav) return;

      /* At top — always show nav, make transparent over banner */
      if (currentY < 80) {
        nav.classList.remove('is-hidden');
        nav.classList.add('is-transparent');
      } else {
        nav.classList.remove('is-transparent');
        /* Scrolling down > 6px — hide */
        if (delta > 6) {
          nav.classList.add('is-hidden');
        }
        /* Scrolling up — reveal */
        else if (delta < -4) {
          nav.classList.remove('is-hidden');
        }
      }

      lastScrollY = currentY;

      /* Auto-reveal after idle */
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function(){
        if (nav) nav.classList.remove('is-hidden');
      }, 2500);
    }, { passive: true });
  }

  /* ── Name style preview ── */
  function updateNamePreview() {
    var preview = $('pikoNamePreview');
    var nameInput = $('editName');
    if (!preview) return;
    var ns = {
      color:  ($('nameStyleColor') ||{}).value || '#ffffff',
      size:   ($('nameStyleSize')  ||{}).value || '1.5rem',
      font:   ($('nameStyleFont')  ||{}).value || 'Orbitron',
      weight: ($('nameStyleWeight')||{}).value || '800',
    };
    preview.textContent    = (nameInput && nameInput.value) || (STATE.profile && STATE.profile.display_name) || 'Your Name';
    preview.style.color      = ns.color;
    preview.style.fontSize   = ns.size;
    preview.style.fontFamily = ns.font;
    preview.style.fontWeight = ns.weight;
  }

  function initNameStyleEditor() {
    ['nameStyleColor','nameStyleSize','nameStyleFont','nameStyleWeight'].forEach(function(id){
      var el=$(id); if(el) el.addEventListener('input', updateNamePreview);
    });
    var nameInput=$('editName'); if(nameInput) nameInput.addEventListener('input', updateNamePreview);
  }

  /* ── Modal system ── */
  function openModal(content) {
    var overlay = $('pikoModalOverlay');
    var mc      = $('pikoModalContent');
    if (!overlay || !mc) return;
    mc.innerHTML = content;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    var overlay = $('pikoModalOverlay');
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  /* ── Share Idea modal ── */
  function openIdeaModal() {
    openModal([
      '<h3 class="piko-modal-title"><i class="fas fa-lightbulb"></i> Share an Idea</h3>',
      '<div class="piko-auth-field">',
        '<label class="piko-auth-label">Your Idea</label>',
        '<textarea id="modalIdeaText" class="piko-auth-input" rows="4" maxlength="500" placeholder="What\'s on your mind? Share a concept, suggestion, or vision for Pikoverse…" style="resize:vertical"></textarea>',
      '</div>',
      '<div class="piko-auth-field">',
        '<label class="piko-auth-label">Category</label>',
        '<select id="modalIdeaCategory" class="piko-auth-input piko-select-sm" style="max-width:100%">',
          '<option value="general">General</option>',
          '<option value="education">Education</option>',
          '<option value="technology">Technology</option>',
          '<option value="culture">Culture</option>',
          '<option value="marketplace">Marketplace</option>',
          '<option value="community">Community</option>',
          '<option value="art">Art &amp; Creative</option>',
          '<option value="other">Other</option>',
        '</select>',
      '</div>',
      '<div class="piko-auth-status" id="modalIdeaStatus" hidden></div>',
      '<button class="piko-auth-btn" id="modalIdeaSubmit" type="button"><i class="fas fa-paper-plane"></i> Share with Community</button>',
    ].join(''));

    var btn = $('modalIdeaSubmit');
    if (!btn) return;
    btn.addEventListener('click', async function() {
      var text = ($('modalIdeaText') || {}).value || '';
      var cat  = ($('modalIdeaCategory') || {}).value || 'general';
      if (!text.trim()) { showStatus('modalIdeaStatus','Please write your idea first.','err'); return; }

      btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sharing…';

      var email = getUserEmail();
      var p = STATE.profile || {};
      var idea = {
        id:          'idea-' + Date.now(),
        text:        text.trim(),
        name:        p.display_name || email.split('@')[0],
        contact:     email,
        shareContact:false,
        category:    cat,
        ts:          Date.now(),
        dismissed:   false,
        reply:       '',
        status:      'pending',
      };

      /* Write to localStorage and Supabase */
      var ideas = loadJSON('amp_admin_ideas', []);
      ideas.unshift(idea); saveJSON('amp_admin_ideas', ideas);

      if (!OFFLINE && supa() && SESSION_USER) {
        await supa().from('community_ideas').insert(Object.assign({}, idea, { user_id: SESSION_USER.id }));
      }

      STATE.ideas = await DB_LAYER.getMyIdeas(getUserId(), email);
      renderIdeas(); renderTimeline(); renderStats();
      toast('💡 Idea shared with the community!');
      closeModal();
    });
  }

  /* ── Share Project modal ── */
  var PROJECT_TEMPLATES = [
    { id:'app',      icon:'📱', name:'App / Tool',       desc:'Web or mobile application', defaults:{ stage:'building', category:'technology' } },
    { id:'art',      icon:'🎨', name:'Creative Project', desc:'Art, music, design, or media', defaults:{ stage:'idea', category:'art' } },
    { id:'edu',      icon:'📚', name:'Education',        desc:'Course, guide, or learning resource', defaults:{ stage:'idea', category:'education' } },
    { id:'business', icon:'💼', name:'Business / Brand', desc:'Product, service, or venture', defaults:{ stage:'idea', category:'business' } },
    { id:'community',icon:'🌺', name:'Community Event',  desc:'Workshop, gathering, or initiative', defaults:{ stage:'idea', category:'community' } },
    { id:'research', icon:'🔬', name:'Research',         desc:'Study, analysis, or white paper', defaults:{ stage:'idea', category:'research' } },
    { id:'nft',      icon:'🔗', name:'Web3 / NFT',       desc:'Blockchain, token, or DAO project', defaults:{ stage:'idea', category:'technology' } },
    { id:'blank',    icon:'✨', name:'Custom',           desc:'Start from scratch', defaults:{ stage:'idea', category:'other' } },
  ];

  function openProjectModal() {
    var selectedTemplate = null;

    openModal([
      '<h3 class="piko-modal-title"><i class="fas fa-rocket"></i> Submit a Project</h3>',
      '<p style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:16px">Pick a template to get started or create a custom entry.</p>',

      '<div class="piko-template-grid">',
        PROJECT_TEMPLATES.map(function(t){
          return '<div class="piko-template-card" data-template="'+t.id+'"><div class="piko-template-icon">'+t.icon+'</div><div class="piko-template-name">'+t.name+'</div><div class="piko-template-desc">'+t.desc+'</div></div>';
        }).join(''),
      '</div>',

      '<div id="projectFormFields" style="display:none">',
        '<div class="piko-auth-field">',
          '<label class="piko-auth-label">Project Name</label>',
          '<input type="text" id="modalProjectName" class="piko-auth-input" placeholder="What\'s your project called?" maxlength="80">',
        '</div>',
        '<div class="piko-auth-field">',
          '<label class="piko-auth-label">Description</label>',
          '<textarea id="modalProjectDesc" class="piko-auth-input" rows="3" maxlength="400" placeholder="Tell the community what you\'re building…" style="resize:vertical"></textarea>',
        '</div>',
        '<div style="display:flex;gap:12px;flex-wrap:wrap">',
          '<div class="piko-auth-field" style="flex:1;min-width:120px">',
            '<label class="piko-auth-label">Stage</label>',
            '<select id="modalProjectStage" class="piko-auth-input piko-select-sm" style="max-width:100%">',
              '<option value="idea">💡 Idea</option>',
              '<option value="building">🔧 Building</option>',
              '<option value="live">🚀 Live</option>',
            '</select>',
          '</div>',
          '<div class="piko-auth-field" style="flex:1;min-width:120px">',
            '<label class="piko-auth-label">URL <span style="opacity:.5">(optional)</span></label>',
            '<input type="url" id="modalProjectUrl" class="piko-auth-input" placeholder="https://…" maxlength="200">',
          '</div>',
        '</div>',
        '<div class="piko-auth-status" id="modalProjectStatus" hidden></div>',
        '<button class="piko-auth-btn" id="modalProjectSubmit" type="button"><i class="fas fa-rocket"></i> Submit Project</button>',
      '</div>',
    ].join(''));

    /* Template selection */
    document.querySelectorAll('.piko-template-card').forEach(function(card) {
      card.addEventListener('click', function() {
        document.querySelectorAll('.piko-template-card').forEach(function(c){ c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        selectedTemplate = PROJECT_TEMPLATES.find(function(t){ return t.id === card.dataset.template; });
        var fields = $('projectFormFields');
        if (fields) fields.style.display = 'block';
        /* Pre-fill stage */
        var stageEl = $('modalProjectStage');
        if (stageEl && selectedTemplate) stageEl.value = selectedTemplate.defaults.stage || 'idea';
        var nameEl = $('modalProjectName');
        if (nameEl) nameEl.focus();
      });
    });

    /* Submit */
    document.addEventListener('click', async function handler(e) {
      if (e.target.id !== 'modalProjectSubmit') return;
      document.removeEventListener('click', handler);

      var name  = ($('modalProjectName')  || {}).value || '';
      var desc  = ($('modalProjectDesc')  || {}).value || '';
      var stage = ($('modalProjectStage') || {}).value || 'idea';
      var url   = ($('modalProjectUrl')   || {}).value || '';

      if (!name.trim()) { showStatus('modalProjectStatus','Please enter a project name.','err'); return; }
      if (!desc.trim()) { showStatus('modalProjectStatus','Please add a short description.','err'); return; }

      var btn = $('modalProjectSubmit');
      if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Submitting…'; }

      var email = getUserEmail();
      var p = STATE.profile || {};
      var project = {
        name:    name.trim(),
        desc:    desc.trim(),
        stage:   stage,
        url:     url.trim(),
        status:  'pending',
        contact: email,
        ts:      Date.now(),
      };

      /* localStorage */
      var projects = loadJSON('amp_admin_projects_hub', []);
      projects.unshift(project); saveJSON('amp_admin_projects_hub', projects);

      /* Supabase */
      if (!OFFLINE && supa() && SESSION_USER) {
        await supa().from('projects').insert({
          user_id: SESSION_USER.id, contact: email,
          name: project.name, description: project.desc,
          stage: project.stage, status: 'pending', url: project.url,
          created_at: new Date().toISOString(),
        });
      }

      STATE.projects = await DB_LAYER.getMyProjects(getUserId(), email);
      renderProjects(); renderTimeline(); renderStats();
      toast('🚀 Project submitted! AMP will review it shortly.');
      closeModal();
    });
  }

  function initLinks() {
    var ib=$('pikoSubmitIdeaBtn');    if(ib) ib.addEventListener('click', openIdeaModal);
    var pb=$('pikoSubmitProjectBtn'); if(pb) pb.addEventListener('click', openProjectModal);

    /* Modal close */
    var closeBtn=$('pikoModalClose');
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    var overlay=$('pikoModalOverlay');
    if(overlay) overlay.addEventListener('click', function(e){ if(e.target===overlay) closeModal(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(); });
  }

  /* ════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════ */

  /* ════════════════════════════════════════════
     GOOGLE OAUTH
  ════════════════════════════════════════════ */
  function boot() {
    /* Apply cached theme instantly — no wait for Supabase */
    var cachedTheme = loadJSON(THEME_KEY, {});
    applyTheme(cachedTheme);

    /* ── Instant pre-render from localStorage ──────────────────────────────
       If localStorage has a profile AND the Supabase session token exists,
       render the profile immediately so the user never sees a blank flash.
       Supabase will confirm the session via piko:supa:ready and refresh data. */
    (function preRender() {
      var cached = loadJSON(PROFILE_KEY, null);
      if (!cached || !cached.email) return; /* no local profile, wait for auth */

      /* If we have a cached profile with an email, always pre-render it.
         Supabase will correct the session state shortly after via piko:supa:ready.
         We no longer try to detect the token here — that was too brittle. */
      if (cached.verified === false) return; /* only skip if explicitly logged out offline */

      /* Pre-render with cached data */
      STATE.profile = cached;
      STATE.theme   = cachedTheme;

      /* Restore name_style and hide_email from theme JSONB */
      if (cachedTheme._nameStyle) {
        STATE.profile.nameStyle  = cachedTheme._nameStyle;
        STATE.profile.name_style = cachedTheme._nameStyle;
      }
      if (cachedTheme._hideEmail !== undefined) {
        STATE.profile.hideEmail  = cachedTheme._hideEmail;
        STATE.profile.hide_email = cachedTheme._hideEmail;
      }

      /* Show profile section immediately */
      var gate    = $('pikoAuthGate');
      var section = $('pikoProfileSection');
      if (gate)    { gate.hidden = true;  gate.style.display = 'none'; }
      if (section) { section.hidden = false; section.style.display = 'block'; }
      var so = $('pikoSignOut');          if (so)  { so.hidden  = false; so.style.display  = ''; }
      var ct = $('pikoCustomizeTrigger'); if (ct)  { ct.hidden  = false; ct.style.display  = ''; }
      var nb = $('pikoNotifBtn');         if (nb)  { nb.hidden  = false; nb.style.display  = ''; }

      /* Render name, avatar, bio from cache instantly */
      renderHeader();

      /* Apply banner from localStorage */
      var bannerBg = cachedTheme.bannerBg || '';
      if (bannerBg) {
        var bnEl = $('pikoBanner');
        if (bnEl) {
          bnEl.style.background         = bannerBg;
          bnEl.style.backgroundSize     = 'cover';
          bnEl.style.backgroundPosition = 'center';
        }
      }

      _profilePreRendered = true;
      console.log('[Profile] pre-rendered from localStorage:', cached.display_name);
    })();

    initGlobalUI(); initAuthTabs(); initProfileTabs();
    initSignup(); initSignin(); initSignOut();
    initEditProfile(); initAccountSettings(); initNameStyleEditor();
    initShareCard(); initNotifBell(); initCustomize(); initLinks();
    handlePasswordReset(); initIdeaForm(); initProjectForm();

    /* Auth decisions handled by piko:supa:ready event
       which fires for both online and offline modes */
  }

  window.addEventListener('piko:supa:ready',function(e){
    OFFLINE=e.detail.offline; DB=window.piko_supa;
    initAuthListeners(); checkExistingSession();
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  window.PIKO_DB = DB_LAYER;

})();