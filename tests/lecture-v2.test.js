/* =============================================================================
 * LECTURE NOVALYZ v2 (décisions 29/10) — classement partagé des exercices,
 * cibles « Ta séance du jour », volume au prorata, repos dans progression_par_exo.
 *
 * Cas tirés des VRAIES données de Vincent (séances jusqu'au 27/10/2026) :
 *  - Développé incliné Smith 60×8 → 70×5 → 80×3 → 80×2 (RPE 10, dégressif) → « sous »
 *  - Leg curl 35×8 sur 4 séances → « bloqué »
 *  - Pendulum 40 → 60 kg × 8 le 27/10 → « record »
 *  - Belt squat 120×10 → 200×5 → « progresse » (décision : charge ↑ reps ↓ = progrès)
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

let ok = 0, ko = 0, fails = [];
function check(label, cond) { if (cond) ok++; else { ko++; fails.push(label); console.log('  ❌ ' + label); } }
function extractFrom(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}

// ---------- Backend : repos dans progression_par_exo ----------
const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
const BFN = ['parseFR', 'fmtFR', 'buildProgressionParExo'];
const B = {}; vm.createContext(B);
vm.runInContext(stripTypeScriptTypes(BFN.map(n => extractFrom(TS, n)).join('\n\n')) + '\n' + BFN.map(n => `this.${n}=${n};`).join(''), B);
const pp = B.buildProgressionParExo([
  { date: '2026-10-27', exercice: 'Leg curl allongé', charge: 35, reps: 8, rpe: 8, serie: 1, repos: 120, seance_id: 'dos jambes' },
  { date: '2026-10-27', exercice: 'Leg curl allongé', charge: 35, reps: 8, rpe: 9, serie: 2, repos: '', seance_id: 'dos jambes' },
]);
const s0 = pp['Leg curl allongé'][0].series;
check('backend : repos réel transmis par série', s0[0].repos === 120);
check('backend : repos absent → null (pas inventé)', s0[1].repos === null);

// ---------- Front : classement partagé ----------
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const S = {
  exercicesData: [
    { exercice: 'Développé incliné à la Smith', muscle: 'Pectoraux', increment_kg: '2.5 / 5 kg' },
    { exercice: 'Leg curl allongé', muscle: 'Ischio', increment_kg: '2.5 / 5 kg' },
    { exercice: 'Pendulum', muscle: 'Quadriceps', increment_kg: '2.5 / 5 kg' },
    { exercice: 'Belt squat', muscle: 'Quadriceps', increment_kg: '5 kg' },
    { exercice: 'Curl', muscle: 'Biceps', increment_kg: '1 kg' },
  ],
  _maSemaineType: function () { return 'calendaire'; },
};
vm.createContext(S);
const FFN = ['parseChatDate', '_exoCat', '_exoFourchette', '_petitPas', '_cdAvgRpe', '_lectureExos', '_normTxt', '_musKey', '_seancesFaites', '_lxVolume'];
vm.runInContext((SRC.match(/var _EXO_CAT_R = \{[^}]*\};/) || [''])[0] + '\n' + FFN.map(n => extractFrom(SRC, n)).join('\n') + '\n' + FFN.map(n => `this.${n}=${n};`).join(''), S);

const ser = (arr, rpe) => arr.map((x, i) => ({ serie: i + 1, charge: x[0], reps: x[1], rpe: Array.isArray(rpe) ? rpe[i] : rpe }));
const pt = (date, arr, rpe) => { const s = ser(arr, rpe); const best = s.slice().sort((a, b) => b.charge - a.charge || b.reps - a.reps)[0]; return { date, charge: best.charge, reps: best.reps, series: s }; };
const DATA = {
  programme: [
    { seance_id: 'pec', exercice: 'Développé incliné à la Smith', reps_mini: 8, reps_max: 12, series_prevues: 3 },
    { seance_id: 'jambes', exercice: 'Leg curl allongé', reps_mini: 8, reps_max: 12, series_prevues: 4 },
    { seance_id: 'jambes', exercice: 'Pendulum', reps_mini: 8, reps_max: 12, series_prevues: 4 },
  ],
  exo_categories: {},
  historique: { progression_par_exo: {
    'Développé incliné à la Smith': [pt('22/10/2026', [[80, 2], [70, 5], [60, 8]], [10, 10, 9]), pt('15/10/2026', [[80, 3], [70, 6], [60, 8]], [10, 9, 9]), pt('05/10/2026', [[70, 5]], 9), pt('14/09/2026', [[60, 8]], 8)],
    'Leg curl allongé': [pt('27/10/2026', [[35, 8], [35, 8]], 8), pt('16/10/2026', [[35, 8]], 9), pt('13/10/2026', [[35, 8]], 9), pt('06/10/2026', [[35, 8]], 8)],
    'Pendulum': [pt('27/10/2026', [[60, 8]], 9), pt('13/10/2026', [[40, 10]], 8), pt('06/10/2026', [[40, 8]], 9)],
    'Belt squat': [pt('16/10/2026', [[200, 5]], 8), pt('30/06/2026', [[120, 10]], 8)],
    'Vieil exo': [pt('01/08/2026', [[50, 8]], 8), pt('20/07/2026', [[45, 8]], 8)],
  } },
};
const NOW = new Date(2026, 9, 29, 12).getTime();
let L = S._lectureExos(DATA, NOW);
const names = k => L[k].map(x => x.exo);
check('Smith (80×2, 70×5 à RPE 10) → sous la fourchette', names('sous').includes('Développé incliné à la Smith'));
check('Smith : historique chiffré du plus ancien au plus récent', JSON.stringify(L.sous[0].hist.map(h => h.c + 'x' + h.r)) === JSON.stringify(['60x8', '70x5', '80x3', '80x2']));
check('Smith : petit pas du catalogue (2,5 kg)', L.sous[0].pas === 2.5);
check('Leg curl 35×8 × 4 séances → bloqué (n = 4)', names('bloque').includes('Leg curl allongé') && L.bloque[0].n === 4);
check('Pendulum 60 kg le 27/10 → record', names('records').includes('Pendulum'));
check('Belt squat 120×10 → 200×5 → progresse (charge ↑ reps ↓ = progrès)', names('progresse').includes('Belt squat'));
check('exo non fait depuis > 21 j → ignoré', !Object.keys(L).some(k => names(k).includes('Vieil exo')));
check('un exercice n\'apparaît que dans une catégorie', (() => { const all = [].concat(...Object.keys(L).map(names)); return all.length === new Set(all).size; })());

// Catégorie « gros » (6-8) : 60×8 et 70×5 → toujours « sous » (2 séries sur 3 < 6) ; T-bar 60×6 en gros → dans la fourchette.
DATA.exo_categories = { 'Développé incliné à la Smith': 'gros' };
L = S._lectureExos(DATA, NOW);
check('Smith classé « gros » (6-8) : reste sous la fourchette (80×2, 70×5)', names('sous').includes('Développé incliné à la Smith') && L.sous[0].rmin === 6 && L.sous[0].rmax === 8);
DATA.historique.progression_par_exo['T-bar row'] = [pt('13/10/2026', [[60, 6], [60, 6], [60, 6]], 9), pt('02/10/2026', [[50, 8]], 8)];
DATA.programme.push({ seance_id: 'dos', exercice: 'T-bar row', reps_mini: 8, reps_max: 12, series_prevues: 3 });
L = S._lectureExos(DATA, NOW);
check('T-bar row 60×6 RPE 9, non classé (8-12) → sous', names('sous').includes('T-bar row'));
DATA.exo_categories['T-bar row'] = 'gros';
L = S._lectureExos(DATA, NOW);
check('T-bar row classé « gros » (6-8) → plus sous la fourchette', !names('sous').includes('T-bar row'));

// ---------- Volume au prorata ----------
const V = S._lxVolume({
  programme: [{ exercice: 'Pendulum' }, { exercice: 'Leg curl allongé' }, { exercice: 'Curl' }],
  dashboard: { regularite: { seances_semaine: 2, seances_prevues: 4 } },
  volume_obti: [
    { muscle: 'Quadriceps', series_semaine: 6, series_min: 8, series_opt: 14 },
    { muscle: 'Ischio', series_semaine: 2, series_min: 6, series_opt: 12 },
    { muscle: 'Biceps', series_semaine: 0, series_min: 8, series_opt: 14 },
    { muscle: 'Mollets', series_semaine: 0, series_min: 8, series_opt: 14 },
  ],
});
const vr = m => V.rows.find(r => r.muscle === m);
check('prorata 2/4 séances : Quadriceps 6 ≥ 4 attendues → pas en retard', vr('Quadriceps') && !vr('Quadriceps').retard && vr('Quadriceps').attendu === 4);
check('Ischio 2 < 3 attendues → en retard', vr('Ischio').retard === true);
check('Biceps 0 < 4 attendues → en retard', vr('Biceps').retard === true);
check('muscle absent du programme (Mollets) → non listé', !vr('Mollets'));

// ---------- Par exercice (audit 30/10) : une seule cible, même classement ----------
const PE = extractFrom(SRC, '_maProgExo');
check('Par exercice : cible = _tjCibles (même calcul que la saisie), plus _chargeAViser', /_tjCibles\(data/.test(PE) && !/_chargeAViser\(/.test(PE));
check('Par exercice : statut = _lectureExos (même classement que la lecture)', /_lectureExos\(data/.test(PE));
check('Par exercice : écart Charge + reps montre aussi les reps', /' rep' \+/.test(PE));
check('Bloqué : leviers indicatifs (repos +30 s, plus tôt dans la séance, persister RPE 8-9) partout', /repos un peu plus long \(\+30 s\)/.test(SRC) && /_LEVIERS_BLOCAGE\)/.test(extractFrom(SRC, '_lxRecos')) && /_blocageInfo\(data, sel\)/.test(PE) && /_blocageInfo\(dernierAppData, exoEnCours/.test(SRC));
console.log('-'.repeat(70));
console.log('lecture v2 : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
