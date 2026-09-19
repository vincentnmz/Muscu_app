/* =============================================================================
 * PHASE 5A — Garde-fou « l'onglet Progression est intégralement conservé ».
 *
 * Le cockpit (bloc E — Performance) est un RÉSUMÉ synthétique. Il ne doit
 * jamais remplacer, supprimer, masquer ni fusionner l'onglet Progression
 * détaillé. Ce test verrouille statiquement la présence de tous les éléments
 * structurants de cet onglet (côté athlète ET côté coach) : conteneurs HTML,
 * sélecteurs/filtres, fonctions de rendu, graphiques et tableaux.
 *
 * Si un jour une modif du cockpit supprime/renomme l'un de ces éléments,
 * ce test échoue — preuve que « le cockpit ne remplace pas Progression ».
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const JS = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

let ok = 0, ko = 0;
const check = (n, c) => { if (c) ok++; else { ko++; console.log('  ❌ ' + n); } };
const inHtml = (n, s) => check(n, HTML.includes(s));
const inJs = (n, s) => check(n, JS.includes(s));

// --- ATHLÈTE : onglet « Progression » (= conteneur tab-historique) -----------
inHtml('ATH · bouton onglet Progression (switchTab historique)', "switchTab('historique')");
inHtml('ATH · libellé « Progression » présent dans la nav', '<span>Progression</span>');
inHtml('ATH · conteneur onglet existe (tab-historique)', 'id="tab-historique"');
inHtml('ATH · section « Progression par exercice »', 'Progression par exercice');
inHtml('ATH · filtre exercice (sel-hist-exercice)', 'id="sel-hist-exercice"');
inHtml('ATH · onchange afficherProgressionExo()', 'afficherProgressionExo()');
inHtml('ATH · conteneur de rendu (hist-progression-content)', 'id="hist-progression-content"');

inJs('ATH · fonction de rendu afficherProgressionExo', 'function afficherProgressionExo(');
inJs('ATH · graphique 12 semaines renderProg12Semaines', 'function renderProg12Semaines(');
inJs('ATH · graphique charge/1RM dessinerProgChartExo', 'function dessinerProgChartExo(');
inJs('ATH · calcul 1RM détaillé (calc1RM) toujours utilisé', 'calc1RM(');
inJs('ATH · rendu écrit bien dans hist-progression-content', "getElementById('hist-progression-content')");
// Le tableau détaillé et le canvas restent présents dans le rendu
check('ATH · tableau détaillé (Date/Charge/Reps/1RM/Évol.) conservé',
  /1RM est\.[\s\S]{0,120}Évol\./.test(JS));
inJs('ATH · canvas graphique (chart-1rm-athlete) conservé', 'chart-1rm-athlete');

// --- COACH : sous-onglet « Progression » (= vue prog) ------------------------
inHtml('COACH · bouton sous-onglet prog (cdtab-btn-prog)', 'id="cdtab-btn-prog"');
inHtml('COACH · switchCoachDetailTab(prog)', "switchCoachDetailTab('prog')");
inHtml('COACH · section « Progression par exercice »', 'Progression par exercice');
inHtml('COACH · filtre exercice (cd-sel-exercice)', 'id="cd-sel-exercice"');
inHtml('COACH · onchange afficherCoachProgressionExo()', 'afficherCoachProgressionExo()');
inHtml('COACH · conteneur de rendu (cd-progression-content)', 'id="cd-progression-content"');

inJs('COACH · fonction de rendu afficherCoachProgressionExo', 'function afficherCoachProgressionExo(');
inJs('COACH · tendances 4/8 sem. (afficherCoachTendances) conservées', 'function afficherCoachTendances(');
inJs('COACH · rendu écrit bien dans cd-progression-content', "getElementById('cd-progression-content')");

// --- Le cockpit n'a PAS absorbé/renommé les fonctions Progression ------------
// (les fonctions de rendu Progression existent en dehors du cockpit)
check('Cockpit ne détourne pas afficherProgressionExo',
  (JS.match(/function afficherProgressionExo\(/g) || []).length === 1);
check('Cockpit ne détourne pas afficherCoachProgressionExo',
  (JS.match(/function afficherCoachProgressionExo\(/g) || []).length === 1);
// renderCockpitPerformance ne remplace PAS le rendu détaillé (il n'écrit jamais
// dans les conteneurs de l'onglet Progression)
const mCk = JS.match(/function renderCockpitPerformance\([\s\S]*?\n\}/);
const bodyCk = mCk ? mCk[0] : '';
check('renderCockpitPerformance n\'écrit pas dans hist-progression-content',
  !bodyCk.includes('hist-progression-content'));
check('renderCockpitPerformance n\'écrit pas dans cd-progression-content',
  !bodyCk.includes('cd-progression-content'));

console.log('-'.repeat(66));
console.log(ko === 0
  ? `✅ Onglet Progression intégralement conservé — ${ok} vérifs (athlète + coach, HTML + JS).`
  : `❌ ${ko} écart(s) sur ${ok + ko} — l'onglet Progression a été altéré.`);
if (ko > 0) process.exitCode = 1;
