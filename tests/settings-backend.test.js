/* =============================================================================
 * RÉGLAGES v3 — backend des actions profil/coach.
 * Exécute le VRAI index.ts : handleSaveProfil / handleSaveCoachProfil /
 * handleChangePasswordCoach / handleSaveClubCoach + verifyPwd/hashSalted réels.
 * Moteur Supabase en mémoire. Vérifie aussi que seuls les champs voulus bougent.
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
  js += '\n;this.__api = { handleSaveProfil, handleSaveCoachProfil, handleChangePasswordCoach, handleSaveClubCoach, handleLoginCoach, verifyPwd, hashSalted };';
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
const P = (o) => new URLSearchParams(o);

(async () => {
  /* --- saveProfil : met à jour les bons champs seulement --- */
  {
    const store = { athletes: [{ id: 'A1', login: '1234', nom: 'Léa', taille: 168, poids: 61, annees: 4, ddn: '2001-03-12', coach_id: 'CA', password_hash: 'H' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveProfil({ athlete_id: 'A1', nom: 'Léa M.', taille: 170, poids: 62, annees: 5, ddn: '2001-03-12' }));
    const a = store.athletes[0];
    eq(r.success === true, 'saveProfil: success');
    eq(a.nom === 'Léa M.' && a.taille === 170 && a.poids === 62 && a.annees === 5, 'saveProfil: champs mis à jour');
    eq(a.login === '1234' && a.coach_id === 'CA' && a.password_hash === 'H', 'saveProfil: login/coach/hash INCHANGÉS');
  }
  { // saveProfil : rien fourni → refus
    const store = { athletes: [{ id: 'A1', nom: 'X' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveProfil({ athlete_id: 'A1' }));
    eq(r.success === false, 'saveProfil: rien à enregistrer → refus');
  }

  /* --- saveCoachProfil : nom + email --- */
  {
    const store = { coachs: [{ coach_id: 'CA', login: 'c1', nom: 'Martin', password_hash: 'H' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveCoachProfil({ coach_id: 'CA', nom: 'Coach Martin', email: 'martin@club.fr' }));
    eq(r.success === true, 'saveCoachProfil: success');
    eq(store.coachs[0].nom === 'Coach Martin' && store.coachs[0].email === 'martin@club.fr', 'saveCoachProfil: nom+email');
    eq(store.coachs[0].password_hash === 'H', 'saveCoachProfil: hash inchangé');
    const r2 = await J(await api.handleSaveCoachProfil({ coach_id: 'CA', email: 'pasunmail' }));
    eq(r2.success === false, 'saveCoachProfil: email invalide → refus');
    eq(store.coachs[0].email === 'martin@club.fr', 'saveCoachProfil: email inchangé après refus');
  }

  /* --- changePasswordCoach --- */
  {
    const api0 = loadBackend({ coachs: [] });
    const hash = await api0.hashSalted('vieux1', 'c1');
    const store = { coachs: [{ coach_id: 'CA', login: 'c1', nom: 'M', password_hash: hash }] };
    const api = loadBackend(store);
    const bad = await J(await api.handleChangePasswordCoach({ coach_id: 'CA', ancien_mdp: 'FAUX', nouveau_mdp: 'neuf12' }));
    eq(bad.success === false && /actuel incorrect/i.test(bad.error), 'changePasswordCoach: ancien faux → refus');
    eq(store.coachs[0].password_hash === hash, 'changePasswordCoach: hash inchangé si ancien faux');
    const good = await J(await api.handleChangePasswordCoach({ coach_id: 'CA', ancien_mdp: 'vieux1', nouveau_mdp: 'neuf12' }));
    eq(good.success === true, 'changePasswordCoach: ancien correct → success');
    const v = await api.verifyPwd('neuf12', store.coachs[0].password_hash, 'c1');
    eq(v.ok === true, 'changePasswordCoach: nouveau mdp accepté');
  }

  /* --- saveClubCoach --- */
  {
    const store = { coachs: [{ coach_id: 'CA', login: 'c1', nom: 'M', password_hash: 'H' }] };
    const api = loadBackend(store);
    const r = await J(await api.handleSaveClubCoach({ coach_id: 'CA', club: 'AS Novalyz', categorie_defaut: 'U17' }));
    eq(r.success === true, 'saveClubCoach: success');
    eq(store.coachs[0].club === 'AS Novalyz' && store.coachs[0].categorie_defaut === 'U17', 'saveClubCoach: club+catégorie');
  }

  /* --- loginCoach renvoie les nouveaux champs --- */
  {
    const api0 = loadBackend({ coachs: [] });
    const hash = await api0.hashSalted('pass12', 'c1');
    const store = { coachs: [{ coach_id: 'CA', login: 'c1', nom: 'M', sport: 'foot', role: 'coach', email: 'm@c.fr', club: 'AS', categorie_defaut: 'U17', password_hash: hash }] };
    const api = loadBackend(store);
    const r = await J(await api.handleLoginCoach(P({ login: 'c1', password: 'pass12' })));
    eq(r.success === true, 'loginCoach: success');
    eq(r.coach.email === 'm@c.fr' && r.coach.club === 'AS' && r.coach.categorie_defaut === 'U17', 'loginCoach: email/club/catégorie renvoyés');
  }

  console.log(`settings-backend.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
