/* =============================================================================
 * #4 — Schéma de séries : dérivation des cibles PAR SÉRIE (_derivePlanSeries).
 * Fonction PURE du front (js/app.js), extraite et exécutée telle quelle.
 * Vérifie les 4 schémas : fixe · double · top-set+back-off · pyramidal.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext([extractFn('_repsRange'), extractFn('_derivePlanSeries'), extractFn('_planLoadTxt'),
  'this._derivePlanSeries=_derivePlanSeries; this._planLoadTxt=_planLoadTxt;'].join('\n'), sandbox);
const derive = sandbox._derivePlanSeries, loadTxt = sandbox._planLoadTxt;
const RM = 107;   // 1RM estimé → 75% ≈ 80 kg

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; fails.push(label); console.log('  ❌ ' + label); } }

// A — Séries fixes : même cible pour toutes les séries.
let a = derive({ schema: 'fixe', series_prevues: 4, reps_mini: 6, reps_max: 10, charge_pct_1rm: 75, rpe_cible: 8 }, RM);
check('A: 4 séries', a.series.length === 4);
check('A: toutes à 80 kg (75% de 107)', a.series.every(s => s.kg === 80));
check('A: reps 6–10 partout', a.series.every(s => s.reps === '6–10'));
check('A: RPE 8 repris', a.series[0].rpe === 8);
check('A: pas de note (fixe)', a.note === '');

// B — Double progression : cibles identiques + note dédiée.
let b = derive({ schema: 'double', series_prevues: 3, reps_mini: 8, reps_max: 12, charge_pct_1rm: 70 }, RM);
check('B: 3 séries identiques', b.series.length === 3 && b.series.every(s => s.pct === 70));
check('B: note double progression', /double progression/i.test(b.note));

// C — Top-set + back-off : S1 lourde, S2+ dérivées à −10%.
let c = derive({ schema: 'topbackoff', series_prevues: 4, reps_mini: 6, reps_max: 8, charge_pct_1rm: 85, rpe_cible: 8, backoff_pct: 10 }, RM);
check('C: 4 séries', c.series.length === 4);
check('C: S1 = top (tag lourde, 85%)', c.series[0].tag === 'lourde' && c.series[0].pct === 85);
check('C: S1 reps = reps_mini (6)', c.series[0].reps === '6');
check('C: S2 = back-off à 77% (85 −10%)', c.series[1].tag === 'back-off' && c.series[1].pct === 77);
check('C: back-off reps = reps_max (8)', c.series[1].reps === '8');
check('C: note mentionne −10%', /−10%|-10%/.test(c.note));

// D — Pyramidal : cible propre à chaque série depuis series_json.
let d = derive({ schema: 'pyramidal', series_prevues: 3, series_json: [{ pct: 70, reps: 12 }, { pct: 80, reps: 8 }, { pct: 90, reps: 5 }] }, RM);
check('D: 3 séries', d.series.length === 3);
check('D: S1 70% × 12', d.series[0].pct === 70 && d.series[0].reps === '12');
check('D: S3 90% × 5', d.series[2].pct === 90 && d.series[2].reps === '5');
check('D: charges croissantes', d.series[0].kg < d.series[1].kg && d.series[1].kg < d.series[2].kg);
check('D: note pyramidal', /pyramidal/i.test(d.note));

// E — Sans 1RM : pas de kg, le libellé retombe sur le % 1RM.
let e = derive({ schema: 'fixe', series_prevues: 2, reps_mini: 5, reps_max: 5, charge_pct_1rm: 80 }, null);
check('E: kg null sans 1RM', e.series[0].kg === null);
check('E: _planLoadTxt affiche le %', loadTxt(e.series[0]) === '80 %');

// F — series_prevues 0 → aucune série (pas de crash).
let f = derive({ schema: 'fixe', series_prevues: 0 }, RM);
check('F: 0 série', f.series.length === 0);

// G — schema absent → traité comme « fixe ».
let g = derive({ series_prevues: 2, reps_mini: 8, reps_max: 8, charge_pct_1rm: 60 }, RM);
check('G: défaut fixe (2 séries identiques)', g.series.length === 2 && g.series.every(s => s.pct === 60));

console.log('-'.repeat(78));
console.log('#4 — _derivePlanSeries : ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ Dérivation des 4 schémas de séries conforme.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
