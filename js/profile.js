/**
 * profile.js — Pikoverse Profile (Supabase Edition)
 * js/profile.js
 *
 * Requires: js/supabase-client.js loaded first
 * Auth:     Supabase magic link (email OTP)
 * Fallback: localStorage when Supabase not configured
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════
     CONFIG & CONSTANTS
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
    default:'linear-gradient(135deg,#080b14,#141830)',
    stars:'#050510',
    gradient1:'linear-gradient(135deg,#0a0020,#200040,#000020)',
    gradient2:'linear-gradient(135deg,#001020,#002040,#003060)',
    gradient3:'linear-gradient(135deg,#0a1a05,#102a10,#1a3a1a)',
    gradient4:'linear-gradient(135deg,#1a0a00,#2a1500,#1a0a00)',
  };

  /* ════════════════════════════════════════════
     SUPABASE CLIENT
  ════════════════════════════════════════════ */
  var DB = null;          /* Supabase client, set after piko:supa:ready */
  var OFFLINE = true;     /* true = no Supabase, use localStorage only */
  var SESSION_USER = null; /* auth.User object when logged in */
  var _realtimeSub = null;

  function supa() { return DB; }

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(id){ return document.getElementById(id); }
  function toast(msg,dur){ var el=$('pikoProfileToast');if(!el)return;el.textContent=msg;el.classList.add('is-visible');clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('is-visible');},dur||3000); }
  function timeAgo(ts){ var s=Math.floor((Date.now()-new Date(ts).getTime())/1000);if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'; }
  function fmtPrice(c){ return '$'+(c/100).toFixed(2); }
  function loadJSON(k,d){ try{return JSON.parse(localStorage.getItem(k)||'null')||d;}catch(e){return d;} }
  function saveJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
  function showStatus(id,msg,type){ var el=$(id);if(!el)return;el.textContent=msg;el.className='piko-auth-status piko-auth-status--'+(type||'info');el.hidden=false; }

  /* ════════════════════════════════════════════
     DATABASE LAYER — tries Supabase, falls back
  ════════════════════════════════════════════ */
  var DB_LAYER = {

    /* ── Profile ── */
    getProfile: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(PROFILE_KEY, null);
      var r = await supa().from('profiles').select('*').eq('id', userId).single();
      if (r.error) return loadJSON(PROFILE_KEY, null);
      saveJSON(PROFILE_KEY, r.data); /* cache locally */
      return r.data;
    },

    upsertProfile: async function(profile) {
      saveJSON(PROFILE_KEY, profile); /* always write local first */
      if (OFFLINE || !SESSION_USER) return profile;
      var payload = {
        id:           SESSION_USER.id,
        email:        SESSION_USER.email,
        display_name: profile.display_name,
        bio:          profile.bio || null,
        avatar_url:   profile.avatar_url || null,
        banner_url:   profile.banner_url || null,
        social:       profile.social || null,
        theme:        loadJSON(THEME_KEY, {}),
        updated_at:   new Date().toISOString(),
      };
      var r = await supa().from('profiles').upsert(payload, { onConflict: 'id' });
      if (r.error) console.warn('[Profile] Supabase upsert error:', r.error);
      return profile;
    },

    /* ── Ideas ── */
    getMyIdeas: async function(userId, email) {
      /* Queries existing community_ideas table — uses contact field (email) */
      if (OFFLINE || !email) {
        var local = loadJSON('amp_admin_ideas', []);
        return email ? local.filter(function(i){ return i.contact && i.contact.toLowerCase()===email.toLowerCase(); }) : [];
      }
      /* Try user_id first (linked ideas), then fall back to contact match */
      var r = await supa()
        .from('community_ideas')
        .select('*')
        .eq('contact', email)
        .order('ts', {ascending:false});
      if (r.error) {
        var local = loadJSON('amp_admin_ideas', []);
        return local.filter(function(i){ return i.contact && i.contact.toLowerCase()===email.toLowerCase(); });
      }
      return r.data || [];
    },

    insertIdea: async function(ideaObj) {
      /* Write to community_ideas (same table hub.js uses) */
      var ideas = loadJSON('amp_admin_ideas', []);
      ideas.unshift(ideaObj); saveJSON('amp_admin_ideas', ideas);
      if (OFFLINE || !SESSION_USER) return ideaObj;
      await supa().from('community_ideas').insert({
        id:           ideaObj.id || ('idea-'+Date.now()),
        text:         ideaObj.text,
        name:         ideaObj.name || (SESSION_USER.user_metadata&&SESSION_USER.user_metadata.display_name) || SESSION_USER.email.split('@')[0],
        contact:      SESSION_USER.email,
        shareContact: false,
        category:     ideaObj.category || 'other',
        ts:           ideaObj.ts || Date.now(),
        dismissed:    false,
        reply:        '',
        status:       'pending',
        user_id:      SESSION_USER.id,
      });
      return ideaObj;
    },

    /* ── Projects ── */
    getMyProjects: async function(userId, email) {
      /* Uses new projects table — also checks localStorage fallback */
      if (OFFLINE || !userId) {
        var local = loadJSON('amp_admin_projects_hub', []);
        return email ? local.filter(function(p){ return p.contact && p.contact.toLowerCase()===email.toLowerCase(); }) : [];
      }
      var r = await supa().from('projects').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      if (r.error || !r.data || !r.data.length) {
        /* Fall back to contact match for pre-Supabase submissions */
        var r2 = await supa().from('projects').select('*').eq('contact', email).order('created_at', {ascending:false});
        return r2.data || loadJSON('amp_admin_projects_hub',[]).filter(function(p){return p.contact&&p.contact.toLowerCase()===email.toLowerCase();});
      }
      return r.data || [];
    },

    /* ── Orders ── */
    getOrders: async function(userId) {
      if (OFFLINE || !userId) return loadJSON('amp_orders_v1', []);
      var r = await supa().from('orders').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      if (r.error || !r.data || !r.data.length) return loadJSON('amp_orders_v1', []);
      return r.data || [];
    },

    /* ── Notifications ── */
    getNotifs: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(NOTIF_KEY, []);
      var r = await supa().from('notifications').select('*').eq('user_id', userId).order('created_at', {ascending:false}).limit(30);
      return r.data || [];
    },

    addNotif: async function(userId, icon, text) {
      /* localStorage always */
      var notifs = loadJSON(NOTIF_KEY, []);
      var n = { id: Date.now().toString(36), icon:icon, text:text, ts:Date.now(), read:false };
      notifs.unshift(n); if(notifs.length>30)notifs.length=30; saveJSON(NOTIF_KEY, notifs);
      if (!OFFLINE && userId) {
        await supa().from('notifications').insert({
          user_id: userId, icon:icon, text:text, read:false,
          created_at: new Date().toISOString(),
        });
      }
    },

    markNotifsRead: async function(userId, ids) {
      var notifs = loadJSON(NOTIF_KEY, []);
      notifs.forEach(function(n){ if(!ids||ids.includes(n.id)) n.read=true; });
      saveJSON(NOTIF_KEY, notifs);
      if (!OFFLINE && userId) {
        if (ids) {
          await supa().from('notifications').update({read:true}).in('id', ids);
        } else {
          await supa().from('notifications').update({read:true}).eq('user_id', userId);
        }
      }
    },

    /* ── Saved items ── */
    getSaved: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(SAVED_KEY, []);
      var r = await supa().from('saved_items').select('*').eq('user_id', userId).order('created_at', {ascending:false});
      return r.data || [];
    },

    addSaved: async function(userId, item) {
      var saved = loadJSON(SAVED_KEY, []);
      saved.unshift(item); saveJSON(SAVED_KEY, saved);
      if (!OFFLINE && userId) {
        await supa().from('saved_items').insert({
          user_id: userId, icon: item.icon, title: item.title,
          meta: item.meta, url: item.url,
          created_at: new Date().toISOString(),
        });
      }
    },

    removeSaved: async function(userId, id, localIdx) {
      var saved = loadJSON(SAVED_KEY, []);
      if (localIdx !== undefined) saved.splice(localIdx, 1);
      saveJSON(SAVED_KEY, saved);
      if (!OFFLINE && userId && id) {
        await supa().from('saved_items').delete().eq('id', id);
      }
    },

    /* ── Learning ── */
    getLearning: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(LEARN_KEY, {});
      var r = await supa().from('learning_progress').select('*').eq('user_id', userId).single();
      if (r.error || !r.data) return loadJSON(LEARN_KEY, {});
      var l = { culturalverse: r.data.culturalverse||[], digitalverse: r.data.digitalverse||[] };
      saveJSON(LEARN_KEY, l); return l;
    },

    saveLearning: async function(userId, learn) {
      saveJSON(LEARN_KEY, learn);
      if (OFFLINE || !userId) return;
      await supa().from('learning_progress').upsert({
        user_id: userId,
        culturalverse: learn.culturalverse||[],
        digitalverse:  learn.digitalverse||[],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    },

    /* ── Theme ── */
    saveTheme: async function(userId, theme) {
      saveJSON(THEME_KEY, theme);
      if (OFFLINE || !userId) return;
      await supa().from('profiles').update({ theme: theme, updated_at: new Date().toISOString() }).eq('id', userId);
    },

    loadTheme: async function(userId) {
      if (OFFLINE || !userId) return loadJSON(THEME_KEY, {});
      var r = await supa().from('profiles').select('theme').eq('id', userId).single();
      if (r.error || !r.data) return loadJSON(THEME_KEY, {});
      var t = r.data.theme || {};
      saveJSON(THEME_KEY, t); return t;
    },
  };

  /* ════════════════════════════════════════════
     SCORE / RANK / BADGES
  ════════════════════════════════════════════ */
  function calcScore(ideas, approvedProjects, orders, badges) {
    return (ideas*1) + (approvedProjects*3) + (orders*1) + (badges*2);
  }
  function getRank(score) {
    for (var i=RANKS.length-1; i>=0; i--) {
      if (score >= RANKS[i].min) return RANKS[i];
    }
    return RANKS[0];
  }
  function getEarnedBadgeIds(ideas, approved, orders, learn, profile) {
    var e = [];
    if (ideas>=1)    e.push('first_idea');
    if (approved>=1) e.push('project_live');
    if (orders>=1)   e.push('first_order');
    if (ideas>=5)    e.push('idea_x5');
    var created = profile && (profile.created_at||profile.joined_ts);
    if (created && Date.now()-new Date(created).getTime() < 90*24*60*60*1000) e.push('early_member');
    if ((learn.culturalverse||[]).length>0 || (learn.digitalverse||[]).length>0) e.push('learner');
    if (profile && profile.chronicle_sub) e.push('chronicle_sub');
    return e;
  }

  /* ════════════════════════════════════════════
     APP STATE
  ════════════════════════════════════════════ */
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

  function getUserId() { return SESSION_USER ? SESSION_USER.id : null; }
  function getUserEmail() { return SESSION_USER ? SESSION_USER.email : (STATE.profile ? STATE.profile.email : null); }

  /* ════════════════════════════════════════════
     RENDER ENGINE
  ════════════════════════════════════════════ */
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
    renderLearningFromState();
    updateNotifBadge();
  }

  function renderHeader() {
    var p = STATE.profile || {};
    var name = p.display_name || getUserEmail() || 'Pikoverse Member';
    var set = function(id,v){ var el=$(id); if(el) el.textContent=v||''; };
    set('pikoProfileName', name);
    set('pikoProfileEmail', getUserEmail()||'');
    set('pikoProfileBio', p.bio||'');
    var social = $('pikoProfileSocial');
    if (social) { social.textContent = p.social||''; social.hidden=!p.social; }
    var ts = p.created_at || p.joined_ts;
    var joined = $('pikoProfileJoined');
    if (joined) {
      joined.textContent = '🌺 Joined '+(ts?new Date(ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently');
    }
    var init = $('pikoProfileAvatarInitial');
    var img  = $('pikoProfileAvatarImg');
    if (init) init.textContent = name[0].toUpperCase();
    if (img && p.avatar_url) {
      img.src=p.avatar_url; img.hidden=false; if(init) init.style.display='none';
      img.onerror=function(){ img.hidden=true; if(init) init.style.display=''; };
    } else if (img) { img.hidden=true; if(init) init.style.display=''; }

    var earned = getEarnedBadgeIds(STATE.ideas.length,
      STATE.projects.filter(function(p){return p.status==='approved';}).length,
      STATE.orders.length, STATE.learn, STATE.profile);
    var score = calcScore(STATE.ideas.length, STATE.projects.filter(function(p){return p.status==='approved';}).length, STATE.orders.length, earned.length);
    var rank  = getRank(score);
    var rb = $('pikoRankBadge');
    if (rb) { rb.textContent=rank.icon+' '+rank.label; rb.style.cssText='--rank-color:'+rank.color+';--rank-bg:'+rank.bg+';--rank-border:'+rank.border; }

    var badgesEl = $('pikoProfileBadges');
    if (!badgesEl) return;
    var chips = [
      '<span class="piko-profile-badge piko-profile-badge--member"><i class="fas fa-star"></i> Pikoverse Member</span>',
      '<span class="piko-profile-badge piko-profile-badge--joined">🌺 Joined '+(ts?new Date(ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently')+'</span>',
    ];
    BADGE_DEFS.forEach(function(b){ if(earned.includes(b.id)) chips.push('<span class="piko-profile-badge piko-profile-badge--earned">'+b.icon+' '+b.name+'</span>'); });
    badgesEl.innerHTML=chips.join('');
  }

  function renderStats() {
    var approved = STATE.projects.filter(function(p){return p.status==='approved';}).length;
    var earned   = getEarnedBadgeIds(STATE.ideas.length, approved, STATE.orders.length, STATE.learn, STATE.profile);
    var score    = calcScore(STATE.ideas.length, approved, STATE.orders.length, earned.length);
    var set = function(id,v){ var el=$(id); if(el) el.textContent=v; };
    set('statIdeas',    STATE.ideas.length);
    set('statProjects', STATE.projects.length);
    set('statScore',    score);
    set('statBadges',   earned.length);
  }

  function renderIdCard() {
    var p = STATE.profile || {};
    var name = p.display_name || getUserEmail() || 'Member';
    var approved = STATE.projects.filter(function(x){return x.status==='approved';}).length;
    var earned   = getEarnedBadgeIds(STATE.ideas.length, approved, STATE.orders.length, STATE.learn, STATE.profile);
    var score    = calcScore(STATE.ideas.length, approved, STATE.orders.length, earned.length);
    var rank     = getRank(score);
    var a=$('pikoIdCardAvatar'),n=$('pikoIdCardName'),m=$('pikoIdCardMeta'),s=$('pikoIdCardScore');
    if(a){ if(p.avatar_url) a.innerHTML='<img src="'+esc(p.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; else a.textContent=name[0].toUpperCase(); }
    if(n) n.textContent=name;
    if(m) m.textContent=rank.icon+' '+rank.label+' · Pikoverse Member';
    if(s) s.textContent='Score: '+score+' pts';
  }

  function renderTimeline() {
    var el=$('pikoTimeline'); if(!el) return;
    var items=[];
    STATE.ideas.forEach(function(i){
      /* community_ideas uses 'ts' column (epoch ms), not created_at */
      items.push({type:'idea',text:'Shared idea: "'+String(i.text||'').slice(0,70)+'"',ts:i.ts||i.created_at||Date.now(),status:i.reply?'replied':'pending'});
    });
    STATE.projects.forEach(function(p){
      items.push({type:'project',text:'Submitted project: "'+esc(p.name)+'"',ts:p.created_at||p.ts||Date.now(),status:p.status||'pending'});
    });
    STATE.orders.forEach(function(o){
      items.push({type:'order',text:'Placed order — '+fmtPrice(o.total||0),ts:o.created_at||o.ts||Date.now()});
    });
    var approved=STATE.projects.filter(function(p){return p.status==='approved';}).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    earned.forEach(function(bid){
      var d=BADGE_DEFS.find(function(b){return b.id===bid;}); if(!d)return;
      items.push({type:'badge',text:'Earned badge: '+d.icon+' '+d.name,ts:STATE.profile&&(STATE.profile.created_at||STATE.profile.joined_ts)||Date.now()});
    });
    items.sort(function(a,b){return new Date(b.ts)-new Date(a.ts);});
    if(!items.length){el.innerHTML='<p class="piko-profile-empty">Your timeline will fill as you engage.</p>';return;}
    var icons={idea:'fa-lightbulb',project:'fa-rocket',order:'fa-bag-shopping',badge:'fa-medal',comment:'fa-comment'};
    el.innerHTML=items.slice(0,20).map(function(item){
      var sh=''; if(item.status){var cls=item.status==='approved'?'approved':item.status==='replied'?'replied':'pending';var lbl=item.status==='approved'?'✓ Approved':item.status==='replied'?'⭐ Replied':'⏳ Pending';sh='<span class="piko-timeline-status piko-timeline-status--'+cls+'">'+lbl+'</span>';}
      return '<div class="piko-timeline-item"><div class="piko-timeline-dot piko-timeline-dot--'+item.type+'"><i class="fas '+(icons[item.type]||'fa-bolt')+'"></i></div><div class="piko-timeline-text">'+esc(item.text)+'<div class="piko-timeline-meta">'+timeAgo(item.ts)+'&ensp;'+sh+'</div></div></div>';
    }).join('');
  }

  function renderRank() {
    var approved=STATE.projects.filter(function(p){return p.status==='approved';}).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    var score=calcScore(STATE.ideas.length,approved,STATE.orders.length,earned.length);
    var rank=getRank(score);
    var next=null; for(var i=0;i<RANKS.length;i++){if(RANKS[i].min>score){next=RANKS[i];break;}}
    var fill=next?Math.min(100,Math.round((score-rank.min)/(next.min-rank.min)*100)):100;
    var set=function(id,v){var el=$(id);if(el)el.textContent=v;};
    set('rankIcon',rank.icon);set('rankLabel',rank.label);
    set('rankSub',next?'Keep contributing to reach '+next.label:'Maximum rank achieved! 🎉');
    var br=$('rankBarFill');if(br)br.style.width=fill+'%';
    set('rankNext',next?score+' / '+next.min+' points to '+next.label:'Elder — Top rank!');
  }

  function renderBadges() {
    var grid=$('pikoBadgesGrid');if(!grid)return;
    var approved=STATE.projects.filter(function(p){return p.status==='approved';}).length;
    var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
    grid.innerHTML=BADGE_DEFS.map(function(b){
      var has=earned.includes(b.id);
      return '<div class="piko-badge-card'+(has?' is-earned':'')+'"><div class="piko-badge-icon">'+b.icon+'</div><div class="piko-badge-name">'+esc(b.name)+'</div><div class="piko-badge-desc">'+esc(b.desc)+'</div></div>';
    }).join('');
  }

  function renderPlatforms() {
    var grid=$('pikoPlatformsGrid');if(!grid)return;
    var platforms=[
      {icon:'⚛',name:'Ikeverse',status:'Active',link:'https://ikeverse.pikoverse.xyz/',progress:Math.min(100,(STATE.learn.culturalverse||[]).length*12),stat:(STATE.learn.culturalverse||[]).length+' modules done'},
      {icon:'⚡',name:'DigitalVerse',status:'Active',link:'digitalverse/index.html',progress:Math.min(100,(STATE.learn.digitalverse||[]).length*10),stat:(STATE.learn.digitalverse||[]).length+' modules done'},
      {icon:'📜',name:'Chronicle',status:'Live',link:'chronicle/index.html',progress:0,stat:'Subscribe for drops'},
      {icon:'🛍️',name:'AMP Marketplace',status:'Live',link:'marketplace/marketplace.html',progress:Math.min(100,STATE.orders.length*20),stat:STATE.orders.length+' orders'},
      {icon:'🌐',name:'Community Board',status:'Active',link:'index.html#ideas',progress:Math.min(100,STATE.ideas.length*10),stat:STATE.ideas.length+' ideas shared'},
      {icon:'🚀',name:'Showcase',status:'Active',link:'index.html#showcase',progress:Math.min(100,STATE.projects.length*25),stat:STATE.projects.length+' projects'},
    ];
    grid.innerHTML=platforms.map(function(p){
      return '<div class="piko-platform-card"><div class="piko-platform-card-header"><div class="piko-platform-icon">'+p.icon+'</div><div><div class="piko-platform-name">'+esc(p.name)+'</div><div class="piko-platform-status"><span class="piko-platform-status-dot"></span>'+esc(p.status)+'</div></div></div><div class="piko-platform-progress"><div class="piko-platform-progress-fill" style="width:'+p.progress+'%"></div></div><div class="piko-platform-stat">'+esc(p.stat)+'</div><a href="'+esc(p.link)+'" class="piko-platform-link">Open <i class="fas fa-arrow-right"></i></a></div>';
    }).join('');
  }

  function renderNotifications() {
    var list=$('pikoNotifList');if(!list)return;
    if(!STATE.notifs.length){list.innerHTML='<p class="piko-profile-empty">No notifications yet.</p>';return;}
    list.innerHTML=STATE.notifs.map(function(n){
      var id=n.id||n.created_at;
      return '<div class="piko-notif-item'+(n.read?'':' is-unread')+'" data-id="'+esc(String(id))+'"><div class="piko-notif-icon">'+esc(n.icon||'🔔')+'</div><div class="piko-notif-text">'+esc(n.text)+'</div><div class="piko-notif-time">'+timeAgo(n.created_at||n.ts||Date.now())+'</div></div>';
    }).join('');
    list.querySelectorAll('.piko-notif-item').forEach(function(el){
      el.addEventListener('click',function(){
        var id=el.dataset.id;
        STATE.notifs.forEach(function(n){if(String(n.id||n.created_at)===id)n.read=true;});
        DB_LAYER.markNotifsRead(getUserId(),[id]);
        renderNotifications();updateNotifBadge();
      });
    });
  }

  function renderSaved() {
    var grid=$('pikoSavedGrid');if(!grid)return;
    if(!STATE.saved.length){grid.innerHTML='<p class="piko-profile-empty" style="grid-column:1/-1">Bookmark Chronicle articles and ecosystem items here.</p>';return;}
    grid.innerHTML=STATE.saved.map(function(item,i){
      return '<div class="piko-saved-card"><div class="piko-saved-icon">'+esc(item.icon||'📌')+'</div><div style="flex:1"><div class="piko-saved-title">'+esc(item.title)+'</div><div class="piko-saved-meta">'+esc(item.meta||'')+'</div></div><button class="piko-saved-remove" data-i="'+i+'" data-id="'+esc(String(item.id||''))+'" type="button"><i class="fas fa-xmark"></i></button></div>';
    }).join('');
    grid.querySelectorAll('.piko-saved-remove').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var i=+btn.dataset.i,id=btn.dataset.id;
        STATE.saved.splice(i,1);
        DB_LAYER.removeSaved(getUserId(),id,i);
        renderSaved();toast('Removed from saved');
      });
    });
  }

  function renderOrders() {
    var list=$('pikoProfileOrdersList');if(!list)return;
    if(!STATE.orders.length){list.innerHTML='<p class="piko-profile-empty">No orders yet. <a href="marketplace/marketplace.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>';return;}
    list.innerHTML=STATE.orders.map(function(o){
      var sc=o.status==='confirmed'?'confirmed':'pending';
      var sl=(o.status||'pending').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
      var items=(o.items_json||o.items||[]);
      var it=Array.isArray(items)?items.map(function(i){return i.name+(i.size?' ('+i.size+')':'')+' ×'+(i.qty||1);}).join(', '):String(items);
      return '<div class="piko-order-card"><div class="piko-order-card-header"><span class="piko-order-id">'+esc(o.id||'')+'</span><span class="piko-order-status piko-order-status--'+sc+'">'+esc(sl)+'</span></div><div class="piko-order-items">'+esc(it)+'</div><div class="piko-order-total">'+fmtPrice(o.total||0)+' · '+(o.created_at||o.ts?new Date(o.created_at||o.ts).toLocaleDateString():'')+'</div></div>';
    }).join('');
  }

  function renderIdeas() {
    var list=$('pikoProfileIdeasList');if(!list)return;
    if(!STATE.ideas.length){list.innerHTML='<p class="piko-profile-empty">No ideas shared yet.</p>';return;}
    list.innerHTML=STATE.ideas.map(function(i){
      return '<div class="piko-profile-idea-card">'+esc(i.text)+'<div class="piko-profile-idea-meta"><span>'+esc(i.category||'Idea')+'</span><span>'+timeAgo(i.created_at||i.ts||Date.now())+'</span>'+(i.reply?'<span style="color:#f0c96a">⭐ AMP replied</span>':'')+'</div></div>';
    }).join('');
  }

  function renderProjects() {
    var grid=$('pikoProfileProjectsGrid');if(!grid)return;
    if(!STATE.projects.length){grid.innerHTML='<p class="piko-profile-empty">No projects submitted yet.</p>';return;}
    var sc={idea:'#f0c96a',building:'#54d1ff',live:'#4caf7a'};
    grid.innerHTML=STATE.projects.map(function(p){
      var col=sc[p.stage]||'#f0c96a';
      return '<div class="ecosystem-project-card" style="background:rgba(255,255,255,.03)"><div class="epc-header"><span class="epc-name">'+esc(p.name)+'</span><span class="epc-stage" style="background:'+col+'22;color:'+col+'">'+esc(p.stage||'idea')+'</span></div><p class="epc-desc">'+esc(p.desc||p.description||'')+'</p><div class="piko-profile-idea-meta"><span style="color:'+(p.status==='approved'?'#4caf7a':'#ffb347')+'">'+(p.status==='approved'?'✓ On Showcase':'⏳ Pending Review')+'</span></div></div>';
    }).join('');
  }

  var CV=['Hawaiian History','Pacific Islanders','Indigenous Knowledge','Cultural Connections','Oral Traditions','Ancestral Navigation','Language & Identity','Modern Sovereignty'];
  var DV=['Bitcoin Fundamentals','Ethereum & Smart Contracts','XRPL Deep Dive','Flare & Songbird','DeFi & AMMs','Web3 Security','Scam Field Guide','Protocol Comparison','Blockchain Forensics Intro','NaluLF Workflow'];

  function renderLearningFromState() {
    renderTrack('culturalverse', CV, STATE.learn.culturalverse||[]);
    renderTrack('digitalverse',  DV, STATE.learn.digitalverse||[]);
  }

  function renderTrack(id, modules, completed) {
    var pEl=$(id+'Progress'), mEl=$(id+'Modules'); if(!mEl)return;
    var pct=modules.length?Math.round(completed.length/modules.length*100):0;
    if(pEl)pEl.style.width=pct+'%';
    mEl.innerHTML=modules.map(function(m){
      var done=completed.includes(m);
      return '<button class="piko-learn-module piko-learn-module--'+(done?'done':'todo')+'" data-track="'+id+'" data-module="'+esc(m)+'" type="button"><i class="fas fa-'+(done?'circle-check':'circle')+'"></i> '+esc(m)+'</button>';
    }).join('');
    mEl.querySelectorAll('.piko-learn-module').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var list=STATE.learn[id]||[], idx=list.indexOf(btn.dataset.module);
        if(idx>-1)list.splice(idx,1);else list.push(btn.dataset.module);
        STATE.learn[id]=list;
        await DB_LAYER.saveLearning(getUserId(), STATE.learn);
        renderTrack(id,id==='culturalverse'?CV:DV,list);
        toast(idx>-1?btn.dataset.module+' marked incomplete':'✅ '+btn.dataset.module+' complete!');
        if(idx===-1) {
          await DB_LAYER.addNotif(getUserId(),'🎓','Learning: '+btn.dataset.module+' completed!');
          STATE.notifs=await DB_LAYER.getNotifs(getUserId());
          updateNotifBadge();
        }
      });
    });
  }

  function updateNotifBadge() {
    var n=STATE.notifs.filter(function(x){return !x.read;}).length;
    var b=$('pikoNotifBadge'),t=$('tabNotifCount');
    if(b){b.textContent=n;b.hidden=n===0;}
    if(t){t.textContent=n;t.style.display=n===0?'none':'';}
  }

  /* ════════════════════════════════════════════
     AUTH FLOWS
  ════════════════════════════════════════════ */
  function showAuthGate() {
    $('pikoAuthGate').hidden=false; $('pikoProfileSection').hidden=true;
    var s=$('pikoSignOut');if(s)s.hidden=true;
    var t=$('pikoCustomizeTrigger');if(t)t.hidden=true;
    var nb=$('pikoNotifBtn');if(nb)nb.hidden=true;
  }

  async function showProfile() {
    $('pikoAuthGate').hidden=true; $('pikoProfileSection').hidden=false;
    var s=$('pikoSignOut');if(s)s.hidden=false;
    var t=$('pikoCustomizeTrigger');if(t)t.hidden=false;
    var nb=$('pikoNotifBtn');if(nb)nb.hidden=false;
    await loadAllData();
    applyTheme(STATE.theme);
    renderAll();
    subscribeRealtime();
  }

  async function loadAllData() {
    var uid=getUserId(), email=getUserEmail();
    var [profile, ideas, projects, orders, notifs, saved, learn, theme] = await Promise.all([
      DB_LAYER.getProfile(uid),
      DB_LAYER.getMyIdeas(uid, email),
      DB_LAYER.getMyProjects(uid, email),
      DB_LAYER.getOrders(uid),
      DB_LAYER.getNotifs(uid),
      DB_LAYER.getSaved(uid),
      DB_LAYER.getLearning(uid),
      DB_LAYER.loadTheme(uid),
    ]);
    STATE.profile  = profile;
    STATE.ideas    = ideas;
    STATE.projects = projects;
    STATE.orders   = orders;
    STATE.notifs   = notifs;
    STATE.saved    = saved;
    STATE.learn    = learn;
    STATE.theme    = theme;
  }

  /* ── Realtime subscription for notifications ── */
  function subscribeRealtime() {
    if (OFFLINE || !supa() || !SESSION_USER) return;
    if (_realtimeSub) supa().removeChannel(_realtimeSub);
    _realtimeSub = supa()
      .channel('profile-notifs-'+SESSION_USER.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: 'user_id=eq.'+SESSION_USER.id,
      }, async function(payload) {
        var n = payload.new;
        STATE.notifs.unshift({ id:n.id, icon:n.icon, text:n.text, ts:n.created_at, read:false });
        renderNotifications(); updateNotifBadge();
        toast(n.icon+' '+n.text, 4000);
      })
      .subscribe();
  }

  /* ════════════════════════════════════════════
     AUTH INIT
  ════════════════════════════════════════════ */
  async function checkExistingSession() {
    if (OFFLINE) {
      var local = loadJSON(PROFILE_KEY, null);
      if (local && local.email) { await showProfile(); } else { showAuthGate(); }
      return;
    }
    var r = await supa().auth.getSession();
    if (r.data && r.data.session && r.data.session.user) {
      SESSION_USER = r.data.session.user;
      await showProfile();
    } else {
      showAuthGate();
    }
  }

  function initAuthListeners() {
    if (OFFLINE || !supa()) return;
    supa().auth.onAuthStateChange(async function(event, session) {
      if (event === 'SIGNED_IN' && session) {
        SESSION_USER = session.user;
        await showProfile();
      } else if (event === 'SIGNED_OUT') {
        SESSION_USER = null;
        STATE.profile=null; STATE.ideas=[]; STATE.projects=[];
        STATE.orders=[]; STATE.notifs=[]; STATE.saved=[];
        STATE.learn={}; STATE.theme={};
        showAuthGate();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        SESSION_USER = session.user;
      }
    });
  }

  /* ════════════════════════════════════════════
     SIGN UP / SIGN IN (Supabase OTP magic link)
  ════════════════════════════════════════════ */
  function initSignup() {
    var btn=$('pikoSignupBtn'); if(!btn)return;
    btn.addEventListener('click', async function(){
      var name  = (($('signupName')||{}).value||'').trim();
      var email = (($('signupEmail')||{}).value||'').trim();
      var pass  = (($('signupPassword')||{}).value||'').trim();
      var pass2 = (($('signupPassword2')||{}).value||'').trim();

      if(!email||!email.includes('@')){showStatus('pikoSignupStatus','Please enter a valid email.','err');return;}
      if(pass.length<8){showStatus('pikoSignupStatus','Password must be at least 8 characters.','err');return;}
      if(pass!==pass2){showStatus('pikoSignupStatus','Passwords do not match.','err');return;}

      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating…';

      if (OFFLINE) {
        var p={email:email,display_name:name||email.split('@')[0],bio:'',avatar_url:'',social:'',joined_ts:Date.now(),verified:true};
        saveJSON(PROFILE_KEY,p);
        showStatus('pikoSignupStatus','✅ Profile created!','ok');
        await DB_LAYER.addNotif(null,'🌺','Welcome to Pikoverse, '+(name||email.split('@')[0])+'!');
        setTimeout(function(){ STATE.profile=p; showProfile(); },1000);
        btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';
        return;
      }

      var r = await supa().auth.signUp({
        email: email,
        password: pass,
        options: { data: { display_name: name || email.split('@')[0] } },
      });

      btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';
      if (r.error) {
        showStatus('pikoSignupStatus','⚠️ '+r.error.message,'err');
      } else if (r.data && r.data.user) {
        SESSION_USER = r.data.user;
        showStatus('pikoSignupStatus','✅ Profile created! Signing you in…','ok');
        await DB_LAYER.addNotif(r.data.user.id,'🌺','Welcome to Pikoverse, '+(name||email.split('@')[0])+'!');
        setTimeout(async function(){ await showProfile(); }, 800);
      }
    });
  }

  function initSignin() {
    var btn=$('pikoSigninBtn'); if(!btn)return;
    btn.addEventListener('click', async function(){
      var email = (($('signinEmail')||{}).value||'').trim();
      var pass  = (($('signinPassword')||{}).value||'').trim();

      if(!email||!email.includes('@')){showStatus('pikoSigninStatus','Please enter your email.','err');return;}
      if(!pass){showStatus('pikoSigninStatus','Please enter your password.','err');return;}

      if (OFFLINE) {
        var local=loadJSON(PROFILE_KEY,null);
        if(local&&local.email&&local.email.toLowerCase()===email.toLowerCase()){
          STATE.profile=local; await showProfile(); return;
        }
        showStatus('pikoSigninStatus','No local profile found. Create one first.','err'); return;
      }

      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing in…';
      var r = await supa().auth.signInWithPassword({ email:email, password:pass });
      btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In';
      if(r.error){
        var msg = r.error.message.toLowerCase().includes('invalid') ?
          'Wrong email or password. Try again.' : '⚠️ '+r.error.message;
        showStatus('pikoSigninStatus', msg, 'err');
      } else {
        SESSION_USER = r.data.user;
        showStatus('pikoSigninStatus','✅ Welcome back!','ok');
        setTimeout(async function(){ await showProfile(); }, 500);
      }
    });

    /* Forgot password */
    var forgot = $('pikoForgotBtn');
    if(!forgot) return;
    forgot.addEventListener('click', async function(){
      var email = (($('signinEmail')||{}).value||'').trim();
      if(!email||!email.includes('@')){showStatus('pikoSigninStatus','Enter your email first.','err');return;}
      forgot.disabled=true; forgot.textContent='Sending…';
      var r = await supa().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin+'/profile.html?reset=1',
      });
      forgot.disabled=false; forgot.textContent='Forgot password?';
      showStatus('pikoSigninStatus',
        r.error ? '⚠️ '+r.error.message : '✅ Reset link sent! Check your email.',
        r.error ? 'err' : 'ok');
    });
  }

  function initSignOut() {
    var btn=$('pikoSignOut'); if(!btn)return;
    btn.addEventListener('click', async function(){
      if (!OFFLINE && supa()) await supa().auth.signOut();
      localStorage.removeItem(PROFILE_KEY);
      SESSION_USER=null;
      showAuthGate(); toast('Signed out.');
    });
  }

  /* ════════════════════════════════════════════
     EDIT PROFILE
  ════════════════════════════════════════════ */
  function initEditProfile() {
    var editBtn=$('pikoEditProfileBtn'),cancelBtn=$('pikoCancelEditBtn'),saveBtn=$('pikoSaveProfileBtn'),
        form=$('pikoProfileEditForm'),avatarBtn=$('pikoAvatarEditBtn'),avatarFile=$('pikoAvatarFile'),
        bannerBtn=$('pikoBannerEditBtn'),bannerFile=$('pikoBannerFile');

    if(editBtn) editBtn.addEventListener('click',function(){
      var p=STATE.profile||{};
      ($('editName')||{}).value=p.display_name||'';
      ($('editBio')||{}).value=p.bio||'';
      ($('editAvatarUrl')||{}).value=p.avatar_url||'';
      ($('editSocial')||{}).value=p.social||'';
      if(form)form.hidden=false;
    });
    if(cancelBtn) cancelBtn.addEventListener('click',function(){if(form)form.hidden=true;});

    if(saveBtn) saveBtn.addEventListener('click', async function(){
      var p=Object.assign({},STATE.profile||{});
      var name=(($('editName')||{}).value||'').trim();
      p.display_name=name||p.display_name;
      p.bio=(($('editBio')||{}).value||'').trim();
      p.avatar_url=(($('editAvatarUrl')||{}).value||'').trim();
      p.social=(($('editSocial')||{}).value||'').trim();
      STATE.profile=p;
      await DB_LAYER.upsertProfile(p);
      renderAll(); if(form)form.hidden=true; toast('✅ Profile updated!');
    });

    /* Avatar upload → Supabase Storage if available, else base64 */
    if(avatarBtn&&avatarFile){
      avatarBtn.addEventListener('click',function(){avatarFile.click();});
      avatarFile.addEventListener('change', async function(){
        var file=avatarFile.files[0]; if(!file)return;
        if(!OFFLINE && supa() && SESSION_USER) {
          var path='avatars/'+SESSION_USER.id+'/'+Date.now()+'.'+file.name.split('.').pop();
          var up=await supa().storage.from('pikoverse-public').upload(path,file,{upsert:true});
          if(!up.error){
            var url=supa().storage.from('pikoverse-public').getPublicUrl(path).data.publicUrl;
            STATE.profile=STATE.profile||{}; STATE.profile.avatar_url=url;
            await DB_LAYER.upsertProfile(STATE.profile); renderAll(); toast('✅ Avatar updated!'); return;
          }
        }
        /* Fallback: base64 */
        var reader=new FileReader(); reader.onload=async function(e){
          STATE.profile=STATE.profile||{}; STATE.profile.avatar_url=e.target.result;
          await DB_LAYER.upsertProfile(STATE.profile); renderAll(); toast('✅ Avatar updated!');
        }; reader.readAsDataURL(file);
      });
    }

    if(bannerBtn&&bannerFile){
      bannerBtn.addEventListener('click',function(){bannerFile.click();});
      bannerFile.addEventListener('change', async function(){
        var file=bannerFile.files[0]; if(!file)return;
        var reader=new FileReader(); reader.onload=async function(e){
          var bn=$('pikoBanner'); if(bn)bn.style.background='url('+e.target.result+') center/cover no-repeat';
          STATE.theme=STATE.theme||{}; STATE.theme.bannerBg='url('+e.target.result+') center/cover no-repeat';
          await DB_LAYER.saveTheme(getUserId(),STATE.theme); toast('✅ Banner updated!');
        }; reader.readAsDataURL(file);
      });
    }
  }

  /* ════════════════════════════════════════════
     TABS / UI INIT
  ════════════════════════════════════════════ */
  function initAuthTabs(){
    document.querySelectorAll('.piko-auth-tab').forEach(function(btn){
      btn.addEventListener('click',function(){
        document.querySelectorAll('.piko-auth-tab').forEach(function(b){b.classList.remove('is-active');});
        document.querySelectorAll('.piko-auth-pane').forEach(function(p){p.classList.remove('is-active');});
        btn.classList.add('is-active');
        var pane=$('pikoAuth'+btn.dataset.authTab.charAt(0).toUpperCase()+btn.dataset.authTab.slice(1));
        if(pane)pane.classList.add('is-active');
      });
    });
  }
  function initProfileTabs(){
    document.querySelectorAll('.piko-profile-tab').forEach(function(btn){
      btn.addEventListener('click',function(){
        document.querySelectorAll('.piko-profile-tab').forEach(function(b){b.classList.remove('is-active');});
        document.querySelectorAll('.piko-profile-pane').forEach(function(p){p.classList.remove('is-active');});
        btn.classList.add('is-active');
        var pane=$('pikoProfilePane'+btn.dataset.ptab.charAt(0).toUpperCase()+btn.dataset.ptab.slice(1));
        if(pane)pane.classList.add('is-active');
      });
    });
  }

  function initShareCard(){
    var btn=$('pikoShareCardBtn');if(!btn)return;
    btn.addEventListener('click',function(){
      var p=STATE.profile||{};var name=p.display_name||getUserEmail()||'Member';
      var approved=STATE.projects.filter(function(x){return x.status==='approved';}).length;
      var earned=getEarnedBadgeIds(STATE.ideas.length,approved,STATE.orders.length,STATE.learn,STATE.profile);
      var score=calcScore(STATE.ideas.length,approved,STATE.orders.length,earned.length);
      var rank=getRank(score);
      var text='🌺 I\'m a '+rank.label+' on Pikoverse! Score: '+score+' pts — pikoverse.xyz/profile.html';
      if(navigator.share)navigator.share({title:'My Pikoverse ID',text:text,url:'https://pikoverse.xyz/profile.html'}).catch(function(){});
      else{navigator.clipboard&&navigator.clipboard.writeText(text);toast('✅ Copied to clipboard!');}
    });
  }

  function initNotifBell(){
    var btn=$('pikoNotifBtn');if(!btn)return;
    btn.addEventListener('click',function(){
      document.querySelectorAll('.piko-profile-tab').forEach(function(b){b.classList.remove('is-active');});
      document.querySelectorAll('.piko-profile-pane').forEach(function(p){p.classList.remove('is-active');});
      var tab=document.querySelector('[data-ptab="notifications"]'),pane=$('pikoProfilePaneNotifications');
      if(tab)tab.classList.add('is-active');if(pane){pane.classList.add('is-active');pane.scrollIntoView({behavior:'smooth',block:'start'});}
    });
    var ma=$('pikoMarkAllRead');if(!ma)return;
    ma.addEventListener('click', async function(){
      STATE.notifs.forEach(function(x){x.read=true;});
      await DB_LAYER.markNotifsRead(getUserId(), null);
      renderNotifications();updateNotifBadge();toast('All read');
    });
  }

  /* ════════════════════════════════════════════
     CUSTOMIZE PANEL
  ════════════════════════════════════════════ */
  function applyTheme(t) {
    if (!t || !Object.keys(t).length) return;
    var r=document.documentElement;
    if(t.accent)  r.style.setProperty('--pf-custom-accent',t.accent);
    if(t.bg)      r.style.setProperty('--pf-custom-bg',t.bg);
    if(t.bg2)     r.style.setProperty('--pf-custom-bg2',t.bg2);
    if(t.text)    r.style.setProperty('--pf-custom-text',t.text);
    if(t.glow)    r.style.setProperty('--pf-custom-glow',t.glow);
    if(t.cardBg)  r.style.setProperty('--pf-custom-card-bg',t.cardBg);
    if(t.font)    r.style.setProperty('--pf-custom-font',t.font);
    if(t.bgImage) document.body.style.background=t.bgImage;
    if(t.bannerBg){var bn=$('pikoBanner');if(bn)bn.style.background=t.bannerBg;}
    var st=$('pikoCustomStyle');if(st)st.textContent=t.css||'';
  }

  function initCustomize() {
    var trigger=$('pikoCustomizeTrigger'),panel=$('pikoCustomizePanel'),close=$('pikoCustomizeClose');
    if(trigger)trigger.addEventListener('click',function(){if(panel)panel.classList.add('is-open');});
    if(close)close.addEventListener('click',function(){if(panel)panel.classList.remove('is-open');});

    document.querySelectorAll('.piko-theme-preset').forEach(function(el){
      el.addEventListener('click',function(){
        document.querySelectorAll('.piko-theme-preset').forEach(function(e){e.classList.remove('is-active');});el.classList.add('is-active');
        var t=THEMES[el.dataset.theme]||THEMES.default;
        var acc=$('customAccentColor'),bg=$('customBgColor'),cb=$('customCardBgColor');
        if(acc)acc.value=t.accent||'#f0c96a';if(bg)bg.value=t.bg||'#080b14';if(cb){try{cb.value=t.bg2||'#0d1220';}catch(e){}}
      });
    });
    document.querySelectorAll('.piko-color-preset').forEach(function(el){
      el.addEventListener('click',function(){document.querySelectorAll('.piko-color-preset').forEach(function(e){e.classList.remove('is-active');});el.classList.add('is-active');var acc=$('customAccentColor');if(acc)acc.value=el.dataset.color;});
    });
    document.querySelectorAll('.piko-font-option').forEach(function(el){
      el.addEventListener('click',function(){document.querySelectorAll('.piko-font-option').forEach(function(e){e.classList.remove('is-active');});el.classList.add('is-active');});
    });
    document.querySelectorAll('.piko-bg-option').forEach(function(el){
      el.addEventListener('click',function(){document.querySelectorAll('.piko-bg-option').forEach(function(e){e.classList.remove('is-active');});el.classList.add('is-active');});
    });

    var apply=$('pikoApplyCustomize');
    if(apply) apply.addEventListener('click', async function(){
      var themeEl=document.querySelector('.piko-theme-preset.is-active');
      var themeId=themeEl?themeEl.dataset.theme:'default';
      var base=THEMES[themeId]||THEMES.default;
      var accent=($('customAccentColor')||{}).value||base.accent;
      var bg=($('customBgColor')||{}).value||base.bg;
      var cb=$('customCardBgColor');var cardBg=cb?cb.value:base.cardBg;
      var fontEl=document.querySelector('.piko-font-option.is-active');var font=fontEl?fontEl.dataset.font:'Montserrat';
      var bgEl=document.querySelector('.piko-bg-option.is-active');var bgOpt=bgEl?bgEl.dataset.bg:'default';
      var bgUrl=($('customBgUrl')||{}).value||'';
      var css=($('customCssInput')||{}).value||'';
      var bgImage=bgUrl?'url('+bgUrl+') center/cover no-repeat fixed':BG_MAP[bgOpt]||bg;
      var t={accent:accent,bg:bg,bg2:cardBg,text:base.text,glow:accent+'26',cardBg:'rgba(255,255,255,.03)',font:font,bgImage:bgImage,css:css,themeId:themeId};
      STATE.theme=t;
      await DB_LAYER.saveTheme(getUserId(),t);
      applyTheme(t);if(panel)panel.classList.remove('is-open');toast('✅ Profile customized!');
    });

    var reset=$('pikoResetCustomize');
    if(reset) reset.addEventListener('click', async function(){
      STATE.theme={};
      await DB_LAYER.saveTheme(getUserId(),{});
      document.documentElement.removeAttribute('style');document.body.removeAttribute('style');
      var bn=$('pikoBanner');if(bn)bn.removeAttribute('style');var st=$('pikoCustomStyle');if(st)st.textContent='';
      toast('Theme reset');if(panel)panel.classList.remove('is-open');
    });
  }

  function initLinks(){
    var ib=$('pikoSubmitIdeaBtn');if(ib)ib.addEventListener('click',function(){window.location.href='index.html#ideas';});
    var pb=$('pikoSubmitProjectBtn');if(pb)pb.addEventListener('click',function(){window.location.href='index.html#showcase';});
  }

  /* ════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════ */
  function boot() {
    /* Apply any cached theme immediately to prevent flash */
    applyTheme(loadJSON(THEME_KEY, {}));

    initAuthTabs(); initProfileTabs();
    initSignup(); initSignin(); initSignOut();
    initEditProfile(); initShareCard(); initNotifBell();
    initCustomize(); initLinks();

    if (OFFLINE) {
      /* No Supabase — check localStorage session */
      var local = loadJSON(PROFILE_KEY, null);
      if (local && local.email && local.verified !== false) {
        STATE.profile = local;
        (async function(){ await showProfile(); })();
      } else {
        showAuthGate();
      }
    }
  }

  /* Handle password reset redirect (?reset=1) */
  (function() {
    if (window.location.search.includes('reset=1') && !OFFLINE) {
      var newPass = prompt('Enter your new password (min 8 characters):');
      if (newPass && newPass.length >= 8) {
        supa && supa() && supa().auth.updateUser({ password: newPass }).then(function(r) {
          if (r.error) alert('Error: '+r.error.message);
          else { alert('✅ Password updated! You are now signed in.'); window.history.replaceState({},'','/profile.html'); }
        });
      }
    }
  })();

  /* Wait for supabase-client.js to fire piko:supa:ready */
  window.addEventListener('piko:supa:ready', function(e) {
    OFFLINE = e.detail.offline;
    DB      = window.piko_supa;
    initAuthListeners();
    checkExistingSession();
  });

  /* Also run boot immediately for UI setup */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Expose DB_LAYER globally so other scripts can use it */
  window.PIKO_DB = DB_LAYER;

})();