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

console.log('-'.repeat(70));
console.log('fitness-fatigue (Banister) : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
