/* =============================================================================
 * Règle « charge + ressenti » (oct. 2026, validée porteur) — VRAIES fonctions
 * d'index.ts : chargeSoutenueJours, sousChargeSoutenue, ressentiConcordant,
 * evaluerEtatAthlete. Oracles établis à la main :
 *   - charge qui monte SANS dégradation du ressenti → AUCUNE alerte charge ;
 *   - charge soutenue + fatigue en hausse vs baseline → alerte « charge » ;
 *   - pic d'un seul jour → pas « soutenue » ;
 *   - une semaine légère → pas de sous-charge ; baisse 3 semaines → sous-charge ;
 *   - « tu encaisses bien » seulement si le ressenti est évaluable (règle 6bis).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { chargeSoutenueJours, sousChargeSoutenue, ressentiConcordant, evaluerEtatAthlete, fmtYMD, minus };';
const sandbox = {
  createClient: () => ({ from: () => ({}) }),
  webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
  crypto: webcrypto, fetch: async () => ({}),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const { chargeSoutenueJours, sousChargeSoutenue, ressentiConcordant, evaluerEtatAthlete, fmtYMD, minus } = sandbox.__api;

let ok = 0, ko = 0; const fails = [];
function eq(cond, label, got) { if (cond) ok++; else { ko++; fails.push(label); console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } }

const NOW = new Date('2026-10-26T12:00:00Z');
const D = (d) => fmtYMD(minus(NOW, d));
const mk = (fn) => { const m = {}; for (let d = 0; d <= 70; d++) { const v = fn(d); if (v > 0) m[D(d)] = v; } return m; };

// --- chargeSoutenueJours ---------------------------------------------------
// Charge doublée sur les 10 derniers jours (séances 1 j/2) → soutenue.
{ const n = chargeSoutenueJours(mk(d => (d % 2 === 0) ? (d < 10 ? 10000 : 5000) : 0), NOW);
  eq(n >= 3, 'hausse 10 j → ≥ 3/5 jours sous -12 %', n); }
// Base régulière, UN seul gros jour aujourd'hui → pas soutenu.
{ const n = chargeSoutenueJours(mk(d => d === 0 ? 20000 : (d % 2 === 0 ? 5000 : 0)), NOW);
  eq(n < 3, 'pic d\'un jour → < 3/5', n); }

// --- sousChargeSoutenue ----------------------------------------------------
{ eq(sousChargeSoutenue(mk(d => (d % 2 === 0) ? (d < 7 ? 2500 : 5000) : 0), NOW) === false, 'une semaine légère → pas soutenue'); }
{ eq(sousChargeSoutenue(mk(d => (d % 2 === 0) ? (d < 21 ? 2000 : 6000) : 0), NOW) === true, 'baisse de 3 semaines → soutenue'); }

// --- ressentiConcordant -----------------------------------------------------
const be = (fn) => { const r = []; for (let d = 0; d < 30; d++) { const x = fn(d); if (x) r.push(Object.assign({ date: D(d) }, x)); } return r; };
{ const r = ressentiConcordant(be(() => ({ fatigue_musculaire: 2, sommeil: 4 })), [], NOW);
  eq(r.evaluable === true && r.degrade === false, 'bien-être stable → évaluable, non dégradé', r); }
{ const r = ressentiConcordant(be(d => ({ fatigue_musculaire: d < 3 ? 4 : 2, sommeil: 4 })), [], NOW);
  eq(r.degrade === true, 'fatigue +2 pts sur 3 dernières saisies → dégradé', r); }
{ const r = ressentiConcordant(be(d => d < 2 ? { fatigue_musculaire: 5 } : null), [], NOW);
  eq(r.evaluable === false && r.degrade === false, 'trop peu de saisies → non évaluable, pas de conclusion', r); }
// RPE en hausse à charge égale sur 2 exos (dernière séance récente) → dégradé.
{ const perfs = [];
  ['Squat', 'Développé couché barre'].forEach(exo => [12, 9, 5, 2].forEach((d, i) => perfs.push({ date: D(d), exercice: exo, charge: 100, reps: 8, rpe: i < 2 ? 7 : 8.5 })));
  const r = ressentiConcordant([], perfs, NOW);
  eq(r.degrade === true && r.rpeExos.length === 2, 'RPE +1,5 à charge égale sur 2 exos → dégradé', r); }
// RPE en hausse MAIS charge en hausse → progression normale, pas dégradé.
{ const perfs = [];
  ['Squat', 'Développé couché barre'].forEach(exo => [12, 9, 5, 2].forEach((d, i) => perfs.push({ date: D(d), exercice: exo, charge: i < 2 ? 100 : 110, reps: 8, rpe: i < 2 ? 7 : 8.5 })));
  eq(ressentiConcordant([], perfs, NOW).degrade === false, 'RPE↑ avec charge +10 % → pas dégradé'); }

// --- evaluerEtatAthlete : gating -------------------------------------------
const base = { acwr: null, acwrFiable: false, ffTsbPct: -20, ffRatio: 1.25, ffFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, stress: null, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 90, wellnessN: 5, hasCharge: true } };
const types = (o) => o.alertes.map(a => a.type);
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: true, ressentiDegrade: false, ressentiEvaluable: true, sousChargeSoutenue: false }));
  eq(!types(o).includes('charge') && !types(o).includes('surcharge'), 'charge soutenue SANS ressenti → aucune alerte charge', types(o));
  eq(/encaisses bien/.test(o.reco), 'reco « tu encaisses bien » si ressenti évaluable', o.reco); }
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: true, ressentiDegrade: false, ressentiEvaluable: false, sousChargeSoutenue: false }));
  eq(!/encaisses bien/.test(o.reco) && /état du jour/.test(o.reco), 'ressenti NON évaluable → on ne dit pas « tu encaisses bien »', o.reco); }
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: true, ressentiDegrade: true, ressentiEvaluable: true, sousChargeSoutenue: false }));
  eq(types(o).includes('charge'), 'charge soutenue + ressenti dégradé → alerte charge', types(o)); }
{ const o = evaluerEtatAthlete(Object.assign({}, base, { ffTsbPct: -35, chargeSoutenue: true, ressentiDegrade: true, ressentiEvaluable: true, sousChargeSoutenue: false }));
  eq(types(o).includes('surcharge'), 'TSB ≤ -30 + soutenue + ressenti → surcharge (haute)', types(o)); }
{ const o = evaluerEtatAthlete(Object.assign({}, base, { chargeSoutenue: false, ressentiDegrade: true, ressentiEvaluable: true, sousChargeSoutenue: false }));
  eq(!types(o).includes('charge'), 'pic non soutenu + ressenti dégradé → pas d\'alerte charge', types(o)); }
{ const sc = Object.assign({}, base, { ffTsbPct: 15, ffRatio: 0.7, chargeSoutenue: false, ressentiDegrade: false, ressentiEvaluable: true });
  eq(!types(evaluerEtatAthlete(Object.assign({}, sc, { sousChargeSoutenue: false }))).includes('sous_charge'), 'ratio bas < 14 j → pas de sous-charge');
  eq(types(evaluerEtatAthlete(Object.assign({}, sc, { sousChargeSoutenue: true }))).includes('sous_charge'), 'ratio bas ≥ 14 j → sous-charge');
  eq(!types(evaluerEtatAthlete(Object.assign({}, sc, { sousChargeSoutenue: true, ctxEtat: 'deload' }))).includes('sous_charge'), 'deload déclaré → pas de sous-charge'); }
// Chemin historique (foot / champs non fournis) inchangé.
{ const o = evaluerEtatAthlete(Object.assign({}, base));
  eq(types(o).includes('charge'), 'champs non fournis → règle historique (alerte charge)', types(o)); }

console.log('-'.repeat(70));
console.log('règle charge + ressenti : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
