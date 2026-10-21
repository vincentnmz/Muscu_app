/* =============================================================================
 * Générateur v2 (MOTEUR) — fonctions pures de js/app.js, exécutées telles quelles.
 * Vérifie : compose blocs→séances, coupe par le temps (round-robin), superset bras,
 * variantes, et squelettes Force (lignes montantes/%1RM).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Le moteur v2 = tout le bloc entre `var _G2_BLOCKS` et le marqueur du modal.
const start = SRC.indexOf('var _G2_BLOCKS');
const end = SRC.indexOf('// ── Modal onboarding (3 étapes) ──');
if (start < 0 || end < 0 || end <= start) throw new Error('bloc moteur v2 introuvable');
const block = SRC.slice(start, end);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(block + '\nthis._genProgramme2=_genProgramme2; this._genProgrammeForce=_genProgrammeForce; this._g2Reps=_g2Reps; this._g2GenDays=_g2GenDays;', sandbox);
const gen = sandbox._genProgramme2, force = sandbox._genProgrammeForce, reps = sandbox._g2Reps;

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; fails.push(label); console.log('  ❌ ' + label); } }
function seances(lignes) { var s = {}; lignes.forEach(function (l) { (s[l.seance_id] = s[l.seance_id] || []).push(l); }); return s; }

// A — Hypertrophie · Upper/Lower · 4 j · 90 min · interméd.
let A = gen('hypertrophie', 'ul', 4, 90, 'intermediaire');
let As = seances(A);
check('A: 4 séances', Object.keys(As).length === 4);
check('A: Haut A = 9 exos (cap 90 min)', As['Haut A'] && As['Haut A'].length === 9);
check('A: 3 séries (interméd.)', A.every(function (l) { return l.series_prevues === 3; }));
let ssA = As['Haut A'].filter(function (l) { return l.groupe_id === 'ss1'; });
check('A: superset bras (biceps+triceps groupés ss1)', ssA.length >= 2 && ssA.every(function (l) { return /curl|extension|dips/i.test(l.exercice); }));
check('A: pas de %1RM imposé en hypertrophie', A.every(function (l) { return l.charge_pct_1rm === null; }));
check('A: variantes fournies (≥1 exo avec remplaçants)', A.some(function (l) { return l.variantes && l.variantes.length > 0; }));

// B — Le TEMPS coupe le nombre d'exos.
let B45 = seances(gen('hypertrophie', 'ul', 4, 45, 'intermediaire'));
let B90 = seances(gen('hypertrophie', 'ul', 4, 90, 'intermediaire'));
check('B: 45 min → Haut A = 5 exos', B45['Haut A'].length === 5);
check('B: 90 min → Haut A = 9 exos', B90['Haut A'].length === 9);
check('B: 45 < 90 (le temps influe)', B45['Haut A'].length < B90['Haut A'].length);

// C — 1 exercice par muscle d'abord (pas 2 pecs avant d'avoir couvert les autres).
let C = seances(gen('hypertrophie', 'ul', 4, 45, 'intermediaire'))['Haut A'];
let muscles = C.map(function (l) { return l.seance_id, l.exercice; });
check('C: 5 exos = 5 muscles distincts à 45 min', new Set(C.map(function (l) { return l.exercice; })).size === 5);

// D — Full Body 3 j : 1 exo/muscle, séances plafonnées par le temps (60 min → 6).
let D = seances(gen('hypertrophie', 'fb', 3, 60, 'intermediaire'));
check('D: 3 séances Full Body', Object.keys(D).length === 3);
check('D: ≤ 6 exos/séance à 60 min', Object.keys(D).every(function (k) { return D[k].length <= 6; }));

// E — Avancé → 4 séries.
check('E: avancé = 4 séries', gen('hypertrophie', 'ppl', 3, 75, 'avance').every(function (l) { return l.series_prevues === 4; }));

// F — _g2Reps : force (poly 4-6) · débutant (relevé) · hypertrophie (valeurs du bloc).
check('F: force poly = 4-6', JSON.stringify(reps('force', 'intermediaire', { type: 'poly', rmin: 6, rmax: 8 })) === '[4,6]');
check('F: débutant relève les reps', reps('hypertrophie', 'debutant', { type: 'poly', rmin: 6, rmax: 8, rmax: 8 })[0] >= 10);

// G — Force 3 j : Squat+Dév ensemble, Soulevé seul, Renfo 5 accessoires.
let G = seances(force(3));
check('G: 3 séances', Object.keys(G).length === 3);
check('G: J1 = 2 lifts (Squat + Dév. couché)', G['Squat + Développé couché'] && G['Squat + Développé couché'].length === 2);
check('G: lifts en schéma montantes @ %1RM', G['Squat + Développé couché'].every(function (l) { return l.schema === 'montantes' && l.charge_pct_1rm === 85; }));
check('G: Soulevé de terre seul', G['Soulevé de terre'] && G['Soulevé de terre'].length === 1);
check('G: Renfo = 5 accessoires 8-12', G['Renfo'] && G['Renfo'].length === 5 && G['Renfo'].every(function (l) { return l.reps_max === 12; }));

// H — Force 6 j : 3 lifts seuls + 2 rappels (lift léger) + Renfo.
let H = seances(force(6));
check('H: 6 séances distinctes', Object.keys(H).length === 6);
let hRappel = force(6).filter(function (l) { return /^Rappel/.test(l.seance_id); });
check('H: 2 rappels = lifts légers (%1RM 70/75)', hRappel.length === 2 && hRappel.every(function (l) { return l.charge_pct_1rm === 70 || l.charge_pct_1rm === 75; }));

console.log((ko === 0 ? '✓' : '✗') + ' generateur-v2 : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs:\n  ' + fails.join('\n  ')); process.exit(1); }
