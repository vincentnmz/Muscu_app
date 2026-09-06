/* =============================================================================
 * P3 — Complétion du reset. Backend handleResetPassword (vrai handler +
 * verifyPwd/hashSalted/sha256hex réels) + front (bloc __RESET_FLOW_*).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let ok = 0, ko = 0;
function eq(cond, label) { if (cond) { ok++; } else { ko++; console.error('  ✗ ' + label); } }
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---------- Backend ---------- */
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
function loadBackend(store) {
  let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
  js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
  js += '\n;this.__api = { handleResetPassword, sha256hex, hashSalted, verifyPwd };';
  const sandbox = {
    createClient: () => makeEngine(store),
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => (k === 'PEPPER' ? 'test-pepper' : undefined) }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: webcrypto, fetch: async () => ({ ok: false, json: async () => ({}) }),
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
const J = async (r) => await r.json();
const IN_1H = () => new Date(Date.now() + 3600 * 1000).toISOString();
const AGO_1H = () => new Date(Date.now() - 3600 * 1000).toISOString();

/* ---------- Front ---------- */
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function grab(tag) { return '/*' + APP.split('/* __' + tag + '_START__')[1].split('__' + tag + '_END__ */')[0] + '*/'; }
const FRONT = [grab('EMAIL_ATHLETE'), grab('RESET_FLOW')].join('\n') + '\n;this.__fns = { envoyerMdpOublie, validerNouveauMdp, _detecterResetToken };';
function ctxFront({ fetchImpl, search } = {}) {
  const els = {}; const el = (id) => (els[id] || (els[id] = { id, value: '', textContent: '', style: {}, disabled: false }));
  const sandbox = {
    SCRIPT_URL: 'https://backend/x', document: { getElementById: el },
    location: { search: search || '', pathname: '/' }, history: { replaceState() {} }, URLSearchParams,
    fetch: fetchImpl || (async () => ({ json: async () => ({ success: true }) })), setTimeout: () => 0, console,
  };
  sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(FRONT, sandbox);
  return { fns: sandbox.__fns, el };
}

(async () => {
  /* ===== BACKEND ===== */
  async function seed({ expires, used } = {}) {
    const api0 = loadBackend({});
    const raw = 'ABC123rawtoken';
    const token_hash = await api0.sha256hex(raw);
    const oldHash = await api0.hashSalted('ancien1', '1234');
    const store = {
      athletes: [{ id: 'A1', login: '1234', password_hash: oldHash }],
      password_reset_tokens: [{ athlete_id: 'A1', token_hash, expires_at: expires || IN_1H(), used: used || false }],
    };
    return { api: loadBackend(store), store, raw, oldHash };
  }
  const tok = (s) => s.password_reset_tokens[0];
  const ath = (s) => s.athletes[0];

  { // 1. token valide → succès + hash changé + token consommé
    const { api, store, raw, oldHash } = await seed();
    const r = await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }));
    eq(r.success === true, 'valide: success');
    eq(ath(store).password_hash !== oldHash, 'valide: hash changé');
    const v = await api.verifyPwd('nouveau1', ath(store).password_hash, '1234');
    eq(v.ok === true, 'valide: nouveau mdp accepté');
    eq(tok(store).used === true, 'valide: token marqué used (usage unique)');
  }
  { // 2. token déjà utilisé → refus
    const { api, store, raw, oldHash } = await seed({ used: true });
    const r = await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }));
    eq(r.success === false, 'used: refus');
    eq(ath(store).password_hash === oldHash, 'used: hash inchangé');
  }
  { // 3. mauvais token → refus
    const { api, store, oldHash } = await seed();
    const r = await J(await api.handleResetPassword({ token: 'MAUVAIS', nouveau_mdp: 'nouveau1' }));
    eq(r.success === false && /invalide/i.test(r.error), 'mauvais token: refus');
    eq(ath(store).password_hash === oldHash, 'mauvais token: hash inchangé');
  }
  { // 4. token expiré → refus + invalidé
    const { api, store, raw, oldHash } = await seed({ expires: AGO_1H() });
    const r = await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'nouveau1' }));
    eq(r.success === false && /expir/i.test(r.error), 'expiré: refus');
    eq(ath(store).password_hash === oldHash, 'expiré: hash inchangé');
    eq(tok(store).used === true, 'expiré: token invalidé');
  }
  { // 5. mot de passe trop court → refus
    const { api, store, raw, oldHash } = await seed();
    const r = await J(await api.handleResetPassword({ token: raw, nouveau_mdp: 'abc' }));
    eq(r.success === false, 'trop court: refus');
    eq(ath(store).password_hash === oldHash && tok(store).used === false, 'trop court: rien changé');
  }
  { // 6. params manquants
    const { api } = await seed();
    eq((await J(await api.handleResetPassword({ token: '', nouveau_mdp: '' }))).success === false, 'params manquants: refus');
  }

  /* ===== FRONT ===== */
  { // envoyer demande : payload requestPasswordReset
    let cap = null;
    const c = ctxFront({ fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('forgot-email').value = 'lea@x.com';
    await c.fns.envoyerMdpOublie(); await tick();
    eq(cap.action === 'requestPasswordReset' && cap.email === 'lea@x.com', 'forgot: action + email');
    eq(/reçevoir|recevoir|correspond/i.test(c.el('forgot-msg').textContent), 'forgot: message générique affiché');
  }
  { // email invalide → aucun appel
    let appele = false;
    const c = ctxFront({ fetchImpl: async () => { appele = true; return { json: async () => ({ success: true }) }; } });
    c.el('forgot-email').value = 'pasunmail';
    await c.fns.envoyerMdpOublie(); await tick();
    eq(appele === false, 'forgot: email invalide → aucun appel');
  }
  { // détection du token depuis l'URL
    const c = ctxFront({ search: '?reset_token=DEADBEEF' });
    c.fns._detecterResetToken();
    eq(c.el('reset-overlay').style.display === 'flex', 'detect: overlay ouvert quand ?reset_token présent');
  }
  { // valider nouveau mdp : payload resetPassword avec le token détecté
    let cap = null;
    const c = ctxFront({ search: '?reset_token=TOK123', fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.fns._detecterResetToken();
    c.el('reset-new').value = 'nouveau1'; c.el('reset-confirm').value = 'nouveau1';
    await c.fns.validerNouveauMdp(); await tick();
    eq(cap.action === 'resetPassword' && cap.token === 'TOK123' && cap.nouveau_mdp === 'nouveau1', 'reset: action + token + mdp');
    eq(/modifié/i.test(c.el('reset-msg').textContent), 'reset: message succès');
  }
  { // validations : mismatch et trop court → aucun appel
    let appele = false;
    const c = ctxFront({ search: '?reset_token=T', fetchImpl: async () => { appele = true; return { json: async () => ({ success: true }) }; } });
    c.fns._detecterResetToken();
    c.el('reset-new').value = 'nouveau1'; c.el('reset-confirm').value = 'DIFFERENT';
    await c.fns.validerNouveauMdp(); await tick();
    eq(appele === false && /correspond/i.test(c.el('reset-msg').textContent), 'reset: mdp différents → aucun appel');
    c.el('reset-confirm').value = 'abc'; c.el('reset-new').value = 'abc';
    await c.fns.validerNouveauMdp(); await tick();
    eq(appele === false, 'reset: trop court → aucun appel');
  }

  console.log(`password-reset-complete.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
