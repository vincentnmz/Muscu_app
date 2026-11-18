/* =============================================================================
 * Modèle fitness-fatigue de Banister (CTL / ATL / TSB) — calculerFitnessFatigue.
 * Exécute la VRAIE fonction d'index.ts (pas une copie). Vérifie le sens physique :
 *   - charge constante → équilibre (ratio ≈ 1, TSB ≈ 0)
 *   - surcharge récente → fatigue (ratio > 1, TSB < 0)
 *   - décharge récente → fraîcheur (ratio < 1, TSB > 0)
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto } = require('crypto');

let js = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
js = js.split('\n').filter(l => !/^import\s/.test(l)).join('\n');
js += '\n;this.__api = { calculerFitnessFatigue, fmtYMD, minus };';
const sandbox = {
  createClient: () => ({ from: () => ({}) }),
  webpush: { setVapidDetails() {}, sendNotification: async () => {} },
  Deno: { env: { get: () => undefined }, serve: () => {} },
  Response, Request, URLSearchParams, TextEncoder, TextDecoder, console, atob, btoa, setTimeout, clearTimeout,
  crypto: webcrypto, fetch: async () => ({}),
};
vm.createContext(sandbox);
vm.runInContext(js, sandbox);
const { calculerFitnessFatigue, fmtYMD, minus } = sandbox.__api;

let ok = 0, ko = 0; const fails = [];
function eq(cond, label, got) { if (cond) ok++; else { ko++; fails.push(label); console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + got + ')' : '')); } }

const NOW = new Date('2026-10-18T12:00:00Z');
const mk = (fn) => { const m = {}; for (let d = 0; d <= 60; d++) { const v = fn(d); if (v > 0) m[fmtYMD(minus(NOW, d))] = v; } return m; };

// 1) charge constante → équilibre
{ const r = calculerFitnessFatigue(mk(() => 500), NOW);
  eq(Math.abs(r.ratio - 1) < 0.03, 'constante : ratio ≈ 1', r.ratio);
  eq(Math.abs(r.tsbPct) <= 3, 'constante : tsbPct ≈ 0', r.tsbPct);
  eq(r.ctl > 0 && r.atl > 0, 'constante : CTL/ATL > 0'); }

// 2) surcharge récente (7 j × 2) → fatigue
{ const r = calculerFitnessFatigue(mk((d) => d < 7 ? 1000 : 500), NOW);
  eq(r.ratio > 1.1, 'surcharge : ratio > 1.1', r.ratio);
  eq(r.tsb < 0, 'surcharge : TSB < 0 (fatigue)', r.tsb);
  eq(r.tsbPct < 0, 'surcharge : tsbPct < 0', r.tsbPct); }

// 3) décharge récente (7 j / 2) → fraîcheur
{ const r = calculerFitnessFatigue(mk((d) => d < 7 ? 250 : 500), NOW);
  eq(r.ratio < 0.95, 'décharge : ratio < 0.95', r.ratio);
  eq(r.tsb > 0, 'décharge : TSB > 0 (frais)', r.tsb); }

// 4) aucune charge → non interprétable (null / 0)
{ const r = calculerFitnessFatigue({}, NOW);
  eq(r.ratio === null && r.ctl === 0 && r.tsbPct === null, 'vide : ratio/tsbPct null, CTL 0'); }

// 5) indépendance d'unité : tonnage (×1000) donne les MÊMES ratio/tsbPct que sRPE
{ const a = calculerFitnessFatigue(mk((d) => d < 7 ? 1000 : 500), NOW);
  const b = calculerFitnessFatigue(mk((d) => d < 7 ? 1000000 : 500000), NOW);
  eq(a.ratio === b.ratio && a.tsbPct === b.tsbPct, 'ratio/tsbPct indépendants de l\'unité', a.ratio + ' vs ' + b.ratio); }

// 6) 18/11 (audit Vincent) : semaine creuse (vacances) puis reprise NORMALE → la reprise n'est pas une « forte hausse ».
//    Cas réel : 3 séances/sem (~6 t), une semaine à 1 séance, puis 3 séances sur les 7 derniers jours.
{ const sem = (d) => [1, 3, 5].includes(d % 7) ? 2000 : 0;           // ≈ 6 t / semaine, 3 jours
  const cas = mk((d) => d < 7 ? sem(d) : d < 14 ? (d === 10 ? 2000 : 0) : sem(d));
  const r = calculerFitnessFatigue(cas, NOW);
  let a7 = 0, c28 = 0; for (let d = 0; d < 28; d++) { const v = cas[fmtYMD(minus(NOW, d))] || 0; c28 += v; if (d < 7) a7 += v; }
  const vraie = (a7 / 7) / (c28 / 28);   // charge 7 j vs moyenne 28 j
  eq(r.tsbPct > -30, 'reprise après semaine creuse : pas de « forte hausse » (TSB > −30 %)', r.tsbPct);
  eq(r.ctl >= Math.floor(c28 / 28), 'reprise : la forme de fond ne descend pas sous la moyenne réelle des 28 j (' + Math.round(c28 / 28) + ')', r.ctl); }

// 7) 18/11 : cas RÉEL (tonnage journalier d'un testeur, anonyme) — semaine de vacances 09-13/11 puis reprise.
//    Charge 7 j = +24 % vs moyenne 28 j ; l'ancien calcul affichait −38 % de fraîcheur (« forte hausse »).
{ const reel = {'2026-09-03':3545,'2026-09-07':3790,'2026-09-14':5150,'2026-09-15':6240,'2026-09-17':4578,'2026-09-18':5856,'2026-10-01':4256,'2026-10-02':5130,'2026-10-05':3750,'2026-10-06':6030,'2026-10-12':4345,'2026-10-13':5125,'2026-10-15':3848,'2026-10-16':9020,'2026-10-22':3464,'2026-10-23':5795,'2026-10-26':4128,'2026-10-27':6860,'2026-10-29':4230,'2026-10-30':3160,'2026-11-02':4580,'2026-11-05':8780,'2026-11-06':5075,'2026-11-13':6285,'2026-11-16':4658,'2026-11-17':9645};
  const N2 = new Date('2026-11-18T08:00:00Z'), r = calculerFitnessFatigue(reel, N2);
  eq(r.tsbPct > -30 && r.tsbPct < -12, 'cas réel : charge « en hausse » (−12 à −30 %), plus « forte hausse »', r.tsbPct); }

console.log('-'.repeat(70));
console.log('fitness-fatigue (Banister) : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
