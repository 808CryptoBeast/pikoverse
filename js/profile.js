/**
 * profile.js — Pikoverse User Profile (Full Edition)
 * js/profile.js
 */
(function () {
  'use strict';

  var WORKER_URL  = localStorage.getItem('amp_worker_url') || '';
  var PROFILE_KEY = 'piko_profile_v1';
  var LEARN_KEY   = 'piko_learning_v1';
  var NOTIF_KEY   = 'piko_notifs_v1';
  var SAVED_KEY   = 'piko_saved_v1';
  var THEME_KEY   = 'piko_theme_v1';

  var RANKS = [
    { id:'seedling', label:'Seedling', icon:'🌱', min:0,  max:4,  color:'#4caf7a', bg:'rgba(76,175,122,.15)',  border:'rgba(76,175,122,.3)'  },
    { id:'grower',   label:'Grower',   icon:'🌿', min:5,  max:14, color:'#54d1ff', bg:'rgba(84,209,255,.15)',  border:'rgba(84,209,255,.3)'  },
    { id:'weaver',   label:'Weaver',   icon:'🔮', min:15, max:29, color:'#9d64ff', bg:'rgba(157,100,255,.15)', border:'rgba(157,100,255,.3)' },
    { id:'elder',    label:'Elder',    icon:'⭐', min:30, max:999, color:'#f0c96a', bg:'rgba(240,201,106,.18)', border:'rgba(240,201,106,.4)' },
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

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function $(id){ return document.getElementById(id); }
  function toast(msg,dur){ var el=$('pikoProfileToast');if(!el)return;el.textContent=msg;el.classList.add('is-visible');clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('is-visible');},dur||3000); }
  function timeAgo(ts){ var s=Math.floor((Date.now()-ts)/1000);if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'; }
  function fmtPrice(c){ return '$'+(c/100).toFixed(2); }
  function loadJSON(k,def){ try{return JSON.parse(localStorage.getItem(k)||'null')||def;}catch(e){return def;} }
  function saveJSON(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
  function loadProfile(){ return loadJSON(PROFILE_KEY,null); }
  function saveProfile(p){ saveJSON(PROFILE_KEY,p); }
  function isLoggedIn(){ var p=loadProfile();return !!(p&&p.email); }

  function calcScore(profile){
    var ideas=getMyIdeas(profile).length;
    var approved=getMyProjects(profile).filter(function(p){return p.status==='approved';}).length;
    var orders=loadJSON('amp_orders_v1',[]).length;
    var badges=getEarnedBadgeIds(profile,ideas,approved,orders).length;
    return ideas*1+approved*3+orders*1+badges*2;
  }
  function getRank(score){ for(var i=RANKS.length-1;i>=0;i--){if(score>=RANKS[i].min)return RANKS[i];}return RANKS[0]; }

  function getEarnedBadgeIds(profile,ideas,approved,orders){
    var e=[];
    if(ideas>=1)e.push('first_idea');
    if(approved>=1)e.push('project_live');
    if(orders>=1)e.push('first_order');
    if(ideas>=5)e.push('idea_x5');
    if(profile&&profile.joined_ts&&Date.now()-profile.joined_ts<90*24*60*60*1000)e.push('early_member');
    var l=loadJSON(LEARN_KEY,{});if((l.culturalverse||[]).length>0||(l.digitalverse||[]).length>0)e.push('learner');
    if(profile&&profile.chronicle_sub)e.push('chronicle_sub');
    return e;
  }

  function getMyIdeas(profile){
    if(!profile||!profile.email)return[];
    return loadJSON('amp_admin_ideas',[]).filter(function(i){return i.contact&&i.contact.toLowerCase()===profile.email.toLowerCase();});
  }
  function getMyProjects(profile){
    if(!profile||!profile.email)return[];
    return loadJSON('amp_admin_projects_hub',[]).filter(function(p){return p.contact&&p.contact.toLowerCase()===profile.email.toLowerCase();});
  }

  function getNotifs(){ return loadJSON(NOTIF_KEY,[]); }
  function saveNotifs(n){ saveJSON(NOTIF_KEY,n); }
  function addNotif(icon,text){
    var n=getNotifs();n.unshift({id:Date.now().toString(36),icon:icon,text:text,ts:Date.now(),read:false});
    if(n.length>30)n.length=30;saveNotifs(n);updateNotifBadge();
  }
  function updateNotifBadge(){
    var n=getNotifs().filter(function(x){return !x.read;}).length;
    var b=$('pikoNotifBadge'),t=$('tabNotifCount');
    if(b){b.textContent=n;b.hidden=n===0;}
    if(t){t.textContent=n;t.style.display=n===0?'none':'';}
  }

  function getSaved(){ return loadJSON(SAVED_KEY,[]); }
  function saveSaved(s){ saveJSON(SAVED_KEY,s); }

  function loadTheme(){ return loadJSON(THEME_KEY,{}); }
  function applyTheme(t){
    var r=document.documentElement;
    if(t.accent)  r.style.setProperty('--pf-custom-accent',t.accent);
    if(t.bg)      r.style.setProperty('--pf-custom-bg',t.bg);
    if(t.bg2)     r.style.setProperty('--pf-custom-bg2',t.bg2);
    if(t.text)    r.style.setProperty('--pf-custom-text',t.text);
    if(t.glow)    r.style.setProperty('--pf-custom-glow',t.glow);
    if(t.cardBg)  r.style.setProperty('--pf-custom-card-bg',t.cardBg);
    if(t.cardBorder) r.style.setProperty('--pf-custom-card-border',t.cardBorder);
    if(t.font)    r.style.setProperty('--pf-custom-font',t.font);
    if(t.bgImage) document.body.style.background=t.bgImage;
    if(t.bannerBg){var bn=$('pikoBanner');if(bn)bn.style.background=t.bannerBg;}
    var st=$('pikoCustomStyle');if(st)st.textContent=t.css||'';
  }

  function checkMagicLink(){
    try{
      var params=new URLSearchParams(window.location.search),token=params.get('verify');if(!token)return;
      var url=new URL(window.location.href);url.searchParams.delete('verify');window.history.replaceState({},'',url.toString());
      var p=loadProfile();
      if(p&&p.pendingToken===token){p.verified=true;delete p.pendingToken;saveProfile(p);toast('✅ Verified! Welcome.');showProfile(p);}
    }catch(e){}
  }

  function showStatus(id,msg,type){var el=$(id);if(!el)return;el.textContent=msg;el.className='piko-auth-status piko-auth-status--'+(type||'info');el.hidden=false;}
  function showAuthGate(){
    $('pikoAuthGate').hidden=false;$('pikoProfileSection').hidden=true;
    var s=$('pikoSignOut');if(s)s.hidden=true;
    var t=$('pikoCustomizeTrigger');if(t)t.hidden=true;
    var nb=$('pikoNotifBtn');if(nb)nb.hidden=true;
  }
  function showProfile(profile){
    $('pikoAuthGate').hidden=true;$('pikoProfileSection').hidden=false;
    var s=$('pikoSignOut');if(s)s.hidden=false;
    var t=$('pikoCustomizeTrigger');if(t)t.hidden=false;
    var nb=$('pikoNotifBtn');if(nb)nb.hidden=false;
    renderAll(profile);
  }

  function renderAll(profile){
    renderHeader(profile);renderStats(profile);renderIdCard(profile);
    renderTimeline(profile);renderRank(profile);renderBadges(profile);
    renderPlatforms(profile);renderNotifications();renderSaved();
    renderOrders(profile);renderIdeas(profile);renderProjects(profile);
    renderLearning();updateNotifBadge();
  }

  function renderHeader(profile){
    var name=profile.display_name||profile.email||'Pikoverse Member';
    var els={name:$('pikoProfileName'),email:$('pikoProfileEmail'),bio:$('pikoProfileBio'),
      joined:$('pikoProfileJoined'),init:$('pikoProfileAvatarInitial'),img:$('pikoProfileAvatarImg'),
      social:$('pikoProfileSocial'),rank:$('pikoRankBadge')};
    if(els.name)els.name.textContent=name;
    if(els.email)els.email.textContent=profile.email||'';
    if(els.bio)els.bio.textContent=profile.bio||'';
    if(els.social){els.social.textContent=profile.social||'';els.social.hidden=!profile.social;}
    if(els.joined)els.joined.textContent='🌺 Joined '+(profile.joined_ts?new Date(profile.joined_ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently');
    if(els.init)els.init.textContent=name[0].toUpperCase();
    if(els.img&&profile.avatar_url){els.img.src=profile.avatar_url;els.img.hidden=false;if(els.init)els.init.style.display='none';els.img.onerror=function(){els.img.hidden=true;if(els.init)els.init.style.display='';};}
    var score=calcScore(profile),rank=getRank(score);
    if(els.rank){els.rank.textContent=rank.icon+' '+rank.label;els.rank.style.cssText='--rank-color:'+rank.color+';--rank-bg:'+rank.bg+';--rank-border:'+rank.border;}
    var badgesEl=$('pikoProfileBadges');if(!badgesEl)return;
    var ideas=getMyIdeas(profile).length,approved=getMyProjects(profile).filter(function(p){return p.status==='approved';}).length,orders=loadJSON('amp_orders_v1',[]).length;
    var earned=getEarnedBadgeIds(profile,ideas,approved,orders);
    var chips=['<span class="piko-profile-badge piko-profile-badge--member"><i class="fas fa-star"></i> Pikoverse Member</span>',
               '<span class="piko-profile-badge piko-profile-badge--joined">🌺 Joined '+(profile.joined_ts?new Date(profile.joined_ts).toLocaleDateString('en-US',{month:'long',year:'numeric'}):'recently')+'</span>'];
    BADGE_DEFS.forEach(function(b){if(earned.includes(b.id))chips.push('<span class="piko-profile-badge piko-profile-badge--earned">'+b.icon+' '+b.name+'</span>');});
    badgesEl.innerHTML=chips.join('');
  }

  function renderStats(profile){
    var ideas=getMyIdeas(profile).length,projects=getMyProjects(profile).length,score=calcScore(profile);
    var earned=getEarnedBadgeIds(profile,ideas,getMyProjects(profile).filter(function(p){return p.status==='approved';}).length,loadJSON('amp_orders_v1',[]).length).length;
    var n=$('statIdeas');if(n)n.textContent=ideas;
    var p=$('statProjects');if(p)p.textContent=projects;
    var s=$('statScore');if(s)s.textContent=score;
    var b=$('statBadges');if(b)b.textContent=earned;
  }

  function renderIdCard(profile){
    var name=profile.display_name||profile.email||'Member',score=calcScore(profile),rank=getRank(score);
    var a=$('pikoIdCardAvatar'),n=$('pikoIdCardName'),m=$('pikoIdCardMeta'),s=$('pikoIdCardScore');
    if(a){if(profile.avatar_url)a.innerHTML='<img src="'+esc(profile.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';else a.textContent=name[0].toUpperCase();}
    if(n)n.textContent=name;
    if(m)m.textContent=rank.icon+' '+rank.label+' · Pikoverse Member';
    if(s)s.textContent='Score: '+score+' pts';
  }

  function renderTimeline(profile){
    var el=$('pikoTimeline');if(!el)return;
    var items=[];
    getMyIdeas(profile).forEach(function(i){items.push({type:'idea',text:'Shared idea: "'+i.text.slice(0,70)+(i.text.length>70?'…':'')+'"',ts:i.ts||Date.now(),status:i.reply?'replied':'pending'});});
    getMyProjects(profile).forEach(function(p){items.push({type:'project',text:'Submitted project: "'+esc(p.name)+'"',ts:p.ts||Date.now(),status:p.status||'pending'});});
    loadJSON('amp_orders_v1',[]).forEach(function(o){items.push({type:'order',text:'Placed order '+esc(o.id)+' — '+fmtPrice(o.total),ts:o.ts||Date.now()});});
    var earned=getEarnedBadgeIds(profile,getMyIdeas(profile).length,getMyProjects(profile).filter(function(p){return p.status==='approved';}).length,loadJSON('amp_orders_v1',[]).length);
    earned.forEach(function(bid){var d=BADGE_DEFS.find(function(b){return b.id===bid;});if(d)items.push({type:'badge',text:'Earned badge: '+d.icon+' '+d.name,ts:profile.joined_ts||Date.now()});});
    items.sort(function(a,b){return (b.ts||0)-(a.ts||0);});
    if(!items.length){el.innerHTML='<p class="piko-profile-empty">Your timeline will fill as you engage with the community.</p>';return;}
    var icons={idea:'fa-lightbulb',project:'fa-rocket',comment:'fa-comment',order:'fa-bag-shopping',badge:'fa-medal'};
    el.innerHTML=items.slice(0,20).map(function(item){
      var sh='';
      if(item.status){var cls=item.status==='approved'?'approved':item.status==='replied'?'replied':'pending';var lbl=item.status==='approved'?'✓ Approved':item.status==='replied'?'⭐ Replied':'⏳ Pending';sh='<span class="piko-timeline-status piko-timeline-status--'+cls+'">'+lbl+'</span>';}
      return '<div class="piko-timeline-item"><div class="piko-timeline-dot piko-timeline-dot--'+item.type+'"><i class="fas '+(icons[item.type]||'fa-bolt')+'"></i></div><div class="piko-timeline-text">'+esc(item.text)+'<div class="piko-timeline-meta">'+timeAgo(item.ts)+'&ensp;'+sh+'</div></div></div>';
    }).join('');
  }

  function renderRank(profile){
    var score=calcScore(profile),rank=getRank(score),next=RANKS.find(function(r){return r.min>score;});
    var fill=next?Math.round((score-rank.min)/(next.min-rank.min)*100):100;
    var ic=$('rankIcon'),lb=$('rankLabel'),sb=$('rankSub'),br=$('rankBarFill'),nx=$('rankNext');
    if(ic)ic.textContent=rank.icon;if(lb)lb.textContent=rank.label;
    if(sb)sb.textContent=next?'Keep contributing to reach '+next.label:'Maximum rank achieved! 🎉';
    if(br)br.style.width=fill+'%';
    if(nx)nx.textContent=next?score+' / '+next.min+' points to '+next.label:'Elder — Top rank!';
  }

  function renderBadges(profile){
    var grid=$('pikoBadgesGrid');if(!grid)return;
    var ideas=getMyIdeas(profile).length,approved=getMyProjects(profile).filter(function(p){return p.status==='approved';}).length,orders=loadJSON('amp_orders_v1',[]).length;
    var earned=getEarnedBadgeIds(profile,ideas,approved,orders);
    grid.innerHTML=BADGE_DEFS.map(function(b){
      var has=earned.includes(b.id);
      return '<div class="piko-badge-card'+(has?' is-earned':'')+'"><div class="piko-badge-icon">'+b.icon+'</div><div class="piko-badge-name">'+esc(b.name)+'</div><div class="piko-badge-desc">'+esc(b.desc)+'</div></div>';
    }).join('');
  }

  function renderPlatforms(profile){
    var grid=$('pikoPlatformsGrid');if(!grid)return;
    var learn=loadJSON(LEARN_KEY,{});
    var platforms=[
      {icon:'⚛',name:'Ikeverse',status:'Active',link:'https://ikeverse.pikoverse.xyz/',progress:Math.min(100,(learn.culturalverse||[]).length*12),stat:(learn.culturalverse||[]).length+' modules done'},
      {icon:'⚡',name:'DigitalVerse',status:'Active',link:'digitalverse/index.html',progress:Math.min(100,(learn.digitalverse||[]).length*10),stat:(learn.digitalverse||[]).length+' modules done'},
      {icon:'📜',name:'Chronicle',status:'Live',link:'chronicle/index.html',progress:0,stat:'Subscribe for drops'},
      {icon:'🛍️',name:'AMP Marketplace',status:'Live',link:'marketplace/marketplace.html',progress:Math.min(100,loadJSON('amp_orders_v1',[]).length*20),stat:loadJSON('amp_orders_v1',[]).length+' orders'},
      {icon:'🌐',name:'Community Board',status:'Active',link:'index.html#ideas',progress:Math.min(100,getMyIdeas(profile).length*10),stat:getMyIdeas(profile).length+' ideas shared'},
      {icon:'🚀',name:'Showcase',status:'Active',link:'index.html#showcase',progress:Math.min(100,getMyProjects(profile).length*25),stat:getMyProjects(profile).length+' projects'},
    ];
    grid.innerHTML=platforms.map(function(p){
      return '<div class="piko-platform-card"><div class="piko-platform-card-header"><div class="piko-platform-icon">'+p.icon+'</div><div><div class="piko-platform-name">'+esc(p.name)+'</div><div class="piko-platform-status"><span class="piko-platform-status-dot"></span>'+esc(p.status)+'</div></div></div><div class="piko-platform-progress"><div class="piko-platform-progress-fill" style="width:'+p.progress+'%"></div></div><div class="piko-platform-stat">'+esc(p.stat)+'</div><a href="'+esc(p.link)+'" class="piko-platform-link">Open <i class="fas fa-arrow-right"></i></a></div>';
    }).join('');
  }

  function renderNotifications(){
    var list=$('pikoNotifList');if(!list)return;
    var notifs=getNotifs();
    if(!notifs.length){list.innerHTML='<p class="piko-profile-empty">No notifications yet.</p>';return;}
    list.innerHTML=notifs.map(function(n){
      return '<div class="piko-notif-item'+(n.read?'':' is-unread')+'" data-id="'+esc(n.id)+'"><div class="piko-notif-icon">'+esc(n.icon)+'</div><div class="piko-notif-text">'+esc(n.text)+'</div><div class="piko-notif-time">'+timeAgo(n.ts)+'</div></div>';
    }).join('');
    list.querySelectorAll('.piko-notif-item').forEach(function(el){
      el.addEventListener('click',function(){var id=el.dataset.id;var n=getNotifs();n.forEach(function(x){if(x.id===id)x.read=true;});saveNotifs(n);renderNotifications();updateNotifBadge();});
    });
  }

  function renderSaved(){
    var grid=$('pikoSavedGrid');if(!grid)return;
    var saved=getSaved();
    if(!saved.length){grid.innerHTML='<p class="piko-profile-empty" style="grid-column:1/-1">Bookmark Chronicle articles, ecosystem cards, and marketplace items here.</p>';return;}
    grid.innerHTML=saved.map(function(item,i){
      return '<div class="piko-saved-card"><div class="piko-saved-icon">'+esc(item.icon||'📌')+'</div><div style="flex:1"><div class="piko-saved-title">'+esc(item.title)+'</div><div class="piko-saved-meta">'+esc(item.meta||'')+'</div></div><button class="piko-saved-remove" data-i="'+i+'" type="button"><i class="fas fa-xmark"></i></button></div>';
    }).join('');
    grid.querySelectorAll('.piko-saved-remove').forEach(function(btn){
      btn.addEventListener('click',function(e){e.stopPropagation();var s=getSaved();s.splice(+btn.dataset.i,1);saveSaved(s);renderSaved();toast('Removed from saved');});
    });
  }

  function renderOrders(profile){
    var list=$('pikoProfileOrdersList');if(!list)return;
    var orders=loadJSON('amp_orders_v1',[]);
    if(!orders.length){list.innerHTML='<p class="piko-profile-empty">No orders yet. <a href="marketplace/marketplace.html" style="color:#f0c96a">Visit the AMP Marketplace →</a></p>';return;}
    list.innerHTML=orders.map(function(o){
      var sc=o.status==='confirmed'?'confirmed':'pending',sl=(o.status||'pending').replace(/_/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
      var it=(o.items||[]).map(function(i){return i.name+(i.size?' ('+i.size+')':'')+' ×'+i.qty;}).join(', ');
      return '<div class="piko-order-card"><div class="piko-order-card-header"><span class="piko-order-id">'+esc(o.id)+'</span><span class="piko-order-status piko-order-status--'+sc+'">'+esc(sl)+'</span></div><div class="piko-order-items">'+esc(it)+'</div><div class="piko-order-total">'+fmtPrice(o.total)+' · '+(o.ts?new Date(o.ts).toLocaleDateString():'')+'</div></div>';
    }).join('');
  }

  function renderIdeas(profile){
    var list=$('pikoProfileIdeasList');if(!list)return;
    var ideas=getMyIdeas(profile);
    if(!ideas.length){list.innerHTML='<p class="piko-profile-empty">No ideas shared yet.</p>';return;}
    list.innerHTML=ideas.map(function(i){
      return '<div class="piko-profile-idea-card">'+esc(i.text)+'<div class="piko-profile-idea-meta"><span>'+esc(i.category||'Idea')+'</span><span>'+timeAgo(i.ts||Date.now())+'</span>'+(i.reply?'<span style="color:#f0c96a">⭐ AMP replied</span>':'')+'</div></div>';
    }).join('');
  }

  function renderProjects(profile){
    var grid=$('pikoProfileProjectsGrid');if(!grid)return;
    var projects=getMyProjects(profile);
    if(!projects.length){grid.innerHTML='<p class="piko-profile-empty">No projects submitted yet.</p>';return;}
    var sc={idea:'#f0c96a',building:'#54d1ff',live:'#4caf7a'};
    grid.innerHTML=projects.map(function(p){
      var col=sc[p.stage]||'#f0c96a';
      return '<div class="ecosystem-project-card" style="background:rgba(255,255,255,.03)"><div class="epc-header"><span class="epc-name">'+esc(p.name)+'</span><span class="epc-stage" style="background:'+col+'22;color:'+col+'">'+esc(p.stage||'idea')+'</span></div><p class="epc-desc">'+esc(p.desc)+'</p><div class="piko-profile-idea-meta"><span style="color:'+(p.status==='approved'?'#4caf7a':'#ffb347')+'">'+(p.status==='approved'?'✓ On Showcase':'⏳ Pending Review')+'</span></div></div>';
    }).join('');
  }

  var CV=['Hawaiian History','Pacific Islanders','Indigenous Knowledge','Cultural Connections','Oral Traditions','Ancestral Navigation','Language & Identity','Modern Sovereignty'];
  var DV=['Bitcoin Fundamentals','Ethereum & Smart Contracts','XRPL Deep Dive','Flare & Songbird','DeFi & AMMs','Web3 Security','Scam Field Guide','Protocol Comparison','Blockchain Forensics Intro','NaluLF Workflow'];

  function renderLearning(){var l=loadJSON(LEARN_KEY,{});renderTrack('culturalverse',CV,l.culturalverse||[]);renderTrack('digitalverse',DV,l.digitalverse||[]);}
  function renderTrack(id,modules,completed){
    var pEl=$(id+'Progress'),mEl=$(id+'Modules');if(!mEl)return;
    var pct=modules.length?Math.round(completed.length/modules.length*100):0;
    if(pEl)pEl.style.width=pct+'%';
    mEl.innerHTML=modules.map(function(m){var done=completed.includes(m);return '<button class="piko-learn-module piko-learn-module--'+(done?'done':'todo')+'" data-track="'+id+'" data-module="'+esc(m)+'" type="button"><i class="fas fa-'+(done?'circle-check':'circle')+'"></i> '+esc(m)+'</button>';}).join('');
    mEl.querySelectorAll('.piko-learn-module').forEach(function(btn){
      btn.addEventListener('click',function(){
        var l=loadJSON(LEARN_KEY,{}),list=l[id]||[],idx=list.indexOf(btn.dataset.module);
        if(idx>-1)list.splice(idx,1);else list.push(btn.dataset.module);
        l[id]=list;saveJSON(LEARN_KEY,l);
        renderTrack(id,id==='culturalverse'?CV:DV,list);
        toast(idx>-1?btn.dataset.module+' marked incomplete':'✅ '+btn.dataset.module+' complete!');
        if(idx===-1)addNotif('🎓','Learning: '+btn.dataset.module+' completed!');
      });
    });
  }

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

  function initSignup(){
    var btn=$('pikoSignupBtn');if(!btn)return;
    btn.addEventListener('click',function(){
      var name=(($('signupName')||{}).value||'').trim(),email=(($('signupEmail')||{}).value||'').trim();
      if(!email||!email.includes('@')){showStatus('pikoSignupStatus','Please enter a valid email.','err');return;}
      btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Creating…';
      var ts=Date.now(),profile={email:email,display_name:name||email.split('@')[0],bio:'',avatar_url:'',social:'',joined_ts:ts,verified:false,pendingToken:'local-'+Math.random().toString(36).slice(2)};
      var done=function(){profile.verified=true;saveProfile(profile);showStatus('pikoSignupStatus','✅ Profile created!','ok');addNotif('🌺','Welcome to Pikoverse, '+profile.display_name+'!');setTimeout(function(){showProfile(profile);},1200);btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';};
      if(WORKER_URL){fetch(WORKER_URL+'/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,displayName:name,joinedTs:ts})}).then(function(r){return r.json();}).then(function(d){if(d.ok){saveProfile(profile);showStatus('pikoSignupStatus','✅ Check your email!','ok');}else throw 0;}).catch(done).finally(function(){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> Create My Profile';});}
      else done();
    });
  }

  function initSignin(){
    var btn=$('pikoSigninBtn');if(!btn)return;
    btn.addEventListener('click',function(){
      var email=(($('signinEmail')||{}).value||'').trim();
      if(!email||!email.includes('@')){showStatus('pikoSigninStatus','Please enter your email.','err');return;}
      var local=loadProfile();
      if(local&&local.email&&local.email.toLowerCase()===email.toLowerCase()){showStatus('pikoSigninStatus','✅ Welcome back!','ok');setTimeout(function(){showProfile(local);},800);return;}
      btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Sending…';
      if(WORKER_URL){fetch(WORKER_URL+'/api/members',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email})}).then(function(r){return r.json();}).then(function(d){if(d.ok){saveProfile({email:email,verified:false});showStatus('pikoSigninStatus','✅ Check your email!','ok');}}).catch(function(){showStatus('pikoSigninStatus','Could not reach server.','err');}).finally(function(){btn.disabled=false;btn.innerHTML='<i class="fas fa-envelope"></i> Send Sign-In Link';});}
      else{showStatus('pikoSigninStatus','No account found. Create a profile first.','err');btn.disabled=false;btn.innerHTML='<i class="fas fa-envelope"></i> Send Sign-In Link';}
    });
  }

  function initSignOut(){var btn=$('pikoSignOut');if(!btn)return;btn.addEventListener('click',function(){localStorage.removeItem(PROFILE_KEY);showAuthGate();toast('Signed out.');});}

  function initEditProfile(){
    var editBtn=$('pikoEditProfileBtn'),cancelBtn=$('pikoCancelEditBtn'),saveBtn=$('pikoSaveProfileBtn'),form=$('pikoProfileEditForm'),avatarBtn=$('pikoAvatarEditBtn'),avatarFile=$('pikoAvatarFile'),bannerBtn=$('pikoBannerEditBtn'),bannerFile=$('pikoBannerFile');
    if(editBtn)editBtn.addEventListener('click',function(){var p=loadProfile()||{};($('editName')||{}).value=p.display_name||'';($('editBio')||{}).value=p.bio||'';($('editAvatarUrl')||{}).value=p.avatar_url||'';($('editSocial')||{}).value=p.social||'';if(form)form.hidden=false;});
    if(cancelBtn)cancelBtn.addEventListener('click',function(){if(form)form.hidden=true;});
    if(saveBtn)saveBtn.addEventListener('click',function(){var p=loadProfile()||{};var name=(($('editName')||{}).value||'').trim();p.display_name=name||p.display_name;p.bio=(($('editBio')||{}).value||'').trim();p.avatar_url=(($('editAvatarUrl')||{}).value||'').trim();p.social=(($('editSocial')||{}).value||'').trim();saveProfile(p);renderAll(p);if(form)form.hidden=true;toast('✅ Profile updated!');});
    if(avatarBtn&&avatarFile){avatarBtn.addEventListener('click',function(){avatarFile.click();});avatarFile.addEventListener('change',function(){var f=avatarFile.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){var p=loadProfile()||{};p.avatar_url=e.target.result;saveProfile(p);renderAll(p);toast('✅ Avatar updated!');};r.readAsDataURL(f);});}
    if(bannerBtn&&bannerFile){bannerBtn.addEventListener('click',function(){bannerFile.click();});bannerFile.addEventListener('change',function(){var f=bannerFile.files[0];if(!f)return;var r=new FileReader();r.onload=function(e){var bn=$('pikoBanner');if(bn)bn.style.background='url('+e.target.result+') center/cover no-repeat';var t=loadTheme();t.bannerBg='url('+e.target.result+') center/cover no-repeat';saveJSON(THEME_KEY,t);toast('✅ Banner updated!');};r.readAsDataURL(f);});}
  }

  function initShareCard(){var btn=$('pikoShareCardBtn');if(!btn)return;btn.addEventListener('click',function(){var p=loadProfile()||{};var name=p.display_name||p.email||'Member';var score=calcScore(p);var rank=getRank(score);var text='🌺 I\'m a '+rank.label+' on Pikoverse! Score: '+score+' pts — pikoverse.xyz/profile.html';if(navigator.share)navigator.share({title:'My Pikoverse ID',text:text,url:'https://pikoverse.xyz/profile.html'}).catch(function(){});else{navigator.clipboard&&navigator.clipboard.writeText(text);toast('✅ Copied to clipboard!');}});}

  function initNotifBell(){
    var btn=$('pikoNotifBtn');if(!btn)return;
    btn.addEventListener('click',function(){
      document.querySelectorAll('.piko-profile-tab').forEach(function(b){b.classList.remove('is-active');});
      document.querySelectorAll('.piko-profile-pane').forEach(function(p){p.classList.remove('is-active');});
      var tab=document.querySelector('[data-ptab="notifications"]'),pane=$('pikoProfilePaneNotifications');
      if(tab)tab.classList.add('is-active');if(pane){pane.classList.add('is-active');pane.scrollIntoView({behavior:'smooth',block:'start'});}
    });
    var ma=$('pikoMarkAllRead');if(!ma)return;
    ma.addEventListener('click',function(){var n=getNotifs();n.forEach(function(x){x.read=true;});saveNotifs(n);renderNotifications();updateNotifBadge();toast('All read');});
  }

  function initCustomize(){
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

    var apply=$('pikoApplyCustomize');if(apply)apply.addEventListener('click',function(){
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
      saveJSON(THEME_KEY,t);applyTheme(t);if(panel)panel.classList.remove('is-open');toast('✅ Profile customized!');
    });

    var reset=$('pikoResetCustomize');if(reset)reset.addEventListener('click',function(){
      localStorage.removeItem(THEME_KEY);document.documentElement.removeAttribute('style');document.body.removeAttribute('style');
      var bn=$('pikoBanner');if(bn)bn.removeAttribute('style');var st=$('pikoCustomStyle');if(st)st.textContent='';
      toast('Theme reset');if(panel)panel.classList.remove('is-open');
    });
  }

  function initLinks(){
    var ib=$('pikoSubmitIdeaBtn');if(ib)ib.addEventListener('click',function(){window.location.href='index.html#ideas';});
    var pb=$('pikoSubmitProjectBtn');if(pb)pb.addEventListener('click',function(){window.location.href='index.html#showcase';});
  }

  function init(){
    var saved=loadTheme();if(Object.keys(saved).length)applyTheme(saved);
    initAuthTabs();initProfileTabs();initSignup();initSignin();initSignOut();
    initEditProfile();initShareCard();initNotifBell();initCustomize();initLinks();
    checkMagicLink();
    if(isLoggedIn())showProfile(loadProfile());else showAuthGate();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();