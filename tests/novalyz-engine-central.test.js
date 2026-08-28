/* =============================================================================
 * PHASE 3D — Banc de référence (SNAPSHOT) du bilan NovalyzEngine.
 * Charge le VRAI moteur front (js/app.js : NovalyzEngine + NovalyzContexte) et
 * capture, pour un jeu de scénarios, les règles de bilan déclenchées.
 * Objectif : figer le comportement ACTUEL (« Avant ») pour pouvoir comparer
 * toute migration future (« Après ») sans régression du bilan.
 * NB : ne teste PAS le verdict (backend evaluerEtatAthlete → moteur-etat.test.js).
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extractBetween(start, end, label) {
  const s = HTML.indexOf(start); if (s === -1) throw new Error('introuvable début: ' + label);
  const e = HTML.indexOf(end, s + start.length); if (e === -1) throw new Error('introuvable fin: ' + label);
  return HTML.slice(s, e + end.length);
}
const engineCode = extractBetween('(function (global) {', "})(typeof self !== 'undefined' ? self : this);", 'moteur Novalyz');
const contexteCode = extractBetween('/* NOVALYZ_CONTEXTE_START', '/* NOVALYZ_CONTEXTE_END */', 'NovalyzContexte');

const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; sandbox.module = { exports: {} }; sandbox.console = console;
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(contexteCode, sandbox);
const Engine = sandbox.NovalyzEngine;

// Constructeurs de `data` (forme getAppData) exerçant les signaux du moteur.
const be = (o) => ({ bien_etre: [o] });
const SCENARIOS = {
  'optimal':            { ...be({ sommeil: 5, energie: 5, fatigue: 1, douleur: 1, ressenti: 4 }), progression: { en_progression: 4, en_baisse: 0 }, regularite: { seances_j7: 4, seances_prevues: 4 } },
  'fatigue_generale':   be({ sommeil: 2, energie: 2, fatigue: 4, douleur: 1, ressenti: 2 }),
  'douleur_seule':      { ...be({ sommeil: 4, energie: 4, fatigue: 2, douleur: 4, ressenti: 3 }), dashboard: { tonnage: { evol_pct: 0 } } },
  'sommeil_faible':     be({ sommeil: 1, energie: 3, fatigue: 2, douleur: 1, ressenti: 3 }),
  'recuperation_opt':   be({ sommeil: 5, energie: 4, fatigue: 1, douleur: 1, ressenti: 4 }),
  'surcharge_locale':   { ...be({ sommeil: 4, energie: 4, fatigue: 2, douleur: 4, ressenti: 3 }), dashboard: { tonnage: { evol_pct: 20 } }, regularite: { seances_j7: 5 } },
  'sous_entrainement':  { ...be({ sommeil: 4, energie: 4, fatigue: 2, douleur: 1 }), progression: { en_progression: 0, en_baisse: 3 }, regularite: { seances_j7: 1 } },
  'surmenage':          { ...be({ sommeil: 3, energie: 3, fatigue: 4, douleur: 1 }), progression: { en_progression: 0, en_baisse: 3 }, dashboard: { tonnage: { evol_pct: 20 } }, regularite: { seances_j7: 5 } },
  'irregularite':       { ...be({ sommeil: 4, energie: 4, fatigue: 2, douleur: 1 }), regularite: { seances_j7: 1, seances_prevues: 4 } },
  'retour_vacances':    { ...be({ sommeil: 4, energie: 3, fatigue: 3, douleur: 1 }), progression: { en_progression: 0, en_baisse: 3 }, regularite: { seances_j7: 1, seances_prevues: 4 }, contexte: { etat: 'retour_vacances' } },
  'deload':             { ...be({ sommeil: 4, energie: 4, fatigue: 2, douleur: 1 }), progression: { en_progression: 0, en_baisse: 3 }, dashboard: { tonnage: { evol_pct: -20 } }, regularite: { seances_j7: 1 }, contexte: { etat: 'deload' } },
  'intensification':    { ...be({ sommeil: 3, energie: 3, fatigue: 4, douleur: 1 }), contexte: { etat: 'intensification' } },
  'donnees_absentes':   {},
};

// SNAPSHOT attendu (« Avant » figé). Règles déclenchées, triées.
const ATTENDU = {
  'optimal':           ['bonne_adaptation', 'tres_bonne_adherence'],
  'fatigue_generale':  ['fatigue_generale'],
  'douleur_seule':     ['douleur_signalee'],
  'sommeil_faible':    [],
  'recuperation_opt':  ['recuperation_optimale'],
  'surcharge_locale':  ['surcharge_locale'],
  'sous_entrainement': ['recuperation_optimale', 'sous_entrainement'],
  'surmenage':         ['surmenage'],
  'irregularite':      ['irregularite', 'recuperation_optimale'],
  'retour_vacances':   [],
  'deload':            ['recuperation_optimale'],
  'intensification':   [],
  'donnees_absentes':  [],
};

let ko = 0;
console.log('=== SNAPSHOT bilan NovalyzEngine (Avant) ===');
for (const nom of Object.keys(SCENARIOS)) {
  const res = Engine.analyser(SCENARIOS[nom]) || [];
  const ids = res.map(r => r.id).sort();
  const att = (ATTENDU[nom] || []).slice().sort();
  const eq = JSON.stringify(ids) === JSON.stringify(att);
  if (!eq) ko++;
  console.log(`  ${(nom + '                 ').slice(0, 18)} → [${ids.join(', ')}] ${eq ? '✅' : '❌ attendu [' + att.join(', ') + ']'}`);
}
console.log('-'.repeat(70));
console.log(ko === 0 ? '✅ Snapshot bilan stable (référence Avant figée).' : `❌ ${ko} scénario(s) hors snapshot.`);
if (ko > 0) process.exitCode = 1;
