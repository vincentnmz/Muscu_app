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

const WINDOWS_SRC = SRC.match(/const WINDOWS = \{[^}]*\}/)[0] + ';';   // { ACUTE:7, MID:14, CHRONIC:28, LONG:56 }
const FN_NAMES = ['fmtYMD', 'minus', 'parseFR', 'fmtFR', 'normDate', 'isoWeek', 'prevIsoWeek', 'getLundi',
  'computeGlobal', 'computeRecent', 'computeComparison', 'computeStreak', 'buildProgressionParExo', 'buildVolumeSemaineParMuscle'];
const tsCode = WINDOWS_SRC + '\n\n' + FN_NAMES.map(extractFn).join('\n\n');
const jsCode = stripTypeScriptTypes(tsCode);           // retire les types → JS exécutable
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(jsCode + '\n' + FN_NAMES.map(n => `this.${n} = ${n};`).join(''), sandbox);
const { computeGlobal, computeRecent, computeComparison, computeStreak, buildProgressionParExo, buildVolumeSemaineParMuscle } = sandbox;

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

// =============================================================================
// computeRecent — fenêtres glissantes (référence : now = 2026-08-20)
// =============================================================================
const NOW = new Date('2026-08-20T12:00:00Z');
// 3 séances dans les 7 j (14, 17, 20 août, 500 kg chacune) + 1 hors 7 j (09 août).
const perfsRecent = [
  { date: '2026-08-14', seance_id: 'A', exercice: 'Squat', muscle: 'Jambes', charge: 100, reps: 5, rpe: 8 },
  { date: '2026-08-17', seance_id: 'A', exercice: 'Squat', muscle: 'Jambes', charge: 100, reps: 5, rpe: 6 },
  { date: '2026-08-20', seance_id: 'A', exercice: 'Squat', muscle: 'Jambes', charge: 100, reps: 5, rpe: 10 },
  { date: '2026-08-09', seance_id: 'A', exercice: 'Squat', muscle: 'Jambes', charge: 100, reps: 5, rpe: 4 },
];
const rec = computeRecent(perfsRecent, NOW);
// j7 : 3 jours, 500 kg × 3 = 1500 kg = 1,5 t
eq('recent.j7.seances = 3 jours distincts', rec.j7.seances, 3);
eq('recent.j7.tonnage_kg = 1500', rec.j7.tonnage_kg, 1500);
eq('recent.j7.tonnage = 1.5 t', rec.j7.tonnage, 1.5);
eq('recent.j7.rpe_moyen = 8 ((8+6+10)/3)', rec.j7.rpe_moyen, 8);
eq('recent.j7.frequence_semaine = 3', rec.j7.frequence_semaine, 3);
// monotonie/strain : loads [500,0,0,500,0,0,500] sur 7 j → mean=1500/7, std connu
eq('recent.j7.monotonie = 0.87', rec.j7.monotonie, 0.87);
eq('recent.j7.strain = 1305', rec.j7.strain, 1305);
// j28 : les 4 séances (500×4 = 2000 kg), RPE moyen (8+6+10+4)/4 = 7
eq('recent.j28.seances = 4', rec.j28.seances, 4);
eq('recent.j28.tonnage_kg = 2000', rec.j28.tonnage_kg, 2000);
eq('recent.j28.rpe_moyen = 7', rec.j28.rpe_moyen, 7);
eq('recent.j28.frequence_semaine = 1', rec.j28.frequence_semaine, 1);
// cas limite : aucune donnée dans la fenêtre → monotonie/strain null
const recVide = computeRecent([], NOW);
eq('recent vide → j7.seances 0', recVide.j7.seances, 0);
eq('recent vide → j7.monotonie null', recVide.j7.monotonie, null);
eq('recent vide → j7.strain null', recVide.j7.strain, null);
eq('recent vide → j7.rpe_moyen null', recVide.j7.rpe_moyen, null);

// =============================================================================
// computeComparison — 7 j vs 7 j précédents / 28 j vs 28 j précédents
// =============================================================================
const cmp = computeComparison(perfsRecent, NOW);
eq('comparison j7 tonnage = 1500 kg', cmp.j7_vs_j7prec.tonnage.j7, 1500);
eq('comparison j7_prec tonnage = 500 kg (séance du 09/08)', cmp.j7_vs_j7prec.tonnage.j7_prec, 500);
eq('comparison j7 évolution = +200 % ((1500-500)/500)', cmp.j7_vs_j7prec.tonnage.evol_pct, 200);
eq('comparison j7 seances = 3', cmp.j7_vs_j7prec.seances.j7, 3);
eq('comparison j7_prec seances = 1', cmp.j7_vs_j7prec.seances.j7_prec, 1);
eq('comparison j28 tonnage = 2000 kg', cmp.j28_vs_j28prec.tonnage.j28, 2000);
eq('comparison j28 évolution = null (période précédente vide)', cmp.j28_vs_j28prec.tonnage.evol_pct, null);
// Dédup anomalie #3 : le tonnage 7 j est le MÊME depuis computeRecent et computeComparison
// (même fenêtre now-7, même formule). tonnageObj.j7 (dashboard) = recentData.j7.tonnage.
eq('cohérence tonnage 7 j : recent.j7.tonnage_kg === comparison.j7', rec.j7.tonnage_kg, cmp.j7_vs_j7prec.tonnage.j7);
eq('tonnage 7 j en tonnes (source dashboard) = 1.5', rec.j7.tonnage, 1.5);

// =============================================================================
// computeStreak — semaines ISO consécutives depuis « now »
// =============================================================================
eq('streak 3 semaines consécutives (20, 13, 06 août)', computeStreak(['2026-08-20', '2026-08-13', '2026-08-06'], NOW), 3);
eq('streak = 0 si la semaine courante manque (rupture immédiate)', computeStreak(['2026-08-13', '2026-08-06'], NOW), 0);
eq('streak 1 (uniquement la semaine courante)', computeStreak(['2026-08-20'], NOW), 1);
eq('streak 0 si aucune date', computeStreak([], NOW), 0);

// =============================================================================
// buildProgressionParExo — 1 point par DATE (meilleure série du jour), 8 récents
// =============================================================================
const perfsProg = [
  // 10/08 : 2 séries le même jour → la MEILLEURE (charge la plus haute) est retenue
  { date: '2026-08-10', seance_id: 'A', exercice: 'Squat', charge: 100, reps: 5 },
  { date: '2026-08-10', seance_id: 'A', exercice: 'Squat', charge: 90,  reps: 8 },
  { date: '2026-08-17', seance_id: 'A', exercice: 'Squat', charge: 105, reps: 5 },
  { date: '2026-08-20', seance_id: 'A', exercice: 'Squat', charge: 102, reps: 5 },
];
// 9 dates distinctes pour « Curl » → doit être plafonné à 8 points
for (let d = 1; d <= 9; d++) perfsProg.push({ date: `2026-08-0${d}`, seance_id: 'B', exercice: 'Curl', charge: 20, reps: 10 });
const prog = buildProgressionParExo(perfsProg);
eq('progression Squat = 3 points (1 par date)', prog.Squat.length, 3);
eq('Squat[0] = date la plus récente 20/08/2026', prog.Squat[0].date, '20/08/2026');
eq('Squat[0].charge = 102', prog.Squat[0].charge, 102);
eq('Squat[1].charge = 105 (17/08)', prog.Squat[1].charge, 105);
eq('Squat[2] = meilleure série du 10/08 = 100×5 (pas 90×8)', prog.Squat[2].charge, 100);
eq('Squat[2].reps = 5 (charge prioritaire sur volume)', prog.Squat[2].reps, 5);
eq('Squat[2].volume = 500 (100×5)', prog.Squat[2].volume, 500);
eq('progression Curl plafonnée à 8 points (sur 9 dates)', prog.Curl.length, 8);
eq('Curl[0] = date la plus récente 09/08/2026', prog.Curl[0].date, '09/08/2026');
eq('Curl[7] = 02/08/2026 (8 plus récentes → 01/08 exclue)', prog.Curl[7].date, '02/08/2026');
check('Curl exclut bien la plus ancienne (01/08)', !prog.Curl.some(p => p.date === '01/08/2026'), 'absente', 'PRÉSENTE');

// =============================================================================
// buildVolumeSemaineParMuscle — séries/muscle de la SEMAINE (source UNIQUE
// athlète + coach). Anomalie #1 : les 2 payloads renvoient désormais la même
// forme [{muscle, faites}].
// =============================================================================
const perfsVol = [
  { date: '2026-08-20', seance_id: 'A', exercice: 'Squat',    muscle: 'Jambes',    charge: 100, reps: 5 }, // semaine en cours
  { date: '2026-08-20', seance_id: 'A', exercice: 'Presse',   muscle: 'Jambes',    charge: 200, reps: 8 }, // 2e série Jambes
  { date: '2026-08-20', seance_id: 'A', exercice: 'Bench',    muscle: 'Pectoraux', charge: 80,  reps: 5 },
  { date: '2026-08-20', seance_id: 'A', exercice: 'Inconnu',  muscle: '',          charge: 40,  reps: 5 }, // pas de muscle → ignoré
  { date: '2026-07-01', seance_id: 'B', exercice: 'Rowing',   muscle: 'Dos',       charge: 60,  reps: 8 }, // vieux → exclu
];
const vs = buildVolumeSemaineParMuscle(perfsVol, NOW);
check('volume_semaine = tableau (forme unique athlète/coach)', Array.isArray(vs), 'array', typeof vs);
eq('2 muscles cette semaine (Jambes, Pectoraux)', vs.length, 2);
eq('Jambes = 2 séries', (vs.find(m => m.muscle === 'Jambes') || {}).faites, 2);
eq('Pectoraux = 1 série', (vs.find(m => m.muscle === 'Pectoraux') || {}).faites, 1);
check('muscle vide ignoré (pas d\'entrée sans nom)', !vs.some(m => !m.muscle), 'ignoré', 'PRÉSENT');
check('séance ancienne (01/07) exclue (Dos absent)', !vs.some(m => m.muscle === 'Dos'), 'absent', 'PRÉSENT');
eq('aucune séance cette semaine → []', buildVolumeSemaineParMuscle([{ date: '2026-01-01', muscle: 'Dos', charge: 1, reps: 1 }], NOW).length, 0);

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Agrégats backend — ${ok} vérifs de VALEUR (computeGlobal · computeRecent · computeComparison · computeStreak · buildProgressionParExo).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
