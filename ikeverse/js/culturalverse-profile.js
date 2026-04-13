/* ═══════════════════════════════════════════════════════════
   culturalverse-profile.js
   - Sign in / sign out with Pikoverse Supabase account
   - Syncs lesson completions, mana, and achievements
   - Avatar matches Pikoverse profile automatically
   Works on culturalverse.html AND culturalverse-lessons.html

   Supabase keys (profiles.theme JSONB — matches lessons.js):
     _cvLessons   : string[]  — completed lesson IDs
     _cvMana      : number    — total mana earned
     _cvLastSync  : string    — ISO timestamp
     _cvAchievements: string[]
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SUPA  = { lessons: '_cvLessons', mana: '_cvMana', sync: '_cvLastSync', ach: '_cvAchievements' };
  const LOCAL = { completed: 'cv_completed', mana: 'cv_mana' };

  const ACHIEVEMENTS = [
    { id: 'first-step',     label: 'First Step',       icon: '🌱',
      desc: 'Complete your first lesson.',          check: c => c.length >= 1 },
    { id: 'curious-mind',   label: 'Curious Mind',     icon: '🔍',
      desc: 'Complete 5 lessons.',                  check: c => c.length >= 5 },
    { id: 'deep-reader',    label: 'Deep Reader',      icon: '📖',
      desc: 'Complete 10 lessons.',                 check: c => c.length >= 10 },
    { id: 'kanaka-scholar', label: 'Kānaka Scholar',   icon: '🌺',
      desc: 'Complete all Kānaka Maoli lessons.',
      check: c => ['km-kumulipo','km-wakea','km-starcompass','km-hokuleaa',
                   'km-ahupuaa','km-loikalo','km-olelo','km-hula'].every(id => c.includes(id)) },
    { id: 'kemet-scholar',  label: 'Kemetic Scholar',  icon: '☥',
      desc: 'Complete all Kemet lessons.',
      check: c => ['ke-nun','ke-ennead','ke-ptah','ke-maat',
                   'ke-maat-politics','ke-medunetjer','ke-medicine'].every(id => c.includes(id)) },
    { id: 'bridge-walker',  label: 'Bridge Walker',    icon: '🌐',
      desc: 'Complete all Bridge lessons.',
      check: c => ['bridge-darkness','bridge-pairs','bridge-pono-maat'].every(id => c.includes(id)) },
    { id: 'weaver',         label: 'Knowledge Weaver', icon: '✦',
      desc: 'Complete all available lessons.',      check: c => c.length >= 18 },
  ];

  let _supa = null, _userId = null, _user = null, _earned = [];

  /* ── Local helpers ── */
  const getLocal = () => ({
    completed: JSON.parse(localStorage.getItem(LOCAL.completed) || '[]'),
    mana: parseInt(localStorage.getItem(LOCAL.mana) || '0', 10)
  });
  const setLocal = (c, m) => {
    localStorage.setItem(LOCAL.completed, JSON.stringify(c));
    localStorage.setItem(LOCAL.mana, String(m));
  };
  const levelLabel = mana =>
    mana < 30  ? 'Cultural Learner · Beginner'  :
    mana < 80  ? 'Cultural Learner · Apprentice' :
    mana < 150 ? 'Cultural Scholar'              :
    mana < 250 ? 'Cultural Elder'                : 'Knowledge Weaver';

  /* ── Show signed-in vs signed-out panels ── */
  function showSignedIn() {
    const i = document.getElementById('cvProfileSignedIn');
    const o = document.getElementById('cvProfileSignedOut');
    if (i) i.style.display = '';
    if (o) o.style.display = 'none';
  }
  function showSignedOut() {
    const i = document.getElementById('cvProfileSignedIn');
    const o = document.getElementById('cvProfileSignedOut');
    if (i) i.style.display = 'none';
    if (o) o.style.display = '';
    // Reset nav pill
    const navName = document.getElementById('cvNavProfileName');
    const navImg  = document.getElementById('cvNavAvatarSmall');
    const navIcon = document.getElementById('cvNavProfileIcon');
    const navBtn  = document.getElementById('cvProfileToggle');
    if (navName) navName.textContent = 'Profile';
    if (navImg)  { navImg.style.display = 'none'; navImg.src = ''; }
    if (navIcon) navIcon.style.display = '';
    if (navBtn)  navBtn.classList.remove('is-signed-in');
  }

  /* ── Populate signed-in panel ── */
  function populateUserUI(completed, mana) {
    if (!_user) return;
    const displayName = _user.user_metadata?.display_name || _user.email.split('@')[0];
    const avatarUrl   = _user.user_metadata?.avatar_url || '';

    // Name + level
    const nameEl  = document.getElementById('cvProfileName');
    const levelEl = document.getElementById('cvProfileLevel');
    if (nameEl)  nameEl.textContent  = 'Aloha, ' + displayName;
    if (levelEl) levelEl.textContent = levelLabel(mana);

    // Avatar in panel
    const avatarEl = document.getElementById('cvProfileAvatar');
    if (avatarEl && avatarUrl) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${displayName}"
        style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(60,179,113,.45);"
        onerror="this.outerHTML='<i class=\\'fas fa-circle-user\\'></i>'">`;
    }

    // Nav pill avatar
    const navName = document.getElementById('cvNavProfileName');
    const navImg  = document.getElementById('cvNavAvatarSmall');
    const navIcon = document.getElementById('cvNavProfileIcon');
    const navBtn  = document.getElementById('cvProfileToggle');
    if (navName) navName.textContent = displayName.split(' ')[0];
    if (avatarUrl && navImg) {
      navImg.src = avatarUrl;
      navImg.alt = displayName;
      navImg.style.display = 'inline-block';
      navImg.onerror = () => { navImg.style.display = 'none'; if (navIcon) navIcon.style.display = ''; };
      if (navIcon) navIcon.style.display = 'none';
    }
    if (navBtn) navBtn.classList.add('is-signed-in');

    // Pikoverse profile link
    const pikoLabel = document.getElementById('cvPikoLinkLabel');
    if (pikoLabel) pikoLabel.textContent = displayName + "'s Pikoverse Profile";

    // Sync banner
    const bannerMsg = document.getElementById('cvSyncMsg');
    if (bannerMsg) bannerMsg.textContent = 'Synced with Pikoverse ✓';

    updateStats(completed, mana);
    renderAchievements(completed);
  }

  /* ── Update stat displays ── */
  function updateStats(completed, mana) {
    const pct = Math.min((mana % 100) || (mana > 0 ? 100 : 0), 100);
    // Signed-in panel
    const el = (id) => document.getElementById(id);
    if (el('completedCount')) el('completedCount').textContent = completed.length;
    if (el('manaDisplay'))    el('manaDisplay').textContent    = `${mana} Mana`;
    if (el('manaFill'))       el('manaFill').style.width       = pct + '%';
    // Signed-out panel (local)
    if (el('manaDisplayLocal')) el('manaDisplayLocal').textContent = `${mana} Mana`;
    if (el('manaFillLocal'))    el('manaFillLocal').style.width    = pct + '%';
    // Lessons page uses these same IDs too
    if (el('culturesCount')) {
      // Count distinct cultures in completed lessons
      const kanaka = ['km-kumulipo','km-wakea','km-starcompass','km-hokuleaa','km-ahupuaa','km-loikalo','km-olelo','km-hula'];
      const kemet  = ['ke-nun','ke-ennead','ke-ptah','ke-maat','ke-maat-politics','ke-medunetjer','ke-medicine'];
      const bridge = ['bridge-darkness','bridge-pairs','bridge-pono-maat'];
      let count = 0;
      if (kanaka.some(id => completed.includes(id))) count++;
      if (kemet.some(id  => completed.includes(id))) count++;
      if (bridge.some(id => completed.includes(id))) count++;
      el('culturesCount').textContent = count;
    }
  }

  /* ── Render achievements list ── */
  function renderAchievements(completed) {
    const container = document.getElementById('cvAchievementsList');
    if (!container) return;
    container.innerHTML = ACHIEVEMENTS.map(a => {
      const earned = a.check(completed);
      return `<div class="cv-ach-item ${earned ? 'is-earned' : ''}">
        <span class="cv-ach-icon">${a.icon}</span>
        <div><strong>${a.label}</strong><small>${a.desc}</small></div>
        ${earned ? '<span class="cv-ach-check">✓</span>' : ''}
      </div>`;
    }).join('');
  }

  /* ── Achievement toast ── */
  function showToast(a) {
    const el = document.createElement('div');
    el.className = 'cv-achievement-toast';
    el.innerHTML = `<span class="cv-ach-toast-icon">${a.icon}</span>
      <div><strong>Achievement Unlocked</strong><span>${a.label}</span></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => { el.classList.remove('is-visible'); setTimeout(() => el.remove(), 400); }, 4000);
  }

  function checkNewAchievements(completed) {
    ACHIEVEMENTS.forEach(a => {
      if (!_earned.includes(a.id) && a.check(completed)) {
        _earned.push(a.id);
        showToast(a);
      }
    });
  }

  /* ── Supabase: load ── */
  async function loadFromSupa() {
    if (!_supa || !_userId) return null;
    try {
      const { data, error } = await _supa
        .from('profiles').select('display_name, avatar_url, theme').eq('id', _userId).single();
      if (error || !data) return null;

      // Pull richer profile data (avatar from Storage, display_name from profiles table)
      if (_user) {
        if (data.avatar_url) _user.user_metadata = { ..._user.user_metadata, avatar_url: data.avatar_url };
        if (data.display_name) _user.user_metadata = { ..._user.user_metadata, display_name: data.display_name };
      }

      const t = data.theme || {};
      return {
        completed: Array.isArray(t[SUPA.lessons]) ? t[SUPA.lessons] : null,
        mana:      typeof t[SUPA.mana] === 'number' ? t[SUPA.mana]  : null,
        earned:    Array.isArray(t[SUPA.ach])       ? t[SUPA.ach]   : []
      };
    } catch (e) { console.warn('[CV Profile] load error:', e); return null; }
  }

  /* ── Supabase: save ── */
  async function saveToSupa(completed, mana) {
    if (!_supa || !_userId) return;
    try {
      const { data } = await _supa.from('profiles').select('theme').eq('id', _userId).single();
      const theme = {
        ...(data?.theme || {}),
        [SUPA.lessons]: completed,
        [SUPA.mana]:    mana,
        [SUPA.sync]:    new Date().toISOString(),
        [SUPA.ach]:     _earned
      };
      await _supa.from('profiles').update({ theme, updated_at: new Date().toISOString() }).eq('id', _userId);
    } catch (e) { console.warn('[CV Profile] save error:', e); }
  }

  /* ── Sync: merge local + remote ── */
  async function syncProgress() {
    const local  = getLocal();
    const remote = await loadFromSupa();
    let completed = local.completed;
    let mana      = local.mana;
    if (remote) {
      if (remote.completed) completed = [...new Set([...local.completed, ...remote.completed])];
      if (remote.mana !== null) mana  = Math.max(local.mana, remote.mana);
      if (remote.earned) _earned      = [...new Set([..._earned, ...remote.earned])];
    }
    setLocal(completed, mana);
    checkNewAchievements(completed);
    await saveToSupa(completed, mana);
    return { completed, mana };
  }

  /* ── SIGN IN ── */
  async function handleSignIn() {
    const emailEl = document.getElementById('cvSignInEmail');
    const passEl  = document.getElementById('cvSignInPassword');
    const errEl   = document.getElementById('cvSignInError');
    const btnEl   = document.getElementById('cvSignInBtn');

    const email    = emailEl?.value.trim();
    const password = passEl?.value;

    if (!email || !password) {
      if (errEl) { errEl.textContent = 'Please enter your email and password.'; errEl.hidden = false; }
      return;
    }
    if (errEl) errEl.hidden = true;
    if (btnEl) { btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in…'; btnEl.disabled = true; }

    const sb = window.piko_supa;
    if (!sb) {
      if (errEl) { errEl.textContent = 'Connection not ready — please wait and try again.'; errEl.hidden = false; }
      if (btnEl) { btnEl.innerHTML = '<i class="fas fa-user-astronaut"></i> Sign In'; btnEl.disabled = false; }
      return;
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;

      _supa   = sb;
      _user   = data.user;
      _userId = data.user.id;

      if (emailEl) emailEl.value = '';
      if (passEl)  passEl.value  = '';

      const { completed, mana } = await syncProgress();
      showSignedIn();
      populateUserUI(completed, mana);

    } catch (err) {
      const msg = err.message?.includes('Invalid login') || err.message?.includes('credentials')
        ? 'Incorrect email or password.'
        : (err.message || 'Sign in failed — please try again.');
      if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    } finally {
      if (btnEl) { btnEl.innerHTML = '<i class="fas fa-user-astronaut"></i> Sign In'; btnEl.disabled = false; }
    }
  }

  /* ── SIGN OUT ── */
  async function handleSignOut() {
    const sb = window.piko_supa || _supa;
    try { if (sb) await sb.auth.signOut(); } catch(e) {}
    _user = null; _userId = null; _supa = null; _earned = [];
    showSignedOut();
    const { completed, mana } = getLocal();
    updateStats(completed, mana);
  }

  /* ── Wire form ── */
  function wireEvents() {
    document.getElementById('cvSignInBtn')?.addEventListener('click', handleSignIn);
    document.getElementById('cvSignInPassword')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleSignIn();
    });
    document.getElementById('cvSignInEmail')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('cvSignInPassword')?.focus();
    });
    document.getElementById('cvSignOutBtn')?.addEventListener('click', handleSignOut);
  }

  /* ── Lesson toggle events (from culturalverse-lessons.js) ── */
  document.addEventListener('cv:lessonToggle', async (e) => {
    const { completed, mana } = e.detail;
    checkNewAchievements(completed);
    updateStats(completed, mana);
    renderAchievements(completed);
    if (_userId) await saveToSupa(completed, mana);
  });

  /* ── Supabase ready ── */
  window.addEventListener('piko:supa:ready', async (e) => {
    if (e.detail?.offline) return;
    _supa = window.piko_supa;
    if (!_supa) { showSignedOut(); return; }
    try {
      const { data } = await _supa.auth.getSession();
      if (!data?.session?.user) { showSignedOut(); return; }
      _user   = data.session.user;
      _userId = _user.id;
      const { completed, mana } = await syncProgress();
      showSignedIn();
      populateUserUI(completed, mana);
    } catch (err) {
      console.warn('[CV Profile] init error:', err);
      showSignedOut();
    }
  });

  /* ── DOM ready ── */
  document.addEventListener('DOMContentLoaded', () => {
    wireEvents();
    showSignedOut();
    const { completed, mana } = getLocal();
    updateStats(completed, mana);
    renderAchievements(completed);
  });

})();