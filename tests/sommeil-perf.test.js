/* Sommeil → performance (js/sommeil-perf.js) — méthode validée : docs/sommeil-performance-methode.md.
 * 1. Les seuils sont ceux validés (changer un seuil = nouveau contrôle de fiabilité, pas une retouche de test).
 * 2. Résultats IDENTIQUES à l'implémentation de référence utilisée pour la validation (tests/fixtures).
 * 3. Jeux simulés de la validation (effet connu 0/3/5/8/10 %) : faux positifs, erreurs de sens, détection.
 * 4. Adaptateur données app (force = _lv3ForcePoint inchangée, nuits < 3 h ignorées), cas réel 16/4/11, textes. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const LV3 = fs.readFileSync(path.join(ROOT, 'js', 'lecture-v3.js'), 'utf8');
const SPsrc = fs.readFileSync(path.join(ROOT, 'js', 'sommeil-perf.js'), 'utf8');
const S = { console, Date, Math, module: undefined }; vm.createContext(S);
vm.runInContext(LV3 + '\n' + SPsrc, S);
const REF = require('./fixtures/sommeil-methode-reference.js');
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };

// 1. Seuils validés (13/11) + moteur non touché
const SP = S.SP;
eq(SP.NUIT_MIN === 180 && SP.NUIT_COURTE === 420 && SP.FENETRE === 28 && SP.MIN_REF === 2 && SP.ECART_EPISODE === 2 && SP.MIN_N === 20 && SP.MIN_K === 5 && SP.MIN_M === 5 && SP.Z80 === 0.84, 'seuils = méthode validée', SP);
eq(Object.isFrozen(SP), 'seuils figés');
eq(!/\/\s*30/.test(SPsrc.replace(/\/\*[\s\S]*?\*\//g, '')), 'aucune formule de force recopiée (on appelle _lv3ForcePoint)');
eq(/function _lv3ForceSerie\(s\) \{ var c = _lv3Num\(s && s\.charge\), r = _lv3Num\(s && s\.reps\); return \(c > 0 && r > 0\) \? c \* \(1 \+ \(r \+ _lv3Rir\(s\)\) \/ 30\) : 0; \}/.test(LV3), 'formule de force estimée inchangée');

// Générateur des jeux simulés (identique à la validation : 3 séances types × 5 exos, 3 séances/sem, nuits AR(1) ρ 0,45).
function rng(seed) { let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const g = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }; return { r, g }; }
const MU = 458, SDN = 79.5, RHO = 0.45;   // 7 h 38, écart-type des vraies nuits (contrôle 13/11)
function genB(R, N, ss, se, eff) {
  const ex = []; for (let t = 0; t < 3; t++) for (let i = 0; i < 5; i++) ex.push({ id: t * 5 + i, t, base: 20 + 130 * R.r() });
  const jours = []; let d = 0; while (jours.length < N) { const w = d % 7; if (w === 0 || w === 2 || w === 4) jours.push(d); d++; }
  const nuits = {}; let x = MU + SDN * R.g(); for (let j = 0; j <= jours[jours.length - 1]; j++) { x = MU + RHO * (x - MU) + SDN * Math.sqrt(1 - RHO * RHO) * R.g(); nuits[j] = Math.max(180, x); }
  const perf = []; let phase = 0, lastW = -1;
  jours.forEach((dd, idx) => { const wk = Math.floor(dd / 7); while (lastW < wk) { phase += 0.01 * R.g(); lastW++; }
    const sess = ss * R.g(), type = idx % 3;
    ex.filter((e) => e.t === type).forEach((e) => { let F = e.base * (1 + 0.003 * dd / 7) * (1 + phase) * (1 + sess) * (1 + se * R.g());
      const ch = Math.max(2.5, Math.round(F / (1 + 10 / 30) / 2.5) * 2.5), reps = Math.max(1, Math.round((F / ch - 1) * 30 - 2));
      let f = ch * (1 + (reps + 2) / 30); if (nuits[dd] < 420) f *= (1 - eff / 100); perf.push({ d: dd, e: e.id, f }); }); });
  return { perf, nuits };
}
const BRUITS = { recent: [0.01, 0.05], long: [0.03, 0.08] };   // calibrés à ±3,3 % et ±5,7 % (validation 13/11)

// 2. Parité avec la référence validée
{ const R = rng(1113); let diff = 0, n = 0;
  for (const b of Object.keys(BRUITS)) for (const N of [20, 30, 40, 60]) for (const eff of [0, 3, 5, 8, 10]) for (let k = 0; k < 25; k++) {
    const g = genB(R, N, BRUITS[b][0], BRUITS[b][1], eff), a = S._spMethode(g.perf, g.nuits), r = REF.methode(g.perf, g.nuits); n++;
    if (a.v !== r.v || a.N !== r.N || a.K !== r.K || a.M !== r.M || (r.D !== undefined && (Math.abs(a.D - r.D) > 1e-9 || a.Y !== r.Y))) diff++; }
  eq(diff === 0, 'identique à la référence validée sur ' + n + ' jeux simulés', diff); }

// 3. Propriétés statistiques sur les jeux simulés (2 000 tirages par cas, critères fixés avant simulation)
function carac(N, bruit, eff, seed) { const R = rng(seed); let aff = 0, net = 0, bon = 0, sens = 0;
  for (let k = 0; k < 2000; k++) { const g = genB(R, N, BRUITS[bruit][0], BRUITS[bruit][1], eff), r = S._spMethode(g.perf, g.nuits); if (r.v === 'apprentissage') continue; aff++; if (r.v === 'net') { net++; if (r.D > 0) bon++; else sens++; } }
  return { fp: net / aff * 100, bon: bon / aff * 100, sens: sens / aff * 100 }; }
for (const [N, b] of [[20, 'recent'], [30, 'recent'], [60, 'recent'], [20, 'long'], [40, 'long']]) {
  const c = carac(N, b, 0, 7 + N); eq(c.fp <= 7, 'faux positifs ≤ 7 % (' + b + ', ' + N + ' séances)', c.fp.toFixed(1)); }
{ const c = carac(30, 'recent', 8, 31); eq(c.bon >= 95 && c.sens <= 1, 'effet 8 %, ±3,3 %, 30 séances : détecté ≥ 95 % dans le bon sens', c); }
{ const c = carac(60, 'recent', 3, 61); eq(c.bon >= 70 && c.sens <= 1, 'effet 3 %, ±3,3 %, 60 séances : détecté ≥ 70 %', c); }
{ const c = carac(20, 'long', 10, 21); eq(c.bon >= 80 && c.sens <= 1, 'effet 10 %, ±5,7 %, 20 séances : détecté ≥ 80 %', c); }
{ const c = carac(20, 'long', 3, 23); eq(c.sens <= 1, 'effet 3 % : erreurs de sens ≤ 1 %', c.sens); }

// 4. Adaptateur, cas réel, textes
const iso = (j) => new Date(Date.UTC(2026, 8, 1) + j * 864e5).toISOString().slice(0, 10);
const fr = (j) => iso(j).split('-').reverse().join('/');
{ // 1 exercice, 2 séances le même jour → max ; charge 0 ignorée ; nuit < 3 h ignorée ; force = _lv3ForcePoint
  const data = { historique: { progression_par_exo: {
      A: [{ date: fr(0), series: [{ charge: 100, reps: 5, rpe: 8 }] }, { date: fr(0), series: [{ charge: 100, reps: 8, rpe: 8 }] }, { date: fr(2), series: [{ charge: 0, reps: 10 }] }] } },
    sante_historique: [{ date: iso(0), sommeil_min: 400 }, { date: iso(1), sommeil_min: 120 }] };
  const E = S._spEntrees(data);
  eq(E.perf.length === 1 && Math.abs(E.perf[0].f - S._lv3ForcePoint({ series: [{ charge: 100, reps: 8, rpe: 8 }] })) < 1e-9, 'max du jour, charge 0 exclue, force = _lv3ForcePoint', E.perf);
  eq(S._spMethode(E.perf, E.nuits).N === 0, 'pas de score sans 2 références');
  eq(S._spAnalyse({ historique: data.historique, sante_historique: [] }) === null && S._spHtml({ historique: data.historique }) === '', 'sans montre : rien affiché');
}
// Cas réel du porteur (13/11) : 16 séances appariées, 4 épisodes, 11 normales → en apprentissage.
function jeu(nuitsSeances) { const prog = { A: [], B: [] }, sh = [];
  nuitsSeances.forEach(([j, m], i) => { prog.A.push({ date: fr(j), series: [{ charge: 100 + (i % 3), reps: 8, rpe: 8 }] }); prog.B.push({ date: fr(j), series: [{ charge: 50, reps: 10 + (i % 2), rpe: 8 }] }); sh.push({ date: iso(j), sommeil_min: m }); });
  return { historique: { progression_par_exo: prog }, sante_historique: sh }; }
const reel = [[0, 489], [3, 501], [4, 462], [10, 493], [11, 511], [13, 485], [14, 402], [20, 353], [21, 395], [25, 418], [27, 532], [28, 488], [31, 430], [34, 460], [35, 460], [42, 386]];   // courtes : 14 · 20-21 · 25 (418) · 42 → 4 épisodes, 11 normales
{ const r = S._spAnalyse(jeu(reel)); eq(r.v === 'apprentissage' && r.N === 16 && r.K === 4 && r.M === 11, 'cas réel 16 séances / 4 épisodes / 11 normales → apprentissage', r);
  eq(S._spTexte(r) === 'En apprentissage : 16/20 séances · 4/5 épisodes de nuits courtes · 5/5 séances après nuit normale.', 'texte apprentissage', S._spTexte(r));
  eq(/Sommeil → performance/.test(S._spHtml(jeu(reel))) && /pas d'écart net/.test(S._spHtml(jeu(reel))) && !/tirera de conclusion/.test(S._spHtml(jeu(reel))), 'plus de promesse de conclusion'); }
{ // épisodes : 22, 23, 25 = 1 épisode ; 22, 25 = 2
  const mk = (cs) => { const ns = []; for (let j = 0; j < 30; j++) ns.push([j, cs.includes(j) ? 400 : 470]); return S._spAnalyse(jeu(ns)); };
  eq(mk([10, 11, 13]).K === 1 && mk([10, 13]).K === 2, 'chaînage des épisodes (≤ 2 jours)'); }
eq(S._spTexte({ v: 'net', D: 0.6, K: 5, M: 9 }) === 'Après tes nuits de moins de 7 h, ta force estimée est en moyenne 0,5 % sous ton niveau du moment (5 épisodes, 9 séances après nuit normale).', 'texte écart net < 1 %');
eq(/6 % au-dessus de/.test(S._spTexte({ v: 'net', D: -6.4, K: 5, M: 9 })), 'texte écart net, sens inverse');
eq(S._spTexte({ v: 'pas_net', Y: 5 }) === 'Pas d\'écart net entre tes nuits de moins de 7 h et les autres. Un écart de moins de 5 % ne serait pas détectable avec tes données.', 'texte pas d\'écart net');
eq(/Association observée, pas une preuve de cause/.test(S._spHtml(jeu(Array.from({ length: 30 }, (_, j) => [j * 2, j % 3 === 0 ? 390 : 480])))), 'mention « association, pas une preuve » sur un résultat');

console.log(`sommeil-perf : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
