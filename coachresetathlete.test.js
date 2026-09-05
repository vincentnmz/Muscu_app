/* =============================================================================
 * RESET MOT DE PASSE — ÉTAPE 1 — coachResetAthlete (backend).
 * Exécute le VRAI supabase/functions/handler/index.ts : appelle le vrai handler
 * handleCoachResetAthlete, et vérifie avec les VRAIS verifyPwd/hashSalted
 * (crypto réel). Moteur Supabase en mémoire. Aucune repro de la logique.
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
      single() { single = true; return self; },
      maybeSingle() { single = true; return self; },
      then(res, rej) { try { res(resolve()); } catch (e) { rej ? rej(e) : res({ data: null, error: { message: String(e) } }); } },
    };
    function resolve() {
      if (op === 'insert') { base().push(...payload); return { data: payload, error: null }; }
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
  js += '\n;this.__api = { handleCoachResetAthlete, verifyPwd, hashSalted };';
  const client = makeEngine(store);
  const sandbox = {
    createClient: () => client,
    webpush: { setVapidDetails() {}, sendNotification: async () => {} },
    Deno: { env: { get: (k) => (k === 'PEPPER' ? 'test-pepper' : undefined) }, serve: () => {} },
    Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
    crypto: webcrypto,
    fetch: async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => '' }),
  };
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox.__api;
}

async function readJson(resp) { return await resp.json(); }

// Base fraîche : coach CA (owner), coach CB (autre), athlète A1 → CA, mdp initial.
async function setup() {
  const store = { coachs: [], athletes: [] };
  const api = loadBackend(store);
  const oldHash = await api.hashSalted('vieuxMDP', '1234');
  store.coachs.push({ coach_id: 'CA', login: 'coachA', password_hash: 'x' });
  store.coachs.push({ coach_id: 'CB', login: 'coachB', password_hash: 'y' });
  store.athletes.push({ id: 'A1', login: '1234', coach_id: 'CA', nom: 'Alice', sport: 'muscu', strategie: 'lin', password_hash: oldHash });
  return { api, store, oldHash };
}
const ath = (store) => store.athletes.find(a => a.id === 'A1');

(async () => {
  /* TEST 1 — coach propriétaire → success + hash changé */
  {
    const { api, store, oldHash } = await setup();
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'nouveauMDP' }));
    eq(r.success === true, 'coach propriétaire: success===true');
    eq(ath(store).password_hash !== oldHash, 'coach propriétaire: password_hash a changé');
    eq(!('password_hash' in r) && !('hash' in r), 'réponse ne fuit pas le hash');
  }

  /* TEST 2 — nouveau mot de passe accepté (vrai verifyPwd) */
  {
    const { api, store } = await setup();
    await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'nouveauMDP' });
    const v = await api.verifyPwd('nouveauMDP', ath(store).password_hash, '1234');
    eq(v.ok === true, 'nouveau mdp accepté par verifyPwd');
  }

  /* TEST 3 — ancien mot de passe refusé */
  {
    const { api, store } = await setup();
    await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'nouveauMDP' });
    const v = await api.verifyPwd('vieuxMDP', ath(store).password_hash, '1234');
    eq(v.ok === false, 'ancien mdp refusé après reset');
  }

  /* TEST 4 — coach NON propriétaire → refus + hash inchangé */
  {
    const { api, store, oldHash } = await setup();
    const before = ath(store).password_hash;
    eq(before === oldHash, '(pré) hash initial en place');
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'CB', athlete_id: 'A1', nouveau_mdp: 'piratage123' }));
    eq(r.success === false, 'coach non propriétaire: success===false');
    eq(ath(store).password_hash === before, 'coach non propriétaire: password_hash INCHANGÉ');
  }

  /* TEST 5 — athlète inexistant → refus, aucune écriture */
  {
    const { api, store, oldHash } = await setup();
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'NOPE', nouveau_mdp: 'abcdef1' }));
    eq(r.success === false, 'athlète inexistant: success===false');
    eq(ath(store).password_hash === oldHash, 'athlète inexistant: aucune écriture');
  }

  /* TEST 6 — coach inexistant → refus, aucune écriture */
  {
    const { api, store, oldHash } = await setup();
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'GHOST', athlete_id: 'A1', nouveau_mdp: 'abcdef1' }));
    eq(r.success === false, 'coach inexistant: success===false');
    eq(ath(store).password_hash === oldHash, 'coach inexistant: aucune écriture');
  }

  /* TEST 7 — mot de passe absent → refus, aucune écriture */
  {
    const { api, store, oldHash } = await setup();
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: '' }));
    eq(r.success === false, 'mdp absent: success===false');
    eq(ath(store).password_hash === oldHash, 'mdp absent: aucune écriture');
  }

  /* TEST 8 — mot de passe trop court (<6) → refus, aucune écriture */
  {
    const { api, store, oldHash } = await setup();
    const r = await readJson(await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'abc' }));
    eq(r.success === false, 'mdp trop court: success===false');
    eq(ath(store).password_hash === oldHash, 'mdp trop court: aucune écriture');
  }

  /* TEST 9 — aucun champ parasite modifié (seul password_hash change) */
  {
    const { api, store } = await setup();
    const before = { ...ath(store) };
    await api.handleCoachResetAthlete({ coach_id: 'CA', athlete_id: 'A1', nouveau_mdp: 'nouveauMDP' });
    const after = ath(store);
    eq(after.login === before.login, 'inchangé: login');
    eq(after.coach_id === before.coach_id, 'inchangé: coach_id');
    eq(after.nom === before.nom, 'inchangé: nom');
    eq(after.sport === before.sport, 'inchangé: sport');
    eq(after.strategie === before.strategie, 'inchangé: strategie');
    eq(after.id === before.id, 'inchangé: id');
    eq(after.password_hash !== before.password_hash, 'changé: password_hash uniquement');
  }

  console.log(`coach-reset-athlete.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
