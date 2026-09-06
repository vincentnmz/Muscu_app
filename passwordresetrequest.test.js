/* =============================================================================
 * P2 — requestPasswordReset (backend). Exécute le VRAI handler + sha256hex réel.
 * fetch (Resend) mocké, crypto réel. Vérifie : validation, anti-énumération,
 * token sûr/haché/non stocké en clair, expiration ~+1h, usage unique, envoi
 * Resend (clé côté backend uniquement, destinataire/expéditeur, lien = token
 * brut), échec Resend -> token invalidé, non-régression.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }

function makeEngine(store) {
  function q(table) {
    const filters = []; let op = null, payload = null, single = false;
    const base = () => (store[table] || (store[table] = []));
    const matches = (r) => filters.every(f => f(r));
    const self = {
      from(t) { return q(t); }, select() { return self; },
      insert(p) { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return self; },
      update(p) { op = 'update'; payload = p; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      limit() { return self; }, order() { return self; },
      single() { single = true; return self; }, maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function resolve() {
      if (op === 'insert') { base().push(...payload); return { data: single ? payload[0] : payload, error: null }; }
      if (op === 'update') { base().filter(matches).forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
      if (op === 'delete') { store[table] = base().filter(r => !matches(r)); return { data: null, error: null }; }
      const rows = base().filter(matches);
      return single ? { data: rows[0] || null, error: null } : { data: rows, error: null };
    }
    return self;
  }
  return { from: q };
}

const KEY = 're_test_SECRET_KEY';
function loadBackend(store, fetchImpl, logs) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleRequestPasswordReset, sha256hex, handleLogin, handleRegister, handleSaveEmail, handleCoachResetAthlete, hashSalted };';
  const env = { RESEND_API_KEY: KEY, APP_BASE_URL: 'https://vincentnmz.github.io/Muscu_app/dev/', PEPPER: 'test-pepper' };
  const sandbox = {
    createClient: () => makeEngine(store),
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => env[k] }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder,
    console: { log() {}, error: (...a) => { if (logs) logs.push(a.join(' ')); }, warn() {} },
    atob, btoa, setTimeout, clearTimeout, crypto: webcrypto, fetch: fetchImpl,
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
const J = async (r) => await r.json();
const P = (o) => new URLSearchParams(o);
function mockFetch(calls, responder) {
  return async (url, init) => { calls.push({ url: String(url), init }); return (responder || (() => ({ ok: true, status: 200, json: async () => ({ id: 'e1' }), text: async () => '' })))(); };
}
const prt = (store) => (store.password_reset_tokens || []);

(async () => {
  /* --- 1. Validation --- */
  {
    const api = loadBackend({ athletes: [] }, mockFetch([]));
    eq((await J(await api.handleRequestPasswordReset({ email: 'a@b.co' }))).success === true, 'email valide (inconnu) -> success générique');
    eq((await J(await api.handleRequestPasswordReset({ email: 'pasunmail' }))).success === false, 'email invalide -> erreur');
    eq((await J(await api.handleRequestPasswordReset({ email: '' }))).success === false, 'email vide -> erreur');
  }

  /* --- 2. Anti-énumération : réponse identique existant / inexistant --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'existe@x.com' }] };
    const api = loadBackend(store, mockFetch([]));
    const rExiste = await J(await api.handleRequestPasswordReset({ email: 'existe@x.com' }));
    const rInconnu = await J(await api.handleRequestPasswordReset({ email: 'inconnu@x.com' }));
    eq(rExiste.success === true && rInconnu.success === true, 'anti-enum: success dans les deux cas');
    eq(rExiste.message === rInconnu.message, 'anti-enum: MÊME message');
    eq(!('athlete_id' in rExiste) && !('id' in rExiste) && !('login' in rExiste), 'anti-enum: aucune donnée athlète renvoyée');
  }

  /* --- 3. Compte inexistant : rien créé, rien envoyé --- */
  {
    const store = { athletes: [] }; const calls = [];
    const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'inconnu@x.com' });
    eq(prt(store).length === 0, 'inexistant: aucun token créé');
    eq(calls.length === 0, 'inexistant: aucun email envoyé');
  }

  /* --- 4. Token : créé, sûr, haché, jamais en clair, +1h, used=false --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'lea@x.com' }] }; const calls = [];
    const api = loadBackend(store, mockFetch(calls));
    const t0 = Date.now();
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    eq(prt(store).length === 1, 'token: 1 ligne créée');
    const row = prt(store)[0];
    eq(row.used === false, 'token: used=false');
    eq(row.athlete_id === 'A1', 'token: bon athlete_id');
    // récupère le token brut depuis le lien de l'email
    const body = JSON.parse(calls[0].init.body);
    const m = body.html.match(/reset_token=([0-9a-f]+)/);
    const rawToken = m && m[1];
    eq(!!rawToken && rawToken.length >= 32, 'token: présent dans le lien et suffisamment long');
    eq(rawToken.length === 64, 'token: 64 hex (32 octets aléatoires)');
    eq(row.token_hash !== rawToken, 'token: la DB ne contient PAS le token brut');
    eq(row.token_hash === await api.sha256hex(rawToken), 'token: DB stocke bien le HASH du token');
    eq(!Object.values(row).includes(rawToken), 'token: aucune colonne ne contient le token brut');
    const exp = new Date(row.expires_at).getTime();
    eq(Math.abs(exp - (t0 + 3600 * 1000)) < 60 * 1000, 'token: expiration ~ +1h');
  }

  /* --- 5. Deux tokens aléatoires différents --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'lea@x.com' }] }; const calls = [];
    const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    const h1 = prt(store)[0].token_hash, h2 = prt(store)[1].token_hash;
    eq(h1 !== h2, 'deux demandes -> hashs différents (aléatoire)');
  }

  /* --- 6. Ancien token invalidé quand un nouveau est demandé --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'lea@x.com' }] }; const calls = [];
    const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    eq(prt(store).length === 2, 'usage unique: 2 lignes');
    eq(prt(store)[0].used === true, 'usage unique: ancien token invalidé (used=true)');
    eq(prt(store)[1].used === false, 'usage unique: nouveau token actif');
  }

  /* --- 7. Resend : clé côté backend, destinataire, expéditeur, lien --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'lea@x.com' }] }; const calls = []; const logs = [];
    const api = loadBackend(store, mockFetch(calls), logs);
    const resp = await J(await api.handleRequestPasswordReset({ email: 'lea@x.com' }));
    const c = calls[0];
    eq(c.url === 'https://api.resend.com/emails', 'resend: bonne URL');
    eq(c.init.headers.Authorization === 'Bearer ' + KEY, 'resend: clé en header Authorization (backend)');
    const body = JSON.parse(c.init.body);
    eq(Array.isArray(body.to) && body.to[0] === 'lea@x.com', 'resend: destinataire = email athlète');
    eq(body.from === 'Novalyz <onboarding@resend.dev>', 'resend: expéditeur onboarding@resend.dev');
    eq(/reset_token=[0-9a-f]{64}/.test(body.html), 'resend: lien contient le token brut');
    eq(!JSON.stringify(resp).includes(KEY), 'resend: clé JAMAIS dans la réponse API');
    eq(!logs.some(l => l.includes(KEY)), 'resend: clé JAMAIS dans les logs');
  }

  /* --- 8. Échec Resend : token invalidé, réponse générique inchangée --- */
  {
    const store = { athletes: [{ id: 'A1', email: 'lea@x.com' }] }; const calls = [];
    const api = loadBackend(store, mockFetch(calls, () => ({ ok: false, status: 422, json: async () => ({ error: 'x' }), text: async () => 'err' })));
    const resp = await J(await api.handleRequestPasswordReset({ email: 'lea@x.com' }));
    eq(resp.success === true, 'échec resend: réponse reste générique (anti-enum)');
    eq(prt(store)[0].used === true, 'échec resend: token invalidé (used=true)');
    eq(!JSON.stringify(resp).includes('422') && !JSON.stringify(resp).includes('err'), 'échec resend: aucun détail Resend renvoyé');
  }

  /* --- 9. Non-régression (handlers existants) --- */
  {
    const store = { athletes: [], coachs: [] };
    const api = loadBackend(store, mockFetch([]));
    const reg = await J(await api.handleRegister(P({ login: '7777', password: 'secret1', prenom: 'Z', email: 'z@x.com' })));
    eq(reg.success === true, 'non-régression: register OK');
    const log = await J(await api.handleLogin(P({ login: '7777', password: 'secret1' })));
    eq(log.success === true, 'non-régression: login OK');
    const se = await J(await api.handleSaveEmail({ athlete_id: log.athlete.athlete_id, email: 'z2@x.com' }));
    eq(se.success === true, 'non-régression: saveEmail OK');
    store.coachs.push({ coach_id: 'CA', login: 'c1', password_hash: 'H' });
    store.athletes.find(a => a.login === '7777').coach_id = 'CA';
    const cr = await J(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: log.athlete.athlete_id, nouveau_mdp: 'abcdef' }));
    eq(cr.success === true, 'non-régression: coachResetAthlete OK');
  }

  console.log(`password-reset-request.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
