// Simulation « Sèche » — protocole FIGÉ : docs/chantiers-futurs/objectif-trajectoire-2026-11.md §13 + §13 bis
// (commité AVANT lancement). Aucun code de l'app, aucune base.  node scripts/simulation-seche/sim.js
'use strict';
const T_TIRAGES = 10000, HIST = 6, SEM = 12, BASCULE = HIST + 7, GRILLE = [0.3, 0.5, 0.8, 1.0];
let seed = 20261114;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
const pct = (x) => (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + ' %';
function hysteresis(brut) {   // identique au §9 : l'état affiché change après 2 évaluations consécutives dans le nouvel état
  const aff = []; let cur = null, cand = null, n = 0;
  for (const e of brut) {
    if (cur === null) { cur = e; aff.push(cur); continue; }
    if (e === cur) { cand = null; n = 0; } else if (e === cand) { n++; if (n >= 2) { cur = e; cand = null; n = 0; } } else { cand = e; n = 1; }
    aff.push(cur);
  }
  return aff;
}
function regression(pts) {
  const n = pts.length, mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0); if (!sxx) return null;
  const b = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / sxx;
  const res = pts.reduce((a, p) => a + (p.y - my - b * (p.x - mx)) ** 2, 0);
  return { b, se: Math.sqrt(res / Math.max(1, n - 2) / sxx) };
}
// Un tirage : séances de force + pesées → états affichés (force, à chaque seuil T) + lecture du poids à la dernière évaluation.
function tirage(sc, sigma) {
  const seances = []; let niveau = 0;
  for (let w = 1; w <= HIST + SEM; w++) {
    const t = sc.force(w);
    for (let s = 0; s < 3; s++) {
      const jour = (w - 1) * 7 + s * 2; niveau += t / 3;
      if (rnd() < 0.10) continue;
      const deload = sc.deload ? sc.deload(w) : false;
      seances.push({ w, x: jour / 7, y: niveau + (deload ? -5 : 0) + sigma * gauss(), r0: deload });
    }
  }
  if (sc.fluct) for (let k = 0; k < 2; k++) { const i = Math.floor(rnd() * seances.length); seances[i].y -= 8; }
  const pesees = []; let poids = 80;
  for (let w = 1; w <= HIST + SEM; w++) {
    const n = rnd() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) { const j = Math.floor(rnd() * 7); pesees.push({ w, x: ((w - 1) * 7 + j) / 7, y: 80 + sc.poids * (((w - 1) * 7 + j) / 7) + 0.4 * gauss() }); }
  }
  const brutParT = GRILLE.map(() => []);
  let lecturePoids = null;
  for (let w = HIST + 1; w <= HIST + SEM; w++) {
    const f = seances.filter((p) => p.w > w - 1 - 6 && p.w <= w - 1 && !p.r0);   // 6 dernières semaines terminées, R0 exclu
    const r = f.length >= 6 ? regression(f) : null;
    GRILLE.forEach((T, i) => brutParT[i].push(!r ? 'nd' : (r.b + 1.28 * r.se < -T ? 'surv' : 'ok')));
    const pz = pesees.filter((p) => p.w > w - 1 - 6 && p.w <= w - 1);
    if (w === HIST + SEM) { const rp = pz.length >= 4 ? regression(pz) : null; lecturePoids = !rp ? 'nd' : (rp.b + 1.28 * rp.se < -0.1 ? 'baisse' : 'stable'); }
  }
  return { aff: brutParT.map(hysteresis), poids: lecturePoids };
}
const SC = {
  R1: { lib: 'Sèche réussie (force −0,3 %/sem, poids −0,5 kg/sem)', force: () => -0.3, poids: -0.5 },
  R2: { lib: 'Poids ↓ sans baisse de perf (force 0)', force: () => 0, poids: -0.5 },
  R3: { lib: 'Fluctuations ponctuelles (2 séances à −8)', force: () => 0, poids: -0.5, fluct: true },
  R4: { lib: 'Déload déclaré (sem. 9-10 à −5, exclues)', force: () => 0, poids: -0.5, deload: (w) => w === HIST + 9 || w === HIST + 10 },
  I1: { lib: 'Intermédiaire (force −0,7 %/sem)', force: () => -0.7, poids: -0.5 },
  B1: { lib: 'Forte baisse dès sem. 7 (poids ↓)', force: (w) => (w < BASCULE ? 0 : -1.5), poids: -0.5 },
  B2: { lib: 'Forte baisse dès sem. 7 (poids stable)', force: (w) => (w < BASCULE ? 0 : -1.5), poids: 0 },
};
const changements = (aff) => aff.reduce((a, e, i) => a + (i && e !== aff[i - 1] ? 1 : 0), 0);
const detection = (aff) => { const i = BASCULE - HIST - 1; for (let k = i; k < aff.length; k++) if (aff[k] === 'surv') return k - i + 1; return null; };
const res = {};
for (const sigma of [3.3, 5.7]) {
  res[sigma] = {};
  for (const k of Object.keys(SC)) { const R = []; for (let i = 0; i < T_TIRAGES; i++) R.push(tirage(SC[k], sigma)); res[sigma][k] = R; }
}
const out = { parT: {}, poids: {} };
GRILLE.forEach((T, ti) => {
  const o = {};
  for (const s of [3.3, 5.7]) {
    const R = res[s], alerte = (k) => R[k].filter((t) => t.aff[ti].includes('surv')).length / T_TIRAGES;
    o[s] = {
      fauxR: { R1: alerte('R1'), R2: alerte('R2'), R3: alerte('R3'), R4: alerte('R4') },
      I1: alerte('I1'),
      det: { B1: R.B1.filter((t) => { const d = detection(t.aff[ti]); return d != null && d <= 6; }).length / T_TIRAGES, B2: R.B2.filter((t) => { const d = detection(t.aff[ti]); return d != null && d <= 6; }).length / T_TIRAGES },
      avantBascule: { B1: R.B1.filter((t) => t.aff[ti].slice(0, BASCULE - HIST - 1).includes('surv')).length / T_TIRAGES },
      chMois: { R1: R.R1.reduce((a, t) => a + changements(t.aff[ti]), 0) / T_TIRAGES / 3, R2: R.R2.reduce((a, t) => a + changements(t.aff[ti]), 0) / T_TIRAGES / 3 },
    };
  }
  const K1 = [3.3, 5.7].every((s) => Object.values(o[s].fauxR).every((v) => v <= 0.10));
  const K2 = o[3.3].det.B1 >= 0.80 && o[3.3].det.B2 >= 0.80;
  const K3 = [3.3, 5.7].every((s) => o[s].chMois.R1 <= 1 && o[s].chMois.R2 <= 1);
  o.K = { K1, K2, K3 }; out.parT[T] = o;
});
for (const s of [3.3, 5.7]) {
  const R = res[s], lu = (k, v) => R[k].filter((t) => t.poids === v).length / T_TIRAGES;
  out.poids[s] = { R1: lu('R1', 'baisse'), R2: lu('R2', 'baisse'), B2: lu('B2', 'stable') };
}
const K4 = [3.3, 5.7].every((s) => out.poids[s].R1 >= 0.80 && out.poids[s].R2 >= 0.80 && out.poids[s].B2 >= 0.80);
for (const T of GRILLE) {
  const o = out.parT[T], f = (x) => x.toFixed(2).replace('.', ',');
  console.log(`\n=== Seuil T = ${String(T).replace('.', ',')} %/sem ===`);
  for (const s of [3.3, 5.7]) {
    const q = o[s];
    console.log(`σ ${String(s).replace('.', ',')} % — fausses alertes R1 ${pct(q.fauxR.R1)} · R2 ${pct(q.fauxR.R2)} · R3 ${pct(q.fauxR.R3)} · R4 ${pct(q.fauxR.R4)} | détection ≤ 6 sem. B1 ${pct(q.det.B1)} · B2 ${pct(q.det.B2)} | changements/mois R1 ${f(q.chMois.R1)} · R2 ${f(q.chMois.R2)} | I1 alerte ${pct(q.I1)} | alerte avant bascule B1 ${pct(q.avantBascule.B1)}`);
  }
  console.log(`K1 ${o.K.K1 ? 'OK' : 'ÉCHEC'} · K2 ${o.K.K2 ? 'OK' : 'ÉCHEC'} · K3 ${o.K.K3 ? 'OK' : 'ÉCHEC'} · K4 ${K4 ? 'OK' : 'ÉCHEC'}`);
}
for (const s of [3.3, 5.7]) console.log(`Poids (σ force ${String(s).replace('.', ',')} %) : R1 lu « en baisse » ${pct(out.poids[s].R1)} · R2 ${pct(out.poids[s].R2)} · B2 lu « stable » ${pct(out.poids[s].B2)}`);
const passe = GRILLE.filter((T) => out.parT[T].K.K1 && out.parT[T].K.K2 && out.parT[T].K.K3 && K4);
console.log('\nRègle de choix (figée) : ' + (passe.length ? 'seuil retenu T = ' + String(passe[0]).replace('.', ',') + ' %/sem (passants : ' + passe.join(' · ') + ')' : 'AUCUN seuil ne passe tous les critères → pas de choix forcé, retour au porteur'));
out.K4 = K4; out.retenu = passe.length ? passe[0] : null;
require('fs').writeFileSync(require('path').join(__dirname, 'resultats.json'), JSON.stringify(out, null, 1));
