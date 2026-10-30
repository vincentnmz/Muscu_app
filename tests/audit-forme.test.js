/* Audit Forme (29-30/10/2026) — non-régression des correctifs :
 * #1 zone de douleur gardée en texte (plus de « NaN »), anciennes lignes « NaN » neutralisées
 * #2 une seule _objSeancesCible, qui lit les vraies données (4 et non 3)
 * #3 dates de douleur ISO lues correctement
 * Croisé : la marche est hors charge d'entraînement ; charge muscu en RPE × durée estimée. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
let ok = 0, ko = 0, fails = [];
function check(l, c) { if (c) ok++; else { ko++; fails.push(l); console.log('  ❌ ' + l); } }
function extract(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
check('une seule définition de _objSeancesCible', (SRC.match(/function\s+_objSeancesCible\s*\(/g) || []).length === 1);
const chips = [];
const S = {
  wellnessState: { zone: null, douleur: null },
  WELLNESS_NO_PAIN_VAL: '1',
  document: { getElementById: () => ({ querySelectorAll: () => chips, style: {} }), querySelectorAll: () => [] },
  dernierAppData: { dashboard: { regularite: { seances_prevues: 4, seances_semaine: 3 } } },
};
vm.createContext(S);
const FN = ['selectWQ', '_maFRtoDate', '_blDate', '_zoneDouleur', '_objSeancesCible', '_estMarche', '_chargeInterneCardio', '_muscuUAJours'];
vm.runInContext(FN.map(extract).join('\n') + '\n' + FN.map(n => `this.${n}=${n};`).join(''), S);
const btn = (v) => ({ dataset: { val: v }, classList: { add() {} } });
S.selectWQ('zone', btn('epaule'));
check('#1 zone choisie au bouton gardée en texte', S.wellnessState.zone === 'epaule');
S.selectWQ('douleur', btn('3'));
check('#1 les autres réponses restent numériques', S.wellnessState.douleur === 3);
check('#1 ancienne zone « NaN » → vide (affichée « Zone non précisée »)', S._zoneDouleur('NaN') === '' && S._zoneDouleur('Epaule gauche') === 'Epaule gauche');
check('#3 date ISO lue', S._blDate('2026-10-29') && S._blDate('2026-10-29').getDate() === 29);
check('#3 date FR toujours lue', S._blDate('26/10/2026').getMonth() === 9);
check('#2 objectif = 4 (données réelles, sans paramètre)', S._objSeancesCible() === 4);
check('#2 sans objectif réglé : nombre de séances du programme', S._objSeancesCible({ dashboard: { regularite: {} }, programme: [{ seance_id: 'a' }, { seance_id: 'b' }, { seance_id: 'a' }] }) === 2);
check('Croisé : la marche ne compte pas dans la charge', S._chargeInterneCardio({ type_cardio: 'marche_normale', duree: 60, rpe: 6 }) === 0);
check('Croisé : un vélo compte (RPE × durée)', S._chargeInterneCardio({ type_cardio: 'velo', duree: 60, rpe: 6 }) === 360);
const ua = S._muscuUAJours({
  historique: { daily_muscu: { '2026-10-29': { series: 3, rpe_sum: 27, rpe_n: 3 } },
    progression_par_exo: { 'Smith': [{ date: '29/10/2026', series: [{ repos: 180 }, { repos: 180 }, { repos: null }] }] } },
  programme: [{ exercice: 'Smith', repos_sec: 120 }], analyses: {},
});
// durée = (180+40)+(180+40)+(120+40) = 600 s = 10 min ; RPE 9 → 90
check('Croisé : charge muscu = RPE moyen × durée estimée (repos réels, sinon programme, + 40 s/série)', ua['2026-10-29'] === 90);
console.log('-'.repeat(70));
console.log('audit forme : ' + ok + ' OK / ' + ko + ' KO');
if (ko) { console.log('Échecs : ' + fails.join(' | ')); process.exit(1); }
