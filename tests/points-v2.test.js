/* =============================================================================
 * POINTS v2 (décision 30/10) — vrai calculerPoints d'index.ts.
 * Barème : séance 10 · RPE complet 5 · ressenti 3/jour · séance complète 5 ·
 * record (charge battue, 1er passage exclu, 3 max/sem.) 20 · objectif semaine 30.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');
let ok = 0, ko = 0;
function eq(c, l) { if (c) ok++; else { ko++; console.error('  ✗ ' + l); } }
function extractFrom(SRC, name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
const TS = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
const consts = ['POINTS_BAREME', 'COLLECTION_PALIERS', 'RECOMPENSES_CATALOGUE'].map(n => { const i = TS.indexOf('const ' + n); let d = 0, j = TS.indexOf('=', i); for (; j < TS.length; j++) { const c = TS[j]; if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (d === 0) { j++; break; } } } return TS.slice(i, j); }).join('\n');
const C = {}; vm.createContext(C);
vm.runInContext(stripTypeScriptTypes(consts + '\n' + ['parseFR', 'normDate', 'fmtFR', 'fmtYMD', '_lundiYMD', 'calculerPoints'].map(n => extractFrom(TS, n)).join('\n')) + '\nthis.calculerPoints=calculerPoints;', C);

const p = (date, exo, charge, rpe, sid) => ({ date, exercice: exo, charge, reps: 8, rpe, seance_id: sid || 'A' });
const prog = [{ seance_id: 'A', exercice: 'Squat', series_prevues: 2 }, { seance_id: 'A', exercice: 'Curl', series_prevues: 1 }];
const now = new Date('2026-10-30T12:00:00Z');   // vendredi, semaine du lundi 26/10
const perfs = [
  // semaine précédente : 1ers passages (pas des records)
  p('2026-10-20', 'Squat', 100, 8), p('2026-10-20', 'Squat', 100, 8), p('2026-10-20', 'Curl', 20, 8),
  // cette semaine
  p('2026-10-26', 'Squat', 105, 8), p('2026-10-26', 'Squat', 100, 9), p('2026-10-26', 'Curl', 20, ''),   // record squat, RPE incomplet
  p('2026-10-28', 'Squat', 105, 8),                                                                       // égalité ≠ record, séance incomplète
];
const be = [{ date: '2026-10-26' }, { date: '2026-10-26' }, { date: '2026-10-27' }];
let R = C.calculerPoints(perfs, be, prog, 2, [], now);
const L = k => R.semaine.lignes.find(l => l.k === k);
eq(L('seance').n === 2 && L('seance').pts === 20, '2 séances cette semaine → 20');
eq(L('rpe').n === 1, 'RPE manquant sur une série → pas de bonus RPE (26/10), 28/10 : 1 seule série mais RPE ok');
eq(L('questionnaire').n === 2, 'ressenti : 1 par jour (2 relevés le 26 = 1)');
eq(L('complete').n === 1, 'séance complète : 26/10 (3 séries ≥ 3 prévues), pas 28/10 (1 série)');
eq(L('record').n === 1 && /Squat 105/.test(L('record').details[0]), 'record : squat 105 > 100 ; égalité 105 le 28 ≠ record ; 1er passage ≠ record');
eq(L('objectif').n === 1 && L('objectif').fait === 2 && L('objectif').cible === 2, 'objectif 2 séances atteint → +30');
// Total gagné = semaine passée (10 + 5 RPE + 5 complète) + cette semaine
eq(R.gagnes === 20 + R.semaine.total, 'gagnés = semaine précédente (20) + cette semaine');
// Plafond records : 5 records la même semaine → 3 comptés
const pr = [];
['A1', 'A2', 'A3', 'A4', 'A5'].forEach(e => { pr.push(p('2026-10-19', e, 10, 8)); pr.push(p('2026-10-27', e, 20, 8)); });
R = C.calculerPoints(pr, [], [], 0, [], now);
eq(R.semaine.lignes.find(l => l.k === 'record').n === 3, 'records plafonnés à 3 par semaine');
eq(R.semaine.lignes.find(l => l.k === 'objectif').n === 0, 'sans objectif réglé → pas de bonus objectif');
// Anciens achats (badges/thème) : restent acquis, plus déduits du solde
R = C.calculerPoints(perfs, be, prog, 2, [{ cle: 'skin_gold', valeur: '300' }, { cle: 'badge_pionnier', valeur: '50' }], now);
eq(R.depenses === 0 && R.solde === R.gagnes, 'anciens achats badges/thème → plus déduits');
eq(R.collection.find(c => c.id === 'skin_gold').debloque === true, 'ancien achat → reste débloqué');
eq(R.collection.find(c => c.id === 'badge_machine').debloque === false, 'badge Machine : 1 200 pts gagnés requis');
eq(typeof R.records_30j === 'number', 'records_30j (même définition) renvoyé');
console.log('points v2 : ' + ok + ' OK / ' + ko + ' KO');
if (ko) process.exit(1);
