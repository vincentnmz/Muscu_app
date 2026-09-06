/* =============================================================================
 * Étape 4 — Câblage natif dans js/app.js. Vérifie les helpers d'aiguillage
 * (bloc __NATIF_PUSH_*) exécutés RÉELLEMENT : détection native, support push,
 * état FCM mémorisé par athlète, et opts transmis à la façade.
 *
 * Le comportement de la façade NovalyzNotifications (register/backend) est déjà
 * couvert par fcm-notifications.test.js ; ici on teste le VERRE glue d'app.js.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function grab(tag) { return APP.split('/* __' + tag + '_START__ */')[1].split('/* __' + tag + '_END__ */')[0]; }
const BLOC = grab('NATIF_PUSH')
  + '\n;this.__fns = { _estAppNative, _pushSupporte, _fcmActif, _setFcmActif, _fcmOpts, _fcmFlagKey };';

// Sandbox minimal : on injecte window/localStorage/navigator + athlete + SCRIPT_URL.
function make({ native, athleteId, hasWebPush } = {}) {
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const win = {};
  if (native) win.NovalyzPlatform = { isNativeApp: () => true, getPlatform: () => 'android' };
  else if (native === false) win.NovalyzPlatform = { isNativeApp: () => false, getPlatform: () => 'web' };
  // hasWebPush : simule un navigateur web capable (serviceWorker/PushManager/Notification).
  const navigator = hasWebPush ? { serviceWorker: {} } : {};
  if (hasWebPush) { win.PushManager = function () {}; win.Notification = function () {}; }
  const sandbox = {
    window: win, localStorage, navigator, fetch: function fetch() {},
    athlete: athleteId ? { athlete_id: athleteId } : null,
    SCRIPT_URL: 'https://backend/x', console,
  };
  // Les helpers utilisent `window.X`, `PushManager in window`, etc. → on relie
  // les identifiants globaux (serviceWorker/PushManager/Notification) à window.
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Rendre `('PushManager' in window)` cohérent : window porte déjà ces clés.
  vm.runInContext(BLOC, sandbox);
  return sandbox.__fns;
}

// 1. Détection native
{
  eq(make({ native: true }).                 _estAppNative() === true,  'native: _estAppNative true');
  eq(make({ native: false }).                _estAppNative() === false, 'web: _estAppNative false');
  eq(make({}).                               _estAppNative() === false, 'sans Capacitor: _estAppNative false');
}

// 2. Support push : natif toujours supporté ; web selon les API présentes
{
  eq(make({ native: true }).                 _pushSupporte() === true,  'native: push supporté (FCM)');
  eq(make({ native: false, hasWebPush: true }).  _pushSupporte() === true,  'web capable: push supporté');
  eq(make({ native: false, hasWebPush: false }). _pushSupporte() === false, 'web sans API: push non supporté');
}

// 3. État FCM mémorisé par athlète (localStorage)
{
  const f = make({ native: true, athleteId: 'ATH-1' });
  eq(f._fcmActif() === false, 'FCM inactif par défaut');
  f._setFcmActif(true);
  eq(f._fcmActif() === true, 'FCM actif après _setFcmActif(true)');
  f._setFcmActif(false);
  eq(f._fcmActif() === false, 'FCM inactif après _setFcmActif(false)');
}

// 4. Clé de flag distincte par athlète (pas de fuite entre comptes)
{
  const a = make({ native: true, athleteId: 'A' });
  const b = make({ native: true, athleteId: 'B' });
  eq(a._fcmFlagKey() !== b._fcmFlagKey(), 'clé FCM différente par athlète');
  eq(a._fcmFlagKey() === 'nv_fcm_on_A', 'clé FCM = nv_fcm_on_<id>');
}

// 5. _fcmOpts : ce que app.js transmet à la façade (athleteId + scriptUrl + fetch)
{
  const o = make({ native: true, athleteId: 'ATH-9' })._fcmOpts();
  eq(o.athleteId === 'ATH-9', 'opts: athleteId depuis athlete courant');
  eq(o.scriptUrl === 'https://backend/x', 'opts: scriptUrl = SCRIPT_URL');
  eq(typeof o.fetchImpl === 'function', 'opts: fetchImpl fourni');
}

console.log(`natif-push-wiring.test.js : ${ok} OK / ${ko} KO`);
if (ko) process.exit(1);
