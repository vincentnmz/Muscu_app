/* =============================================================================
 * PHASE FOOT — Garde-fou cockpit foot (blocs A + C), présentation seule.
 * Vérifie : OFF → conteneur vide ; ON + moteur → bloc A (État, moteur commun)
 * + bloc C (Bien-être foot depuis data.bienetre / wellness) ; sans moteur →
 * vide ; le cockpit foot ne recalcule aucun verdict.
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

const fnNames = ['_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', 'renderCockpitEtat', '_ckKpi', 'renderCockpitChargeFoot', '_ckWbColor', 'renderCockpitBienEtreFoot', '_ckSpark', '_ckDir', 'renderCockpitEvolutionFoot', 'renderCockpitFoot'];
const code = extractDecl('_CK_CTX') + '\n' + extractDecl('WQ_DIMS') + '\n' + extractDecl('WQ_ANSWERS') + '\n' + fnNames.map(extractFn).join('\n');

let ok = 0, ko = 0;
const check = (n, c) => { if (c) ok++; else { ko++; console.log('  ❌ ' + n); } };

function run(flag, data) {
  const store = {};
  const sandbox = {
    COCKPIT_ON: flag,
    escapeHtml: s => String(s == null ? '' : s),
    couleurStatut: l => ({ 'Prêt': '#22c55e', 'Vigilance': '#f5a623', 'À surveiller': '#e5484d' }[l] || '#22c55e'),
    document: { getElementById: id => store[id] || (store[id] = { innerHTML: '' }) },
    DATA: data,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + '\nrenderCockpitFoot(DATA);', sandbox);
  return (store['foot-cockpit'] || {}).innerHTML || '';
}

const dataFoot = {
  moteur: { disponibilite: { niveau: 'Vigilance' }, recup: 'Moyen', surcharge: 'Faible', risque_blessure: 'Modéré', confiance: 'haute', contexte_tag: null, reco: 'Vigilance — surveiller les sensations.', acwr_fiable: true, acwr_categorie: 'normal' },
  acwr: 1.12, charge_7j: 930, kpi_foot: { charge_mensuelle: 4200, monotonie: 1.4, strain: 205, temps_jeu: 0 },
  bienetre: { sommeil: 2, energie: 3, fatigue: 4, douleur: 2 },
  wellness: [{ sommeil: 4, energie: 4, fatigue: 2, douleur: 1 }, { sommeil: 3, energie: 3, fatigue: 3, douleur: 1 }, { sommeil: 2, energie: 3, fatigue: 4, douleur: 2 }],
  charge_hebdo: [{ semaine: '2026-W31', charge: 900, label: '01/08' }, { semaine: '2026-W32', charge: 1100, label: '08/08' }, { semaine: '2026-W33', charge: 930, label: '15/08' }],
};
const dataFootNI = {
  moteur: { disponibilite: { niveau: 'Prêt' }, recup: 'Bon', surcharge: 'Faible', risque_blessure: 'Faible', confiance: 'moyenne', reco: 'RAS', acwr_fiable: false, acwr_note: 'ACWR non interprétable — historique insuffisant', acwr_categorie: 'non_interpretable' },
  acwr: 1.6, charge_7j: 300, kpi_foot: {},
  bienetre: { sommeil: 4, energie: 4, fatigue: 2, douleur: 1 },
};

// OFF → vide
check('OFF → conteneur vide', run(false, dataFoot) === '');
// ON + moteur → bloc A + C
const html = run(true, dataFoot);
check('ON → non vide', html.length > 0);
check('A → disponibilité (Vigilance)', /Vigilance/.test(html));
check('A → récup (Moyen)', /Moyen/.test(html));
check('A → risque (Modéré)', /Modéré/.test(html));
check('A → reco (moteur.reco)', /surveiller les sensations/.test(html));
// Bloc B — Charge foot (UA)
check('B → carte Charge', /📊 Charge/.test(html));
check('B → unité UA (charge interne)', /UA \(charge interne\)/.test(html));
check('B → ACWR ratio 1.12 (data.acwr)', /1\.12/.test(html));
check('B → catégorie ACWR (Zone optimale)', /Zone optimale/.test(html));
check('B → Charge 7 j = 930 (charge_7j)', /Charge 7 j/.test(html) && /930/.test(html));
check('B → Charge 28 j (label présent)', /Charge 28 j/.test(html));
check('B → Variabilité 1,40 (kpi_foot.monotonie)', /Variabilité/.test(html) && /1,40/.test(html));
check('B → Charge cumulée 205 (kpi_foot.strain)', /Charge cumulée/.test(html) && /205/.test(html));
// ACWR non fiable → « non interprétable », ratio jamais présenté comme verdict
const htmlNI = run(true, dataFootNI);
check('B non-interp → « ACWR non interprétable »', /ACWR non interprétable/.test(htmlNI));
check('B non-interp → ratio 1.6 NON affiché comme verdict', !/1\.60/.test(htmlNI));
check('B non-interp → note backend affichée', /historique insuffisant/.test(htmlNI));
check('C → carte bien-être', /🫀 Bien-être/.test(html));
check('C → 4 signaux /5 (sommeil/energie/fatigue/douleur)', (html.match(/\/5</g) || []).length === 4);
check('C → sommeil=2 libellé « Mauvais » (WQ_ANSWERS)', /Mauvais/.test(html));
check('C → source data.bienetre (dernier)', /Bien-être · dernier questionnaire/.test(html));
// Bloc D — Évolution foot (sparklines : wellness + charge_hebdo + ACWR)
check('D → carte Évolution', /📈 Évolution/.test(html));
check('D → sparklines (polyline) rendues', /<polyline/.test(html));
check('D → ≥5 tendances (4 bien-être + charge)', (html.match(/<polyline/g) || []).length >= 5);
check('D → libellé tendance bien-être (Sommeil)', /Sommeil/.test(html));
check('D → charge hebdo (semaines · UA)', /semaines · UA/.test(html));
check('D → ACWR dernière valeur backend (fiable)', /dernière valeur transmise par le moteur/.test(html));
check('D non-interp → « ACWR non interprétable »', /ACWR non interprétable/.test(htmlNI));
check('D non-interp → PAS de « dernière valeur »', !/dernière valeur transmise/.test(htmlNI));
// Données absentes → état neutre, rien inventé
const htmlEvoNeutre = run(true, { moteur: dataFoot.moteur, acwr: dataFoot.acwr });
check('D sans wellness → « Pas assez de questionnaires »', /Pas assez de questionnaires pour une tendance/.test(htmlEvoNeutre));
check('D sans charge_hebdo → « Évolution de la charge indisponible »', /Évolution de la charge indisponible/.test(htmlEvoNeutre));
// Repli sur wellness si pas de bienetre
const htmlWell = run(true, { moteur: dataFoot.moteur, wellness: dataFoot.wellness });
check('C → repli wellness (dernier point) affiché', /\/5</.test(htmlWell) && /🫀 Bien-être · dernier/.test(htmlWell));
// Bien-être absent → message propre
const htmlNoBE = run(true, { moteur: dataFoot.moteur });
check('C sans bien-être → « Aucun questionnaire récent »', /Aucun questionnaire récent/.test(htmlNoBE));
// Sans moteur → vide
check('ON sans moteur → vide', run(true, { bienetre: dataFoot.bienetre }) === '');

// STATIQUE — le cockpit foot ne décide pas
const body = extractFn('renderCockpitFoot') + extractFn('renderCockpitBienEtreFoot') + extractFn('renderCockpitChargeFoot') + extractFn('renderCockpitEvolutionFoot');
for (const mot of ['computeACWR', 'calculerACWR', 'evaluerEtatAthlete', 'fiabiliteACWR', 'interpreterACWR', 'CORE_SEUILS', 'CORE_FIABILITE', 'NovalyzEngine']) {
  check('foot cockpit n\'appelle pas ' + mot, !body.includes(mot));
}
// Bloc A réutilise bien renderCockpitEtat (moteur commun)
check('renderCockpitFoot réutilise renderCockpitEtat', /renderCockpitEtat\(m\)/.test(extractFn('renderCockpitFoot')));

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Cockpit foot (A + B + C + D) — ${ok} vérifs (OFF vide · ON État+Charge+Bien-être+Évolution · ne décide pas).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
