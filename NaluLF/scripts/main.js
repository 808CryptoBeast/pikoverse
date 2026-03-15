/* =====================================================
   main.js — Application Entry Point
   ===================================================== */
import { restoreTheme, setTheme, cycleTheme } from './theme.js';
import { showLandingPage, showDashboard, showProfile, switchTab } from './nav.js';
import {
  openAuth, closeAuth, showAuthView, authKeydown,
  submitSignIn, submitSignUp, refreshCaptcha,
  showForgotView, forgotRestoreFromFile, forgotWipeConfirm,
  forgotWipeExecute, forgotBackToOptions,
  submitSyncImport, exportVaultSyncCode, syncImportFromFile,
  signupNext, signupBack,
  logout, restoreSession
} from './auth.js';
import { initDashboard } from './dashboard.js';
import { initInspector, runInspect } from './inspector.js';
import { initNetwork, measureLatency } from './network.js';
import {
  initProfile, switchProfileTab, openProfileEditor, closeProfileEditor, saveProfileEditor,
  openWalletCreator, closeWalletCreator, wizardNext, wizardBack,
  openSocialModal, closeSocialModal, saveSocialModal, deleteSocial,
  viewSocial, deleteWallet, inspectWalletAddr, selectAlgo,
  selectWalletEmoji, selectWalletColor, toggleSecurityCheck,
  revealSeed, copySeed, copyAddress, copyToClipboard,
  selectAvatar, selectBanner,
  uploadAvatarImage, removeAvatarImage,
  uploadBannerImage, removeBannerImage, prefSetTheme,
  setPrefCurrency, setPrefNetwork, setPrefAutoLock,
  openPublicProfilePreview,
  logActivity, exportVaultBackup,
  toggleWalletDrawer, switchWalletDrawerTab, cancelOffer,
  fetchBalance, setActiveWallet,
  openImportAddressModal, closeImportAddressModal, importWatchOnlyWallet,
  openImportSeedModal, closeImportSeedModal, executeImportFromSeed,
  openTokenDetailsModal, closeTokenDetailsModal
} from './profile.js';
import { buildLandingContent, initReveal } from './landing.js';
import { initParticles } from './particles.js';
import { openCmdk, closeCmdk, setupCmdkListeners } from './cmdk.js';

/* ── Global onclick bridges ── */

// Auth
window.openAuth              = m    => openAuth(m);
window.closeAuth             = ()   => closeAuth();
window.showAuthView          = v    => showAuthView(v);
window.authKeydown           = e    => authKeydown(e);
window.submitSignIn          = ()   => submitSignIn();
window.submitSignUp          = ()   => submitSignUp();
window.refreshCaptcha        = ()   => refreshCaptcha();
window.showForgotView        = ()   => showForgotView();
window.forgotRestoreFromFile = ()   => forgotRestoreFromFile();
window.forgotWipeConfirm     = ()   => forgotWipeConfirm();
window.forgotWipeExecute     = ()   => forgotWipeExecute();
window.forgotBackToOptions   = ()   => forgotBackToOptions();
window.submitSyncImport      = ()   => submitSyncImport();
window.exportVaultSyncCode   = ()   => exportVaultSyncCode();
window.syncImportFromFile    = ()   => syncImportFromFile();
window.signupNext            = ()   => signupNext();
window.signupBack            = ()   => signupBack();
window.logout                = ()   => logout();

// Nav — ALL nav functions exposed globally so onclick= attributes work
window.goHome              = ()     => showLandingPage();
window.showLandingPage     = ()     => showLandingPage();
window.showDashboard       = ()     => showDashboard();
window.showProfile         = ()     => showProfile();
window.switchTab           = (b,id) => switchTab(b, id);

// Dashboard / Inspector / Network
window.runInspect          = ()   => runInspect();
window.closeCommandPalette = ()   => closeCmdk();
window.setTheme            = t    => setTheme(t);
window.cycleTheme          = ()   => cycleTheme();
window.measureLatency      = (o)  => measureLatency(o);

// Profile
window.switchProfileTab         = t       => switchProfileTab(t);
window.openProfileEditor        = ()      => openProfileEditor();
window.closeProfileEditor       = ()      => closeProfileEditor();
window.saveProfileEditor        = ()      => saveProfileEditor();
window.selectAvatar             = e       => selectAvatar(e);
window.selectBanner             = b       => selectBanner(b);
window.uploadAvatarImage        = el      => uploadAvatarImage(el);
window.removeAvatarImage        = ()      => removeAvatarImage();
window.uploadBannerImage        = el      => uploadBannerImage(el);
window.removeBannerImage        = ()      => removeBannerImage();
window.prefSetTheme             = t       => prefSetTheme(t);
window.setPrefCurrency          = c       => setPrefCurrency(c);
window.setPrefNetwork           = n       => setPrefNetwork(n);
window.setPrefAutoLock          = m       => setPrefAutoLock(m);
window.openPublicProfilePreview = ()      => openPublicProfilePreview();
window.exportVaultBackup        = ()      => exportVaultBackup();
window.logActivity              = (t,d)   => logActivity(t,d);
window.toggleWalletDrawer       = id      => toggleWalletDrawer(id);
window.switchWalletDrawerTab    = (id,tab)=> switchWalletDrawerTab(id,tab);
window.cancelOffer              = (w,s,b) => cancelOffer(w,s,b);
window.fetchBalance             = addr    => fetchBalance(addr);
window.setActiveWallet          = id      => setActiveWallet(id);
window.openImportAddressModal   = ()      => openImportAddressModal();
window.closeImportAddressModal  = ()      => closeImportAddressModal();
window.importWatchOnlyWallet    = ()      => importWatchOnlyWallet();
window.openImportSeedModal      = ()      => openImportSeedModal();
window.closeImportSeedModal     = ()      => closeImportSeedModal();
window.executeImportFromSeed    = ()      => executeImportFromSeed();
window.openTokenDetailsModal    = (c,i,a) => openTokenDetailsModal(c,i,a);
window.closeTokenDetailsModal   = ()      => closeTokenDetailsModal();

// Wallet creator
window.openWalletCreator   = ()   => openWalletCreator();
window.closeWalletCreator  = ()   => closeWalletCreator();
window.wizardNext          = ()   => wizardNext();
window.wizardBack          = ()   => wizardBack();
window.selectAlgo          = a    => selectAlgo(a);
window.selectWalletEmoji   = e    => selectWalletEmoji(e);
window.selectWalletColor   = c    => selectWalletColor(c);
window.toggleSecurityCheck = i    => toggleSecurityCheck(i);
window.revealSeed          = ()   => revealSeed();
window.copySeed            = ()   => copySeed();
window.copyAddress         = ()   => copyAddress();
window.copyToClipboard     = t    => copyToClipboard(t);
window.deleteWallet        = i    => deleteWallet(i);
window.inspectWalletAddr   = a    => inspectWalletAddr(a);

// Social
window.openSocialModal  = id => openSocialModal(id);
window.closeSocialModal = ()  => closeSocialModal();
window.saveSocialModal  = ()  => saveSocialModal();
window.deleteSocial     = ()  => deleteSocial();
window.viewSocial       = id  => viewSocial(id);

// cmdk internal refs
window._openAuth    = openAuth;
window._goHome      = showLandingPage;
window._cycleTheme  = cycleTheme;
window._showProfile = showProfile;

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌊 NaluLF: booting…');

  restoreTheme();
  showLandingPage();
  buildLandingContent();
  initReveal();
  initParticles();
  initDashboard();
  initInspector();
  initNetwork();
  setupCmdkListeners();
  initXrpPrice();

  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdk(); return; }
    if (e.key === '/' && !inInput) { e.preventDefault(); openCmdk(); return; }
    if (e.key === 'Escape') {
      closeCmdk();
      closeAuth();
      closeProfileEditor();
      closeWalletCreator();
      closeSocialModal();
    }
  });

  document.getElementById('auth-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAuth();
  });

  if (restoreSession()) {
    showDashboard();
    import('./xrpl.js').then(({ connectXRPL }) => connectXRPL());
    initProfile();
  }

  console.log('✅ NaluLF: ready');
});

/* ─────────────────────────────────────────────────────
   XRP Price Ticker
   Primary:  CryptoCompare  — proper Access-Control-Allow-Origin: *
   Fallback: Kraken          — also CORS-safe, no geo-blocks
   Both work from any origin including localhost and GitHub Pages.
───────────────────────────────────────────────────── */
function initXrpPrice() {
  fetchXrpPrice();
  setInterval(fetchXrpPrice, 30_000);
}

async function fetchXrpPrice() {
  try {
    // CryptoCompare — free tier, no auth, CORS: * header set server-side
    const res = await fetch(
      'https://min-api.cryptocompare.com/data/pricemultifull?fsyms=XRP&tsyms=USD'
    );
    if (!res.ok) throw new Error(`CryptoCompare ${res.status}`);
    const json  = await res.json();
    const raw   = json?.RAW?.XRP?.USD;
    if (!raw) throw new Error('unexpected shape');
    _updatePricePill(raw.PRICE, raw.CHANGEPCT24HOUR);
  } catch {
    // Fallback: Kraken — also CORS-safe, no geo restrictions
    try {
      const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XRPUSD');
      if (!res.ok) throw new Error(`Kraken ${res.status}`);
      const json   = await res.json();
      const ticker = json?.result?.XXRPZUSD;
      if (!ticker) throw new Error('unexpected shape');
      const price  = parseFloat(ticker.c[0]);          // last trade price
      const open   = parseFloat(ticker.o);              // 24h open
      const change = open > 0 ? ((price - open) / open) * 100 : 0;
      _updatePricePill(price, change);
    } catch {
      // Both failed — silently keep last displayed value
    }
  }
}

function _updatePricePill(price, change) {
  const priceEl  = document.getElementById('xrpPrice');
  const changeEl = document.getElementById('xrpChange');
  if (priceEl)  priceEl.textContent  = `$${price.toFixed(3)}`;
  if (changeEl) {
    const up = change >= 0;
    changeEl.textContent = `${up ? '+' : ''}${change.toFixed(2)}%`;
    changeEl.className   = `xrp-price-change ${Math.abs(change) < 0.1 ? 'flat' : up ? 'up' : 'down'}`;
  }
}