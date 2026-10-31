/* =============================================================================
 * Audit 31/10 — F1/F2 : moteur front (NovalyzEngine) rebranché sur les vraies sources.
 *  - bien-être = moyenne des 3 derniers jours (douleur = dernière saisie) ;
 *  - « Fatigue générale » vit sans « énergie » (questionnaire Hooper : stress élevé) ;
 *  - le tonnage 28 j (comparison.j28_vs_j28prec.charge) n'est plus lu comme « force » ;
 *  - progression = classement partagé des exercices (records + progresse vs recule).
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const s0 = SRC.indexOf('(function (global) {');
const end = "})(typeof self !== 'undefined' ? self : this);";
const engineCode = SRC.slice(s0, SRC.indexOf(end, s0) + end.length);
const sandbox = { console }; sandbox.self = sandbox; sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
const E = sandbox.NovalyzEngine;

let ok = 0, ko = 0;
function eq(cond, label, got) { if (cond) ok++; else { ko++; console.error('  ✗ ' + label + (got !== undefined ? ' (got ' + JSON.stringify(got) + ')' : '')); } }
const ids = (d) => (E.analyser(d) || []).map(a => a.id);

// 1) Moyenne 3 jours : un seul mauvais matin ne suffit plus.
{ const d = { bien_etre: [
    { date: '31/10/2026', sommeil: 1, fatigue: 5, stress: 5, douleur: 1 },
    { date: '30/10/2026', sommeil: 4, fatigue: 1, stress: 1, douleur: 1 },
    { date: '29/10/2026', sommeil: 4, fatigue: 1, stress: 1, douleur: 1 }] };
  const v = E.normaliser(d).valeurs;
  eq(v.sommeil === 3 && v.fatigue === 2.3, 'sommeil / fatigue = moyenne des 3 derniers jours', [v.sommeil, v.fatigue]);
  eq(!ids(d).includes('fatigue_generale'), '1 mauvais matin isolé → pas de « Fatigue générale »', ids(d)); }

// 2) 3 jours dégradés, sans « énergie » (Hooper) → « Fatigue générale » avec le stress comme preuve.
{ const d = { bien_etre: [
    { date: '31/10/2026', sommeil: 2, fatigue: 4, stress: 4, douleur: 1 },
    { date: '30/10/2026', sommeil: 2, fatigue: 5, stress: 4, douleur: 1 },
    { date: '29/10/2026', sommeil: 2, fatigue: 4, stress: 5, douleur: 1 }] };
  const a = (E.analyser(d) || []).find(x => x.id === 'fatigue_generale');
  eq(!!a, 'Hooper dégradé 3 jours → « Fatigue générale »', ids(d));
  eq(a && /stress/.test(a.evidence) && !/énergie/.test(a.evidence), 'preuve = stress (pas d\'énergie inventée)', a && a.evidence); }

// 3) Douleur = dernière saisie (pas la moyenne).
{ const d = { bien_etre: [
    { date: '31/10/2026', sommeil: 4, fatigue: 2, douleur: 1 },
    { date: '30/10/2026', sommeil: 4, fatigue: 2, douleur: 4, zone: 'Genou' }] };
  eq(E.normaliser(d).valeurs.douleur === 1, 'douleur = dernière saisie (1 aujourd\'hui)', E.normaliser(d).valeurs.douleur); }

// 4) F2 : le tonnage 28 j n'est plus pris pour la force.
{ const d = { comparison: { j28_vs_j28prec: { charge: { evol_pct: -40 }, tonnage: { evol_pct: -40 } } },
    poids: [{ poids: 80 }, { poids: 81 }], bien_etre: [{ sommeil: 4, fatigue: 2 }] };
  const f = E.normaliser(d);
  eq(f.valeurs.charge28EvolPct === null, 'charge28EvolPct (tonnage) plus lu comme force', f.valeurs.charge28EvolPct);
  eq(!ids(d).includes('deficit_energetique'), 'poids en baisse + mois plus léger → pas de « Déficit énergétique »', ids(d)); }

// 5) Progression = classement des exercices exposé par l'app.
{ sandbox._lectureExos = () => ({ records: [{}], progresse: [{}], recule: [{}, {}, {}], bloque: [], sous: [] });
  const d = { historique: { progression_par_exo: { X: [] } }, poids: [{ poids: 80 }, { poids: 81 }], bien_etre: [{ sommeil: 4, fatigue: 2 }] };
  const f = E.normaliser(d);
  eq(f.valeurs.progUp === 2 && f.valeurs.progDown === 3, 'progression = records+progresse (2) vs recule (3)', [f.valeurs.progUp, f.valeurs.progDown]);
  const a = (E.analyser(d) || []).find(x => x.id === 'deficit_energetique');
  eq(!!a && /3 en recul, 2 en progrès/.test(a.evidence), '« Déficit énergétique » prouvé par les exercices réels', a && a.evidence);
  delete sandbox._lectureExos; }

console.log('-'.repeat(70));
console.log(`moteur front rebranché : ${ok} OK / ${ko} KO`);
if (ko) process.exitCode = 1;
