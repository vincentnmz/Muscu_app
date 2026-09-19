/* =============================================================================
 * P4 — Durcissement sécurité du reset. Exécute les VRAIS handlers de prod.
 * 33 checks : token, reset, anti-énumération, Resend, coach, login, secrets.
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
      update(p) { op = 'update'; payload = p; return self; }, delete() { op = 'delete'; return self; },
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
  js += '\n;this.__api = { handleRequestPasswordReset, handleResetPassword, handleChangePassword, handleCoachResetAthlete, handleLogin, handleRegister, sha256hex, hashSalted, verifyPwd };';
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
function mockFetch(calls, responder) { return async (url, init) => { calls.push({ url: String(url), init }); return (responder || (() => ({ ok: true, status: 200, json: async () => ({}), text: async () => '' })))(); }; }
const prt = (s) => (s.password_reset_tokens || []);
function rawFrom(call) { const m = JSON.parse(call.init.body).html.match(/reset_token=([0-9a-f]+)/); return m && m[1]; }

async function baseStore() {
  const api0 = loadBackend({});
  const hash = await api0.hashSalted('ancien1', '1234');
  return {
    athletes: [{ id: 'A1', login: '1234', email: 'lea@x.com', password_hash: hash }, { id: 'A2', login: '2222', email: 'bob@x.com', password_hash: 'H2' }],
    coachs: [{ coach_id: 'CA', login: 'c1', password_hash: 'HC' }],
    password_reset_tokens: [],
  };
}

(async () => {
  /* ===== TOKEN (1-9) ===== */
  { // 1,5,6,7 : reset valide + token long + brut absent + hash présent
    const store = await baseStore(); const calls = [];
    const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    const raw = rawFrom(calls[0]);
    eq(raw && raw.length === 64, '5. token suffisamment long (64 hex)');
    const row = prt(store)[0];
    eq(row.token_hash !== raw && !Object.values(row).includes(raw), '6. token brut absent de la DB');
    eq(row.token_hash === await api.sha256hex(raw), '7. hash du token présent en DB');
    const r = await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }));
    eq(r.success === true, '1. token valide -> reset OK');
  }
  { // 2. expiré refusé
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    const raw = 'RAWEXPIRE'; store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: await api.sha256hex(raw), expires_at: new Date(Date.now() - 1000).toISOString(), used: false });
    eq((await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }))).success === false, '2. token expiré refusé');
  }
  { // 3. utilisé refusé
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    const raw = 'RAWUSED'; store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: await api.sha256hex(raw), expires_at: new Date(Date.now() + 3600000).toISOString(), used: true });
    eq((await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }))).success === false, '3. token utilisé refusé');
  }
  { // 4. token aléatoire (2 hashs différents)
    const store = await baseStore(); const calls = []; const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    eq(rawFrom(calls[0]) !== rawFrom(calls[1]), '4. token aléatoire (deux tokens différents)');
  }
  { // 8. ancien token invalidé après nouvelle demande
    const store = await baseStore(); const calls = []; const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    eq(prt(store)[0].used === true && prt(store)[1].used === false, '8. ancien token invalidé, nouveau actif');
  }
  { // 9. tous les tokens invalidés après reset réussi
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    const rawA = 'RAWA', rawB = 'RAWB';
    store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: await api.sha256hex(rawA), expires_at: new Date(Date.now() + 3600000).toISOString(), used: false });
    store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: await api.sha256hex(rawB), expires_at: new Date(Date.now() + 3600000).toISOString(), used: false });
    await api.handleResetPassword({ token: rawB, nouveau_mdp: 'nouveau1' });
    eq(prt(store).every(t => t.used === true), '9. TOUS les tokens invalidés après reset');
  }

  /* ===== RESET (10-16) ===== */
  { // 10,11,12,13
    const store = await baseStore(); const calls = []; const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    const raw = rawFrom(calls[0]);
    await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' });
    const a1 = store.athletes.find(a => a.id === 'A1');
    eq((await api.verifyPwd('nouveau1', a1.password_hash, '1234')).ok === true, '10. nouveau mdp accepté');
    eq((await api.verifyPwd('ancien1', a1.password_hash, '1234')).ok === false, '11. ancien mdp refusé');
    eq(prt(store).every(t => t.used === true), '12. token invalidé après utilisation');
    eq((await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'autre12' }))).success === false, '13. double utilisation refusée');
  }
  { // 14. token d'un autre compte : ne change que son proprio
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    const raw = 'RAWA1'; store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: await api.sha256hex(raw), expires_at: new Date(Date.now() + 3600000).toISOString(), used: false });
    const h2 = store.athletes.find(a => a.id === 'A2').password_hash;
    await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' });
    eq(store.athletes.find(a => a.id === 'A2').password_hash === h2, '14. token A1 ne touche pas A2');
  }
  { // 15,16
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    eq((await J(await api.handleResetPassword({ token: '', nouveau_mdp: 'nouveau1' }))).success === false, '15. token manquant refusé');
    eq((await J(await api.handleResetPassword({ token: 'NIMPORTEQUOI', nouveau_mdp: 'nouveau1' }))).success === false, '16. token invalide refusé');
  }

  /* ===== ANTI-ENUMERATION (17-20) ===== */
  {
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    const rE = await J(await api.handleRequestPasswordReset({ email: 'lea@x.com' }));
    const rI = await J(await api.handleRequestPasswordReset({ email: 'inconnu@x.com' }));
    eq(rE.success === true, '17. email existant -> success');
    eq(rI.success === true, '18. email inexistant -> success');
    eq(rE.message === rI.message && JSON.stringify(Object.keys(rE).sort()) === JSON.stringify(Object.keys(rI).sort()), '19. structure de réponse identique');
    eq(!('athlete_id' in rE) && !('id' in rE) && !('login' in rE) && !('email' in rE), '20. aucune donnée athlète dans la réponse');
  }

  /* ===== RESEND (21-24) ===== */
  {
    const store = await baseStore(); const calls = []; const logs = [];
    const api = loadBackend(store, mockFetch(calls), logs);
    const resp = await J(await api.handleRequestPasswordReset({ email: 'lea@x.com' }));
    eq(!JSON.stringify(resp).includes(KEY) && !logs.some(l => l.includes(KEY)), '21. clé Resend jamais exposée (réponse+logs)');
    const raw = rawFrom(calls[0]);
    eq(!JSON.stringify(resp).includes(raw), '22. token jamais exposé dans la réponse');
  }
  { // 23,24 : échec Resend
    const store = await baseStore(); const calls = [];
    const api = loadBackend(store, mockFetch(calls, () => ({ ok: false, status: 422, json: async () => ({ error: 'boom' }), text: async () => 'boom' })));
    const resp = await J(await api.handleRequestPasswordReset({ email: 'lea@x.com' }));
    eq(resp.success === true && !JSON.stringify(resp).includes('boom') && !JSON.stringify(resp).includes('422'), '23. erreur Resend masquée');
    eq(prt(store)[0].used === true, '24. token invalidé si envoi échoue');
  }

  /* ===== COACH (25-27) ===== */
  {
    const store = await baseStore(); const api = loadBackend(store, mockFetch([]));
    store.athletes.find(a => a.id === 'A1').coach_id = 'CA';
    // token email actif de A1
    store.password_reset_tokens.push({ athlete_id: 'A1', token_hash: 'H', expires_at: new Date(Date.now() + 3600000).toISOString(), used: false });
    const okOwner = await J(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'abcdef' }));
    eq(okOwner.success === true, '25. coach propriétaire accepté');
    eq(prt(store)[0].used === true, '27. token email actif invalidé après coach reset');
    const notOwner = await J(await api.handleCoachResetAthlete({ coach_id: 'AUTRE', athlete_id: 'A1', nouveau_mdp: 'abcdef' }));
    eq(notOwner.success === false, '26. coach non propriétaire refusé');
  }

  /* ===== LOGIN (28-30) ===== */
  {
    const store = await baseStore(); const calls = []; const api = loadBackend(store, mockFetch(calls));
    await api.handleRequestPasswordReset({ email: 'lea@x.com' });
    await api.handleResetPassword({ token: rawFrom(calls[0]), nouveau_mdp: 'nouveau1' });
    eq((await J(await api.handleLogin(P({ login: '1234', password: 'ancien1' })))).success !== true, '28. ancien mdp refusé après reset');
    const ok2 = await J(await api.handleLogin(P({ login: '1234', password: 'nouveau1' })));
    eq(ok2.success === true, '29. nouveau mdp accepté');
    eq(ok2.athlete && !('password_hash' in ok2.athlete), '30. password_hash absent de la réponse login');
  }

  /* ===== SECRETS (31-33) ===== */
  {
    const reSecret = /re_[A-Za-z0-9]{20,}/;   // vraie clé Resend (le fake re_test_SECRET_KEY ne matche pas)
    // Vraie clé privée = en-tête PEM + corps base64 LONG (les fausses fixtures de
    // test, ex. "QUFBQQ==", ont un corps court et ne matchent pas).
    const priv = /-----BEGIN (RSA |EC )?PRIVATE KEY-----[A-Za-z0-9+/=\s]{200,}-----END/;
    const scan = (rel) => { try { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); } catch (e) { return ''; } };
    const front = scan('js/app.js') + scan('index.html') + scan('sw.js');
    eq(!reSecret.test(front) && !priv.test(front) && !/"private_key"/.test(front), '31. aucun secret dans le frontend');
    const testsDir = fs.readdirSync(path.join(__dirname)).filter(f => f.endsWith('.test.js'));
    const testsBlob = testsDir.map(f => scan('tests/' + f)).join('\n');
    eq(!reSecret.test(testsBlob) && !priv.test(testsBlob), '32. aucun vrai secret dans les tests');
    const tracked = front + scan('supabase/functions/handler/index.ts') + fs.readdirSync(path.join(__dirname, '..', 'supabase')).filter(f => f.endsWith('.sql')).map(f => scan('supabase/' + f)).join('\n');
    eq(!reSecret.test(tracked) && !priv.test(tracked), '33. aucun secret dans les fichiers versionnés (front+backend+sql)');
  }

  console.log(`password-reset-security.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
