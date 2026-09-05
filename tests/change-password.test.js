/* =============================================================================
 * SELF-SERVICE — Modifier son mot de passe (athlète connecté).
 * Backend : vrai handleChangePassword + vrais verifyPwd/hashSalted (crypto réel).
 * Front : vrai bloc __CHANGE_PWD_* de js/app.js (document/fetch stubs).
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
      update(p) { op = 'update'; payload = p; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
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
  js += '\n;this.__api = { handleChangePassword, verifyPwd, hashSalted };';
  const sandbox = {
    createClient: () => makeEngine(store),
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => (k === 'PEPPER' ? 'test-pepper' : undefined) }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: webcrypto, fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
  };
  vm.createContext(sandbox); vm.runInContext(js, sandbox); return sandbox.__api;
}
const J = async (r) => await r.json();

/* ---------- Front ---------- */
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const bloc = APP.split('/* __CHANGE_PWD_START__')[1].split('__CHANGE_PWD_END__ */')[0];
const FRONT = '/*' + bloc + '*/\n;this.__fns = { changerMonMotDePasse };';
function ctxFront({ athlete, fetchImpl } = {}) {
  const els = {}; const el = (id) => (els[id] || (els[id] = { id, value: '', textContent: '', style: {} }));
  const toasts = [];
  const sandbox = {
    athlete: athlete === undefined ? { athlete_id: 'A1' } : athlete,
    SCRIPT_URL: 'https://backend/x', showToast: (t) => toasts.push(t),
    document: { getElementById: el }, fetch: fetchImpl || (async () => ({ json: async () => ({ success: true }) })), console,
  };
  sandbox.globalThis = sandbox; vm.createContext(sandbox); vm.runInContext(FRONT, sandbox);
  return { fns: sandbox.__fns, el, toasts };
}

(async () => {
  /* ===== BACKEND ===== */
  async function seed() {
    const api0 = loadBackend({ athletes: [] });
    const hash = await api0.hashSalted('ancien1', '1234');
    const store = { athletes: [{ id: 'A1', login: '1234', nom: 'Alice', password_hash: hash }] };
    return { api: loadBackend(store), store };
  }
  const ath = (s) => s.athletes.find(a => a.id === 'A1');

  { // 1. ancien correct → success + hash change + nouveau valide
    const { api, store } = await seed();
    const r = await J(await api.handleChangePassword({ athlete_id: 'A1', ancien_mdp: 'ancien1', nouveau_mdp: 'nouveau1' }));
    eq(r.success === true, 'backend: ancien correct → success');
    const v = await api.verifyPwd('nouveau1', ath(store).password_hash, '1234');
    eq(v.ok === true, 'backend: nouveau mdp accepté');
    const vOld = await api.verifyPwd('ancien1', ath(store).password_hash, '1234');
    eq(vOld.ok === false, 'backend: ancien mdp refusé après changement');
  }
  { // 2. ancien incorrect → refus, hash inchangé
    const { api, store } = await seed();
    const before = ath(store).password_hash;
    const r = await J(await api.handleChangePassword({ athlete_id: 'A1', ancien_mdp: 'FAUX', nouveau_mdp: 'nouveau1' }));
    eq(r.success === false && /actuel incorrect/i.test(r.error), 'backend: ancien faux → erreur');
    eq(ath(store).password_hash === before, 'backend: ancien faux → hash INCHANGÉ');
  }
  { // 3. nouveau trop court → refus
    const { api, store } = await seed();
    const before = ath(store).password_hash;
    const r = await J(await api.handleChangePassword({ athlete_id: 'A1', ancien_mdp: 'ancien1', nouveau_mdp: 'abc' }));
    eq(r.success === false, 'backend: nouveau trop court → refus');
    eq(ath(store).password_hash === before, 'backend: trop court → hash inchangé');
  }
  { // 4. params manquants
    const { api } = await seed();
    const r = await J(await api.handleChangePassword({ athlete_id: 'A1', ancien_mdp: '', nouveau_mdp: '' }));
    eq(r.success === false, 'backend: params manquants → refus');
  }
  { // 5. athlète inexistant
    const { api } = await seed();
    const r = await J(await api.handleChangePassword({ athlete_id: 'NOPE', ancien_mdp: 'ancien1', nouveau_mdp: 'nouveau1' }));
    eq(r.success === false, 'backend: athlète inexistant → refus');
  }

  /* ===== FRONT ===== */
  { // payload correct + succès
    let cap = null;
    const c = ctxFront({ athlete: { athlete_id: 'ATH-3' }, fetchImpl: async (u, i) => { cap = JSON.parse(i.body); return { json: async () => ({ success: true }) }; } });
    c.el('pwd-actuel').value = 'vieux12'; c.el('pwd-nouveau').value = 'neuf1234';
    await c.fns.changerMonMotDePasse(); await tick();
    eq(cap.action === 'changePassword', 'front: action changePassword');
    eq(cap.athlete_id === 'ATH-3', 'front: athlete_id de session');
    eq(cap.ancien_mdp === 'vieux12' && cap.nouveau_mdp === 'neuf1234', 'front: ancien + nouveau transmis');
    eq(/modifié/i.test(c.el('pwd-msg').textContent), 'front: message succès');
    eq(c.el('pwd-actuel').value === '' && c.el('pwd-nouveau').value === '', 'front: champs vidés après succès');
  }
  { // erreur backend
    const c = ctxFront({ fetchImpl: async () => ({ json: async () => ({ success: false, error: 'Mot de passe actuel incorrect' }) }) });
    c.el('pwd-actuel').value = 'x123456'; c.el('pwd-nouveau').value = 'y123456';
    await c.fns.changerMonMotDePasse(); await tick();
    eq(/actuel incorrect/i.test(c.el('pwd-msg').textContent), 'front: erreur backend affichée');
  }
  { // validations bloquent l'appel
    let appele = false; const fetchImpl = async () => { appele = true; return { json: async () => ({ success: true }) }; };
    const c = ctxFront({ fetchImpl });
    c.el('pwd-actuel').value = 'abcdef'; c.el('pwd-nouveau').value = 'abc'; // trop court
    await c.fns.changerMonMotDePasse(); await tick();
    eq(appele === false, 'front: nouveau trop court → aucun appel');
    c.el('pwd-nouveau').value = 'abcdef'; // == ancien
    await c.fns.changerMonMotDePasse(); await tick();
    eq(appele === false, 'front: nouveau == ancien → aucun appel');
    eq(/différent/i.test(c.el('pwd-msg').textContent), 'front: message "différent"');
  }
  { // non connecté
    let appele = false; const c = ctxFront({ athlete: null, fetchImpl: async () => { appele = true; return { json: async () => ({}) }; } });
    c.el('pwd-actuel').value = 'a12345'; c.el('pwd-nouveau').value = 'b12345';
    await c.fns.changerMonMotDePasse(); await tick();
    eq(appele === false, 'front: sans athlète → aucun appel');
    eq(c.toasts.some(t => /connecte/i.test(t)), 'front: sans athlète → toast');
  }

  console.log(`change-password.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
