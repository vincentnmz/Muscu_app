/* =============================================================================
 * Points 2 et 5 (31/10) — « ta normale » bien-être + montre (VRAIES fonctions de js/app.js).
 *  - normale = 5 semaines précédentes, ≥ 7 saisies, sinon on le dit (aucune moyenne inventée) ;
 *  - orange seulement à ±1 point (sommeil en baisse / fatigue-stress-courbatures en hausse) ;
 *  - montre : rien sans montre ; sommeil 7 j vs les 4 semaines d'avant.
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extractFrom(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const FN = ['_dYmd', '_fmt1', '_beNormale', '_beNormaleTxt', '_montreNormale', '_fmtHmin'];
const S = {}; vm.createContext(S);
vm.runInContext(FN.map(extractFrom).join('\n') + '\n' + FN.map(n => `this.${n}=${n};`).join(''), S);

let ok = 0, ko = 0;
function eq(c, l, g) { if (c) ok++; else { ko++; console.error('  ✗ ' + l + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } }
const NOW = new Date(2026, 9, 31, 12).getTime();
const day = (n) => { const d = new Date(NOW - n * 864e5); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };
const be = (fn, n = 20) => ({ bien_etre: Array.from({ length: n }, (_, i) => Object.assign({ date: day(i) }, fn(i))) });

// Normale stable → « dans ta normale ».
{ const r = S._beNormale(be(() => ({ sommeil: 4, fatigue: 1 })), NOW);
  const so = r.find(x => x.key === 'sommeil');
  eq(so.etat === 'ok' && so.base === 4 && so.n === 3, 'sommeil stable → dans la normale', so);
  eq(/dans ta normale/.test(S._beNormaleTxt(so, 'ta')), 'texte « dans ta normale »'); }
// Sommeil en baisse d'1 point sur les 3 dernières saisies → « sous ta normale ».
{ const so = S._beNormale(be(i => ({ sommeil: i < 3 ? 3 : 4 })), NOW).find(x => x.key === 'sommeil');
  eq(so.etat === 'bas', 'sommeil −1 → sous la normale', so); }
// Fatigue en hausse d'1 point → « au-dessus ».
{ const fa = S._beNormale(be(i => ({ fatigue: i < 3 ? 3 : 2 })), NOW).find(x => x.key === 'fatigue');
  eq(fa.etat === 'haut', 'fatigue +1 → au-dessus de la normale', fa); }
// Écart < 1 point → reste « dans la normale ».
{ const so = S._beNormale(be(i => ({ sommeil: i < 3 ? 3.5 : 4 })), NOW).find(x => x.key === 'sommeil');
  eq(so.etat === 'ok', 'écart 0,5 → dans la normale', so); }
// Trop peu de saisies → pas de moyenne inventée.
{ const st = S._beNormale(be(i => ({ stress: 1 }), 6), NOW).find(x => x.key === 'stress');
  eq(st.etat === 'nd' && st.base === null && /arrive après 7 saisies \(3 pour/.test(S._beNormaleTxt(st, 'ta')), '6 saisies → « ta normale arrive après 7 saisies »', st); }
// Rien saisi depuis > 7 j → pas de ligne.
{ eq(S._beNormale({ bien_etre: [{ date: day(10), sommeil: 2 }] }, NOW).length === 0, 'dernière saisie > 7 j → aucune ligne'); }
// Montre absente → null ; présente → sommeil 7 j vs 4 semaines d'avant.
{ eq(S._montreNormale({ sante_historique: [] }, NOW) === null, 'sans montre → rien');
  const iso = (n) => new Date(NOW - n * 864e5).toISOString().slice(0, 10);
  const sh = []; for (let i = 0; i < 30; i++) sh.push({ date: iso(i), sommeil_min: i < 7 ? 480 : 420 });
  const m = S._montreNormale({ sante_historique: sh }, NOW);
  eq(m.sommeil.moy === 480 && m.sommeil.base === 420 && m.sommeil.n === 7, 'sommeil montre 8 h vs normale 7 h', m.sommeil);
  eq(S._fmtHmin(485.7) === '8 h 06', 'format 8 h 06', S._fmtHmin(485.7)); }

console.log('-'.repeat(70));
console.log(`normale bien-être : ${ok} OK / ${ko} KO`);
if (ko) process.exitCode = 1;
