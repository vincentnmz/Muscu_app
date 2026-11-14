// Simulation « objectif → trajectoire » — protocole FIGÉ : docs/chantiers-futurs/objectif-trajectoire-2026-11.md §9
// (commit 0d62e56, avant lancement). Aucun code de l'app, aucune base.  node scripts/simulation-trajectoire/sim.js
'use strict';
const T = 10000, HIST = 6, SEM = 12;
let seed = 20261114;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const pct = (x) => (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + ' %';

// Anti-nervosité : l'état affiché ne change qu'après 2 évaluations consécutives dans le nouvel état.
function hysteresis(brut) {
  const aff = []; let cur = null, cand = null, n = 0;
  for (const e of brut) {
    if (cur === null) { cur = e; aff.push(cur); continue; }
    if (e === cur) { cand = null; n = 0; } else if (e === cand) { n++; if (n >= 2) { cur = e; cand = null; n = 0; } } else { cand = e; n = 1; }
    aff.push(cur);
  }
  return aff;
}
// Force : tendance (en %/semaine) fonction de la semaine (1..HIST+SEM).
function tirageForce(tendance, sigma) {
  const seances = []; let niveau = 0;
  for (let w = 1; w <= HIST + SEM; w++) {
    const t = tendance(w);
    for (let s = 0; s < 3; s++) { const jour = (w - 1) * 7 + s * 2; niveau += t / 3; if (rnd() < 0.10) continue; seances.push({ w, x: jour / 7, y: niveau + sigma * gauss() }); }
  }
  const brut = [];
  for (let w = HIST + 1; w <= HIST + SEM; w++) {
    const f = seances.filter((p) => p.w > w - 1 - 6 && p.w <= w - 1);   // 6 dernières semaines TERMINÉES
    if (f.length < 6) { brut.push('nd'); continue; }
    const mx = f.reduce((a, p) => a + p.x, 0) / f.length, my = f.reduce((a, p) => a + p.y, 0) / f.length;
    const sxx = f.reduce((a, p) => a + (p.x - mx) ** 2, 0), b = f.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
    const res = f.reduce((a, p) => a + (p.y - my - b * (p.x - mx)) ** 2, 0), se = Math.sqrt(res / (f.length - 2) / sxx);
    brut.push(b + 1.28 * se < 0 ? 'surv' : 'ok');
  }
  return hysteresis(brut);
}
function tirageVolume(moyenne) {
  const sem = [];
  for (let w = 1; w <= HIST + SEM; w++) sem.push([0, 1, 2, 3].map(() => Math.max(0, Math.round(moyenne(w) + 2 * gauss()))));
  const brut = [];
  for (let w = HIST + 1; w <= HIST + SEM; w++) {
    const f = sem.slice(w - 1 - 4, w - 1);   // 4 dernières semaines terminées
    const sous = [0, 1, 2, 3].filter((m) => f.reduce((a, s) => a + s[m], 0) / 4 < 10 - 1).length;
    brut.push(sous >= 2 ? 'surv' : 'ok');
  }
  return hysteresis(brut);
}
const BASCULE = HIST + 7;   // semaine 7 des 12 évaluées
const SC = {
  'F+': (w) => 1, F0: (w) => 0, 'F-': (w) => (w < BASCULE ? 0.5 : -1),
  'V+': (w) => 12, 'V-': (w) => (w < BASCULE ? 12 : 7),
};
const changements = (aff) => aff.reduce((a, e, i) => a + (i && e !== aff[i - 1] ? 1 : 0), 0);
const detection = (aff) => { const i = BASCULE - HIST - 1; for (let k = i; k < aff.length; k++) if (aff[k] === 'surv') return k - i + 1; return null; };
const out = {};
for (const sigma of [3.3, 5.7]) {
  const r = {}, run = (k, f) => { const R = []; for (let i = 0; i < T; i++) R.push(f()); return R; };
  const Fp = run('F+', () => tirageForce(SC['F+'], sigma)), F0 = run('F0', () => tirageForce(SC.F0, sigma)), Fm = run('F-', () => tirageForce(SC['F-'], sigma));
  r.T1_force = Fp.filter((a) => a.includes('surv')).length / T;
  const dF = Fm.map(detection); r.T2_force = dF.filter((d) => d != null && d <= 4).length / T;
  const okF = dF.filter((d) => d != null).sort((a, b) => a - b); r.detMedForce = okF.length ? okF[Math.floor(okF.length / 2)] : null;
  r.fauxAvantBasculeForce = Fm.filter((a) => a.slice(0, BASCULE - HIST - 1).includes('surv')).length / T;
  r.T3 = { 'F+': Fp.reduce((a, x) => a + changements(x), 0) / T / 3, F0: F0.reduce((a, x) => a + changements(x), 0) / T / 3 };
  r.F0_surv = F0.filter((a) => a.includes('surv')).length / T;
  out[sigma] = r;
}
const Vp = []; const Vm = []; for (let i = 0; i < T; i++) { Vp.push(tirageVolume(SC['V+'])); Vm.push(tirageVolume(SC['V-'])); }
const vol = { T1: Vp.filter((a) => a.includes('surv')).length / T, T3: Vp.reduce((a, x) => a + changements(x), 0) / T / 3 };
const dV = Vm.map(detection); vol.T2 = dV.filter((d) => d != null && d <= 4).length / T;
const okV = dV.filter((d) => d != null).sort((a, b) => a - b); vol.detMed = okV.length ? okV[Math.floor(okV.length / 2)] : null;
for (const s of [3.3, 5.7]) {
  const r = out[s];
  console.log(`\n=== Force, bruit σ = ${String(s).replace('.', ',')} % ===`);
  console.log(`T1 faux « à surveiller » (F+, ≤ 10 %) : ${pct(r.T1_force)} → ${r.T1_force <= 0.10 ? 'OK' : 'ÉCHEC'}`);
  console.log(`T2 dérive détectée ≤ 4 sem. (F−, ≥ 80 %) : ${pct(r.T2_force)} → ${r.T2_force >= 0.80 ? 'OK' : 'ÉCHEC'}   [délai médian ${r.detMedForce} sem. ; fausse alerte avant la bascule ${pct(r.fauxAvantBasculeForce)}]`);
  console.log(`T3 changements d'état / mois (≤ 1) : F+ ${r.T3['F+'].toFixed(3).replace('.', ',')} · F0 ${r.T3.F0.toFixed(3).replace('.', ',')} → ${r.T3['F+'] <= 1 && r.T3.F0 <= 1 ? 'OK' : 'ÉCHEC'}`);
  console.log(`Rapporté : F0 (stagnation) affiché « à surveiller » au moins une fois : ${pct(r.F0_surv)}`);
}
console.log('\n=== Volume ===');
console.log(`T1 faux « à surveiller » (V+, ≤ 10 %) : ${pct(vol.T1)} → ${vol.T1 <= 0.10 ? 'OK' : 'ÉCHEC'}`);
console.log(`T2 baisse détectée ≤ 4 sem. (V−, ≥ 80 %) : ${pct(vol.T2)} → ${vol.T2 >= 0.80 ? 'OK' : 'ÉCHEC'}   [délai médian ${vol.detMed} sem.]`);
console.log(`T3 changements d'état / mois (V+, ≤ 1) : ${vol.T3.toFixed(3).replace('.', ',')} → ${vol.T3 <= 1 ? 'OK' : 'ÉCHEC'}`);
require('fs').writeFileSync(require('path').join(__dirname, 'resultats.json'), JSON.stringify({ force: out, volume: vol }, null, 1));
