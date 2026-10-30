/* =============================================================================
 * SAISIE DE SÉANCE PAR LE COACH (présentiel, 30/10) — vrai handleSaveSeance.
 * La séance compte dès que le coach valide, avec la trace « saisie par ton coach ».
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
  js += '\n;this.__api = { handleSaveSeance, buildSeancesDetail };';
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

(async () => {
  const store = { athletes: [{ id: 1, login: '1234', nom: 'Vincent', coach_id: 'C1' }], performances: [], indicateurs: [] };
  const api = loadBackend(store);
  const L = [['2026-10-30', 44, 'dos jambe 2', 'Vincent', '1', 'Traction', 'Dos', '68', 1, 0, 7, 8, 180, 7], ['2026-10-30', 44, 'dos jambe 2', 'Vincent', '1', 'Traction', 'Dos', '68', 2, 0, 7, 8, 180, 7]];
  let r = await (await api.handleSaveSeance(L, 'C1')).json();
  eq(r.ok && store.performances.length === 2, 'séance saisie par le coach → enregistrée au nom de l\'athlète (2 séries)');
  const sp = store.indicateurs.filter(x => x.cle === 'saisi_par');
  eq(sp.length === 1 && sp[0].valeur === 'coach:C1' && sp[0].seance_id === 'dos jambe 2' && String(sp[0].athlete_id) === '1', 'trace « saisi_par = coach:C1 » posée sur la séance');
  r = await (await api.handleSaveSeance([['2026-10-31', 44, 'pec', 'Vincent', '1', 'Curl', 'Biceps', '3', 1, 10, 10, 8, 90, 100]])).json();
  eq(r.ok && store.indicateurs.filter(x => x.cle === 'saisi_par').length === 1, 'séance de l\'athlète lui-même → pas de trace coach');
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  eq(/saisi_par_coach: String\(coach && coach.coach_id/.test(SRC), 'front : le coach envoie saisi_par_coach');
  eq(/if \(_saisieCoach\) \{ _validationEnCours = true; _bloquerBoutonsValidation\(\); _envoyerSeance\(\); return; \}/.test(SRC), 'front : en saisie coach, pas de bilan (ressenti) rempli à la place de l\'athlète');
  eq(/if \(_saisieCoach\) return null;/.test(SRC), 'front : pas de brouillon de l\'athlète sur le téléphone du coach');
  eq(!/_appliquerAppData\(/.test(SRC.slice(SRC.indexOf('async function coachSaisirSeance'), SRC.indexOf('function coachQuitterSaisie'))), 'front : la saisie coach n\'appelle pas _appliquerAppData (pas d\'import montre au nom de l\'athlète)');
  const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
  eq(/action === 'saveSeance' && body && Array.isArray\(body.data\)/.test(TS), 'backend : saveSeance vérifie que chaque ligne appartient à un athlète autorisé');
  console.log('saisie coach : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) process.exit(1);
})();
