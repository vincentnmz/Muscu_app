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
function extractVarObj(name) {
  const m = SRC.match(new RegExp('var\\s+' + name + '\\s*=\\s*'));
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j + 1) + ';';
}

const fnNames = ['_ckColRecup', '_ckColNiv3', '_ckConf', '_ckMini', 'renderCockpitEtat', 'renderCockpit'];
const code = extractVarObj('_CK_CTX') + '\n' + fnNames.map(extractFn).join('\n');

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
    document: { getElementById: id => store[id] || (store[id] = { innerHTML: '' }) },
    DATA: data, PREFIX: prefix,
  };
  vm.createContext(sandbox);
  vm.runInContext(code + "\nrenderCockpit(DATA, PREFIX);", sandbox);
  return (store[prefix + '-cockpit'] || {}).innerHTML || '';
}

const dataMuscu = { sport: 'muscu', moteur: { disponibilite: { niveau: 'Vigilance' }, recup: 'Moyen', surcharge: 'Faible', risque_blessure: 'Modéré', confiance: 'haute', contexte_tag: null, reco: 'Vigilance — surveiller les sensations.' } };
const dataFoot = { sport: 'foot', moteur: { disponibilite: { niveau: 'Prêt' }, recup: 'Bon', surcharge: 'Faible', risque_blessure: 'Faible', confiance: 'haute', reco: 'RAS' } };

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

// 4) ON + foot → vide (muscu uniquement)
check('ON foot → vide (muscu only)', run(true, dataFoot, 'cd') === '', '""', 'non vide');
// 5) ON sans moteur → vide
check('ON sans moteur → vide', run(true, { sport: 'muscu' }, 'dash') === '', '""', 'non vide');

// 6) STATIQUE — le cockpit ne recalcule aucun verdict
const bodyCk = extractFn('renderCockpit') + extractFn('renderCockpitEtat');
const interdits = ['computeACWR', 'calculerACWR', 'evaluerEtatAthlete', 'fiabiliteACWR', 'interpreterACWR', 'CORE_SEUILS', 'CORE_FIABILITE', 'NovalyzEngine'];
for (const mot of interdits) check('cockpit n\'appelle pas ' + mot, !bodyCk.includes(mot), 'absent', 'PRÉSENT');
// lit bien moteur.* (m.*)
check('cockpit lit moteur (m.disponibilite/recup/reco)', /m\.disponibilite/.test(bodyCk) && /m\.recup/.test(bodyCk) && /m\.reco/.test(bodyCk), 'oui', 'non');

console.log('-'.repeat(66));
console.log(ko === 0 ? `✅ Cockpit ne décide pas — ${ok} vérifs (OFF vide · ON présentation · muscu only).` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
