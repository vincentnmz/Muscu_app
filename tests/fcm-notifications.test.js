/* =============================================================================
 * PHASE ADOPTION — ÉTAPE 3 — Notifications natives Android (FCM), côté façade.
 * Exécute le VRAI js/notifications.js dans un contexte « natif » (Capacitor
 * mock) avec un plugin PushNotifications simulé (émission d'événements) et un
 * fetch injecté qui capture les appels backend. Aucun Android/Firebase réel.
 *
 * Couvre : canal native-fcm · permission accordée/refusée/déjà accordée ·
 * token reçu · erreur d'enregistrement · absence de token · changement de
 * token · anti-double-inscription · athlete_id correct dans l'appel backend ·
 * web inchangé.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PLATFORM = fs.readFileSync(path.join(__dirname, '..', 'js', 'platform.js'), 'utf8');
const NOTIFS = fs.readFileSync(path.join(__dirname, '..', 'js', 'notifications.js'), 'utf8');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise((r) => setTimeout(r, 0));

// Contexte « app native » : Capacitor mock rendant isNativeApp() === true.
function ctxNatif() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  sandbox.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
  vm.createContext(sandbox);
  vm.runInContext(PLATFORM, sandbox);
  vm.runInContext(NOTIFS, sandbox);
  return sandbox;
}

// Plugin PushNotifications simulé : mémorise les écouteurs, permet _emit().
function mockPush(cfg) {
  cfg = cfg || {};
  const listeners = {};
  const calls = { check: 0, request: 0, register: 0, addListener: 0 };
  return {
    _listeners: listeners, calls,
    async checkPermissions() { calls.check++; return { receive: cfg.check || 'granted' }; },
    async requestPermissions() { calls.request++; return { receive: cfg.request || 'granted' }; },
    async register() { calls.register++; if (cfg.registerThrows) throw new Error('register failed'); },
    addListener(ev, cb) { calls.addListener++; (listeners[ev] = listeners[ev] || []).push(cb); return { remove() {} }; },
    _emit(ev, data) { (listeners[ev] || []).forEach((cb) => cb(data)); },
  };
}

// fetch injecté : capture chaque corps POST parsé.
function mockFetch() {
  const bodies = [];
  const f = async (url, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ success: true }) }; };
  f.bodies = bodies;
  return f;
}

(async () => {
  /* --- 1. Canal natif -------------------------------------------------- */
  {
    const s = ctxNatif();
    eq(s.NovalyzNotifications.canalNotification() === 'native-fcm', "canal === 'native-fcm'");
  }

  /* --- 2. Permission déjà accordée → register + token → backend -------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    const r = await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'ATH-42', scriptUrl: 'https://backend/x' });
    eq(r.ok === true && r.raison === 'enregistrement-demande', 'déjà accordée: activer ok');
    eq(P.calls.request === 0, 'déjà accordée: pas de requestPermissions');
    eq(P.calls.register === 1, 'déjà accordée: register appelé');
    P._emit('registration', { value: 'FCM_TOKEN_ABC' });
    await tick();
    eq(f.bodies.length === 1, 'token reçu: 1 appel backend');
    eq(f.bodies[0].action === 'saveNativePushToken', 'backend: action saveNativePushToken');
    eq(f.bodies[0].athlete_id === 'ATH-42', 'backend: athlete_id correct');
    eq(f.bodies[0].token === 'FCM_TOKEN_ABC', 'backend: token transmis');
    eq(f.bodies[0].platform === 'android', 'backend: platform android');
  }

  /* --- 3. Permission à demander puis accordée -------------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'prompt', request: 'granted' });
    const f = mockFetch();
    const r = await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'ATH-1', scriptUrl: 'u' });
    eq(P.calls.request === 1, 'prompt: requestPermissions appelé');
    eq(r.ok === true, 'prompt→granted: activer ok');
  }

  /* --- 4. Permission refusée → pas de register, pas de backend --------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'prompt', request: 'denied' });
    const f = mockFetch();
    const r = await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'ATH-1', scriptUrl: 'u' });
    eq(r.ok === false && r.raison === 'permission-refusee', 'refusée: activer ko permission-refusee');
    eq(P.calls.register === 0, 'refusée: register NON appelé');
    P._emit('registration', { value: 'X' }); await tick();
    eq(f.bodies.length === 0, 'refusée: aucun appel backend');
  }

  /* --- 5. Erreur d'enregistrement -------------------------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted', registerThrows: true });
    const r = await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: mockFetch(), athleteId: 'A', scriptUrl: 'u' });
    eq(r.ok === false && r.raison === 'registration-erreur', 'register throw: raison registration-erreur');
  }

  /* --- 6. registrationError capturé, aucun backend -------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    P._emit('registrationError', { error: 'boom' }); await tick();
    eq(f.bodies.length === 0, 'registrationError: aucun appel backend');
  }

  /* --- 7. Absence de token (value vide) → pas de backend --------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    P._emit('registration', { value: '' }); await tick();
    eq(f.bodies.length === 0, 'token vide: aucun appel backend');
  }

  /* --- 8. Changement de token + dédoublonnage ------------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    P._emit('registration', { value: 'TOK1' }); await tick();
    P._emit('registration', { value: 'TOK1' }); await tick(); // identique → ignoré
    P._emit('registration', { value: 'TOK2' }); await tick(); // nouveau → envoyé
    eq(f.bodies.length === 2, 'token change: 2 envois (TOK1, TOK2), doublon ignoré');
    eq(f.bodies[0].token === 'TOK1' && f.bodies[1].token === 'TOK2', 'token change: bons tokens dans l\'ordre');
  }

  /* --- 9. Anti-double-inscription des écouteurs ----------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    eq((P._listeners.registration || []).length === 1, 'écouteur registration installé une seule fois');
    P._emit('registration', { value: 'TOKU' }); await tick();
    eq(f.bodies.length === 1, 'anti-double: un seul envoi malgré 2 activer()');
  }

  /* --- 10. Non connecté → pas d'activation ---------------------------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const r = await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: mockFetch(), athleteId: null, scriptUrl: 'u' });
    eq(r.ok === false && r.raison === 'non-connecte', 'non connecté: activer ko non-connecte');
    eq(P.calls.register === 0, 'non connecté: register NON appelé');
  }

  /* --- 11. Désactivation (logout) : désassociation du token ----------- */
  {
    const s = ctxNatif();
    const P = mockPush({ check: 'granted' });
    const f = mockFetch();
    await s.NovalyzNotifications.activer({ plugin: P, fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    P._emit('registration', { value: 'TOKX' }); await tick();
    const rd = await s.NovalyzNotifications.desactiver({ fetchImpl: f, athleteId: 'A', scriptUrl: 'u' });
    eq(rd.ok === true && rd.desassocie === true, 'desactiver: désassociation envoyée');
    const del = f.bodies[f.bodies.length - 1];
    eq(del.action === 'deleteNativePushToken' && del.token === 'TOKX' && del.athlete_id === 'A', 'desactiver: bon payload delete');
  }

  /* --- 12. Plugin indisponible --------------------------------------- */
  {
    const s = ctxNatif();
    const r = await s.NovalyzNotifications.activer({ plugin: null, fetchImpl: mockFetch(), athleteId: 'A', scriptUrl: 'u' });
    // plugin:null → la façade tente le global Capacitor.Plugins (absent) → indisponible
    eq(r.ok === false && r.raison === 'plugin-indisponible', 'plugin absent: raison plugin-indisponible');
  }

  console.log(`fcm-notifications.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
