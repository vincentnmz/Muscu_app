/* =============================================================================
 * PHASE ADOPTION — ÉTAPE 3-backend — Notifications natives (FCM) côté serveur.
 * Exécute le VRAI supabase/functions/handler/index.ts dans un sandbox vm avec :
 *   - un moteur Supabase en mémoire (from/select/insert/upsert/delete/eq…) ;
 *   - crypto.subtle et fetch MOCKÉS (aucun appel réseau/Google réel) ;
 *   - un compte de service FCM factice via Deno.env.
 * Couvre : stockage/suppression du token natif · envoi FCM (URL projet, token,
 * titre) · purge des tokens morts · dégradation si FCM absent · testPush inclut
 * le diagnostic FCM · notifyAthlete déclenche le canal natif.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }

// ── Moteur Supabase en mémoire (minimal, suffisant pour ces tests) ──────────
function makeEngine(store) {
  function q(table) {
    const filters = []; let op = null, payload = null, single = false;
    const base = () => (store[table] || (store[table] = []));
    const matches = (r) => filters.every(f => f(r));
    const self = {
      from(t) { return q(t); },
      select() { return self; },
      insert(p) { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return self; },
      upsert(p) { op = 'upsert'; payload = Array.isArray(p) ? p : [p]; return self; },
      update(p) { op = 'update'; payload = p; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      single() { single = true; return self; },
      maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function resolve() {
      if (op === 'insert' || op === 'upsert') { base().push(...payload); return { data: payload, error: null }; }
      if (op === 'update') { base().filter(matches).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === 'delete') { store[table] = base().filter(r => !matches(r)); return { data: null, error: null }; }
      const rows = base().filter(matches);
      return single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
    }
    return self;
  }
  return { from: q };
}

// ── Chargeur du vrai backend ────────────────────────────────────────────────
function loadBackend(store, env, fetchImpl, fcmCalls) {
  let src = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
  let js = stripTypeScriptTypes(src);
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleSaveNativePushToken, handleDeleteNativePushToken, sendFcmToAthlete, notifyAthlete, handleTestPush };';
  const client = makeEngine(store);
  const sandbox = {
    createClient: () => client,
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console,
    atob, btoa, setTimeout, clearTimeout,
    crypto: {
      subtle: {
        importKey: async () => ({}),
        sign: async () => new Uint8Array([1, 2, 3, 4]).buffer,
        digest: async () => new Uint8Array(32).buffer,
      },
    },
    fetch: fetchImpl,
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox.__api;
}

const FAKE_SA = JSON.stringify({
  client_email: 'sa@novalyz-test.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nQUFBQQ==\n-----END PRIVATE KEY-----',
  project_id: 'novalyz-test',
});

// fetch mock : route oauth2 → access_token ; fcm → capture + réponse pilotable.
function makeFetch(fcmCalls, fcmResponder) {
  return async (url, init) => {
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'AT123', expires_in: 3600 }), text: async () => '' };
    }
    if (String(url).includes('fcm.googleapis.com')) {
      const body = JSON.parse(init.body);
      fcmCalls.push({ url: String(url), auth: init.headers.Authorization, body });
      return (fcmResponder || (() => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })))();
    }
    return { ok: false, status: 0, json: async () => ({}), text: async () => '' };
  };
}

async function readJson(resp) { return await resp.json(); }

(async () => {
  /* --- 1. Stockage du token natif --------------------------------------- */
  {
    const store = {};
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch([]));
    const r = await readJson(await api.handleSaveNativePushToken({ athlete_id: 'ATH-1', token: 'TOK-A', platform: 'android' }));
    eq(r.success === true, 'save: success');
    eq((store.native_push_tokens || []).length === 1, 'save: 1 ligne insérée');
    eq(store.native_push_tokens[0].token === 'TOK-A' && store.native_push_tokens[0].athlete_id === 'ATH-1', 'save: bon token + athlete_id');
    eq(store.native_push_tokens[0].platform === 'android', 'save: platform stockée');
  }

  /* --- 2. Paramètres manquants ------------------------------------------ */
  {
    const store = {};
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch([]));
    const r = await readJson(await api.handleSaveNativePushToken({ athlete_id: '', token: '' }));
    eq(r.success === false, 'save sans params: success=false');
    eq((store.native_push_tokens || []).length === 0, 'save sans params: rien inséré');
  }

  /* --- 3. Suppression du token ------------------------------------------ */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'ATH-1' }, { token: 'TOK-B', athlete_id: 'ATH-2' }] };
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch([]));
    const r = await readJson(await api.handleDeleteNativePushToken({ token: 'TOK-A' }));
    eq(r.success === true, 'delete: success');
    eq(store.native_push_tokens.length === 1 && store.native_push_tokens[0].token === 'TOK-B', 'delete: seul TOK-A retiré');
  }

  /* --- 4. Envoi FCM : URL projet, token, titre -------------------------- */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'ATH-1' }] };
    const fcmCalls = [];
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch(fcmCalls));
    const r = await api.sendFcmToAthlete('ATH-1', { title: 'Hello', body: 'Monde', target: 'conversation', url: './' });
    eq(r.sent === 1 && r.found === 1, 'fcm: 1 envoyé / 1 trouvé');
    eq(fcmCalls.length === 1, 'fcm: 1 appel HTTP');
    eq(fcmCalls[0].url === 'https://fcm.googleapis.com/v1/projects/novalyz-test/messages:send', 'fcm: URL avec project_id');
    eq(fcmCalls[0].auth === 'Bearer AT123', 'fcm: header Authorization Bearer');
    eq(fcmCalls[0].body.message.token === 'TOK-A', 'fcm: token dans le message');
    eq(fcmCalls[0].body.message.notification.title === 'Hello', 'fcm: titre transmis');
    eq(fcmCalls[0].body.message.data.target === 'conversation', 'fcm: data.target transmis');
  }

  /* --- 5. FCM non configuré → dégradation propre ------------------------ */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'ATH-1' }] };
    const fcmCalls = [];
    const api = loadBackend(store, {}, makeFetch(fcmCalls)); // pas de FCM_SERVICE_ACCOUNT
    const r = await api.sendFcmToAthlete('ATH-1', { title: 'x', body: 'y' });
    eq(r.error === 'fcm-sa-absent' && r.sent === 0, 'fcm absent: fcm-sa-absent, 0 envoi');
    eq(fcmCalls.length === 0, 'fcm absent: aucun appel HTTP');
  }

  /* --- 6. Token mort (UNREGISTERED) → purge ----------------------------- */
  {
    const store = { native_push_tokens: [{ token: 'DEAD', athlete_id: 'ATH-1' }] };
    const fcmCalls = [];
    const responder = () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '{"error":{"status":"UNREGISTERED"}}' });
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch(fcmCalls, responder));
    const r = await api.sendFcmToAthlete('ATH-1', { title: 'x', body: 'y' });
    eq(r.sent === 0, 'token mort: 0 envoyé');
    eq((store.native_push_tokens || []).length === 0, 'token mort: purgé de la table');
  }

  /* --- 7. Aucun token pour l'athlète ------------------------------------ */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'AUTRE' }] };
    const fcmCalls = [];
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch(fcmCalls));
    const r = await api.sendFcmToAthlete('ATH-1', { title: 'x', body: 'y' });
    eq(r.found === 0 && r.sent === 0, 'aucun token: found=0 sent=0');
    eq(fcmCalls.length === 0, 'aucun token: aucun appel HTTP');
  }

  /* --- 8. notifyAthlete déclenche le canal natif (VAPID absent) --------- */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'ATH-1' }] };
    const fcmCalls = [];
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch(fcmCalls)); // pas de VAPID → web no-op
    await api.notifyAthlete('ATH-1', { title: 'Coach', body: 'Salut', target: 'conversation' });
    eq(fcmCalls.length === 1, 'notifyAthlete: FCM déclenché');
    eq(fcmCalls[0].body.message.notification.title === 'Coach', 'notifyAthlete: titre propagé au FCM');
  }

  /* --- 9. testPush inclut le diagnostic FCM ----------------------------- */
  {
    const store = { native_push_tokens: [{ token: 'TOK-A', athlete_id: 'ATH-1' }] };
    const fcmCalls = [];
    const api = loadBackend(store, { FCM_SERVICE_ACCOUNT: FAKE_SA }, makeFetch(fcmCalls));
    const r = await readJson(await api.handleTestPush({ athlete_id: 'ATH-1' }));
    eq(r.fcm && r.fcm.configured === true, 'testPush: fcm.configured=true');
    eq(r.fcm.found === 1 && r.fcm.sent === 1, 'testPush: fcm found=1 sent=1');
  }

  console.log(`native-push-backend.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
