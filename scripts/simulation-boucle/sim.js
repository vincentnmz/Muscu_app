// Simulation de la boucle « résultat → décision suivante » — protocole FIGÉ :
// docs/chantiers-futurs/boucle-resultat-decision-2026-11.md §12-§13 (commit 51ac085, avant lancement).
// Aucun code de l'app, aucune base : modèle abstrait du moteur (R1-R4 + échec comparable).
// node scripts/simulation-boucle/sim.js
'use strict';
const TIRAGES = 10000, SEMAINES = 12, FENETRE = 6;
let seed = 20261114;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const P_DEFAUT = 0.5;   // efficacité des leviers suivants quand le scénario ne la précise pas (« inconnue »)

// Un tirage : renvoie la suite des décisions semaine par semaine.
function tirage(sc, N, rng) {
  const lev = sc.leviers;                       // [{ nom, p | p(w) }] : A, B, C puis repli R
  const pDe = (l, w) => (typeof l.p === 'function' ? l.p(w) : l.p);
  let cur = 0, echecs = [], nonTente = 0, enDernier = false, aucun = false;
  const abandon = {}, hist = [], changements = [];
  for (let w = 1; w <= SEMAINES; w++) {
    const tente = rng() < sc.a, perturbe = rng() < sc.q, vu = perturbe && rng() < sc.d;
    let issue = 'non_tentee';
    if (aucun) { hist.push({ w, levier: null, issue: 'aucune_action' }); continue; }
    if (tente) {
      nonTente = 0;
      const p = pDe(lev[cur], w) / (perturbe ? 3 : 1);
      if (rng() < p) { issue = 'reussie'; echecs = []; enDernier = false; }                  // R1 : compteur remis à zéro
      else if (vu) issue = 'echec_non_comparable';                                          // §12 : R0 / perturbation vue
      else {
        issue = 'echec_comparable';
        echecs.push(w); echecs = echecs.filter((x) => w - x < FENETRE);                     // fenêtre de 6 semaines
        if (echecs.length >= N) {                                                           // R2
          const avant = lev[cur].nom, nbEchecs = echecs.length;
          abandon[avant] = w;
          let nxt = -1;
          for (let i = cur + 1; i < lev.length; i++) { const ab = abandon[lev[i].nom]; if (ab == null || w - ab >= FENETRE) { nxt = i; break; } }
          if (nxt < 0) aucun = true; else cur = nxt;
          changements.push({ w, de: avant, vers: nxt < 0 ? null : lev[nxt].nom, nbEchecs });
          echecs = [];
        }
      }
    } else { nonTente++; if (nonTente >= 2) enDernier = true; }                              // R3 : en dernier, pas de changement
    hist.push({ w, levier: lev[cur].nom, issue, enDernier });
  }
  return { hist, changements, final: aucun ? null : lev[cur].nom };
}
const A = (p) => [{ nom: 'A', p }, { nom: 'B', p: P_DEFAUT }, { nom: 'C', p: P_DEFAUT }, { nom: 'R', p: P_DEFAUT }];
const BASE = { a: 0.8, q: 0.15, d: 0.8 };
const S = {
  S1: { ...BASE, leviers: A(0.7), lib: 'levier efficace (p 0,7)' },
  S2: { ...BASE, leviers: A(0.1), lib: 'levier inefficace (p 0,1)' },
  S3: { ...BASE, leviers: A(0.4), lib: 'levier moyen (p 0,4)' },
  S4: { ...BASE, leviers: A(0.5), lib: 'bruit pur (p 0,5)' },
  S5: { ...BASE, leviers: A((w) => (w <= 6 ? 0.8 : 0.1)), lib: 'succès puis échec (0,8 → 0,1 en semaine 7)' },
  S6: { ...BASE, a: 0.3, leviers: A(0.7), lib: 'deux « pas faits » répétés (adhérence 0,3, p 0,7)' },
  S7: { ...BASE, q: 0.4, leviers: A(0.7), lib: 'reprise / déload fréquents (q 0,4, p 0,7)' },
  S8: { ...BASE, leviers: [{ nom: 'A', p: 0.1 }, { nom: 'B', p: 0.7 }, { nom: 'C', p: 0.4 }, { nom: 'R', p: P_DEFAUT }], lib: 'plusieurs leviers (A 0,1 · B 0,7 · C 0,4)' },
  S9: { ...BASE, q: 0.4, d: 0.3, leviers: A(0.7), lib: 'conditions qui changent, peu vues (q 0,4, d 0,3, p 0,7)' },
};
const pct = (x) => (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + ' %';
function run(nomS, N) {
  const sc = S[nomS]; const R = [];
  for (let i = 0; i < TIRAGES; i++) R.push(tirage(sc, N, rnd));
  return R;
}
const out = { N: {} };
for (const N of [2, 3]) {
  const r = {}; const res = {};
  for (const k of Object.keys(S)) res[k] = run(k, N);
  const abandonA6 = (k) => res[k].filter((t) => t.changements.some((c) => c.de === 'A' && c.w <= 6)).length / TIRAGES;
  r.C1 = { S1: abandonA6('S1'), S6: abandonA6('S6'), S7: abandonA6('S7') };
  r.C2 = res.S2.filter((t) => t.changements.some((c) => c.de === 'A' && c.w <= 3)).length / TIRAGES;
  let nbCh = 0, ch1 = 0; for (const k of Object.keys(S)) for (const t of res[k]) for (const c of t.changements) { nbCh++; if (c.nbEchecs < 2) ch1++; }
  r.C3 = nbCh ? ch1 / nbCh : 0;
  const chS1 = res.S1.reduce((s, t) => s + t.changements.length, 0) / TIRAGES;
  r.C4 = { changementsParMoisS1: chS1 / 3,
    retourDansFenetre: Object.keys(S).reduce((s, k) => s + res[k].filter((t) => { const vus = []; for (const h of t.hist) { if (!h.levier) continue; const i = vus.lastIndexOf(h.levier); if (i >= 0 && i < vus.length - 1) { const dern = t.changements.filter((c) => c.de === h.levier).pop(); if (dern && h.w - dern.w < FENETRE) return true; } if (vus[vus.length - 1] !== h.levier) vus.push(h.levier); } return false; }).length, 0),
    retour12semS1: res.S1.filter((t) => { const seq = []; for (const h of t.hist) if (h.levier && seq[seq.length - 1] !== h.levier) seq.push(h.levier); return new Set(seq).size < seq.length; }).length / TIRAGES,
    S8finB: res.S8.filter((t) => t.final === 'B').length / TIRAGES };
  // Déterminisme : mêmes tirages aléatoires → mêmes décisions.
  let same = 0; for (let i = 0; i < 1000; i++) { const s0 = seed; const t1 = tirage(S.S3, N, rnd); const s1 = seed; seed = s0; const t2 = tirage(S.S3, N, rnd); seed = s1; if (JSON.stringify(t1) === JSON.stringify(t2)) same++; }
  r.determinisme = same / 1000;
  // Rapportés sans critère.
  r.S3abandon6 = abandonA6('S3'); r.S4abandon6 = abandonA6('S4'); r.S9abandon6 = abandonA6('S9');
  r.S3abandon12 = res.S3.filter((t) => t.changements.some((c) => c.de === 'A')).length / TIRAGES;
  const delais = res.S5.map((t) => { const c = t.changements.find((x) => x.de === 'A' && x.w >= 7); return c ? c.w - 6 : null; });
  const ok = delais.filter((x) => x != null).sort((a, b) => a - b);
  r.S5 = { changeApresBascule: ok.length / TIRAGES, delaiMedian: ok.length ? ok[Math.floor(ok.length / 2)] : null, abandonAvantBascule: res.S5.filter((t) => t.changements.some((c) => c.de === 'A' && c.w <= 6)).length / TIRAGES };
  r.S2dans6 = res.S2.filter((t) => t.changements.some((c) => c.de === 'A' && c.w <= 6)).length / TIRAGES;
  r.S6enDernier = res.S6.filter((t) => t.hist.some((h) => h.enDernier)).length / TIRAGES;
  out.N[N] = r;
}
const verdict = (r) => ({
  C1: r.C1.S1 <= 0.10 && r.C1.S6 <= 0.10 && r.C1.S7 <= 0.10,
  C2: r.C2 >= 0.80,
  C3: r.C3 === 0,
  C4: r.C4.changementsParMoisS1 <= 1 && r.C4.retourDansFenetre === 0 && r.C4.S8finB >= 0.80 && r.determinisme === 1,
});
for (const N of [2, 3]) {
  const r = out.N[N], v = verdict(r);
  console.log(`\n=== N = ${N} échecs comparables ===`);
  console.log(`C1 abandon injustifié (≤ 10 %) : S1 ${pct(r.C1.S1)} · S6 ${pct(r.C1.S6)} · S7 ${pct(r.C1.S7)} → ${v.C1 ? 'OK' : 'ÉCHEC'}`);
  console.log(`C2 levier inefficace remplacé en ≤ 3 sem. (≥ 80 %) : ${pct(r.C2)} → ${v.C2 ? 'OK' : 'ÉCHEC'}   [en ≤ 6 sem. : ${pct(r.S2dans6)}]`);
  console.log(`C3 changement après 1 seul échec (0 %) : ${pct(r.C3)} → ${v.C3 ? 'OK' : 'ÉCHEC'}`);
  console.log(`C4 stabilité : ${r.C4.changementsParMoisS1.toFixed(3).replace('.', ',')} changement/mois (S1, ≤ 1) · retours dans la fenêtre : ${r.C4.retourDansFenetre} · S8 finit sur B : ${pct(r.C4.S8finB)} (≥ 80 %) · déterminisme ${pct(r.determinisme)} → ${v.C4 ? 'OK' : 'ÉCHEC'}`);
  console.log(`   retour à un ancien levier sur 12 sem. (S1, hors fenêtre) : ${pct(r.C4.retour12semS1)}`);
  console.log(`Rapporté : S3 moyen abandonné ≤ 6 sem. ${pct(r.S3abandon6)} (≤ 12 sem. ${pct(r.S3abandon12)}) · S4 bruit ${pct(r.S4abandon6)} · S9 conditions peu vues ${pct(r.S9abandon6)}`);
  console.log(`Rapporté : S5 abandon avant la bascule ${pct(r.S5.abandonAvantBascule)} · changement après la bascule ${pct(r.S5.changeApresBascule)} (délai médian ${r.S5.delaiMedian} sem.) · S6 mis en dernier ${pct(r.S6enDernier)}`);
}
require('fs').writeFileSync(require('path').join(__dirname, 'resultats.json'), JSON.stringify(out, null, 1));
