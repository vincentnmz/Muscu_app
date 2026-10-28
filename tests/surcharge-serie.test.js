/* =============================================================================
 * Surcharge progressive PAR NIVEAU — règle unique validée le 28/10/2026
 * (fonctions pures de js/app.js) : _refSerie · _progDecision · _estPoly ·
 * _reposBornes · _reposRef · _petitPas.
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
const sandbox = { exercicesData: [{ exercice: 'Leg curl', increment_kg: '2.5 / 5 kg' }, { exercice: 'Curl haltère', increment_kg: '2 kg' }, { exercice: 'Pompe', increment_kg: null }] };
vm.createContext(sandbox);
const FN = ['_refSerie', '_r025', '_progDecision', '_estPoly', '_reposBornes', '_reposRef', '_petitPas'];
vm.runInContext("var _POLY_KW = ['squat', 'pendulum', 'presse', 'soulev', 'rdl', 'hip thrust', 'fente', 'developpe', 'dips', 'traction', 'rowing', 't-bar', 'tirage']; var _POLY_EXCL = ['mollet', ' uni', 'trapeze'];\n"
  + FN.map(extractFn).join('\n') + '\n' + FN.map(f => 'this.' + f + '=' + f + ';').join(''), sandbox);
const S = sandbox;
// garde-fou : les listes du test = celles du code
for (const v of ['_POLY_KW', '_POLY_EXCL']) { const m = SRC.match(new RegExp('var ' + v + ' = (\\[[^\\]]*\\])')); if (!m) throw new Error(v + ' introuvable'); vm.runInContext('var ' + v + ' = ' + m[1] + ';', S); }

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; fails.push(label); console.log('  ❌ ' + label); } }
const ser = (arr, rpe, repos) => arr.map((x, i) => ({ serie: i + 1, charge: x[0], reps: x[1], rpe: rpe, repos: repos }));
const D = (o) => S._progDecision(Object.assign({ rmin: 8, rmax: 12, nPrevues: 3, pas: 2.5, reposRef: 120, bornes: { min: 60, max: 180 } }, o));
const top = ser([[35, 12], [35, 12], [35, 12]], 8, 120);

// --- _refSerie ---
var hist = [{ serie: '1', charge: 82, reps: 8 }, { serie: '2', charge: 82, reps: 7 }, { serie: '3', charge: 80, reps: 6 }];
check('refSerie: trouve S3 par numéro', S._refSerie(hist, 3).charge === 80);
check('refSerie: repli par index', S._refSerie([{ charge: 50, reps: 10 }, { charge: 50, reps: 9 }], 2).reps === 9);

// --- Débutant ---
let d = D({ niveau: 'debutant', last: top, prev: null });
check('débutant : toutes au haut, 1 fois, RPE 8 → charge', d.mode === 'charge' && d.cible(1).charge === 37.5 && d.cible(1).reps === 8);
d = D({ niveau: 'debutant', last: ser([[35, 12], [35, 12], [35, 10]], 8, 120) });
check('débutant : une série sous le haut → +1 rep (pas de charge)', d.mode === 'reps' && d.cible(3).reps === 11 && d.cible(1).reps === 12 && d.cible(1).charge === 35);
d = D({ niveau: 'debutant', last: ser([[35, 12], [35, 12]], 8, 120) });
check('débutant : moins de séries que prévu → pas de charge', d.mode === 'reps');
d = D({ niveau: 'debutant', last: ser([[35, 12], [35, 12], [35, 12]], null, 120) });
check('débutant : RPE non saisi → ne bloque pas', d.mode === 'charge');
// --- Intermédiaire ---
d = D({ niveau: 'intermediaire', last: top, prev: ser([[35, 11], [35, 12], [35, 12]], 8) });
check('intermédiaire : 1 seule fois au haut (RPE 8) → +1 rep, pas de charge', d.mode === 'reps');
d = D({ niveau: 'intermediaire', last: top, prev: top });
check('intermédiaire : 2 séances de suite → charge', d.mode === 'charge' && d.cible(2).charge === 37.5);
d = D({ niveau: 'intermediaire', last: ser([[35, 12], [35, 12], [35, 12]], 7, 120), prev: null });
check('intermédiaire : 1 fois avec RPE ≤ 7 → charge', d.mode === 'charge');
// --- Consolide ---
d = D({ niveau: 'intermediaire', last: ser([[35, 12], [35, 12], [35, 12]], 9, 120), prev: top });
check('RPE ≥ 9 → consolide (mêmes charge et reps)', d.mode === 'consolide' && d.cible(1).charge === 35 && d.cible(1).reps === 12);
// --- Avancé / expert : choix ---
d = D({ niveau: 'avance', last: top, prev: top });
check('avancé : charge possible → choix du jour (4 options)', d.mode === 'choix' && d.options.length === 4);
check('choix charge : +2,5 kg, bas de fourchette, repos inchangé', JSON.stringify(d.cible(1, 'charge')) === JSON.stringify({ charge: 37.5, reps: 8, repos: 120, up: 'charge' }));
check('choix charge +30 s', d.cible(1, 'charge30').charge === 37.5 && d.cible(1, 'charge30').repos === 150);
check('choix +1 rep +30 s', d.cible(1, 'rep30').charge === 35 && d.cible(1, 'rep30').reps === 13 && d.cible(1, 'rep30').repos === 150);
check('choix repos −30 s : même perf', d.cible(1, 'repos').reps === 12 && d.cible(1, 'repos').repos === 90);
d = D({ niveau: 'expert', last: top, prev: top, reposRef: 60 });
check('repos au minimum → option « réduire » grisée', d.options[3].ok === false && /minimum/.test(d.options[3].raison));
d = D({ niveau: 'expert', last: top, prev: top, reposRef: 180 });
check('repos au maximum → options +30 s grisées', !d.options[1].ok && !d.options[2].ok && d.options[3].ok);
d = D({ niveau: 'expert', last: top, prev: ser([[35, 12], [35, 11], [35, 12]], 8) });
check('expert : 1 seule fois au haut → +1 rep, pas de choix', d.mode === 'reps');
// --- Poids du corps / hors programme ---
d = D({ niveau: 'avance', last: ser([[0, 12], [0, 12], [0, 12]], 8, 120), prev: ser([[0, 12], [0, 12], [0, 12]], 8), pas: 0 });
check('poids du corps : jamais de charge → +1 rep', d.mode === 'reps' && d.cible(1).reps === 13);
d = D({ niveau: 'debutant', last: ser([[20, 10]], 8, 90), rmin: null, rmax: null, nPrevues: 0 });
check('hors programme (pas de fourchette) → +1 rep', d.mode === 'reps' && d.cible(1).reps === 11);
check('jamais fait → premier essai', D({ niveau: 'debutant', last: [] }).mode === 'premier');

// --- Utilitaires ---
check('petit pas : « 2.5 / 5 kg » → 2,5', S._petitPas('Leg curl') === 2.5);
check('petit pas : « 2 kg » → 2', S._petitPas('Curl haltère') === 2);
check('petit pas : non renseigné → 0', S._petitPas('Pompe') === 0);
check('poly : squat, développé couché, traction, T-bar row', ['Squat', 'Développé couché barre', 'Traction', 'T-bar row prise basse', 'Presse inclinée', 'RDL haltère'].every(S._estPoly));
check('pas poly : curl, leg curl, mollets presse, tirage uni, trapèze machine', !['Curl haltére', 'Leg curl allongé', 'Les extensions mollets à la presse', 'Tirage vertical uni à la poulie', 'Tirage trapèze machine', 'Elévation latérale haltère'].some(S._estPoly));
check('bornes : poly 2-5 min, isolation 1-3 min', S._reposBornes('Squat').min === 120 && S._reposBornes('Squat').max === 300 && S._reposBornes('Leg extension').min === 60);
check('repos réf : le plus fréquent de la dernière fois', S._reposRef(ser([[1, 1], [1, 1], [1, 1]], 8, 90).concat([{ repos: 120 }]), 150) === 90);
check('repos réf : sans historique → programme', S._reposRef([{ repos: null }], 150) === 150);
check('repos réf : rien → null (pas inventé)', S._reposRef([], null) === null);

console.log('-'.repeat(70));
console.log('surcharge par niveau : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
