/* =============================================================================
 * PHASE ADOPTION — ÉTAPE 2/3 — Couche d'abstraction de plateforme.
 * Charge les VRAIS modules js/platform.js et js/notifications.js dans un
 * sandbox vm : une fois SANS Capacitor (PWA web), une fois AVEC un Capacitor
 * mock (app native), et vérifie la détection + l'aiguillage du canal.
 * (Le détail du flux FCM est couvert par tests/fcm-notifications.test.js.)
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLATFORM = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform.js'), 'utf8');
const NOTIFS = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }

function contexte(capacitor, extra) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  if (capacitor) sandbox.Capacitor = capacitor;
  if (extra) Object.assign(sandbox, extra);
  vm.createContext(sandbox);
  vm.runInContext(PLATFORM, sandbox);
  vm.runInContext(NOTIFS, sandbox);
  return sandbox;
}

(async () => {
  /* --- 1. PWA web : aucun Capacitor global ------------------------------- */
  {
    const s = contexte(null);
    eq(s.NovalyzPlatform.isNativeApp() === false, 'web: isNativeApp() === false');
    eq(s.NovalyzPlatform.isWebApp() === true, 'web: isWebApp() === true');
    eq(s.NovalyzPlatform.getPlatform() === 'web', "web: getPlatform() === 'web'");
    eq(s.NovalyzNotifications.canalNotification() === 'web-push', "web: canal === 'web-push'");
  }

  /* --- 2. App native : Capacitor.isNativePlatform() === true ------------- */
  {
    const s = contexte({ isNativePlatform: () => true, getPlatform: () => 'android' });
    eq(s.NovalyzPlatform.isNativeApp() === true, 'native: isNativeApp() === true');
    eq(s.NovalyzPlatform.isWebApp() === false, 'native: isWebApp() === false');
    eq(s.NovalyzPlatform.getPlatform() === 'android', "native: getPlatform() === 'android'");
    eq(s.NovalyzNotifications.canalNotification() === 'native-fcm', "native: canal === 'native-fcm'");
  }

  /* --- 3. Repli : Capacitor sans isNativePlatform, getPlatform seul ------ */
  {
    const s = contexte({ getPlatform: () => 'ios' });
    eq(s.NovalyzPlatform.isNativeApp() === true, 'repli ios: isNativeApp() === true (via getPlatform)');
    eq(s.NovalyzPlatform.getPlatform() === 'ios', "repli ios: getPlatform() === 'ios'");
  }

  /* --- 4. Capacitor présent mais plateforme web ------------------------- */
  {
    const s = contexte({ isNativePlatform: () => false, getPlatform: () => 'web' });
    eq(s.NovalyzPlatform.isNativeApp() === false, 'capacitor web: isNativeApp() === false');
    eq(s.NovalyzNotifications.canalNotification() === 'web-push', "capacitor web: canal === 'web-push'");
  }

  /* --- 5. Façade web : délègue au flux EXISTANT sans le réimplémenter ---- */
  {
    let appele = 0;
    const s = contexte(null, { activerNotifications: () => { appele++; } });
    const r = await s.NovalyzNotifications.activer();
    eq(r.canal === 'web-push', 'web activer(): canal web-push');
    eq(r.delegated === 'activerNotifications', 'web activer(): délègue à activerNotifications');
    eq(appele === 1, 'web activer(): a bien appelé le flux existant une fois');
  }

  /* --- 6. Robustesse : NovalyzPlatform absent → retombe sur web ---------- */
  {
    const sandbox = {};
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(NOTIFS, sandbox);
    eq(sandbox.NovalyzNotifications.canalNotification() === 'web-push', 'sans platform: canal retombe sur web-push');
  }

  console.log(`platform-native.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
