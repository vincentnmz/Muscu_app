/* =============================================================================
 * PHASE 5A — Garde-fou « le cockpit ne décide pas ».
 * Charge les vraies fonctions renderCockpit* de js/app.js et vérifie :
 *   1. COCKPIT_ON défaut = false ;
 *   2. OFF → conteneur vide (aucun changement visible) ;
 *   3. ON + muscu + moteur → rend le bloc A à partir de moteur.* (lecture seule) ;
 *   4. ON + sport foot → conteneur vide (muscu uniquement) ;
 *   5. ON sans moteur → conteneur vide ;
 *   6. STATIQUE : le cockpit ne recalcule aucun verdict (aucun appel de calcul métier).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extractFn(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable: ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
function extractDecl(name) {
  const m = SRC.match(new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*'));
  if (!m) throw new Error('decl introuvable: ' + name);
  let i = m.index + m[0].length; const open = SRC[i], close = open === '[' ? ']' : '}';
  let d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === open) d++; else if (c === close) { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j) + ';';
}

const fnNames = ['_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', 'renderCockpitEtat', '_ckT', '_ckKpi', 'renderCockpitCharge', '_ckWbColor', 'renderCockpitBienEtre', '_ckKpiC', 'renderCockpitPerformance', 'renderCockpitHistorique', '_ckSpark', '_ckDir', '_ckWeeklyVolume', 'renderCockpitEvolution', 'renderCockpit'];
const code = extractDecl('_CK_CTX') + '\n' + extractDecl('WQ_DIMS') + '\n' + extractDecl('WQ_ANSWERS') + '\n' + fnNames.map(extractFn).join('\n');

let ok = 0, ko = 0;
const check = (n, c, att, obt) => { if (c) ok++; else { ko++; console.log('  ❌ ' + n + ' — attendu ' + att + ', obtenu ' + obt); } };

// 1) flag défaut
check('COCKPIT_ON défaut = false', /const\s+COCKPIT_ON\s*=\s*false/.test(SRC), 'false', '?');

function run(flag, data, prefix) {
  const store = {};
  const sandbox = {
    COCKPIT_ON: flag,
    escapeHtml: s => String(s == null ? '' : s),
    couleurStatut: l => ({ 'Prêt': '#22c55e', 'Vigilance': '#f5a623', 'À surveiller': '#e5484d' }[l] || '#22c55e'),
    tendance1RM: prog => ({ pct: (prog && Object.keys(prog).length) ? 5 : null }),
    document: { getElementById: id => store[id] || (store[id] = { innerHTML: '' }) },
    DATA: data, PREFIX: prefix,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + "\nrenderCockpit(DATA, PREFIX);", sandbox);
  return (store[prefix + '-cockpit'] || {}).innerHTML || '';
}

const dataMuscu = {
  sport: 'muscu',
  moteur: { disponibilite: { niveau: 'Vigilance' }, recup: 'Moyen', surcharge: 'Faible', risque_blessure: 'Modéré', confiance: 'haute', contexte_tag: null, reco: 'Vigilance — surveiller les sensations.', acwr_fiable: true, acwr_categorie: 'normal' },
  dashboard: { acwr: 1.12, tonnage: { j7: 12.4, evol_pct: 8, j7_prec: 11.5 }, regularite: { seances_j7: 4, seances_prevues: 4 }, streak: { semaines: 5 } },
  comparison: { j28_vs_j28prec: { tonnage: { j28: 46.2, evol_pct: 4 } } },
  recent: { j7: { seances: 4, rpe_moyen: 7.8 } },
  bien_etre: [
    { date: '01/09', sommeil: 2, energie: 3, fatigue: 4, douleur: 2, zone: 'Genou droit', ressenti: 3, note: 'Nuit courte, genou tire.' },
    { date: '29/08', sommeil: 3, energie: 3, fatigue: 3, douleur: 1, ressenti: 4, note: '' },
    { date: '27/08', sommeil: 4, energie: 4, fatigue: 2, douleur: 1, ressenti: 4, note: '' },
  ],
  historique: { progression_par_exo: { 'Squat': [{ charge: 100, reps: 5 }, { charge: 105, reps: 5 }] }, volume_semaine: [{ muscle: 'Quadriceps', faites: 12 }, { muscle: 'Pectoraux', faites: 8 }], volume_par_jour: { '2026-08-10': 5000, '2026-08-24': 6000 } },
  global: { records_30j: 2, total_seances: 37, tonnage_total_kg: 128400, dernieres_seances: [{ date: '30/08', tonnage: 8200, exercices: ['Squat', 'Développé'] }, { date: '28/08', tonnage: 7600, exercices: ['Tractions'] }] },
  poids: [{ date: '30/08', poids: 82 }, { date: '01/07', poids: 84 }],
};
const dataFoot = { sport: 'foot', moteur: { disponibilite: { niveau: 'Prêt' }, recup: 'Bon', surcharge: 'Faible', risque_blessure: 'Faible', confiance: 'haute', reco: 'RAS' } };
const dataNonInterp = {
  sport: 'muscu',
  moteur: { disponibilite: { niveau: 'Prêt' }, recup: 'Bon', surcharge: 'Faible', risque_blessure: 'Faible', confiance: 'moyenne', reco: 'RAS', acwr_fiable: false, acwr_note: 'ACWR non interprétable — historique de charge insuffisant', acwr_categorie: 'non_interpretable' },
  dashboard: { acwr: 1.6, tonnage: { j7: 5.0, evol_pct: null } },
  comparison: {}, recent: { j7: {} },
};

// 2) OFF → vide
check('OFF (dash) → vide', run(false, dataMuscu, 'dash') === '', '""', '[' + run(false, dataMuscu, 'dash').length + ' car]');
check('OFF (cd) → vide', run(false, dataMuscu, 'cd') === '', '""', 'non vide');

// 3) ON + muscu → bloc A depuis moteur.*
const html = run(true, dataMuscu, 'dash');
check('ON muscu → non vide', html.length > 0, '>0', html.length);
check('ON muscu → affiche disponibilité (Vigilance)', /Vigilance/.test(html), 'présent', 'absent');
check('ON muscu → affiche récup (Moyen)', /Moyen/.test(html), 'présent', 'absent');
check('ON muscu → affiche risque (Modéré)', /Modéré/.test(html), 'présent', 'absent');
check('ON muscu → affiche la reco (moteur.reco)', /surveiller les sensations/.test(html), 'présent', 'absent');
check('ON muscu → badge confiance', /Confiance haute/.test(html), 'présent', 'absent');
// Bloc B — Charge
check('B → carte charge', /Charge d.entraînement/.test(html), 'présent', 'absent');
check('B → ACWR ratio (1.12 depuis dashboard.acwr)', /1\.12/.test(html), 'présent', 'absent');
check('B → catégorie ACWR (Zone optimale)', /Zone optimale/.test(html), 'présent', 'absent');
check('B → tonnage 7j (12,4 t)', /12,4 t/.test(html), 'présent', 'absent');
check('B → tonnage 28j (46,2 t)', /46,2 t/.test(html), 'présent', 'absent');
check('B → RPE (7,8)', /7,8/.test(html), 'présent', 'absent');
// acwr_fiable=false → non interprétable, ratio JAMAIS présenté comme verdict
const htmlNI = run(true, dataNonInterp, 'dash');
check('B non-interp → "ACWR non interprétable"', /ACWR non interprétable/.test(htmlNI), 'présent', 'absent');
check('B non-interp → ratio 1.6 NON affiché comme verdict', !/1\.60/.test(htmlNI), 'absent', 'PRÉSENT');
check('B non-interp → note backend affichée', /historique de charge insuffisant/.test(htmlNI), 'présent', 'absent');
// Bloc C — Bien-être (bien_etre[0], valeurs conservées, libellés existants)
check('C → carte bien-être', /Bien-être · dernier questionnaire/.test(html), 'présent', 'absent');
check('C → 5 valeurs numériques /5 conservées', (html.match(/\/5</g) || []).length >= 5, '>=5', (html.match(/\/5</g) || []).length);
check('C → sommeil=2 libellé « Mauvais » (WQ_ANSWERS)', /Mauvais/.test(html), 'présent', 'absent');
check('C → fatigue=4 libellé « Importante »', /Importante/.test(html), 'présent', 'absent');
check('C → zone affichée (douleur≠1 + zone)', /Genou droit/.test(html), 'présent', 'absent');
check('C → note affichée', /Nuit courte/.test(html), 'présent', 'absent');
// Données absentes → gestion propre, rien inventé
const htmlNoBE = run(true, { sport: 'muscu', moteur: dataMuscu.moteur }, 'dash');
check('C sans bien_etre → « Aucun questionnaire récent »', /Aucun questionnaire récent/.test(htmlNoBE), 'présent', 'absent');
// Douleur = 1 → zone NON affichée même si présente (pas d'invention)
const htmlDoul1 = run(true, { sport: 'muscu', moteur: dataMuscu.moteur, dashboard: dataMuscu.dashboard, bien_etre: [{ sommeil: 4, douleur: 1, zone: 'Cheville' }] }, 'dash');
check('C douleur=1 → zone masquée', !/Cheville/.test(htmlDoul1), 'absent', 'PRÉSENT');

// Bloc E — Performance (progression/e1RM, records, volume — descriptif, données existantes)
check('E → carte Performance', /🏋️ Performance/.test(html), 'présent', 'absent');
check('E → progression e1RM affichée (+5 %, via tendance1RM)', /\+5 %/.test(html), 'présent', 'absent');
check('E → records 30 j affichés (2)', /⚡ 2/.test(html), 'présent', 'absent');
check('E → volume par muscle affiché (Quadriceps)', /Quadriceps/.test(html), 'présent', 'absent');
check('E → volume trié desc (Quadriceps avant Pectoraux)', html.indexOf('Quadriceps') < html.indexOf('Pectoraux'), 'ordre', 'inversé');
// Performance sans données → rendu propre, rien inventé
const htmlNoPerf = run(true, { sport: 'muscu', moteur: dataMuscu.moteur }, 'dash');
check('E sans progression → e1RM « — »', /Progression e1RM[\s\S]*?—/.test(htmlNoPerf), 'présent', 'absent');
check('E sans records → « — »', /Records \(30 j\)[\s\S]*?—/.test(htmlNoPerf), 'présent', 'absent');
check('E sans volume → « Pas de volume cette semaine »', /Pas de volume cette semaine/.test(htmlNoPerf), 'présent', 'absent');

// Bloc F — Historique (global.* + poids[] + streak — présentation pure, données existantes)
check('F → carte Historique', /📅 Historique/.test(html), 'présent', 'absent');
check('F → séances totales (37 via global.total_seances)', /37/.test(html), 'présent', 'absent');
check('F → tonnage cumulé (128,4 t via global.tonnage_total_kg)', /128,4 t/.test(html), 'présent', 'absent');
check('F → régularité streak (5 sem. via dashboard.streak)', /5 sem\./.test(html), 'présent', 'absent');
check('F → poids dernier (82 kg via poids[0])', /82 kg/.test(html), 'présent', 'absent');
check('F → variation poids NEUTRE (-2 kg, descriptif)', /-2 kg depuis/.test(html), 'présent', 'absent');
check('F → dernières séances (30/08)', /30\/08/.test(html), 'présent', 'absent');
// Historique sans données → rendu propre, rien inventé
const htmlNoHist = run(true, { sport: 'muscu', moteur: dataMuscu.moteur }, 'dash');
check('F sans global → séances « — »', /Séances totales[\s\S]*?—/.test(htmlNoHist), 'présent', 'absent');
check('F sans poids → « — »', /Poids[\s\S]*?—/.test(htmlNoHist), 'présent', 'absent');
check('F sans dernières séances → « Aucune séance enregistrée »', /Aucune séance enregistrée/.test(htmlNoHist), 'présent', 'absent');

// Bloc D — Évolution (tendances descriptives ; sources bien_etre[]/volume_par_jour/moteur.acwr_*)
check('D → carte Évolution', /📈 Évolution/.test(html), 'présent', 'absent');
check('D → renvoi vers onglet Progression (ne remplace pas)', /onglet Progression/.test(html), 'présent', 'absent');
check('D → sparkline SVG (polyline) rendue', /<polyline/.test(html), 'présent', 'absent');
check('D → ≥5 tendances bien-être + volume (≥6 polylines)', (html.match(/<polyline/g) || []).length >= 6, '>=6', (html.match(/<polyline/g) || []).length);
check('D → libellé tendance bien-être (Sommeil)', /Sommeil/.test(html), 'présent', 'absent');
check('D → volume hebdo (semaines glissantes)', /semaines glissantes/.test(html), 'présent', 'absent');
check('D → ACWR : dernière valeur backend (fiable=true)', /dernière valeur transmise par le moteur/.test(html), 'présent', 'absent');
check('D → ACWR ratio backend affiché (1.12)', /1\.12/.test(html), 'présent', 'absent');
// Respect strict de moteur.acwr_fiable : non fiable → « non interprétable », AUCUNE position/valeur suggérée
check('D non-interp → « ACWR non interprétable »', /ACWR non interprétable/.test(htmlNI), 'présent', 'absent');
check('D non-interp → PAS de « dernière valeur » (aucune interprétation)', !/dernière valeur transmise/.test(htmlNI), 'absent', 'PRÉSENT');
// Données absentes → état neutre, rien inventé
const htmlEvoNeutre = run(true, { sport: 'muscu', moteur: dataMuscu.moteur, dashboard: dataMuscu.dashboard }, 'dash');
check('D sans bien_etre → « Pas assez de questionnaires »', /Pas assez de questionnaires pour une tendance/.test(htmlEvoNeutre), 'présent', 'absent');
check('D sans volume_par_jour (vue coach) → état neutre', /Évolution du volume indisponible dans cette vue/.test(htmlEvoNeutre), 'présent', 'absent');
// _ckWeeklyVolume : agrégation présentation, pas de série < 2 semaines
check('D volume : <2 jours → pas de sparkline (vide)', run(true, { sport: 'muscu', moteur: dataMuscu.moteur, historique: { volume_par_jour: { '2026-08-10': 5000 } } }, 'dash').includes('indisponible dans cette vue'), 'neutre', 'inventé');

// 4) ON + foot → vide (muscu uniquement)
check('ON foot → vide (muscu only)', run(true, dataFoot, 'cd') === '', '""', 'non vide');
// 5) ON sans moteur → vide
check('ON sans moteur → vide', run(true, { sport: 'muscu' }, 'dash') === '', '""', 'non vide');

// 6) STATIQUE — le cockpit ne recalcule aucun verdict
const bodyCk = extractFn('renderCockpit') + extractFn('renderCockpitEtat') + extractFn('renderCockpitCharge') + extractFn('renderCockpitBienEtre') + extractFn('renderCockpitPerformance') + extractFn('renderCockpitHistorique') + extractFn('renderCockpitEvolution');
// Blocs F & D n'écrivent dans aucun conteneur de l'onglet Progression / Historique détaillé
const bodyHist = extractFn('renderCockpitHistorique');
const bodyEvo = extractFn('renderCockpitEvolution');
for (const cont of ['tab-historique', 'hist-progression-content', 'cd-progression-content', 'getElementById']) {
  check('F n\'écrit pas dans ' + cont, !bodyHist.includes(cont), 'absent', 'PRÉSENT');
  check('D n\'écrit pas dans ' + cont, !bodyEvo.includes(cont), 'absent', 'PRÉSENT');
}
// Bloc D ne réutilise/détourne aucune fonction graphique de Progression, ni canvas
for (const fn of ['afficherProgressionExo', 'renderProg12Semaines', 'dessinerProgChartExo', 'chart-1rm-athlete', 'afficherCoachProgressionExo', 'afficherCoachTendances', 'renderACWRChart', 'computeACWR', 'canvas']) {
  check('D ne détourne pas ' + fn, !bodyEvo.includes(fn), 'absent', 'PRÉSENT');
}
const interdits = ['computeACWR', 'calculerACWR', 'evaluerEtatAthlete', 'fiabiliteACWR', 'interpreterACWR', 'CORE_SEUILS', 'CORE_FIABILITE', 'NovalyzEngine'];
for (const mot of interdits) check('cockpit n\'appelle pas ' + mot, !bodyCk.includes(mot), 'absent', 'PRÉSENT');
// lit bien moteur.* (m.*)
check('cockpit lit moteur (m.disponibilite/recup/reco)', /m\.disponibilite/.test(bodyCk) && /m\.recup/.test(bodyCk) && /m\.reco/.test(bodyCk), 'oui', 'non');

console.log('-'.repeat(66));
console.log(ko === 0 ? `✅ Cockpit ne décide pas — ${ok} vérifs (OFF vide · ON présentation · muscu only).` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
