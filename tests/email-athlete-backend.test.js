/* =============================================================================
 * RESET PAR EMAIL — P1 — Stockage de l'email (backend).
 * Exécute le VRAI index.ts : handleSaveEmail / handleRegister / handleLogin +
 * _emailValide. Moteur Supabase en mémoire (insert().select().single() renvoie
 * l'objet), crypto réel pour hashSalted, PEPPER de test. Aucune repro.
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
      from(t) { return q(t); },
      select() { return self; },
      insert(p) { op = 'insert'; payload = Array.isArray(p) ? p : [p]; return self; },
      update(p) { op = 'update'; payload = p; return self; },
      delete() { op = 'delete'; return self; },
      eq(c, v) { filters.push(r => String(r[c]) === String(v)); return self; },
      limit() { return self; },
      order() { return self; },
      single() { single = true; return self; },
      maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function resolve() {
      if (op === 'insert' || op === 'upsert') { base().push(...payload); return { data: single ? payload[0] : payload, error: null }; }
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
  js += '\n;this.__api = { handleSaveEmail, handleRegister, handleLogin, hashSalted, _emailValide };';
  const client = makeEngine(store);
  const sandbox = {
    createClient: () => client,
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => (k === 'PEPPER' ? 'test-pepper' : undefined) }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: webcrypto, fetch: async () => ({ ok: false, json: async () => ({}), text: async () => '' }),
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox.__api;
}
const J = async (resp) => await resp.json();
const P = (o) => new URLSearchParams(o);

(async () => {
  /* --- 1. _emailValide ---------------------------------------------------- */
  {
    const api = loadBackend({});
    eq(api._emailValide('a@b.co') === true, "valide: a@b.co");
    eq(api._emailValide('prenom.nom@gmail.com') === true, 'valide: prenom.nom@gmail.com');
    eq(api._emailValide('abc') === false, 'invalide: abc');
    eq(api._emailValide('a@b') === false, 'invalide: a@b (pas de TLD)');
    eq(api._emailValide('') === false, 'invalide: vide');
    eq(api._emailValide('a b@c.com') === false, 'invalide: espace');
  }

  /* --- 2. saveEmail : stockage ------------------------------------------- */
  {
    const store = { athletes: [{ id: 'A1', login: '1234', nom: 'Alice' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveEmail({ athlete_id: 'A1', email: 'alice@mail.com' }));
    eq(r.success === true, 'saveEmail: success');
    eq(store.athletes[0].email === 'alice@mail.com', 'saveEmail: email stocké');
  }

  /* --- 3. saveEmail : email vide efface ---------------------------------- */
  {
    const store = { athletes: [{ id: 'A1', login: '1234', email: 'old@mail.com' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveEmail({ athlete_id: 'A1', email: '' }));
    eq(r.success === true, 'saveEmail vide: success');
    eq(store.athletes[0].email == null, 'saveEmail vide: email effacé (null)');
  }

  /* --- 4. saveEmail : format invalide → refus, inchangé ------------------ */
  {
    const store = { athletes: [{ id: 'A1', login: '1234', email: 'garde@mail.com' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveEmail({ athlete_id: 'A1', email: 'pasunemail' }));
    eq(r.success === false, 'saveEmail invalide: success false');
    eq(store.athletes[0].email === 'garde@mail.com', 'saveEmail invalide: email INCHANGÉ');
  }

  /* --- 5. saveEmail : athlete_id manquant -------------------------------- */
  {
    const api = loadBackend({ athletes: [] });
    const r = await J(await api.handleSaveEmail({ athlete_id: '', email: 'a@b.co' }));
    eq(r.success === false, 'saveEmail sans athlete_id: success false');
  }

  /* --- 6. register avec email valide ------------------------------------- */
  {
    const store = { athletes: [] };
    const api = loadBackend(store);
    const r = await J(await api.handleRegister(P({ login: '9001', password: 'secret1', prenom: 'Bob', email: 'bob@mail.com' })));
    eq(r.success === true, 'register email: success');
    eq(r.athlete.email === 'bob@mail.com', 'register email: renvoyé dans athlete');
    eq(store.athletes[0].email === 'bob@mail.com', 'register email: stocké en base');
  }

  /* --- 7. register email invalide → refus, aucune insertion -------------- */
  {
    const store = { athletes: [] };
    const api = loadBackend(store);
    const r = await J(await api.handleRegister(P({ login: '9002', password: 'secret1', prenom: 'Bob', email: 'nope' })));
    eq(!r.success && /invalide/i.test(r.erreur || r.message || ''), 'register email invalide: erreur');
    eq(store.athletes.length === 0, 'register email invalide: aucune insertion');
  }

  /* --- 8. register SANS email (optionnel) → OK --------------------------- */
  {
    const store = { athletes: [] };
    const api = loadBackend(store);
    const r = await J(await api.handleRegister(P({ login: '9003', password: 'secret1', prenom: 'Bob' })));
    eq(r.success === true, 'register sans email: success (optionnel)');
    eq(r.athlete.email === '', 'register sans email: email vide');
    eq(store.athletes[0].email == null, 'register sans email: null en base');
  }

  /* --- 9. login renvoie l'email ------------------------------------------ */
  {
    const api0 = loadBackend({ athletes: [] });
    const hash = await api0.hashSalted('secret1', '1234');
    const store = { athletes: [{ id: 'A1', login: '1234', nom: 'Alice', password_hash: hash, email: 'alice@mail.com' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleLogin(P({ login: '1234', password: 'secret1' })));
    eq(r.success === true, 'login: success');
    eq(r.athlete.email === 'alice@mail.com', 'login: email renvoyé');
  }

  console.log(`email-athlete-backend.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
