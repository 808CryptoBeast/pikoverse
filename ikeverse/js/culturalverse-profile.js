/* ═══════════════════════════════════════════════════════════
   culturalverse-profile.js
   Connects Culturalverse learning progress to the Pikoverse
   Supabase profile. Syncs completions & mana across devices.

   Load order (in HTML):
     1. supabase cdn
     2. supabase-client.js  (fires piko:supa:ready)
     3. culturalverse-data.js
     4. culturalverse.js
     5. culturalverse-lessons.js  (dispatches cv:lessonToggle)
     6. THIS FILE  ← listens for both events

   Supabase storage: profiles.theme JSONB
     _cvCompleted : string[]  — lesson IDs
     _cvMana      : number    — total mana earned
     _cvAchievements: string[] — earned achievement IDs
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Config ── */
  const SUPA_KEY    = { completed: '_cvCompleted', mana: '_cvMana', ach: '_cvAchievements' };
  const LOCAL_KEY   = { completed: 'cv_completed', mana: 'cv_mana' };

  /* ── Achievements definition ── */
  const ACHIEVEMENTS = [
    { id: 'first-step',    label: 'First Step',       icon: '🌱', desc: 'Complete your first lesson.',            check: (c) => c.length >= 1 },
    { id: 'curious-mind',  label: 'Curious Mind',     icon: '🔍', desc: 'Complete 5 lessons.',                   check: (c) => c.length >= 5 },
    { id: 'deep-reader',   label: 'Deep Reader',      icon: '📖', desc: 'Complete 10 lessons.',                  check: (c) => c.length >= 10 },
    { id: 'kanaka-scholar',label: 'Kānaka Scholar',   icon: '🌺', desc: 'Complete all Kānaka Maoli lessons.',
      check: (c) => ['km-kumulipo','km-wakea','km-starcompass','km-hokuleaa','km-ahupuaa','km-loikalo','km-olelo','km-hula'].every(id => c.includes(id)) },
    { id: 'kemet-scholar', label: 'Kemetic Scholar',  icon: '☥',  desc: 'Complete all Kemet lessons.',
      check: (c) => ['ke-nun','ke-ennead','ke-ptah','ke-maat','ke-maat-politics','ke-medunetjer','ke-medicine'].every(id => c.includes(id)) },
    { id: 'bridge-walker', label: 'Bridge Walker',    icon: '🌐', desc: 'Complete all Bridge lessons.',
      check: (c) => ['bridge-darkness','bridge-pairs','bridge-pono-maat'].every(id => c.includes(id)) },
    { id: 'weaver',        label: 'Knowledge Weaver', icon: '✦',  desc: 'Complete all available lessons.',       check: (c) => c.length >= 18 },
  ];

  /* ── State ── */
  let _supa     = null;
  let _userId   = null;
  let _user     = null;
  let _earned   = [];

  /* ── Local helpers ── */
  function getLocal() {
    return {
      completed: JSON.parse(localStorage.getItem(LOCAL_KEY.completed) || '[]'),
      mana:      parseInt(localStorage.getItem(LOCAL_KEY.mana) || '0', 10)
    };
  }

  function setLocal(completed, mana) {
    localStorage.setItem(LOCAL_KEY.completed, JSON.stringify(completed));
    localStorage.setItem(LOCAL_KEY.mana, String(mana));
  }

  /* ── Mana level label ── */
  function levelLabel(mana) {
    if (mana < 30)  return 'Cultural Learner · Beginner';
    if (mana < 80)  return 'Cultural Learner · Apprentice';
    if (mana < 150) return 'Cultural Scholar';
    if (mana < 250) return 'Cultural Elder';
    return 'Knowledge Weaver';
  }

  /* ── Check & announce new achievements ── */
  function checkAchievements(completed) {
    const newlyEarned = [];
    ACHIEVEMENTS.forEach(a => {
      if (!_earned.includes(a.id) && a.check(completed)) {
        _earned.push(a.id);
        newlyEarned.push(a);
      }
    });
    newlyEarned.forEach(a => showAchievementToast(a));
    return newlyEarned.length > 0;
  }

  /* ── Toast notification for achievement ── */
  function showAchievementToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'cv-achievement-toast';
    toast.innerHTML = `
      <span class="cv-ach-toast-icon">${achievement.icon}</span>
      <div>
        <strong>Achievement Unlocked</strong>
        <span>${achievement.label}</span>
      </div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  /* ── Update profile panel UI ── */
  function updateProfilePanel(completed, mana) {
    const { length } = completed;
    const pct = Math.min((mana % 100) || (mana > 0 ? 100 : 0), 100);

    /* Stats */
    const countEl = document.getElementById('completedCount');
    if (countEl) countEl.textContent = length;

    const manaEl = document.getElementById('manaDisplay');
    if (manaEl) manaEl.textContent = `${mana} Mana`;

    const fillEl = document.getElementById('manaFill');
    if (fillEl) fillEl.style.width = pct + '%';

    /* User info */
    if (_user) {
      const displayName = (_user.user_metadata && _user.user_metadata.display_name)
        || _user.email.split('@')[0];
      const avatarUrl = _user.user_metadata && _user.user_metadata.avatar_url;

      const nameEl = document.querySelector('.cv-profile__name');
      if (nameEl) nameEl.textContent = 'Aloha, ' + displayName;

      const levelEl = document.querySelector('.cv-profile__level');
      if (levelEl) levelEl.textContent = levelLabel(mana);

      const avatarEl = document.querySelector('.cv-profile__avatar');
      if (avatarEl && avatarUrl) {
        avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}"
          style="width:48px;height:48px;border-radius:50%;object-fit:cover;
                 border:2px solid rgba(60,179,113,.4);"
          onerror="this.outerHTML='<i class=\\'fas fa-circle-user\\'></i>'">`;
      }

      /* Nav profile button */
      const navBtn = document.getElementById('cvProfileToggle');
      if (navBtn) {
        const spanEl = navBtn.querySelector('span');
        if (spanEl) spanEl.textContent = displayName.split(' ')[0];

        /* Turn button into a proper link if it isn't already */
        if (navBtn.tagName === 'BUTTON') {
          navBtn.style.cursor = 'pointer';
          navBtn.title = 'Open Pikoverse Profile';
          navBtn.onclick = () => window.open('https://pikoverse.xyz/profile.html', '_blank');
        }
        navBtn.classList.add('is-signed-in');
      }

      /* Hide sign-in prompt */
      const signInBox = document.getElementById('cvProfileSignIn');
      if (signInBox) signInBox.style.display = 'none';

      /* Show pikoverse profile link */
      const pikoLink = document.getElementById('cvPikoProfileLink');
      if (pikoLink) pikoLink.style.display = 'flex';
    }

    /* Achievements */
    renderAchievements(completed);
  }

  /* ── Render achievements list in panel ── */
  function renderAchievements(completed) {
    const container = document.getElementById('cvAchievementsList');
    if (!container) return;

    container.innerHTML = ACHIEVEMENTS.map(a => {
      const earned = a.check(completed);
      return `<div class="cv-ach-item ${earned ? 'is-earned' : ''}">
        <span class="cv-ach-icon">${a.icon}</span>
        <div>
          <strong>${a.label}</strong>
          <small>${a.desc}</small>
        </div>
        ${earned ? '<span class="cv-ach-check">✓</span>' : ''}
      </div>`;
    }).join('');
  }

  /* ── Load from Supabase ── */
  async function loadFromSupa(userId) {
    if (!_supa || !userId) return null;
    try {
      const { data, error } = await _supa
        .from('profiles').select('theme').eq('id', userId).single();
      if (error || !data) return null;
      const t = data.theme || {};
      return {
        completed: Array.isArray(t[SUPA_KEY.completed]) ? t[SUPA_KEY.completed] : null,
        mana:      typeof t[SUPA_KEY.mana] === 'number'  ? t[SUPA_KEY.mana]      : null,
        earned:    Array.isArray(t[SUPA_KEY.ach])        ? t[SUPA_KEY.ach]        : []
      };
    } catch (e) {
      console.warn('[CV Profile] load error:', e);
      return null;
    }
  }

  /* ── Save to Supabase ── */
  async function saveToSupa(completed, mana) {
    if (!_supa || !_userId) return;
    try {
      const { data } = await _supa
        .from('profiles').select('theme').eq('id', _userId).single();
      const theme = { ...(data?.theme || {}),
        [SUPA_KEY.completed]: completed,
        [SUPA_KEY.mana]:      mana,
        [SUPA_KEY.ach]:       _earned
      };
      await _supa.from('profiles')
        .update({ theme, updated_at: new Date().toISOString() })
        .eq('id', _userId);
    } catch (e) {
      console.warn('[CV Profile] save error:', e);
    }
  }

  /* ── Merge local + remote (union of lessons, max mana) ── */
  async function syncProgress() {
    const local  = getLocal();
    const remote = await loadFromSupa(_userId);

    let completed = local.completed;
    let mana      = local.mana;

    if (remote) {
      if (remote.completed) {
        completed = [...new Set([...local.completed, ...remote.completed])];
      }
      if (remote.mana !== null) mana = Math.max(local.mana, remote.mana);
      if (remote.earned)        _earned = [...new Set([..._earned, ...remote.earned])];
    }

    /* Persist merged state */
    setLocal(completed, mana);
    checkAchievements(completed);
    await saveToSupa(completed, mana);
    return { completed, mana };
  }

  /* ── Listen for lesson completion events from culturalverse-lessons.js ── */
  document.addEventListener('cv:lessonToggle', async (e) => {
    const { completed, mana } = e.detail;
    checkAchievements(completed);
    updateProfilePanel(completed, mana);
    if (_userId) await saveToSupa(completed, mana);
  });

  /* ── Supabase ready ── */
  window.addEventListener('piko:supa:ready', async (e) => {
    if (e.detail.offline) return;
    _supa = window.piko_supa;
    if (!_supa) return;

    try {
      const { data } = await _supa.auth.getSession();
      if (!data?.session?.user) return;

      _user   = data.session.user;
      _userId = _user.id;

      const { completed, mana } = await syncProgress();
      updateProfilePanel(completed, mana);
    } catch (err) {
      console.warn('[CV Profile] init error:', err);
    }
  });

  /* ── On DOM ready: show local data immediately ── */
  document.addEventListener('DOMContentLoaded', () => {
    const { completed, mana } = getLocal();
    updateProfilePanel(completed, mana);
    checkAchievements(completed);
  });

})();