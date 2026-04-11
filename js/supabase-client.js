/**
 * supabase-client.js — Pikoverse Supabase bootstrap
 * Place in: js/supabase-client.js
 * Load BEFORE profile.js in every HTML page:
 *   <script src="js/supabase-client.js"></script>
 *
 * How to configure:
 *   Go to Admin → Settings and paste your Supabase URL + anon key,
 *   OR set them directly below for production.
 */
(function () {
  'use strict';

  /* ── 1. Load Supabase JS SDK ── */
  var SUPA_URL = localStorage.getItem('amp_supabase_url') || '';
  var SUPA_KEY = localStorage.getItem('amp_supabase_key') || '';

  /* Expose config globally so profile.js can read it */
  window.PIKO_SUPA_URL = SUPA_URL;
  window.PIKO_SUPA_KEY = SUPA_KEY;
  window.PIKO_SUPA_READY = false;
  window.piko_supa = null; /* will be the Supabase client */

  if (!SUPA_URL || !SUPA_KEY) {
    console.info('[Pikoverse] Supabase not configured — running in localStorage mode.');
    window.dispatchEvent(new CustomEvent('piko:supa:ready', { detail: { offline: true } }));
    return;
  }

  /* ── 2. Inject Supabase SDK via CDN ── */
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = function () {
    try {
      /* supabase is exposed as window.supabase in UMD build */
      var client = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: {
          autoRefreshToken:    true,
          persistSession:      true,
          detectSessionInUrl:  true,
          storageKey:          'piko_supabase_auth',   /* consistent key across all pages */
          storage:             window.localStorage,
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
    console.warn('[Pikoverse] Could not load Supabase SDK — localStorage fallback.');
    window.dispatchEvent(new CustomEvent('piko:supa:ready', { detail: { offline: true } }));
  };
  document.head.appendChild(script);
})();