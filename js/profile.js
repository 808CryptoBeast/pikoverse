/**
 * profile.js — Pikoverse Profile System (Supabase-first rewrite)
 * Requires: js/supabase-client.js loaded first
 *
 * Design principles:
 *  - Supabase is the ONLY source of truth for profile data
 *  - localStorage stores ONLY appearance/theme cache (for instant visual apply)
 *  - No merge logic, no stale data, no race conditions
 *  - Sign out is immediate and complete
 */
(function () {
  'use strict';

  /* ════════════════════════════════════════════
     CONSTANTS
  ════════════════════════════════════════════ */
  var THEME_CACHE_KEY = 'piko_theme_cache_v2'; /* localStorage — appearance only */

  var RANKS = [
    { id:'seedling', label:'Seedling', icon:'🌱', min:0,  color:'#4caf7a', bg:'rgba(76,175,122,.15)',  border:'rgba(76,175,122,.3)'  },
    { id:'grower',   label:'Grower',   icon:'🌿', min:5,  color:'#54d1ff', bg:'rgba(84,209,255,.15)',  border:'rgba(84,209,255,.3)'  },
    { id:'weaver',   label:'Weaver',   icon:'🔮', min:15, color:'#9d64ff', bg:'rgba(157,100,255,.15)', border:'rgba(157,100,255,.3)' },
    { id:'elder',    label:'Elder',    icon:'⭐', min:30, color:'#f0c96a', bg:'rgba(240,201,106,.18)', border:'rgba(240,201,106,.4)'  }
  ];

  var BADGES = [
    { id:'first_idea',    icon:'💡', name:'First Idea',       desc:'Shared your first idea with the community' },
    { id:'project_live',  icon:'🚀', name:'Project Live',     desc:'Had a project approved to the showcase' },
    { id:'chronicle_sub', icon:'📜', name:'Chronicle Reader', desc:'Subscribed to the Pikoverse Chronicle' },
    { id:'early_member',  icon:'🌺', name:'Early Member',     desc:'Joined during the founding wave' },
    { id:'idea_x5',       icon:'🔥', name:'Idea Machine',     desc:'Submitted 5 or more ideas' },
    { id:'learner',       icon:'🎓', name:'Knowledge Seeker', desc:'Completed a learning module' },
    { id:'connector',     icon:'🔗', name:'Connector',        desc:'Active across multiple Pikoverse areas' },
    { id:'first_order',   icon:'🛍️', name:'First Purchase',   desc:'Placed your first marketplace order' }
  ];

  var CV_MODULES = ['Hawaiian History','Pacific Islanders','Indigenous Knowledge','Cultural Connections','Oral Traditions','Ancestral Navigation','Language & Identity','Modern Sovereignty'];
  var DV_MODULES = ['Bitcoin Fundamentals','Ethereum & Smart Contracts','XRPL Deep Dive','Flare & Songbird','DeFi & AMMs','Web3 Security','Scam Field Guide','Protocol Comparison','Blockchain Forensics Intro','NaluLF Workflow'];

  var DEFAULT_THEME = { accent:'#f0c96a', bg:'#080b14', bg2:'#0d1220', text:'rgba(255,255,255,.88)', font:'Montserrat', bgMode:'default', bgUrl:'', customCss:'' };
  var BG_MAP = { default:'linear-gradient(135deg,#080b14,#141830)', stars:'#050510', gradient1:'linear-gradient(135deg,#0a0020,#200040,#000020)', gradient2:'linear-gradient(135deg,#001020,#002040,#003060)', gradient3:'linear-gradient(135deg,#0a1a05,#102a10,#1a3a1a)', gradient4:'linear-gradient(135deg,#1a0a00,#2a1500,#1a0a00)', light:'linear-gradient(135deg,#f0f4ff,#e0e8ff)' };
  var THEME_PRESETS = {
    default:{ accent:'#f0c96a', bg:'#080b14', bg2:'#0d1220', text:'rgba(255,255,255,.88)', font:'Montserrat', bgMode:'default' },
    ocean:  { accent:'#54d1ff', bg:'#001a2e', bg2:'#003366', text:'rgba(220,240,255,.9)',  font:'Montserrat', bgMode:'gradient2' },
    jungle: { accent:'#4caf7a', bg:'#0a1a0a', bg2:'#0d2e1a', text:'rgba(220,255,230,.88)',font:'Montserrat', bgMode:'gradient3' },
    sunset: { accent:'#ff9f43', bg:'#1a0a0a', bg2:'#2e1800', text:'rgba(255,240,220,.88)',font:'Montserrat', bgMode:'gradient4' },
    neon:   { accent:'#ff6fd8', bg:'#050010', bg2:'#0d0020', text:'rgba(255,220,255,.88)',font:'Montserrat', bgMode:'gradient1' },
    light:  { accent:'#4060d0', bg:'#f0f4ff', bg2:'#e0e8ff', text:'rgba(20,30,60,.9)',    font:'Montserrat', bgMode:'light'     }
  };

  /* ════════════════════════════════════════════
     STATE — single source of truth in memory
  ════════════════════════════════════════════ */
  var STATE = {
    user:     null,  /* Supabase auth user */
    profile:  null,  /* profiles table row */
    ideas:    [],
    projects: [],
    orders:   [],
    notifs:   [],
    learn:    { culturalverse:[], digitalverse:[] },
    theme:    Object.assign({}, DEFAULT_THEME),
    nameStyle:{ color:'#ffffff', font:'', weight:'700', size:28 }
  };

  /* ════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════ */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
  function email() { return STATE.user && STATE.user.email ? STATE.user.email : ''; }
  function supa() { return window.piko_supa || null; }

  function toast(msg, dur) {
    var el = $('pikoProfileToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(function(){ el.classList.remove('is-visible'); }, dur||3500);
  }

  function setStatus(id, msg, type) {
    var el = $(id); if (!el) return;
    el.textContent = msg;
    el.className = 'piko-auth-status piko-auth-status--'+(type||'info');
    el.hidden = false;
  }
  function clearStatus(id) { var el=$(id); if(el){ el.hidden=true; el.textContent=''; } }

  function timeAgo(ts) {
    var s = Math.floor((Date.now()-Number(ts||0))/1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s/60)+'m ago';
    if (s < 86400) return Math.floor(s/3600)+'h ago';
    return Math.floor(s/86400)+'d ago';
  }

  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}) : 'recently'; }
  function fmtPrice(cents) { return '$'+(Number(cents||0)/100).toFixed(2); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e||'').trim()); }

  function pwStrength(pw) {
    var s=0; if(!pw) return {label:'',pct:0,color:'transparent'};
    if(pw.length>=8)s++; if(pw.length>=12)s++; if(/[A-Z]/.test(pw))s++; if(/[0-9]/.test(pw))s++; if(/[^A-Za-z0-9]/.test(pw))s++;
    return [{label:'',pct:0,color:'transparent'},{label:'Weak',pct:20,color:'#e05252'},{label:'Fair',pct:40,color:'#ff9f43'},{label:'Good',pct:60,color:'#f0c96a'},{label:'Strong',pct:80,color:'#4caf7a'},{label:'Very Strong',pct:100,color:'#54d1ff'}][Math.min(s,5)];
  }

  function bindPwStrength(inputId, barId, labelId) {
    var inp=$(inputId), bar=$(barId), lbl=$(labelId);
    if(!inp||!bar) return;
    inp.addEventListener('input', function(){
      var s=pwStrength(inp.value);
      bar.style.width=s.pct+'%'; bar.style.background=s.color;
      if(lbl){ lbl.textContent=s.label; lbl.style.color=s.color; }
    });
  }

  /* ════════════════════════════════════════════
     SCORE / RANK / BADGES
  ════════════════════════════════════════════ */
  function earnedBadges() {
    var e=[], ideas=STATE.ideas.length;
    var approved=STATE.projects.filter(function(p){return p.status==='approved'||p.status==='live';}).length;
    var orders=STATE.orders.length;
    var learn=STATE.learn;
    if(ideas>=1) e.push('first_idea');
    if(approved>=1) e.push('project_live');
    if(orders>=1) e.push('first_order');
    if(ideas>=5) e.push('idea_x5');
    if((learn.culturalverse||[]).length||(learn.digitalverse||[]).length) e.push('learner');
    if(STATE.profile&&STATE.profile.created_at&&Date.now()-new Date(STATE.profile.created_at).getTime()<90*24*60*60*1000) e.push('early_member');
    var used=0; if(ideas>0)used++; if(approved>0||STATE.projects.length>0)used++; if(orders>0)used++; if(((learn.culturalverse||[]).length+(learn.digitalverse||[]).length)>0)used++;
    if(used>=3) e.push('connector');
    return e;
  }

  function calcScore() {
    var earned=earnedBadges();
    var approved=STATE.projects.filter(function(p){return p.status==='approved'||p.status==='live';}).length;
    return STATE.ideas.length + approved*3 + STATE.orders.length + earned.length*2;
  }

  function getRank(score) {
    for(var i=RANKS.length-1;i>=0;i--){ if(score>=RANKS[i].min) return RANKS[i]; }
    return RANKS[0];
  }

  /* ════════════════════════════════════════════
     THEME — apply from STATE.theme
  ════════════════════════════════════════════ */
  function applyTheme(t) {
    STATE.theme = Object.assign({}, DEFAULT_THEME, t||{});
    var r=document.documentElement.style;
    r.setProperty('--pf-gold', STATE.theme.accent||'#f0c96a');
    r.setProperty('--pf-dark', STATE.theme.bg||'#080b14');
    r.setProperty('--pf-dark2',STATE.theme.bg2||'#0d1220');
    r.setProperty('--pf-text', STATE.theme.text||'rgba(255,255,255,.88)');
    var body=document.body; if(!body) return;
    body.style.background = STATE.theme.bgUrl ? 'url("'+STATE.theme.bgUrl+'") center/cover fixed' : (BG_MAP[STATE.theme.bgMode]||BG_MAP.default);
    body.style.color = STATE.theme.text||'rgba(255,255,255,.88)';
    body.style.fontFamily = STATE.theme.font||'Montserrat';
    var cs=$('pikoCustomStyle');
    if(cs) cs.textContent = STATE.theme.customCss||'';
    /* Cache for instant apply on next load */
    try { localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(STATE.theme)); } catch(e){}
  }

  function applyNameStyle(ns) {
    STATE.nameStyle = ns||STATE.nameStyle;
    var els=[$('pikoProfileName'),$('pikoNamePreview')].filter(Boolean);
    els.forEach(function(el){
      el.style.color      = STATE.nameStyle.color||'';
      el.style.fontFamily = STATE.nameStyle.font||'';
      el.style.fontWeight = STATE.nameStyle.weight||'';
      el.style.fontSize   = STATE.nameStyle.size ? STATE.nameStyle.size+'px' : '';
      el.style.textShadow = STATE.nameStyle.color ? '0 0 18px '+STATE.nameStyle.color+'55' : '';
    });
  }

  function applyBanner() {
    var bannerUrl = STATE.profile && STATE.profile.banner_url ? STATE.profile.banner_url : '';
    /* Fallback to theme bannerUrl for cross-device */
    var url = bannerUrl || (STATE.theme && STATE.theme.bannerUrl) || '';
    var bnEl=$('pikoBanner'), idEl=$('pikoIdCardBanner');
    if(bnEl){ bnEl.style.background = url ? 'url("'+url+'") center/cover no-repeat' : ''; }
    if(idEl){ idEl.style.background = url ? 'url("'+url+'") center/cover no-repeat' : 'linear-gradient(135deg,#080b14,#141830)'; }
  }

  /* ════════════════════════════════════════════
     SUPABASE DATA LAYER
     All reads/writes go to Supabase only
  ════════════════════════════════════════════ */
  async function fetchProfile() {
    if(!supa()||!STATE.user) return null;
    var r=await supa().from('profiles').select('*').eq('id',STATE.user.id).single();
    if(r.error||!r.data) return null;
    return r.data;
  }

  async function saveProfile(updates) {
    if(!supa()||!STATE.user) return;
    var payload = Object.assign({
      id: STATE.user.id,
      email: STATE.user.email,
      display_name: STATE.profile.display_name || STATE.user.email.split('@')[0],
      bio: STATE.profile.bio || '',
      avatar_url: STATE.profile.avatar_url || '',
      banner_url: STATE.profile.banner_url || '',
      social: STATE.profile.social || '',
      theme: buildThemePayload(),
      updated_at: new Date().toISOString()
    }, updates||{});

    var r=await supa().from('profiles').upsert(payload,{onConflict:'id'});
    if(r.error) {
      console.error('[Profile] save failed:', r.error.message);
      return false;
    }
    console.log('[Profile] saved to Supabase ✓');
    return true;
  }

  function buildThemePayload() {
    /* Strip base64 bannerBg — stored as bannerUrl (Storage URL) only in DB */
    var t=Object.assign({},STATE.theme);
    if(t.bannerBg && t.bannerBg.startsWith('url(data:')) delete t.bannerBg;
    /* Encode nameStyle and learn progress into theme JSONB */
    t._nameStyle = STATE.nameStyle;
    t._learn     = STATE.learn;
    t._hideEmail = STATE.profile && STATE.profile.hide_email;
    return t;
  }

  async function fetchIdeas() {
    if(!supa()||!email()) return [];
    try {
      var r=await supa().from('community_ideas').select('*').eq('contact',email()).order('ts',{ascending:false});
      return r.error?[]:(r.data||[]);
    } catch(e){ return []; }
  }

  async function fetchProjects() {
    if(!supa()||!STATE.user) return [];
    try {
      var r=await supa().from('projects').select('*').eq('user_id',STATE.user.id).order('created_at',{ascending:false});
      if(!r.error&&r.data&&r.data.length) return r.data.map(mapProject);
      /* fallback by email */
      var r2=await supa().from('projects').select('*').eq('contact',email()).order('created_at',{ascending:false});
      return r2.error?[]:(r2.data||[]).map(mapProject);
    } catch(e){ return []; }
  }

  function mapProject(row) {
    return { id:row.id, name:row.name||'', desc:row.description||row.desc||'', stage:row.stage||'idea', link:row.url||row.link||'', status:row.status||'pending', contact:row.contact||email(), ts:row.created_at?new Date(row.created_at).getTime():Date.now() };
  }

  function fetchOrders() {
    /* Orders stay in localStorage — sourced from Worker/D1 via admin */
    try { return JSON.parse(localStorage.getItem('amp_orders_v1')||'[]').filter(function(o){ return String(o.email||o.customer_email||'').toLowerCase()===email().toLowerCase(); }); }
    catch(e){ return []; }
  }

  async function fetchNotifs() {
    if(!supa()||!STATE.user) return [];
    try {
      var r=await supa().from('notifications').select('*').eq('user_id',STATE.user.id).order('created_at',{ascending:false}).limit(40);
      return r.error?[]:(r.data||[]);
    } catch(e){ return []; }
  }

  async function addNotif(icon, text) {
    var n={ icon:icon, text:text, read:false, created_at:new Date().toISOString() };
    if(supa()&&STATE.user) {
      try { await supa().from('notifications').insert(Object.assign({user_id:STATE.user.id},n)); } catch(e){}
    }
    STATE.notifs.unshift(Object.assign({id:'n-'+Date.now()},n));
    if(STATE.notifs.length>40) STATE.notifs.length=40;
    renderNotifications();
    updateNotifBadge();
  }

  /* ════════════════════════════════════════════
     SHOW / HIDE UI SECTIONS
  ════════════════════════════════════════════ */
  function showAuthGate() {
    var g=$('pikoAuthGate'), s=$('pikoProfileSection');
    if(g) g.hidden=false;
    if(s) s.hidden=true;
    [$('pikoSignOut'),$('pikoCustomizeTrigger'),$('pikoNotifBtn')].forEach(function(el){ if(el){ el.hidden=true; el.style.display=''; } });
  }

  function showProfileSection() {
    var g=$('pikoAuthGate'), s=$('pikoProfileSection');
    if(g) g.hidden=true;
    if(s) s.hidden=false;
    [$('pikoSignOut'),$('pikoCustomizeTrigger'),$('pikoNotifBtn')].forEach(function(el){ if(el){ el.hidden=false; el.style.display=''; el.style.pointerEvents='auto'; } });
  }

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
    renderLearning();
    updateNotifBadge();
    applyBanner();
    applyNameStyle(STATE.nameStyle);
  }

  function renderHeader() {
    var p=STATE.profile||{};
    var name=p.display_name||email()||'Pikoverse Member';
    var hideEmail=p.hide_email||false;

    setText('pikoProfileName', name);
    setText('pikoProfileBio',  p.bio||'');
    var socialEl=$('pikoProfileSocial');
    if(socialEl){ socialEl.textContent=p.social||''; socialEl.hidden=!p.social; }
    var emailEl=$('pikoProfileEmail');
    if(emailEl){ emailEl.textContent=hideEmail?'':email(); emailEl.hidden=hideEmail; }
    var joinedEl=$('pikoProfileJoined');
    if(joinedEl) joinedEl.textContent='🌺 Joined '+fmtDate(p.created_at);

    /* Avatar */
    setText('pikoProfileAvatarInitial', name.charAt(0).toUpperCase());
    var img=$('pikoProfileAvatarImg');
    if(img){
      if(p.avatar_url){ img.src=p.avatar_url; img.hidden=false; var init=$('pikoProfileAvatarInitial'); if(init) init.style.display='none'; img.onerror=function(){ img.hidden=true; if(init) init.style.display=''; }; }
      else { img.hidden=true; if(img.src) img.removeAttribute('src'); var init2=$('pikoProfileAvatarInitial'); if(init2) init2.style.display=''; }
    }
    /* Nav avatar */
    var navImg=$('pikoNavAvatarImg');
    if(navImg){ navImg.src=p.avatar_url||'assets/goldenp.jpg'; navImg.onerror=function(){ this.src='assets/AMP Tiki.jpg'; }; }

    /* Rank badge */
    var score=calcScore(), rank=getRank(score);
    var rb=$('pikoRankBadge');
    if(rb){ rb.textContent=rank.icon+' '+rank.label; rb.style.color=rank.color; rb.style.background=rank.bg; rb.style.borderColor=rank.border; }

    /* Badges row */
    var badgesEl=$('pikoProfileBadges');
    if(badgesEl){
      var chips=['<span class="piko-profile-badge piko-profile-badge--member"><i class="fas fa-star"></i> Pikoverse Member</span>','<span class="piko-profile-badge piko-profile-badge--joined">🌺 Joined '+fmtDate(p.created_at)+'</span>'];
      earnedBadges().forEach(function(id){ var b=BADGES.find(function(x){return x.id===id;}); if(b) chips.push('<span class="piko-profile-badge piko-profile-badge--earned">'+b.icon+' '+b.name+'</span>'); });
      badgesEl.innerHTML=chips.join('');
    }
    applyNameStyle(STATE.nameStyle);
  }

  function renderStats() {
    var approved=STATE.projects.filter(function(p){return p.status==='approved'||p.status==='live';}).length;
    setText('statIdeas',    String(STATE.ideas.length));
    setText('statProjects', String(STATE.projects.length));
    setText('statScore',    String(calcScore()));
    setText('statBadges',   String(earnedBadges().length));
  }

  function renderIdCard() {
    var p=STATE.profile||{}, name=p.display_name||email()||'Member';
    var rank=getRank(calcScore());
    setText('pikoIdCardName',  name);
    setText('pikoIdCardMeta',  rank.icon+' '+rank.label+' · Pikoverse Member');
    setText('pikoIdCardScore', 'Score: '+calcScore());
    var av=$('pikoIdCardAvatar');
    if(av){ av.innerHTML=p.avatar_url?'<img src="'+esc(p.avatar_url)+'" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentNode.textContent=\''+esc(name.charAt(0).toUpperCase())+'\'">':''; if(!p.avatar_url) av.textContent=name.charAt(0).toUpperCase(); }
  }

  function renderTimeline() {
    var el=$('pikoTimeline'); if(!el) return;
    var items=[];
    STATE.ideas.forEach(function(i){ items.push({text:'💡 Shared idea: "'+String(i.text||'').slice(0,60)+(String(i.text||'').length>60?'…':'')+'"',ts:i.ts||Date.now()}); });
    STATE.projects.forEach(function(p){ items.push({text:'🚀 Submitted: "'+String(p.name||'Project')+'"',ts:p.ts||Date.now()}); });
    STATE.orders.forEach(function(o){ items.push({text:'🛍️ Placed order — '+fmtPrice(o.total||0),ts:o.ts||Date.now()}); });
    earnedBadges().forEach(function(id){ var b=BADGES.find(function(x){return x.id===id;}); if(b) items.push({text:'🏅 Earned: '+b.icon+' '+b.name,ts:STATE.profile&&STATE.profile.created_at?new Date(STATE.profile.created_at).getTime():Date.now()}); });
    items.sort(function(a,b){return(b.ts||0)-(a.ts||0);});
    if(!items.length){ el.innerHTML='<p class="piko-profile-empty">Your activity will appear here as you engage with the community.</p>'; return; }
    el.innerHTML=items.slice(0,20).map(function(item){ return '<div class="piko-activity-item"><div class="piko-activity-icon"><i class="fas fa-bolt"></i></div><div><div class="piko-activity-text">'+esc(item.text)+'</div><div class="piko-activity-meta">'+timeAgo(item.ts)+'</div></div></div>'; }).join('');
  }

  function renderRank() {
    var score=calcScore(), rank=getRank(score);
    var next=null; for(var i=0;i<RANKS.length;i++){ if(RANKS[i].min>score){next=RANKS[i];break;} }
    var pct=next?Math.min(100,Math.round(((score-rank.min)/Math.max(1,next.min-rank.min))*100)):100;
    setText('rankIcon',  rank.icon);
    setText('rankLabel', rank.label);
    setText('rankSub',   next?'Keep contributing to reach '+next.label:'Top rank reached 🌟');
    setText('rankNext',  next?score+' / '+next.min+' points to '+next.label:'You have reached the highest rank');
    var bar=$('rankBarFill'); if(bar) bar.style.width=pct+'%';
  }

  function renderBadges() {
    var grid=$('pikoBadgesGrid'); if(!grid) return;
    var earned=earnedBadges();
    if(!earned.length){ grid.innerHTML='<p class="piko-profile-empty">Your badges will appear here as you participate.</p>'; return; }
    grid.innerHTML=earned.map(function(id){ var b=BADGES.find(function(x){return x.id===id;}); return b?'<div class="piko-badge-card"><div class="piko-badge-icon">'+b.icon+'</div><div class="piko-badge-name">'+esc(b.name)+'</div><div class="piko-badge-desc">'+esc(b.desc)+'</div></div>':''; }).join('');
  }

  function renderPlatforms() {
    var wrap=$('pikoPlatformsGrid'); if(!wrap) return;
    var cv=(STATE.learn.culturalverse||[]).length, dv=(STATE.learn.digitalverse||[]).length;
    wrap.innerHTML='<a class="piko-platform-card" href="index.html"><strong>Pikoverse Hub</strong><span>'+(STATE.ideas.length+STATE.projects.length)+' submissions</span></a><a class="piko-platform-card" href="marketplace/index.html"><strong>AMP Marketplace</strong><span>'+STATE.orders.length+' orders</span></a><a class="piko-platform-card" href="ikeverse/culturalverse.html"><strong>Culturalverse</strong><span>'+cv+' modules complete</span></a><a class="piko-platform-card" href="ikeverse/digitalverse/index.html"><strong>DigitalVerse</strong><span>'+dv+' modules complete</span></a>';
  }

  function renderNotifications() {
    var wrap=$('pikoNotifList'); if(!wrap) return;
    if(!STATE.notifs.length){ wrap.innerHTML='<p class="piko-profile-empty">No notifications yet.</p>'; updateNotifBadge(); return; }
    wrap.innerHTML=STATE.notifs.map(function(n){ return '<div class="piko-notif-item'+(n.read?'':' is-unread')+'"><div class="piko-notif-icon">'+esc(n.icon||'🔔')+'</div><div class="piko-notif-content"><div class="piko-notif-text">'+esc(n.text||'')+'</div><div class="piko-notif-meta">'+timeAgo(n.created_at||n.ts||Date.now())+'</div></div></div>'; }).join('');
    updateNotifBadge();
  }

  function updateNotifBadge() {
    var count=(STATE.notifs||[]).filter(function(n){return !n.read;}).length;
    var b=$('pikoNotifBadge'); if(b){ b.textContent=String(count); b.hidden=count<1; }
    var t=$('tabNotifCount'); if(t){ t.textContent=String(count); t.style.display=count<1?'none':''; }
  }

  function renderSaved() {
    var wrap=$('pikoSavedGrid'); if(!wrap) return;
    /* Saved items still from localStorage — not critical enough for Supabase */
    var saved=[]; try{ saved=JSON.parse(localStorage.getItem('piko_saved_v1')||'[]'); }catch(e){}
    if(!saved.length){ wrap.innerHTML='<p class="piko-profile-empty">Bookmark Chronicle articles and items to find them here.</p>'; return; }
    wrap.innerHTML=saved.map(function(s,i){ return '<div class="piko-saved-card"><div class="piko-saved-head"><strong>'+esc(s.title||'Saved')+'</strong><button class="piko-saved-remove" data-i="'+i+'" type="button">×</button></div><p>'+esc(s.type||'Bookmark')+'</p>'+(s.href?'<a href="'+esc(s.href)+'" target="_blank">Open</a>':'')+'</div>'; }).join('');
    wrap.querySelectorAll('.piko-saved-remove').forEach(function(btn){
      btn.addEventListener('click',function(){ saved.splice(parseInt(btn.dataset.i),1); try{localStorage.setItem('piko_saved_v1',JSON.stringify(saved));}catch(e){} renderSaved(); });
    });
  }

  function renderOrders() {
    var wrap=$('pikoProfileOrdersList'); if(!wrap) return;
    if(!STATE.orders.length){ wrap.innerHTML='<p class="piko-profile-empty">No orders yet. <a href="marketplace/index.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>'; return; }
    wrap.innerHTML=STATE.orders.map(function(o){
      var status=String(o.status||'pending').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
      var items=(o.items||[]).map(function(i){return(i.name||'Item')+(i.size?' ('+i.size+')':'')+' ×'+(i.qty||1);}).join(', ');
      return '<div class="piko-order-card"><div class="piko-order-card-header"><span class="piko-order-id">'+esc(o.id||'')+'</span><span class="piko-order-status piko-order-status--'+(o.status==='confirmed'?'confirmed':'pending')+'">'+esc(status)+'</span></div><div class="piko-order-items">'+esc(items)+'</div><div class="piko-order-total">'+fmtPrice(o.total||0)+' · '+(o.ts?new Date(o.ts).toLocaleDateString():'')+'</div></div>';
    }).join('');
  }

  function renderIdeas() {
    var wrap=$('pikoProfileIdeasList'); if(!wrap) return;
    if(!STATE.ideas.length){ wrap.innerHTML='<p class="piko-profile-empty">No ideas shared yet.</p>'; return; }
    wrap.innerHTML=STATE.ideas.map(function(i){ return '<div class="piko-profile-idea-card">'+esc(i.text||'')+'<div class="piko-profile-idea-meta"><span>'+esc(i.category||'Idea')+'</span><span>'+timeAgo(i.ts||Date.now())+'</span>'+(i.reply?'<span style="color:#f0c96a"><i class="fas fa-star"></i> AMP replied</span>':'')+'</div></div>'; }).join('');
  }

  function renderProjects() {
    var wrap=$('pikoProfileProjectsGrid'); if(!wrap) return;
    if(!STATE.projects.length){ wrap.innerHTML='<p class="piko-profile-empty">No projects submitted yet.</p>'; return; }
    var cols={idea:'#f0c96a',building:'#54d1ff',live:'#4caf7a',approved:'#4caf7a'};
    wrap.innerHTML=STATE.projects.map(function(p){ var c=cols[p.stage]||'#f0c96a'; return '<div class="ecosystem-project-card"><div class="epc-header"><span class="epc-name">'+esc(p.name||'Project')+'</span><span class="epc-stage" style="background:'+c+'22;color:'+c+'">'+esc(p.stage||'idea')+'</span></div><p class="epc-desc">'+esc(p.desc||'')+'</p><div class="piko-profile-idea-meta"><span style="color:'+((p.status==='approved'||p.status==='live')?'#4caf7a':'#ffb347')+'">'+((p.status==='approved'||p.status==='live')?'✓ On Showcase':'⏳ Pending Review')+'</span></div></div>'; }).join('');
  }

  function renderLearning() {
    renderTrack('culturalverse', CV_MODULES, STATE.learn.culturalverse||[]);
    renderTrack('digitalverse',  DV_MODULES, STATE.learn.digitalverse||[]);
  }

  function renderTrack(trackId, modules, completed) {
    var pEl=$(trackId+'Progress'), wEl=$(trackId+'Modules'); if(!wEl) return;
    var pct=modules.length?Math.round((completed.length/modules.length)*100):0;
    if(pEl) pEl.style.width=pct+'%';
    wEl.innerHTML=modules.map(function(mod){ var done=completed.indexOf(mod)>-1; return '<button class="piko-learn-module piko-learn-module--'+(done?'done':'todo')+'" data-track="'+esc(trackId)+'" data-mod="'+esc(mod)+'" type="button"><i class="fas fa-'+(done?'circle-check':'circle')+'"></i> '+esc(mod)+'</button>'; }).join('');
    wEl.querySelectorAll('.piko-learn-module').forEach(function(btn){
      btn.addEventListener('click', async function(){
        var track=btn.dataset.track, mod=btn.dataset.mod;
        var list=STATE.learn[track]||[];
        var idx=list.indexOf(mod); if(idx>-1) list.splice(idx,1); else list.push(mod);
        STATE.learn[track]=list;
        await saveProfile(); /* persist learn progress via theme JSONB */
        renderLearning(); renderStats(); renderRank(); renderBadges();
        addNotif('🎓',(idx>-1?'Marked incomplete: ':'Completed: ')+mod);
      });
    });
  }

  function setText(id, val) { var el=$(id); if(el) el.textContent=val||''; }

  /* ════════════════════════════════════════════
     AUTH FLOW
  ════════════════════════════════════════════ */
  async function signIn(email, pass) {
    var r=await supa().auth.signInWithPassword({email:email,password:pass});
    if(r.error) throw r.error;
    STATE.user=r.data.user;
    await loadProfileAndShow();
  }

  async function signUp(name, emailAddr, pass) {
    var r=await supa().auth.signUp({ email:emailAddr, password:pass, options:{ data:{ display_name:name } } });
    if(r.error) throw r.error;
    STATE.user=r.data.user;
    if(r.data.session) {
      await loadProfileAndShow();
    } else {
      /* Email confirmation required */
      return 'confirm';
    }
  }

  async function loadProfileAndShow() {
    if(!STATE.user) return;
    /* Fetch or create profile row */
    var p=await fetchProfile();
    if(!p) {
      /* Create row for new signup */
      var meta=STATE.user.user_metadata||{};
      await supa().from('profiles').upsert({
        id:STATE.user.id, email:STATE.user.email,
        display_name: meta.display_name||STATE.user.email.split('@')[0],
        bio:'', avatar_url:'', banner_url:'', social:'',
        theme: buildThemePayload()
      },{onConflict:'id'});
      p=await fetchProfile();
    }
    STATE.profile=p||{};

    /* Restore theme, nameStyle, learn from profiles.theme JSONB */
    var dbTheme=(p&&p.theme)||{};
    var themeBase=Object.assign({},DEFAULT_THEME,dbTheme);
    if(dbTheme._nameStyle) STATE.nameStyle=dbTheme._nameStyle;
    if(dbTheme._learn)     STATE.learn=dbTheme._learn;
    if(STATE.profile)      STATE.profile.hide_email=!!(dbTheme._hideEmail);
    applyTheme(themeBase);

    /* Fetch all data in parallel */
    var results=await Promise.all([fetchIdeas(), fetchProjects(), fetchNotifs()]);
    STATE.ideas    = results[0];
    STATE.projects = results[1];
    STATE.orders   = fetchOrders();
    STATE.notifs   = results[2];

    showProfileSection();
    renderAll();
    addNotif('🌺','Welcome back, '+(STATE.profile.display_name||STATE.user.email.split('@')[0])+'!');
  }

  function signOut() {
    /* Clear ALL Supabase tokens from localStorage synchronously */
    var toRemove=[];
    for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&(k.indexOf('supabase')>-1||k.indexOf('sb-')===0||k==='piko_supabase_auth')) toRemove.push(k); }
    toRemove.forEach(function(k){ localStorage.removeItem(k); });
    /* Fire Supabase signOut in background — don't wait */
    if(supa()) supa().auth.signOut().catch(function(){});
    /* Immediate redirect — no delay */
    window.location.replace('/index.html');
  }

  /* ════════════════════════════════════════════
     AUTH UI — sign up / sign in forms
  ════════════════════════════════════════════ */
  function initSignup() {
    var btn=$('pikoSignupBtn'); if(!btn) return;
    btn.addEventListener('click', async function(){
      clearStatus('pikoSignupStatus');
      var name=(($('signupName')||{}).value||'').trim();
      var emailVal=(($('signupEmail')||{}).value||'').trim().toLowerCase();
      var pass=(($('signupPassword')||{}).value||'').trim();
      var pass2=(($('signupPassword2')||{}).value||'').trim();
      if(!name)                 { setStatus('pikoSignupStatus','Please enter a display name.','err'); return; }
      if(!validEmail(emailVal)) { setStatus('pikoSignupStatus','Please enter a valid email.','err'); return; }
      if(pass.length<8)         { setStatus('pikoSignupStatus','Password must be at least 8 characters.','err'); return; }
      if(pass!==pass2)          { setStatus('pikoSignupStatus','Passwords do not match.','err'); return; }
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating profile…';
      try {
        var result=await signUp(name,emailVal,pass);
        if(result==='confirm') {
          setStatus('pikoSignupStatus','✅ Account created! Check your email to confirm, then sign in.','ok');
        }
      } catch(err) {
        setStatus('pikoSignupStatus','⚠️ '+((err&&err.message)?err.message:'Could not create profile.'),'err');
      } finally {
        btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';
      }
    });
  }

  function initSignin() {
    var btn=$('pikoSigninBtn'); if(!btn) return;
    btn.addEventListener('click', async function(){
      clearStatus('pikoSigninStatus');
      var emailVal=(($('signinEmail')||{}).value||'').trim();
      var pass=(($('signinPassword')||{}).value||'').trim();
      if(!validEmail(emailVal)) { setStatus('pikoSigninStatus','Please enter your email.','err'); return; }
      if(!pass)                 { setStatus('pikoSigninStatus','Please enter your password.','err'); return; }
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Signing in…';
      try {
        await signIn(emailVal,pass);
        setStatus('pikoSigninStatus','✅ Welcome back!','ok');
      } catch(err) {
        var msg=(err&&err.message)?err.message:'Could not sign in.';
        if(msg.toLowerCase().indexOf('invalid')>-1) msg='Wrong email or password. Please try again.';
        setStatus('pikoSigninStatus',msg,'err');
      } finally {
        btn.disabled=false; btn.innerHTML='<i class="fas fa-sign-in-alt"></i> Sign In';
      }
    });

    /* Forgot password */
    var forgot=$('pikoForgotBtn'); if(!forgot) return;
    forgot.addEventListener('click', async function(){
      clearStatus('pikoSigninStatus');
      var emailVal=(($('signinEmail')||{}).value||'').trim();
      if(!validEmail(emailVal)){ setStatus('pikoSigninStatus','Enter your email above first.','err'); return; }
      forgot.disabled=true; forgot.textContent='Sending…';
      try {
        var r=await supa().auth.resetPasswordForEmail(emailVal,{redirectTo:window.location.origin+'/profile.html?reset=1'});
        if(r.error) throw r.error;
        setStatus('pikoSigninStatus','✅ Password reset link sent to '+emailVal+'. Check your inbox.','ok');
      } catch(err) {
        setStatus('pikoSigninStatus','⚠️ '+((err&&err.message)?err.message:'Could not send reset link.'),'err');
      } finally {
        forgot.disabled=false; forgot.textContent='Forgot password?';
      }
    });
  }

  function initSignOut() {
    var btn=$('pikoSignOut'); if(!btn) return;
    btn.addEventListener('click', function(){ signOut(); });
  }

  function handlePasswordReset() {
    if(window.location.search.indexOf('reset=1')===-1) return;
    window.history.replaceState({},'',window.location.pathname);
    var panel=document.createElement('div');
    panel.style.cssText='position:fixed;inset:0;background:rgba(8,11,20,.97);display:flex;align-items:center;justify-content:center;z-index:9999;padding:24px;';
    panel.innerHTML='<div style="width:min(460px,100%);background:#0d1220;border:1px solid rgba(240,201,106,.18);border-radius:16px;padding:28px;"><h2 style="margin:0 0 8px;font-family:Orbitron,sans-serif;color:#f0c96a;font-size:18px;">Set New Password</h2><p style="margin:0 0 18px;font-size:13px;color:rgba(255,255,255,.6);">Choose a new password for your Pikoverse account.</p><div style="margin-bottom:12px"><input id="resetPw1" type="password" placeholder="New password" maxlength="128" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:14px;box-sizing:border-box"></div><div style="margin-bottom:18px"><input id="resetPw2" type="password" placeholder="Confirm password" maxlength="128" style="width:100%;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:14px;box-sizing:border-box"></div><div id="resetStatus" style="font-size:13px;margin-bottom:14px;color:rgba(255,255,255,.7);min-height:18px;"></div><button id="resetSaveBtn" type="button" style="width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#c9a84c,#f0c96a);color:#080b14;font-weight:800;font-size:15px;cursor:pointer;">Save New Password</button></div>';
    document.body.appendChild(panel);
    $('resetSaveBtn').addEventListener('click', async function(){
      var np=($('resetPw1').value||'').trim(), np2=($('resetPw2').value||'').trim(), st=$('resetStatus'), btn=$('resetSaveBtn');
      if(np.length<8){ st.textContent='Password must be at least 8 characters.'; return; }
      if(np!==np2){ st.textContent='Passwords do not match.'; return; }
      btn.disabled=true; btn.textContent='Saving…';
      try {
        var r=await supa().auth.updateUser({password:np}); if(r.error) throw r.error;
        st.textContent='✅ Password updated! Redirecting…';
        setTimeout(function(){ panel.remove(); toast('Password updated! Welcome back.'); },1200);
      } catch(err){ st.textContent='⚠️ '+((err&&err.message)?err.message:'Could not update password.'); btn.disabled=false; btn.textContent='Save New Password'; }
    });
  }

  /* ════════════════════════════════════════════
     PANEL — Profile Settings (Edit + Customize)
  ════════════════════════════════════════════ */
  function openPanel(tab) {
    var bd=$('pikoCustomizeBackdrop'), pn=$('pikoCustomizePanel');
    if(bd) bd.classList.add('is-open');
    if(pn) pn.classList.add('is-open');
    if(tab) switchPanelTab(tab);
    hydratePanelFields();
  }

  function closePanel() {
    var bd=$('pikoCustomizeBackdrop'), pn=$('pikoCustomizePanel');
    if(bd) bd.classList.remove('is-open');
    if(pn) pn.classList.remove('is-open');
  }

  function switchPanelTab(tab) {
    document.querySelectorAll('.piko-edit-tab').forEach(function(b){ b.classList.toggle('is-active',b.getAttribute('data-etab')===tab); });
    document.querySelectorAll('.piko-edit-pane').forEach(function(p){ p.classList.toggle('is-active',p.id==='pikoEditPane'+tab.charAt(0).toUpperCase()+tab.slice(1)); });
  }

  function hydratePanelFields() {
    var p=STATE.profile||{}, t=STATE.theme, ns=STATE.nameStyle;
    if($('editName'))     $('editName').value     = p.display_name||'';
    if($('editBio'))      $('editBio').value      = p.bio||'';
    if($('editAvatarUrl'))$('editAvatarUrl').value= p.avatar_url||'';
    if($('editSocial'))   $('editSocial').value   = p.social||'';
    if($('hideEmailToggle')) $('hideEmailToggle').checked=!!(p.hide_email);
    if($('nameStyleColor'))  $('nameStyleColor').value  = ns.color||'#ffffff';
    if($('nameStyleFont'))   $('nameStyleFont').value   = ns.font||'';
    if($('nameStyleWeight')) $('nameStyleWeight').value = ns.weight||'700';
    if($('nameStyleSize'))   $('nameStyleSize').value   = String(ns.size||28);
    if($('nameStyleSizeVal'))$('nameStyleSizeVal').textContent = (ns.size||28)+'px';
    if($('pikoNamePreview')) $('pikoNamePreview').textContent = p.display_name||'Your Name';
    if($('customAccentColor')) $('customAccentColor').value = t.accent||'#f0c96a';
    if($('customBgColor'))     $('customBgColor').value     = t.bg||'#080b14';
    if($('customCardBgColor')) $('customCardBgColor').value = t.bg2||'#0d1220';
    if($('customBgUrl'))       $('customBgUrl').value       = t.bgUrl||'';
    if($('customCssInput'))    $('customCssInput').value    = t.customCss||'';
    document.querySelectorAll('.piko-theme-preset').forEach(function(el){ el.classList.toggle('is-active',el.getAttribute('data-theme')===(t.themeId||'default')); });
    document.querySelectorAll('.piko-color-preset').forEach(function(el){ el.classList.toggle('is-active',el.getAttribute('data-color')===(t.accent||'#f0c96a')); });
    document.querySelectorAll('.piko-font-option').forEach(function(el){ el.classList.toggle('is-active',el.getAttribute('data-font')===(t.font||'Montserrat')); });
    document.querySelectorAll('.piko-bg-option').forEach(function(el){ el.classList.toggle('is-active',el.getAttribute('data-bg')===(t.bgMode||'default')); });
    applyNameStyle(ns);
  }

  function initPanelActions() {
    /* Open/close */
    var trigger=$('pikoCustomizeTrigger');
    if(trigger) trigger.addEventListener('click', function(){ openPanel('profile'); });
    if($('pikoCustomizeClose')) $('pikoCustomizeClose').addEventListener('click', closePanel);
    if($('pikoCustomizeBackdrop')) $('pikoCustomizeBackdrop').addEventListener('click',function(e){ if(e.target===$('pikoCustomizeBackdrop')) closePanel(); });

    /* Tab switching */
    document.querySelectorAll('.piko-edit-tab').forEach(function(btn){
      btn.addEventListener('click', function(){ switchPanelTab(btn.getAttribute('data-etab')); });
    });

    /* Theme presets */
    document.querySelectorAll('.piko-theme-preset').forEach(function(el){
      el.addEventListener('click', function(){
        document.querySelectorAll('.piko-theme-preset').forEach(function(x){x.classList.remove('is-active');});
        el.classList.add('is-active');
        var preset=THEME_PRESETS[el.getAttribute('data-theme')]||THEME_PRESETS.default;
        applyTheme(Object.assign({},STATE.theme,preset,{themeId:el.getAttribute('data-theme')}));
      });
    });

    /* Color / font / bg presets */
    document.querySelectorAll('.piko-color-preset').forEach(function(el){
      el.addEventListener('click', function(){
        document.querySelectorAll('.piko-color-preset').forEach(function(x){x.classList.remove('is-active');});
        el.classList.add('is-active');
        var cc=$('customAccentColor'); if(cc) cc.value=el.getAttribute('data-color')||'#f0c96a';
      });
    });
    document.querySelectorAll('.piko-font-option').forEach(function(el){
      el.addEventListener('click', function(){ document.querySelectorAll('.piko-font-option').forEach(function(x){x.classList.remove('is-active');}); el.classList.add('is-active'); });
    });
    document.querySelectorAll('.piko-bg-option').forEach(function(el){
      el.addEventListener('click', function(){ document.querySelectorAll('.piko-bg-option').forEach(function(x){x.classList.remove('is-active');}); el.classList.add('is-active'); });
    });

    /* Save profile */
    if($('pikoSaveProfileBtn')) {
      $('pikoSaveProfileBtn').addEventListener('click', async function(){
        clearStatus('pikoSaveStatus');
        var name=(($('editName')||{}).value||'').trim();
        if(!name){ setStatus('pikoSaveStatus','Display name is required.','err'); return; }
        var btn=$('pikoSaveProfileBtn');
        btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…';
        STATE.profile.display_name = name;
        STATE.profile.bio          = (($('editBio')||{}).value||'').trim();
        STATE.profile.avatar_url   = (($('editAvatarUrl')||{}).value||'').trim();
        STATE.profile.social       = (($('editSocial')||{}).value||'').trim();
        STATE.profile.hide_email   = !!(($('hideEmailToggle')||{}).checked);
        var ok=await saveProfile();
        if(ok){ setStatus('pikoSaveStatus','✅ Profile saved!','ok'); toast('✅ Profile saved!'); renderAll(); addNotif('✨','Profile updated'); }
        else   setStatus('pikoSaveStatus','⚠️ Save failed — check console.','err');
        btn.disabled=false; btn.innerHTML='<i class="fas fa-floppy-disk"></i> Save Changes';
      });
    }

    /* Cancel */
    if($('pikoCancelEditBtn')) $('pikoCancelEditBtn').addEventListener('click', function(){ hydratePanelFields(); clearStatus('pikoSaveStatus'); closePanel(); });

    /* Apply appearance */
    if($('pikoApplyCustomize')) {
      $('pikoApplyCustomize').addEventListener('click', async function(){
        var activeFont=document.querySelector('.piko-font-option.is-active');
        var activeBg=document.querySelector('.piko-bg-option.is-active');
        var activeTheme=document.querySelector('.piko-theme-preset.is-active');
        var base=activeTheme?Object.assign({},THEME_PRESETS[activeTheme.getAttribute('data-theme')]||THEME_PRESETS.default):Object.assign({},STATE.theme);
        var next=Object.assign({},base,{
          themeId: activeTheme?activeTheme.getAttribute('data-theme'):'default',
          accent:  (($('customAccentColor')||{}).value||base.accent),
          bg:      (($('customBgColor')||{}).value||base.bg),
          bg2:     (($('customCardBgColor')||{}).value||base.bg2),
          font:    activeFont?activeFont.getAttribute('data-font'):(base.font||'Montserrat'),
          bgMode:  activeBg?activeBg.getAttribute('data-bg'):(base.bgMode||'default'),
          bgUrl:   (($('customBgUrl')||{}).value||'').trim(),
          customCss:(($('customCssInput')||{}).value||''),
          bannerUrl:STATE.theme.bannerUrl||''
        });
        applyTheme(next);
        await saveProfile();
        toast('✅ Appearance saved!');
        addNotif('🎨','Appearance updated');
        closePanel();
      });
    }

    /* Reset appearance */
    if($('pikoResetCustomize')) {
      $('pikoResetCustomize').addEventListener('click', async function(){
        applyTheme(Object.assign({},DEFAULT_THEME));
        await saveProfile();
        hydratePanelFields();
        toast('Appearance reset to default.');
      });
    }
  }

  /* ════════════════════════════════════════════
     NAME STYLE EDITOR
  ════════════════════════════════════════════ */
  function initNameStyleEditor() {
    var color=$('nameStyleColor'), font=$('nameStyleFont'), weight=$('nameStyleWeight'), size=$('nameStyleSize'), sizeVal=$('nameStyleSizeVal');
    function preview(){
      var ns={ color:color?color.value:'#ffffff', font:font?font.value:'', weight:weight?weight.value:'700', size:size?parseInt(size.value)||28:28 };
      if(sizeVal) sizeVal.textContent=(ns.size)+'px';
      if($('pikoNamePreview')) $('pikoNamePreview').textContent=(STATE.profile&&STATE.profile.display_name)||'Your Name';
      applyNameStyle(ns);
    }
    [color,font,weight,size].forEach(function(el){ if(!el) return; el.addEventListener('input',preview); el.addEventListener('change',preview); });
    if($('pikoSaveStyleBtn')) {
      $('pikoSaveStyleBtn').addEventListener('click', async function(){
        STATE.nameStyle={ color:color?color.value:'#ffffff', font:font?font.value:'', weight:weight?weight.value:'700', size:size?parseInt(size.value)||28:28 };
        applyNameStyle(STATE.nameStyle);
        await saveProfile();
        setStatus('pikoStyleStatus','✅ Name style saved!','ok');
        toast('✅ Name style saved!');
        addNotif('🎨','Name style updated');
      });
    }
  }

  /* ════════════════════════════════════════════
     AVATAR & BANNER UPLOAD
  ════════════════════════════════════════════ */
  function initUploads() {
    var avatarBtn=$('pikoAvatarEditBtn'), avatarFile=$('pikoAvatarFile');
    if(avatarBtn&&avatarFile) {
      avatarBtn.addEventListener('click', function(){ avatarFile.click(); });
      avatarFile.addEventListener('change', async function(){
        var file=avatarFile.files&&avatarFile.files[0]; if(!file||!STATE.profile) return;
        var orig=avatarBtn.innerHTML; avatarBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i>'; avatarBtn.disabled=true;
        toast('⏳ Uploading avatar…');
        try {
          if(supa()&&STATE.user) {
            var ext=file.name.split('.').pop()||'jpg';
            var path='avatars/'+STATE.user.id+'/avatar.'+ext;
            var up=await supa().storage.from('pikoverse-public').upload(path,file,{upsert:true});
            if(!up.error) {
              var url=supa().storage.from('pikoverse-public').getPublicUrl(path).data.publicUrl+'?t='+Date.now();
              STATE.profile.avatar_url=url;
              await saveProfile();
              renderAll();
              toast('✅ Avatar saved — visible on all devices!');
              avatarBtn.innerHTML=orig; avatarBtn.disabled=false; return;
            }
            console.warn('[Avatar] Storage upload failed:',up.error.message);
          }
          /* Fallback: base64 */
          var reader=new FileReader();
          reader.onload=async function(){ STATE.profile.avatar_url=reader.result; await saveProfile(); renderAll(); toast('✅ Avatar updated!'); avatarBtn.innerHTML=orig; avatarBtn.disabled=false; };
          reader.readAsDataURL(file);
        } catch(err){ console.error('[Avatar]',err); toast('⚠️ Upload failed — please try again.'); avatarBtn.innerHTML=orig; avatarBtn.disabled=false; }
      });
    }

    var bannerBtn=$('pikoBannerEditBtn'), bannerFile=$('pikoBannerFile');
    if(bannerBtn&&bannerFile) {
      bannerBtn.addEventListener('click', function(){ bannerFile.click(); });
      bannerFile.addEventListener('change', async function(){
        var file=bannerFile.files&&bannerFile.files[0]; if(!file) return;
        var orig=bannerBtn.innerHTML; bannerBtn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Uploading…'; bannerBtn.disabled=true;
        toast('⏳ Uploading banner…');
        try {
          if(supa()&&STATE.user) {
            var ext=file.name.split('.').pop()||'jpg';
            var path='banners/'+STATE.user.id+'/banner.'+ext;
            var up=await supa().storage.from('pikoverse-public').upload(path,file,{upsert:true});
            if(!up.error) {
              var url=supa().storage.from('pikoverse-public').getPublicUrl(path).data.publicUrl+'?t='+Date.now();
              STATE.profile.banner_url=url;
              STATE.theme.bannerUrl=url;
              await saveProfile();
              applyBanner();
              toast('✅ Banner saved — visible on all devices!');
              bannerBtn.innerHTML=orig; bannerBtn.disabled=false; return;
            }
            console.warn('[Banner] Storage upload failed:',up.error.message);
          }
          /* Fallback: base64 local */
          var reader2=new FileReader();
          reader2.onload=async function(){
            STATE.theme.bannerUrl=''; STATE.theme.bannerBg='url('+reader2.result+') center/cover';
            /* Store base64 only in localStorage cache — not in DB */
            try { var cache=JSON.parse(localStorage.getItem(THEME_CACHE_KEY)||'{}'); cache.bannerBg=STATE.theme.bannerBg; localStorage.setItem(THEME_CACHE_KEY,JSON.stringify(cache)); }catch(e){}
            applyBanner();
            toast('✅ Banner saved on this device!');
            bannerBtn.innerHTML=orig; bannerBtn.disabled=false;
          };
          reader2.readAsDataURL(file);
        } catch(err){ console.error('[Banner]',err); toast('⚠️ Upload failed — please try again.'); bannerBtn.innerHTML=orig; bannerBtn.disabled=false; }
      });
    }
  }

  /* ════════════════════════════════════════════
     SECURITY SETTINGS
  ════════════════════════════════════════════ */
  function initAccountSettings() {
    bindPwStrength('newPassword','changePwStrengthBar','changePwStrengthLabel');

    if($('pikoChangePwBtn')) {
      $('pikoChangePwBtn').addEventListener('click', async function(){
        clearStatus('pikoChangePwStatus');
        var cur=(($('currentPassword')||{}).value||'').trim();
        var np=(($('newPassword')||{}).value||'').trim();
        var np2=(($('newPassword2')||{}).value||'').trim();
        if(!cur)           { setStatus('pikoChangePwStatus','Enter your current password.','err'); return; }
        if(np.length<8)    { setStatus('pikoChangePwStatus','New password must be at least 8 characters.','err'); return; }
        if(np!==np2)       { setStatus('pikoChangePwStatus','New passwords do not match.','err'); return; }
        if(np===cur)       { setStatus('pikoChangePwStatus','New password must be different.','err'); return; }
        var btn=$('pikoChangePwBtn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verifying…';
        try {
          var reauth=await supa().auth.signInWithPassword({email:email(),password:cur});
          if(reauth.error) throw new Error('Current password is incorrect.');
          btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Saving…';
          var r=await supa().auth.updateUser({password:np}); if(r.error) throw r.error;
          setStatus('pikoChangePwStatus','✅ Password updated successfully!','ok');
          toast('✅ Password changed!');
          ['currentPassword','newPassword','newPassword2'].forEach(function(id){ if($(id)) $(id).value=''; });
          addNotif('🔐','Password changed successfully');
        } catch(err){ setStatus('pikoChangePwStatus',(err&&err.message)?err.message:'Could not change password.','err'); }
        finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-key"></i> Update Password'; }
      });
    }

    if($('pikoChangeEmailBtn')) {
      $('pikoChangeEmailBtn').addEventListener('click', async function(){
        clearStatus('pikoChangeEmailStatus');
        var newMail=(($('newEmail')||{}).value||'').trim().toLowerCase();
        var pw=(($('emailChangePw')||{}).value||'').trim();
        if(!validEmail(newMail)) { setStatus('pikoChangeEmailStatus','Enter a valid new email address.','err'); return; }
        if(!pw)                  { setStatus('pikoChangeEmailStatus','Enter your current password to confirm.','err'); return; }
        var btn=$('pikoChangeEmailBtn'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verifying…';
        try {
          var reauth=await supa().auth.signInWithPassword({email:email(),password:pw});
          if(reauth.error) throw new Error('Current password is incorrect.');
          btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Updating…';
          var r=await supa().auth.updateUser({email:newMail}); if(r.error) throw r.error;
          setStatus('pikoChangeEmailStatus','✅ Confirmation sent to '+newMail+'. Check your inbox.','ok');
          addNotif('📧','Email change requested to '+newMail);
        } catch(err){ setStatus('pikoChangeEmailStatus',(err&&err.message)?err.message:'Could not update email.','err'); }
        finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-envelope"></i> Update Email'; }
      });
    }
  }

  /* ════════════════════════════════════════════
     NOTIFICATIONS BELL
  ════════════════════════════════════════════ */
  function initNotifBell() {
    if($('pikoNotifBtn')) {
      $('pikoNotifBtn').addEventListener('click', function(){
        document.querySelectorAll('.piko-profile-tab').forEach(function(b){b.classList.remove('is-active');});
        document.querySelectorAll('.piko-profile-pane').forEach(function(p){p.classList.remove('is-active');});
        if($('pikoProfilePaneNotifications')) $('pikoProfilePaneNotifications').classList.add('is-active');
        /* Mark all read in Supabase */
        if(supa()&&STATE.user){
          supa().from('notifications').update({read:true}).eq('user_id',STATE.user.id).then(function(){
            STATE.notifs.forEach(function(n){n.read=true;});
            updateNotifBadge();
          });
        }
      });
    }
    if($('pikoMarkAllRead')) {
      $('pikoMarkAllRead').addEventListener('click', async function(){
        STATE.notifs.forEach(function(n){n.read=true;});
        if(supa()&&STATE.user) await supa().from('notifications').update({read:true}).eq('user_id',STATE.user.id);
        renderNotifications();
      });
    }
  }

  /* ════════════════════════════════════════════
     SHARE CARD
  ════════════════════════════════════════════ */
  function initShareCard() {
    var btn=$('pikoShareCardBtn'); if(!btn) return;
    btn.addEventListener('click', async function(){
      var p=STATE.profile||{}, name=p.display_name||email()||'Member';
      var rank=getRank(calcScore()), score=calcScore();
      var card=$('pikoIdCard')||document.querySelector('.piko-id-card');
      if(card&&typeof html2canvas!=='undefined'){
        btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Capturing…';
        try {
          var imgs=card.querySelectorAll('img');
          await Promise.all(Array.from(imgs).map(function(img){ return img.complete&&img.naturalWidth>0?Promise.resolve():new Promise(function(res){img.onload=res;img.onerror=res;}); }));
          var canvas=await html2canvas(card,{backgroundColor:'#080b14',scale:2,useCORS:true,allowTaint:false,logging:false});
          canvas.toBlob(async function(blob){
            var file=new File([blob],'pikoverse-id.png',{type:'image/png'});
            var text='🌺 '+name+' is a '+rank.label+' on Pikoverse! Score: '+score+' pts';
            if(navigator.canShare&&navigator.canShare({files:[file]})){
              try { await navigator.share({title:'My Pikoverse ID',text:text,url:'https://pikoverse.xyz/profile.html',files:[file]}); }
              catch(e){ if(e.name!=='AbortError'){ var a=document.createElement('a'); a.download='pikoverse-id.png'; a.href=canvas.toDataURL(); a.click(); toast('✅ ID card downloaded!'); } }
            } else { var a2=document.createElement('a'); a2.download='pikoverse-id.png'; a2.href=canvas.toDataURL(); a2.click(); if(navigator.clipboard) navigator.clipboard.writeText(text+' — https://pikoverse.xyz/profile.html').catch(function(){}); toast('✅ ID card downloaded! Link copied.'); }
          },'image/png');
        } catch(e){ console.warn('[ShareCard]',e); var t2='🌺 '+name+' is a '+rank.label+' on Pikoverse! — pikoverse.xyz/profile.html'; if(navigator.share) navigator.share({title:'My Pikoverse ID',text:t2,url:'https://pikoverse.xyz/profile.html'}).catch(function(){}); else if(navigator.clipboard) navigator.clipboard.writeText(t2).catch(function(){}); }
        finally { btn.disabled=false; btn.innerHTML='<i class="fas fa-share-nodes"></i> Share My Card'; }
      } else {
        var t3='🌺 '+name+' is a '+rank.label+' on Pikoverse! Score: '+score+' pts — pikoverse.xyz/profile.html';
        if(navigator.share) navigator.share({title:'My Pikoverse ID',text:t3,url:'https://pikoverse.xyz/profile.html'}).catch(function(){});
        else if(navigator.clipboard){ navigator.clipboard.writeText(t3).catch(function(){}); toast('Profile link copied!'); }
      }
    });
  }

  /* ════════════════════════════════════════════
     MODAL — Ideas & Projects
  ════════════════════════════════════════════ */
  function openModal(html) {
    var ov=$('pikoModalOverlay'), ct=$('pikoModalContent'); if(!ov||!ct) return;
    ct.innerHTML=html; ov.hidden=false;
  }
  function closeModal() {
    var ov=$('pikoModalOverlay'); if(ov) ov.hidden=true;
    var ct=$('pikoModalContent'); if(ct) ct.innerHTML='';
  }

  function openIdeaModal() {
    openModal('<h3 class="piko-modal-title"><i class="fas fa-lightbulb"></i> Share an Idea</h3><div class="piko-auth-field"><label class="piko-auth-label">Category</label><select id="mIdeaCat" class="piko-auth-input"><option value="platform">Platform</option><option value="feature">Feature</option><option value="content">Content</option><option value="other">Other</option></select></div><div class="piko-auth-field"><label class="piko-auth-label">Your Idea</label><textarea id="mIdeaText" class="piko-auth-input" rows="4" maxlength="500" placeholder="Share your idea…"></textarea></div><div class="piko-auth-status" id="mIdeaStatus" hidden></div><button class="piko-auth-btn" id="mIdeaSubmit" type="button"><i class="fas fa-paper-plane"></i> Share with Community</button>');
    var btn=$('mIdeaSubmit'); if(!btn) return;
    btn.addEventListener('click', async function(){
      var text=(($('mIdeaText')||{}).value||'').trim(), cat=(($('mIdeaCat')||{}).value||'other');
      if(!text){ setStatus('mIdeaStatus','Please write your idea first.','err'); return; }
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sharing…';
      var idea={ id:'idea-'+Date.now(), text:text, name:STATE.profile&&STATE.profile.display_name?STATE.profile.display_name:email().split('@')[0], contact:email(), category:cat, ts:Date.now(), status:'pending' };
      if(supa()&&STATE.user){ try{ await supa().from('community_ideas').insert({id:idea.id,user_id:STATE.user.id,text:idea.text,name:idea.name,contact:idea.contact,category:idea.category,ts:idea.ts,status:'pending'}); }catch(e){} }
      STATE.ideas=await fetchIdeas();
      renderIdeas(); renderTimeline(); renderStats(); renderRank(); renderBadges();
      addNotif('💡','Idea shared with the community!');
      toast('✅ Idea shared! Mahalo 🌺');
      closeModal();
    });
  }

  function openProjectModal() {
    openModal('<h3 class="piko-modal-title"><i class="fas fa-rocket"></i> Submit a Project</h3><div class="piko-auth-field"><label class="piko-auth-label">Project Name</label><input id="mProjName" class="piko-auth-input" type="text" maxlength="80" placeholder="Your project name"></div><div class="piko-auth-field"><label class="piko-auth-label">Description</label><textarea id="mProjDesc" class="piko-auth-input" rows="4" maxlength="400" placeholder="What are you building?"></textarea></div><div class="piko-auth-field"><label class="piko-auth-label">Stage</label><select id="mProjStage" class="piko-auth-input"><option value="idea">💡 Idea</option><option value="building">🔧 Building</option><option value="live">🚀 Live</option></select></div><div class="piko-auth-field"><label class="piko-auth-label">URL (optional)</label><input id="mProjUrl" class="piko-auth-input" type="url" maxlength="200" placeholder="https://…"></div><div class="piko-auth-status" id="mProjStatus" hidden></div><button class="piko-auth-btn" id="mProjSubmit" type="button"><i class="fas fa-rocket"></i> Submit Project</button>');
    var btn=$('mProjSubmit'); if(!btn) return;
    btn.addEventListener('click', async function(){
      var name=(($('mProjName')||{}).value||'').trim(), desc=(($('mProjDesc')||{}).value||'').trim();
      if(!name){ setStatus('mProjStatus','Please enter a project name.','err'); return; }
      if(!desc){ setStatus('mProjStatus','Please add a description.','err'); return; }
      btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Submitting…';
      if(supa()&&STATE.user){ try{ await supa().from('projects').insert({user_id:STATE.user.id,contact:email(),name:name,description:desc,stage:($('mProjStage')||{}).value||'idea',status:'pending',url:($('mProjUrl')||{}).value||'',created_at:new Date().toISOString()}); }catch(e){} }
      STATE.projects=await fetchProjects();
      renderProjects(); renderTimeline(); renderStats(); renderRank(); renderBadges();
      addNotif('🚀','Project submitted for review!');
      toast('✅ Project submitted! Mahalo 🌺');
      closeModal();
    });
  }

  function initModalLinks() {
    if($('pikoSubmitIdeaBtn')) $('pikoSubmitIdeaBtn').addEventListener('click', openIdeaModal);
    if($('pikoSubmitProjectBtn')) $('pikoSubmitProjectBtn').addEventListener('click', openProjectModal);
    if($('pikoModalClose')) $('pikoModalClose').addEventListener('click', closeModal);
    if($('pikoModalOverlay')) $('pikoModalOverlay').addEventListener('click', function(e){ if(e.target===$('pikoModalOverlay')) closeModal(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'){ closeModal(); closePanel(); } });
  }

  /* ════════════════════════════════════════════
     GLOBAL UI — tabs, password toggles, Enter key
  ════════════════════════════════════════════ */
  function initGlobalUI() {
    bindPwStrength('signupPassword','signupStrengthBar','signupStrengthLabel');

    /* Auth tabs */
    document.querySelectorAll('.piko-auth-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        document.querySelectorAll('.piko-auth-tab').forEach(function(b){b.classList.remove('is-active');});
        document.querySelectorAll('.piko-auth-pane').forEach(function(p){p.classList.remove('is-active');});
        btn.classList.add('is-active');
        var tab=btn.getAttribute('data-auth-tab');
        var pane=$('pikoAuth'+tab.charAt(0).toUpperCase()+tab.slice(1));
        if(pane) pane.classList.add('is-active');
      });
    });

    /* Profile tabs */
    document.querySelectorAll('.piko-profile-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        var tab=btn.getAttribute('data-ptab');
        document.querySelectorAll('.piko-profile-tab').forEach(function(b){b.classList.remove('is-active');});
        document.querySelectorAll('.piko-profile-pane').forEach(function(p){p.classList.remove('is-active');});
        btn.classList.add('is-active');
        var pane=$('pikoProfilePane'+tab.charAt(0).toUpperCase()+tab.slice(1));
        if(pane) pane.classList.add('is-active');
      });
    });

    /* Password visibility toggles */
    document.addEventListener('click', function(e){
      var btn=e.target.closest('.piko-pw-toggle'); if(!btn) return;
      var inp=document.getElementById(btn.getAttribute('data-target')); if(!inp) return;
      var show=inp.type==='password'; inp.type=show?'text':'password';
      var icon=btn.querySelector('i'); if(icon) icon.className=show?'fas fa-eye-slash':'fas fa-eye';
    });

    /* Enter key shortcuts */
    document.addEventListener('keydown', function(e){
      if(e.key!=='Enter') return;
      var id=document.activeElement&&document.activeElement.id?document.activeElement.id:'';
      if(['signupName','signupEmail','signupPassword','signupPassword2'].indexOf(id)>-1&&$('pikoSignupBtn')) $('pikoSignupBtn').click();
      if(['signinEmail','signinPassword'].indexOf(id)>-1&&$('pikoSigninBtn')) $('pikoSigninBtn').click();
    });
  }

  /* ════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════ */
  function boot() {
    /* Apply cached theme immediately — no flash of unstyled content */
    try {
      var cached=JSON.parse(localStorage.getItem(THEME_CACHE_KEY)||'null');
      if(cached) applyTheme(cached);
      /* Also restore cached banner if no Storage URL yet */
      if(cached&&cached.bannerBg&&!cached.bannerUrl){
        var bnEl=$('pikoBanner'); if(bnEl){ bnEl.style.background=cached.bannerBg; bnEl.style.backgroundSize='cover'; bnEl.style.backgroundPosition='center'; }
      }
    } catch(e){}

    initGlobalUI();
    initSignup();
    initSignin();
    initSignOut();
    initPanelActions();
    initNameStyleEditor();
    initAccountSettings();
    initUploads();
    initNotifBell();
    initShareCard();
    initModalLinks();
    handlePasswordReset();
  }

  /* ════════════════════════════════════════════
     ENTRY POINT — wait for Supabase
  ════════════════════════════════════════════ */
  window.addEventListener('piko:supa:ready', async function(e) {
    if(e.detail&&e.detail.offline) {
      /* Supabase unavailable — show auth gate with message */
      showAuthGate();
      setStatus('pikoSigninStatus','Supabase is not available. Profile features require a connection.','err');
      return;
    }
    try {
      var res=await supa().auth.getUser();
      if(res.data&&res.data.user) {
        STATE.user=res.data.user;
        await loadProfileAndShow();
      } else {
        showAuthGate();
      }
    } catch(e2) {
      showAuthGate();
    }
  });

  document.addEventListener('DOMContentLoaded', function(){
    boot();
    /* Auth state changes — e.g. sign in from another tab */
    window.addEventListener('piko:supa:ready', function(){
      if(supa()) {
        supa().auth.onAuthStateChange(function(event){
          if(event==='SIGNED_OUT'&&STATE.user){
            /* Only react if our state thinks we're signed in — avoids spurious events */
            STATE.user=null; STATE.profile=null;
          }
        });
      }
    });
  });

})();