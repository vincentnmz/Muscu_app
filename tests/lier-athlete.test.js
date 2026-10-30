/* =============================================================================
 * LIER UN ATHLÈTE (audit 30/10) — vrai handler lierAthlete / detacherCoach.
 * Avant : la liaison écrasait sans rien dire le coach d'un athlète déjà suivi.
 * Moteur Supabase en mémoire.
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
  js += '\n;this.__api = { handleLierAthlete, handleDetacherCoach };';
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
  const store = { athletes: [
    { id: 1, login: '1234', nom: 'Libre', coach_id: null },
    { id: 2, login: '5678', nom: 'Suivi', coach_id: 'C2' },
    { id: 3, login: '9999', nom: 'Mien', coach_id: 'C1' },
  ], coachs: [{ coach_id: 'C1', nom: 'Coach A' }, { coach_id: 'C2', nom: 'Coach B' }] };
  const api = loadBackend(store);
  const call = async (p) => (await api.handleLierAthlete(new URLSearchParams(p))).json();
  const ath = id => store.athletes.find(a => a.id === id);

  let r = await call({ coach_id: 'C1', login_athlete: '1234' });
  eq(r.success && ath(1).coach_id === 'C1' && r.nom === 'Libre', 'athlète libre → rattaché, nom renvoyé');
  r = await call({ coach_id: 'C1', login_athlete: '5678' });
  eq(!r.success && r.deja_autre && ath(2).coach_id === 'C2', 'athlète d\'un autre coach → refusé, coach inchangé');
  r = await call({ coach_id: 'C1', athlete_id: '2' });
  eq(!r.success && ath(2).coach_id === 'C2', 'même refus par athlete_id');
  r = await call({ coach_id: 'C1', login_athlete: '9999' });
  eq(r.success && r.deja === true, 'déjà dans mon équipe → succès « déjà »');
  r = await call({ coach_id: 'C1', login_athlete: '12a4' });
  eq(!r.success && /4 chiffres/.test(r.error), 'login non 4 chiffres → refusé');
  r = await call({ coach_id: 'C1', login_athlete: '0000' });
  eq(!r.success && /Aucun athlète/.test(r.error), 'login inconnu → message clair');

  r = await (await api.handleDetacherCoach({ athlete_id: '2' })).json();
  eq(r.success && ath(2).coach_id === null, 'athlète quitte son coach → coach_id null');
  r = await call({ coach_id: 'C1', login_athlete: '5678' });
  eq(r.success && ath(2).coach_id === 'C1', 'après départ, un nouveau coach peut le lier');

  // Front : sync coach_lie + validation 4 chiffres + toast
  const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  eq(/_safe\('coach-lie'/.test(SRC) && /function _syncCoachLie/.test(SRC), 'front : coach_lie synchronisé à chaque getAppData');
  eq(/est rattaché à ton équipe/.test(SRC), 'front : toast de succès après liaison');
  const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
  eq(/coach_lie: coachLie/.test(TS) && /case 'detacherCoach'/.test(TS), 'backend : getAppData renvoie coach_lie + route detacherCoach');

  console.log('lier-athlete : ' + ok + ' OK / ' + ko + ' KO');
  if (ko) process.exit(1);
})();
