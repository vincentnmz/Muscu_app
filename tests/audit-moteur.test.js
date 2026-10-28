/* =============================================================================
 * Audit moteur 26/10/2026 — verrous des correctifs (VRAIES fonctions d'index.ts).
 *   #2 noms de muscles canoniques · #3 la charge seule ne fait pas de risque ·
 *   #4 courbatures = dernière saisie · #7 alertes legacy bornées dans le temps.
 * (#1, #5, #6, #8, #9 sont vérifiés par rejeu sur données réelles — voir
 *  docs/audit-moteur-2026-10-26.md.)
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { normMuscle, _aggSignaux, evaluerEtatAthlete, calculerAlertes, fmtYMD, minus };';
const sandbox = {
  createClient: () => ({ from: () => ({}) }),
  webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
  crypto: webcrypto, fetch: async () => ({}),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const { normMuscle, _aggSignaux, evaluerEtatAthlete, calculerAlertes, fmtYMD, minus } = sandbox.__api;

let ok = 0, ko = 0; const fails = [];
function eq(cond, label, got) { if (cond) ok++; else { ko++; fails.push(label); console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } }

// #2
[['Moletts', 'Mollets'], ['fessier', 'Fessier'], ['Triceps ', 'Triceps'], ['  Epaule', 'Epaule'], ['ischio', 'Ischio'], ['Trapéze', 'Trapèze'], ['Pectoraux', 'Pectoraux'], ['', '']]
  .forEach(([a, b]) => eq(normMuscle(a) === b, 'normMuscle(' + JSON.stringify(a) + ') = ' + b, normMuscle(a)));

// #3 : charge haute + ressenti bon → risque blessure Faible (plus « Modéré »)
const base = { acwr: null, acwrFiable: false, ffTsbPct: -23, ffRatio: 1.23, ffFiable: true, seances7: 3, douleur: 1, fatigue: 1, sommeil: 4, stress: 1, courbatures: 1, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 120, wellnessN: 10, hasCharge: true }, sousChargeSoutenue: false };
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: true, ressentiDegrade: false, ressentiEvaluable: true }));
  eq(o.risque_blessure === 'Faible', '#3 charge seule (ressenti bon) → risque Faible', o.risque_blessure); }
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: true, ressentiDegrade: true, ressentiEvaluable: true }));
  eq(o.risque_blessure === 'Modéré', '#3 charge + ressenti dégradé → risque Modéré', o.risque_blessure); }

// #4 : courbatures 4 il y a 3 jours puis 1 → dernière saisie = 1
{ const NOW = new Date('2026-10-28T12:00:00Z');
  const g = _aggSignaux([{ date: '2026-10-25', courbatures: 4 }, { date: '2026-10-27', courbatures: 1 }], NOW, 7);
  eq(g.courbatures === 1, '#4 courbatures = dernière saisie (1, pas 4)', g.courbatures); }

// #7 : stagnation sur des séances anciennes → plus d'alerte ; récentes → alerte
{ const now = new Date();
  const D = (d) => fmtYMD(minus(now, d));
  const mk = (days) => days.map(d => ({ date: D(d), exercice: 'Curl barre', charge: 30, reps: 8, rpe: 8 }));
  const vieux = calculerAlertes(mk([130, 125, 40, 30]), 'x', 5, false).filter(a => a.type === 'stagnation');
  eq(vieux.length === 0, '#7 séances étalées sur 4 mois → pas de stagnation', vieux);
  const recents = calculerAlertes(mk([20, 14, 7, 2]), 'x', 5, false).filter(a => a.type === 'stagnation');
  eq(recents.length === 1, '#7 4 séances récentes identiques → stagnation', recents); }

console.log('-'.repeat(70));
console.log('audit moteur : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
