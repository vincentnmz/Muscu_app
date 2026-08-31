/* =============================================================================
 * PHASE FIABILITÉ — Tests de VALEUR des agrégations backend (index.ts).
 *
 * Standard de traçabilité : données brutes connues → agrégation → valeur exacte.
 * On teste le VRAI code : les fonctions sont extraites de
 * supabase/functions/handler/index.ts, les types TypeScript sont retirés
 * (module.stripTypeScriptTypes, Node ≥ 22), puis exécutées dans un bac à sable.
 *
 * Couverture actuelle : computeGlobal (dont dernieres_seances — bug « 36 exos »).
 * À étendre ensuite : computeRecent, computeComparison, computeStreak,
 * buildProgression* (voir plan Phase Fiabilité).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

// Extraction d'une fonction par équilibrage d'accolades (les ${} des gabarits
// sont internes-équilibrés, donc sans effet sur la profondeur).
function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}

const tsCode = ['fmtYMD', 'parseFR', 'fmtFR', 'normDate', 'computeGlobal'].map(extractFn).join('\n\n');
const jsCode = stripTypeScriptTypes(tsCode);           // retire les types → JS exécutable
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(jsCode + '\nthis.computeGlobal = computeGlobal;', sandbox);
const computeGlobal = sandbox.computeGlobal;

let ok = 0, ko = 0;
const check = (n, cond, att, obt) => { if (cond) ok++; else { ko++; console.log('  ❌ ' + n + ' — attendu ' + att + ', obtenu ' + obt); } };
const eq = (n, got, exp) => check(n, got === exp, JSON.stringify(exp), JSON.stringify(got));

// ── Jeu de données brutes CONNU ──────────────────────────────────────────────
// Deux séances « Full body » à deux DATES différentes + une « Push » + une vieille
// « Legs ». seance_id = NOM/TYPE (réutilisé). Charges/reps connues → tonnage exact.
const perfs = [
  // 2026-08-10 · Full body : Squat 100×5=500, Bench 80×5=400  → tonnage 900, 2 exos
  { date: '2026-08-10', seance_id: 'Full body', exercice: 'Squat', muscle: 'Jambes',   charge: 100, reps: 5, rpe: 8 },
  { date: '2026-08-10', seance_id: 'Full body', exercice: 'Bench', muscle: 'Pectoraux', charge: 80,  reps: 5, rpe: 7 },
  // 2026-08-17 · Full body : Squat 105×5=525, Deadlift 120×3=360 → tonnage 885, 2 exos
  { date: '2026-08-17', seance_id: 'Full body', exercice: 'Squat',    muscle: 'Jambes', charge: 105, reps: 5, rpe: 9 },
  { date: '2026-08-17', seance_id: 'Full body', exercice: 'Deadlift', muscle: 'Dos',    charge: 120, reps: 3, rpe: 9 },
  // 2026-08-20 · Push : Bench 85×5=425, Overhead 50×5=250 → tonnage 675, 2 exos
  { date: '2026-08-20', seance_id: 'Push', exercice: 'Bench',    muscle: 'Pectoraux', charge: 85, reps: 5, rpe: 8 },
  { date: '2026-08-20', seance_id: 'Push', exercice: 'Overhead', muscle: 'Épaules',   charge: 50, reps: 5, rpe: 7 },
  // 2026-07-01 · Legs (ancienne) : Squat 90×5=450 → hors des 3 dernières
  { date: '2026-07-01', seance_id: 'Legs', exercice: 'Squat', muscle: 'Jambes', charge: 90, reps: 5, rpe: 6 },
];

const g = computeGlobal(perfs);
const ds = g.dernieres_seances;

// ── PREUVE « 36 exos » : une séance réelle = une DATE réelle ─────────────────
eq('dernieres_seances = 3 entrées (3 dernières DATES)', ds.length, 3);
eq('[0] date la plus récente = 20/08/2026', ds[0].date, '20/08/2026');
eq('[1] date = 17/08/2026', ds[1].date, '17/08/2026');
eq('[2] date = 10/08/2026', ds[2].date, '10/08/2026');
check('vieille séance 01/07 EXCLUE des 3 dernières', !ds.some(s => s.date === '01/07/2026'), 'absente', 'PRÉSENTE');

// (1) Deux « Full body » à deux dates = DEUX séances distinctes (pas fusionnées)
const fullBodyEntries = ds.filter(s => s.seance_id === 'Full body');
eq('les 2 « Full body » restent 2 entrées distinctes', fullBodyEntries.length, 2);

// (2) Exercices regroupés correctement PAR DATE (pas de fuite entre jours)
eq('17/08 → 2 exercices distincts (Squat+Deadlift)', ds[1].exercices.length, 2);
check('17/08 contient Squat & Deadlift', ds[1].exercices.includes('Squat') && ds[1].exercices.includes('Deadlift'), 'oui', 'non');
check('17/08 NE contient PAS Bench (venait du 10/08)', !ds[1].exercices.includes('Bench'), 'absent', 'PRÉSENT');

// (3) Tonnage de chaque séance = uniquement les lignes de CE jour
eq('tonnage 20/08 = 675 (85×5 + 50×5)', ds[0].tonnage, 675);
eq('tonnage 17/08 = 885 (105×5 + 120×3)', ds[1].tonnage, 885);
eq('tonnage 10/08 = 900 (100×5 + 80×5)', ds[2].tonnage, 900);

// (5) Aucune donnée d'une ancienne séance ne fuit dans une récente
//     → l'ANCIEN bug (regroupement par type) aurait fusionné les 2 « Full body » :
//        3 exos {Squat,Bench,Deadlift} et tonnage 1785. On prouve que NON.
check('anti-« 36 exos » : aucune entrée n\'a ≥ 3 exos', ds.every(s => s.exercices.length <= 2), 'max 2', 'FUSION détectée');
check('anti-fusion : aucun tonnage = 1785 (900+885)', !ds.some(s => s.tonnage === 1785), 'absent', 'FUSION détectée');

// ── Autres valeurs de computeGlobal (traçabilité) ────────────────────────────
eq('total_seances = 4 jours distincts', g.total_seances, 4);
eq('total_series = 7 lignes', g.total_series, 7);
eq('total_reps = 33', g.total_reps, 33);
eq('tonnage_total_kg = 2910 (900+885+675+450)', g.tonnage_total_kg, 2910);
eq('mean_rpe = 7.7 (moyenne des 7 RPE)', g.mean_rpe, Math.round((8+7+9+9+8+7+6) / 7 * 10) / 10);
eq('record Squat = meilleure charge 105', g.records['Squat'].charge, 105);
eq('record Deadlift = 120', g.records['Deadlift'].charge, 120);

// ── Cas limite : aucune performance ──────────────────────────────────────────
const vide = computeGlobal([]);
eq('perfs vides → total_seances 0', vide.total_seances, 0);
eq('perfs vides → dernieres_seances []', vide.dernieres_seances.length, 0);

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Agrégats backend — ${ok} vérifs de VALEUR (computeGlobal ; une séance = une date réelle).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
