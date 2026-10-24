/* =============================================================================
 * « Dernière fois → cible » PAR SÉRIE — fonctions pures de js/app.js (séance).
 * _refSerie (retrouve la série k dans l'historique) · _cibleSerieSurcharge (double
 * progression : +reps puis +charge au plafond).
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
vm.runInContext([extractFn('_refSerie'), extractFn('_cibleSerieSurcharge'),
  'this._refSerie=_refSerie; this._cibleSerieSurcharge=_cibleSerieSurcharge;'].join('\n'), sandbox);
const refSerie = sandbox._refSerie, cible = sandbox._cibleSerieSurcharge;

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; fails.push(label); console.log('  ❌ ' + label); } }

// --- _refSerie ---
var hist = [{ serie: '1', charge: 82, reps: 8 }, { serie: '2', charge: 82, reps: 7 }, { serie: '3', charge: 80, reps: 6 }];
check('refSerie: trouve S1 par numéro', refSerie(hist, 1).reps === 8);
check('refSerie: trouve S3 par numéro', refSerie(hist, 3).charge === 80);
check('refSerie: repli par index si pas de champ serie', refSerie([{ charge: 50, reps: 10 }, { charge: 50, reps: 9 }], 2).reps === 9);
check('refSerie: null si absent', refSerie(hist, 9) === null);
check('refSerie: null si pas un tableau', refSerie(null, 1) === null);

// --- _cibleSerieSurcharge (double progression) ---
// reps < max → +1 rep, même charge.
var c1 = cible({ charge: 82, reps: 8 }, 12, 8, 2);
check('cible: reps<max → +1 rep', c1.reps === 9 && c1.charge === 82 && c1.up === 'reps');
// reps au plafond → +incrément de charge, retour au bas de fourchette.
var c2 = cible({ charge: 82, reps: 12 }, 12, 8, 2.5);
check('cible: reps=max → +charge', c2.charge === 84.5 && c2.reps === 8 && c2.up === 'charge');
// arrondi au quart de kg.
var c3 = cible({ charge: 80, reps: 12 }, 12, 8, 1.25);
check('cible: arrondi 0.25 kg', c3.charge === 81.25);
// pas de rmax → progresse en reps par défaut.
var c4 = cible({ charge: 60, reps: 10 }, null, null, 2);
check('cible: sans fourchette → +1 rep', c4.reps === 11 && c4.charge === 60);

console.log((ko === 0 ? '✓' : '✗') + ' surcharge-serie : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs:\n  ' + fails.join('\n  ')); process.exit(1); }
