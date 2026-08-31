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

const fnNames = ['_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', 'renderCockpitEtat', '_ckWbColor', 'renderCockpitBienEtreFoot', 'renderCockpitFoot'];
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
  bienetre: { sommeil: 2, energie: 3, fatigue: 4, douleur: 2 },
  wellness: [{ sommeil: 3, energie: 3, fatigue: 3, douleur: 1 }, { sommeil: 2, energie: 3, fatigue: 4, douleur: 2 }],
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
check('C → carte bien-être', /🫀 Bien-être/.test(html));
check('C → 4 signaux /5 (sommeil/energie/fatigue/douleur)', (html.match(/\/5</g) || []).length === 4);
check('C → sommeil=2 libellé « Mauvais » (WQ_ANSWERS)', /Mauvais/.test(html));
check('C → source data.bienetre (dernier)', /Bien-être · dernier questionnaire/.test(html));
// Repli sur wellness si pas de bienetre
const htmlWell = run(true, { moteur: dataFoot.moteur, wellness: dataFoot.wellness });
check('C → repli wellness (dernier point) affiché', /\/5</.test(htmlWell) && /🫀 Bien-être · dernier/.test(htmlWell));
// Bien-être absent → message propre
const htmlNoBE = run(true, { moteur: dataFoot.moteur });
check('C sans bien-être → « Aucun questionnaire récent »', /Aucun questionnaire récent/.test(htmlNoBE));
// Sans moteur → vide
check('ON sans moteur → vide', run(true, { bienetre: dataFoot.bienetre }) === '');

// STATIQUE — le cockpit foot ne décide pas
const body = extractFn('renderCockpitFoot') + extractFn('renderCockpitBienEtreFoot');
for (const mot of ['computeACWR', 'calculerACWR', 'evaluerEtatAthlete', 'fiabiliteACWR', 'interpreterACWR', 'CORE_SEUILS', 'CORE_FIABILITE', 'NovalyzEngine']) {
  check('foot cockpit n\'appelle pas ' + mot, !body.includes(mot));
}
// Bloc A réutilise bien renderCockpitEtat (moteur commun)
check('renderCockpitFoot réutilise renderCockpitEtat', /renderCockpitEtat\(m\)/.test(extractFn('renderCockpitFoot')));

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Cockpit foot (A + C) — ${ok} vérifs (OFF vide · ON État+Bien-être · ne décide pas).`
  : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
