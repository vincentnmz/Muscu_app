/* =============================================================================
 * P0 #6 — Centre d'alertes (buildAlertesCentre) : exécute la VRAIE fonction de
 * production extraite d'index.ts. Pure (moteur + comparison). Vérifie le schéma
 * unifié, le classement par sévérité et la stagnation depuis comparison.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const JS = stripTypeScriptTypes(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8'));
function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extractFn('buildAlertesCentre') + '\nthis.buildAlertesCentre = buildAlertesCentre;', sandbox);
const buildAlertesCentre = sandbox.buildAlertesCentre;

let ok = 0, ko = 0, fails = [];
function check(l, c) { if (c) ok++; else { ko++; fails.push(l); console.log('  ❌ ' + l); } }

// A — alertes moteur mappées au schéma unifié + classées par sévérité
const moteur = {
  confiance: 'haute', contexte_tag: 'intensification',
  alertes: [
    { type: 'fatigue', severite: 'moyenne', message: 'Fatigue élevée (4/5)' },
    { type: 'surcharge', severite: 'haute', message: 'Charge aiguë élevée (ACWR 1.8)' },
  ],
};
const a = buildAlertesCentre(moteur, null);
check('A: 2 alertes', a.length === 2);
check('A: triées par sévérité (haute en 1er)', a[0].severity === 'haute' && a[0].type === 'surcharge');
check('A: schéma complet', a[0].type && a[0].severity && a[0].source && a[0].title && a[0].action !== undefined && a[0].reliability === 'haute' && a[0].context === 'intensification');
check('A: evidence = message moteur', a[1].evidence === 'Fatigue élevée (4/5)');
check('A: title lisible', a[0].title === 'Charge aiguë élevée');

// B — stagnation ajoutée depuis comparison (≥3 exos en baisse), avec NOMS des exos
const cmp = { j7_vs_j7prec: { charge_details: [
  { exercice: 'Squat', down: true }, { exercice: 'Développé couché', down: true },
  { exercice: 'Rowing', down: true }, { exercice: 'Curl', down: false },
] } };
const b = buildAlertesCentre({ alertes: [] }, cmp);
check('B: stagnation détectée', b.some(x => x.type === 'stagnation'));
check('B: action stagnation présente', (b.find(x => x.type === 'stagnation') || {}).action);
check('B: evidence nomme les exercices en baisse', /Squat/.test((b.find(x => x.type === 'stagnation') || {}).evidence || ''));

// C — pas de stagnation si <3 en baisse
const c = buildAlertesCentre({ alertes: [] }, { j7_vs_j7prec: { charge_details: [{ down: true }, { down: true }] } });
check('C: pas de stagnation (<3)', !c.some(x => x.type === 'stagnation'));

// D — moteur vide → liste vide
check('D: aucune alerte si rien', buildAlertesCentre(null, null).length === 0);

console.log('-'.repeat(78));
console.log('P0 #6 — buildAlertesCentre : ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ Centre d\'alertes conforme (schéma unifié + tri + stagnation).');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
