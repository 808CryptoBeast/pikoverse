/**
 * supabase-client.js — Pikoverse Supabase bootstrap
 * Place in: js/supabase-client.js
 * Load BEFORE profile.js on every page.
 */
(function () {
  'use strict';

  /* ── Hardcoded credentials — anon key is safe to be public ── */
  var SUPA_URL = 'https://fmrjdvsqdfyaqtzwbbqi.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtcmpkdnNxZGZ5YXF0endiYnFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTE2MzYsImV4cCI6MjA5MTE2NzYzNn0.UKyvX02bG4cNhb7U2TK96t8XFREHYYwHJIKbPK06nqs';

  /* Admin panel overrides still work if set */
  SUPA_URL = localStorage.getItem('amp_supabase_url') || SUPA_URL;
  SUPA_KEY = localStorage.getItem('amp_supabase_key') || SUPA_KEY;

  window.PIKO_SUPA_URL   = SUPA_URL;
  window.PIKO_SUPA_KEY   = SUPA_KEY;
  window.PIKO_SUPA_READY = false;
  window.piko_supa       = null;

  /* ── Load Supabase SDK ── */
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  script.onload = function () {
    try {
      var client = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: {
          autoRefreshToken:   true,
          persistSession:     true,
          detectSessionInUrl: true,
          storageKey:         'piko_supabase_auth',
          storage:            window.localStorage,
        },
      });
      window.piko_supa       = client;
      window.PIKO_SUPA_READY = true;
      console.info('[Pikoverse] Supabase client ready.');
      window.dispatchEvent(new CustomEvent('piko:supa:ready', { detail: { offline: false } }));
    } catch (e) {
      console.error('[Pikoverse] Supabase init failed:', e);
      window.dispatchEvent(new CustomEvent('piko:supa:ready', { detail: { offline: true } }));
    }
  };

  script.onerror = function () {
    console.warn('[Pikoverse] Could not load Supabase SDK — offline fallback.');
    window.dispatchEvent(new CustomEvent('piko:supa:ready', { detail: { offline: true } }));
  };

  document.head.appendChild(script);
})();