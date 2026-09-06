/* =============================================================================
 * PHASE FIABILITÉ FOOT — Tests de VALEUR des agrégats foot (index.ts).
 *
 * Standard de traçabilité : données brutes connues → fonction pure → valeur
 * exacte. On teste le VRAI code extrait de supabase/functions/handler/index.ts
 * (types retirés via module.stripTypeScriptTypes, Node ≥ 22).
 *
 * Fonctions couvertes (extraites à ISO-COMPORTEMENT de handleGetSuiviJoueur) :
 *   chargeFenetresFoot · monotonieStrainFoot · aggMatchsFoot · aggGpsFenetreFoot.
 * + test de cohérence fiche (getSuiviJoueur) ↔ accueil (getSuiviEquipe) sur la charge.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}

const FN = ['fmtYMD', 'minus', 'parseFR', 'fmtFR', 'normDate', 'isoWeek', 'getLundi',
  'chargeFenetresFoot', 'monotonieStrainFoot', 'aggMatchsFoot', 'aggGpsFenetreFoot', 'seancesFoot'];
const jsCode = stripTypeScriptTypes(FN.map(extractFn).join('\n\n'));
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(jsCode + '\n' + FN.map(n => `this.${n}=${n};`).join(''), sandbox);
const { normDate, fmtYMD, minus, chargeFenetresFoot, monotonieStrainFoot, aggMatchsFoot, aggGpsFenetreFoot, seancesFoot } = sandbox;

let ok = 0, ko = 0;
const check = (n, cond, att, obt) => { if (cond) ok++; else { ko++; console.log('  ❌ ' + n + ' — attendu ' + att + ', obtenu ' + obt); } };
const eq = (n, got, exp) => check(n, got === exp, JSON.stringify(exp), JSON.stringify(got));

const NOW = new Date('2026-08-20T12:00:00Z');   // j7 = 2026-08-13 · j28 = 2026-07-23

// ── chargeFenetresFoot — fenêtres 7 j / 28 j (condition réelle : dIso ≥ now-7/28) ──
// J-7 (2026-08-13) = j7 exactement → INCLUS dans les 7 j (condition >=).
const rowsCharge = [
  { cle: 'charge_interne', date: '2026-08-19', valeur: '100' }, // J-1 : 7j + 28j
  { cle: 'charge_interne', date: '2026-08-17', valeur: '200' }, // J-3 : 7j + 28j
  { cle: 'charge_interne', date: '2026-08-13', valeur: '300' }, // J-7 = j7 : INCLUS 7j
  { cle: 'charge_interne', date: '2026-08-12', valeur: '400' }, // J-8 : hors 7j, dans 28j
  { cle: 'charge_interne', date: '2026-08-05', valeur: '500' }, // J-15 : hors 7j, dans 28j
  { cle: 'sommeil', date: '2026-08-19', valeur: '999' },        // non-charge → ignoré
];
const chF = chargeFenetresFoot(rowsCharge, NOW);
eq('charge7 = 600 (J-1+J-3+J-7, J-7 inclus)', chF.charge7, 600);
eq('charge28 = 1500 (toutes les charges ≥ now-28)', chF.charge28, 1500);
eq('J-8 exclu des 7 j (charge7 ne contient pas 400)', chF.charge7, 600);
eq('chargeParJour = 3 jours (7 j)', Object.keys(chF.chargeParJour).length, 3);
eq('chargeParJour28 = 5 jours (28 j, val>0)', Object.keys(chF.chargeParJour28).length, 5);
eq('premiereCharge = 2026-08-05 (plus ancienne)', chF.premiereCharge, '2026-08-05');
eq('derniere = 2026-08-19 (charge la plus récente, pour l\'accueil)', chF.derniere, '2026-08-19');
check('ligne non-charge (sommeil) ignorée', !Object.keys(chF.chargeParJour).includes('2026-08-19') || chF.charge7 === 600, '600', chF.charge7);
// aucune donnée
const chVide = chargeFenetresFoot([], NOW);
eq('charge vide → charge7 0', chVide.charge7, 0);
eq('charge vide → charge28 0', chVide.charge28, 0);
eq('charge vide → premiereCharge null', chVide.premiereCharge, null);
eq('charge vide → derniere null', chVide.derniere, null);
// une seule journée
const ch1 = chargeFenetresFoot([{ cle: 'charge_interne', date: '2026-08-20', valeur: '150' }], NOW);
eq('1 jour → charge7 150', ch1.charge7, 150);
eq('1 jour → charge28 150', ch1.charge28, 150);
eq('1 jour → premiere = derniere = 2026-08-20', ch1.premiereCharge + '|' + ch1.derniere, '2026-08-20|2026-08-20');

// ── monotonieStrainFoot — Foster 7 j glissants ───────────────────────────────
// charges 500 les jours J, J-3, J-6 (dans la fenêtre [now-6..now]) → loads [500,0,0,500,0,0,500]
const cpj = { '2026-08-20': 500, '2026-08-17': 500, '2026-08-14': 500 };
const ms1 = monotonieStrainFoot(cpj, 1500, NOW);
eq('monotonie = 0.87 (loads [500,0,0,500,0,0,500])', ms1.monotonie, 0.87);
eq('strain = 1305 (charge7 1500 × 0.87)', ms1.strain, 1305);
// charges identiques chaque jour → écart-type nul → monotonie null (comportement actuel)
const cpjEgal = {}; for (let d = 0; d < 7; d++) cpjEgal[fmtYMD(minus(NOW, d))] = 100;
const ms2 = monotonieStrainFoot(cpjEgal, 700, NOW);
eq('sdD = 0 (charges égales) → monotonie null', ms2.monotonie, null);
eq('sdD = 0 → strain null', ms2.strain, null);
// aucune donnée → null
const ms3 = monotonieStrainFoot({}, 0, NOW);
eq('aucune charge → monotonie null', ms3.monotonie, null);
eq('aucune charge → strain null', ms3.strain, null);

// ── aggMatchsFoot — matchs indépendants, cumuls & moyennes ───────────────────
const mk = (dateIso, date, c) => ({ date: date, dateIso: dateIso, cles: c });
const seancesMatch = {
  A: mk('2026-08-20', '20/08/2026', { type_seance: 'match', minutes_jouees: '90', buts: '1', passes_decisives: '2', note: '7', xg: '0.8', xa: '0.4' }),
  B: mk('2026-08-13', '13/08/2026', { type_seance: 'match', minutes_jouees: '75', buts: '0', passes_decisives: '1', note: '8', xg: '0.5', xa: '0.7' }),
  C: mk('2026-08-06', '06/08/2026', { type_seance: 'match', minutes_jouees: '60', buts: '2', passes_decisives: '0', note: '6', xg: '1.2', xa: '0.2' }),
  T: mk('2026-08-18', '18/08/2026', { type_seance: 'entrainement', charge_interne: '400' }), // NON match
};
const am = aggMatchsFoot(seancesMatch);
eq('matchs = 3 (entraînement exclu)', am.match_stats.nb, 3);
eq('minutes = 225 (90+75+60)', am.match_stats.minutes, 225);
eq('buts = 3 (1+0+2)', am.match_stats.buts, 3);
eq('passes = 3 (2+1+0)', am.match_stats.passes_d, 3);
eq('note moyenne = 7 ((7+8+6)/3)', am.match_stats.note_moy, 7);
eq('xG cumulé = 2.5 (0.8+0.5+1.2)', am.match_agg.xg.total, 2.5);
eq('xA cumulé = 1.3 (0.4+0.7+0.2)', am.match_agg.xa.total, 1.3);
eq('matchs[0] = plus récent (20/08/2026)', am.matchs[0].date, '20/08/2026');
eq('matchs = liste de 3', am.matchs.length, 3);
// indépendance : changer un match ne fusionne pas les autres
const seances2 = Object.assign({}, seancesMatch, { A: mk('2026-08-20', '20/08/2026', { type_seance: 'match', minutes_jouees: '10', buts: '5' }) });
eq('indépendance : minutes = 145 (10+75+60), pas de fusion', aggMatchsFoot(seances2).match_stats.minutes, 145);
eq('indépendance : buts = 7 (5+0+2)', aggMatchsFoot(seances2).match_stats.buts, 7);
// aucun match
eq('aucun match → nb 0', aggMatchsFoot({ T: seancesMatch.T }).match_stats.nb, 0);
eq('aucun match → note_moy null', aggMatchsFoot({ T: seancesMatch.T }).match_stats.note_moy, null);

// ── aggGpsFenetreFoot — somme 7 j (vmax = max), absence → 0 ───────────────────
const gseances = {
  A: mk('2026-08-20', '20/08/2026', { distance_hi: '6500', sprints: '20', accelerations: '30', decelerations: '25', vitesse_max: '31' }),
  B: mk('2026-08-17', '17/08/2026', { distance_hi: '5400', sprints: '15', accelerations: '20', decelerations: '18', vitesse_max: '32' }),
  C: mk('2026-08-14', '14/08/2026', { distance_hi: '7200', sprints: '25', accelerations: '35', decelerations: '30', vitesse_max: '30' }),
  OLD: mk('2026-08-01', '01/08/2026', { distance_hi: '9999', sprints: '99' }), // hors 7 j → exclu
};
const g = aggGpsFenetreFoot(gseances, NOW, 7);
eq('gps distance_hi = 19100 (6500+5400+7200)', g.distance_hi, 19100);
eq('gps sprints = 60 (20+15+25)', g.sprints, 60);
eq('gps accel = 85 (30+20+35)', g.accel, 85);
eq('gps decel = 73 (25+18+30)', g.decel, 73);
eq('gps vmax = 32 (max, pas somme)', g.vmax, 32);
eq('gps n = 3 (séance hors fenêtre exclue)', g.n, 3);
// GPS absent / partiel → 0 pour le champ manquant (comportement actuel Number(x||0))
const gPart = aggGpsFenetreFoot({ X: mk('2026-08-19', '19/08/2026', { sprints: '10' }) }, NOW, 7);
eq('GPS partiel : distance_hi absente → 0', gPart.distance_hi, 0);
eq('GPS partiel : sprints présents = 10', gPart.sprints, 10);
eq('GPS partiel : vmax absente → 0', gPart.vmax, 0);
eq('aucune séance → n 0', aggGpsFenetreFoot({}, NOW, 7).n, 0);

// ── seancesFoot — VRAI total vs LISTE plafonnée à 10 (Étape 4) ───────────────
function makeSeances(n) {
  const o = {};
  for (let i = 0; i < n; i++) { const dd = String(i + 1).padStart(2, '0'); o['s' + i] = { dateIso: '2026-08-' + dd, date: dd + '/08/2026', cles: { type_seance: 'entrainement' } }; }
  return o; // s0 = plus ancienne (01/08), s(n-1) = plus récente
}
const S0 = seancesFoot({}, new Set());
eq('0 séance → total 0', S0.total, 0);
eq('0 séance → liste vide', S0.liste.length, 0);
const S1 = seancesFoot(makeSeances(1), new Set());
eq('1 séance → total 1', S1.total, 1);
eq('1 séance → liste 1', S1.liste.length, 1);
const S10 = seancesFoot(makeSeances(10), new Set());
eq('10 séances → total 10', S10.total, 10);
eq('10 séances → liste 10', S10.liste.length, 10);
const S11 = seancesFoot(makeSeances(11), new Set());
eq('11 séances → total 11 (PAS 10)', S11.total, 11);
eq('11 séances → liste plafonnée à 10', S11.liste.length, 10);
const S15 = seancesFoot(makeSeances(15), new Set());
eq('15 séances → total 15 (indépendant du slice)', S15.total, 15);
eq('15 séances → liste 10', S15.liste.length, 10);
eq('15 séances → liste[0] = plus récente (15/08/2026)', S15.liste[0].date, '15/08/2026');
check('15 séances → les 10 affichées sont les plus récentes (01→05 exclues)',
  !S15.liste.some(s => ['01/08/2026', '02/08/2026', '03/08/2026', '04/08/2026', '05/08/2026'].includes(s.date)), 'exclues', 'PRÉSENTES');
// pas de fusion : 15 seance_id distincts → total = 15
eq('pas de fusion par seance_id → total = nb d\'événements', seancesFoot(makeSeances(15), new Set()).total, 15);
// renfo exclu du total ET de la liste
const S5renfo = seancesFoot(makeSeances(5), new Set(['s0', 's1']));
eq('renfo exclu → total 3 (5 − 2 renfo)', S5renfo.total, 3);
eq('renfo exclu → liste 3', S5renfo.liste.length, 3);

// ── Cohérence fiche ↔ accueil (getSuiviEquipe) sur la charge ─────────────────
// getSuiviEquipe pré-filtre cle='charge_interne' (query) puis accumule charge7/28 +
// chargeParJour28 (val>0) avec les MÊMES fenêtres. On reproduit ce calcul et on
// prouve qu'il donne le même résultat que chargeFenetresFoot (source de l'ACWR).
function accueilCharge(rows, now) {
  const j7 = fmtYMD(minus(now, 7)), j28 = fmtYMD(minus(now, 28));
  let charge7 = 0, charge28 = 0; const chargeParJour28 = {};
  for (const row of rows) {
    const dIso = normDate(row.date); if (!dIso) continue;
    const val = Number(row.valeur) || 0;
    if (dIso >= j28) { charge28 += val; if (val > 0) chargeParJour28[dIso] = (chargeParJour28[dIso] || 0) + val; }
    if (dIso >= j7) { charge7 += val; }
  }
  return { charge7, charge28, chargeParJour28 };
}
// getSuiviEquipe reçoit les lignes déjà filtrées cle='charge_interne' (query) →
// on reproduit ce pré-filtre. chargeFenetresFoot, lui, filtre en interne.
const acc = accueilCharge(rowsCharge.filter(r => r.cle === 'charge_interne'), NOW);
eq('cohérence charge7 fiche === accueil', chF.charge7, acc.charge7);
eq('cohérence charge28 fiche === accueil', chF.charge28, acc.charge28);
eq('cohérence chargeParJour28 (entrée ACWR) identique', JSON.stringify(chF.chargeParJour28), JSON.stringify(acc.chargeParJour28));

// Multi-athlètes : l'accueil groupe par athlète puis appelle le MÊME helper.
// On prouve l'isolation (la charge de B ne fuit pas chez A).
const rowsMulti = [
  { athlete_id: 'A', cle: 'charge_interne', date: '2026-08-19', valeur: '100' },
  { athlete_id: 'A', cle: 'charge_interne', date: '2026-08-17', valeur: '200' },
  { athlete_id: 'B', cle: 'charge_interne', date: '2026-08-19', valeur: '999' },
];
const byAth = {};
for (const r of rowsMulti) (byAth[r.athlete_id] ||= []).push(r);
const cA = chargeFenetresFoot(byAth['A'], NOW), cB = chargeFenetresFoot(byAth['B'], NOW);
eq('multi-athlètes : A charge7 = 300 (pas de fuite de B)', cA.charge7, 300);
eq('multi-athlètes : B charge7 = 999 (isolé)', cB.charge7, 999);
eq('multi-athlètes : A et B ont des séries ACWR distinctes',
  JSON.stringify(cA.chargeParJour28) === JSON.stringify(cB.chargeParJour28), false);

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Agrégats foot — ${ok} vérifs de VALEUR (charge · monotonie/strain · matchs · GPS · séances total/liste · cohérence).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
