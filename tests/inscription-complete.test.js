/* =============================================================================
 * INSCRIPTION COMPLÈTE (07/11) — champs obligatoires côté serveur + loginDispo.
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
  js += '\n;this.__api = { handleSaveEmail, handleRegister, handleLogin, hashSalted, _emailValide, handleLoginDispo, handleRegisterCoach };';
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
  const BASE = { login: '4000', password: 'secret1', prenom: 'Inès', email: 'ines@x.fr', sexe: 'F', ddn: '2000-01-01', taille: '165', poids: '58', annees: '1', sport: 'muscu' };
  const essai = async (patch, motif, label) => {
    const store = { athletes: [] };
    const api = loadBackend(store);
    const r = await J(await api.handleRegister(P(Object.assign({}, BASE, patch))));
    eq(!r.success && motif.test(r.erreur || r.message || ''), label + ' → refus précis (' + (r.erreur || r.message) + ')');
    eq(store.athletes.length === 0, label + ' → aucune insertion');
  };
  { const store = { athletes: [] }; const api = loadBackend(store);
    const r = await J(await api.handleRegister(P(BASE)));
    eq(r.success === true, 'complet → OK');
    eq(store.athletes[0] && store.athletes[0].sexe === 'F', 'sexe stocké'); }
  await essai({ login: '40' }, /4 chiffres/, 'login pas 4 chiffres');
  await essai({ prenom: '' }, /prénom/i, 'sans prénom');
  await essai({ email: '' }, /e-mail/i, 'sans e-mail');
  await essai({ sexe: '' }, /sexe/i, 'sans sexe');
  await essai({ ddn: '' }, /naissance/i, 'sans date de naissance');
  await essai({ taille: '' }, /taille/i, 'sans taille');
  await essai({ poids: '' }, /poids/i, 'sans poids');
  await essai({ taille: '40' }, /taille/i, 'taille absurde');
  await essai({ annees: '' }, /années/i, 'muscu sans années');
  { const store = { athletes: [{ id: 'A1', login: '4000' }] }; const api = loadBackend(store);
    const r = await J(await api.handleRegister(P(BASE)));
    eq(!r.success && r.login_pris === true && /déjà pris/.test(r.message), 'login pris → message précis + login_pris'); }
  { const api = loadBackend({ athletes: [{ id: 'A1', login: '4000' }] });
    const a = await J(await api.handleLoginDispo({ login: '4000' }));
    eq(a.valide && a.dispo === false && /^\d{4}$/.test(a.propose) && a.propose !== '4000', 'loginDispo pris → proposition libre');
    const b = await J(await api.handleLoginDispo({ login: '4001' }));
    eq(b.valide && b.dispo === true, 'loginDispo libre');
    const c = await J(await api.handleLoginDispo({ login: '12' }));
    eq(c.valide === false, 'loginDispo format invalide'); }
  { const C = { login: 'coachz', password: 'secret1', nom: 'Max', email: 'm@x.fr', sport: 'muscu' };
    for (const [k, re] of [['nom', /nom/i], ['email', /e-mail/i], ['sport', /sport/i]]) {
      const store = { coachs: [] }; const api = loadBackend(store);
      const r = await J(await api.handleRegisterCoach(Object.assign({}, C, { [k]: '' })));
      eq(!r.success && re.test(r.error || ''), 'coach sans ' + k + ' → refus'); eq(store.coachs.length === 0, 'coach sans ' + k + ' → aucune insertion'); }
    const store = { coachs: [] }; const api = loadBackend(store);
    const r = await J(await api.handleRegisterCoach(C));
    eq(r.success === true, 'coach complet → OK'); }
  console.log(`inscription-complete.test.js : ${ok} OK / ${ko} KO`);
  if (ko) process.exit(1);
})();
