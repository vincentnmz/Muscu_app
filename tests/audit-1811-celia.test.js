/* =============================================================================
 * Audit 18/11 (Célia, Vincent) — date d'un record égalé.
 * Exécute la VRAIE computeGlobal d'index.ts : à égalité (même charge, mêmes reps),
 * le record garde la date où il a été atteint la première fois, quel que soit
 * l'ordre des perfs (la base les renvoie du plus récent au plus ancien).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { computeGlobal };';
const sandbox = {
  createClient: () => ({ from: () => ({}) }),
  webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
  crypto: webcrypto, fetch: async () => ({}),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const { computeGlobal } = sandbox.__api;

let ok = 0, ko = 0;
function eq(cond, label, got) { if (cond) ok++; else { ko++; console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } }
const P = (date, charge, reps) => ({ date, exercice: 'Hip thrust machine', muscle: 'Fessier', charge, reps, rpe: 10 });

// Données réelles anonymisées (Célia) : 80×10 le 10/11, puis 3×(80×10) le 13/11.
const desc = [P('2026-11-13', 80, 10), P('2026-11-13', 80, 10), P('2026-11-10', 80, 9), P('2026-11-10', 80, 10)];
let r = computeGlobal(desc).records_par_exo['Hip thrust machine'];
eq(r && r.date === '10/11/2026' && r.charge === 80 && r.reps === 10, 'ordre récent → ancien : record 80×10 daté du 10/11 (1re fois)', r);
r = computeGlobal(desc.slice().reverse()).records_par_exo['Hip thrust machine'];
eq(r && r.date === '10/11/2026', 'ordre ancien → récent : même date', r);
// Un vrai record plus tard déplace bien la date.
r = computeGlobal([P('2026-11-18', 80, 11)].concat(desc)).records_par_exo['Hip thrust machine'];
eq(r && r.date === '18/11/2026' && r.reps === 11, '80×11 le 18/11 = nouveau record, nouvelle date', r);

console.log('-'.repeat(70));
console.log('audit 18/11 Célia (records) : ' + ok + ' OK / ' + ko + ' KO');
process.exit(ko ? 1 : 0);
