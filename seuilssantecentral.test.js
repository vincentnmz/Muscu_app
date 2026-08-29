/* =============================================================================
 * PHASE 4C — Verrou des seuils santé + frontières (AVANT tout câblage).
 * 1. verrouille les valeurs Core : sommeil.bas=2, fatigue.haute=4, douleur.forte=3 ;
 * 2. vérifie via le VRAI NovalyzEngine que les frontières des signaux santé sont
 *    exactement <=2 / >=4 / >=3 (référence « Avant ») ;
 * 3. verrouille l'override contextuel intensification.fatigueElevee = 5 (≠ Core).
 * Ce test documente le comportement à préserver si/quand la source des 3 seuils
 * santé de NovalyzEngine est centralisée. Aucun fichier de production requis.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const IDX = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

function extraire(src, nom) {
  const m = src.match(new RegExp('(?:var|const)\\s+' + nom + '\\s*=\\s*'));
  if (!m) throw new Error('introuvable: ' + nom);
  let i = m.index + m[0].length; const open = src[i], close = open === '[' ? ']' : '}';
  let d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === open) d++; else if (c === close) { d--; if (d === 0) { j++; break; } } }
  return Function('"use strict"; return (' + src.slice(i, j) + ');')();
}
function extractBetween(start, end) { const s = APP.indexOf(start); const e = APP.indexOf(end, s + start.length); return APP.slice(s, e + end.length); }

const CORE_SEUILS = extraire(IDX, 'CORE_SEUILS');
const sandbox = {}; sandbox.self = sandbox; sandbox.window = sandbox; sandbox.module = { exports: {} }; sandbox.console = console;
vm.createContext(sandbox);
vm.runInContext(extractBetween('(function (global) {', "})(typeof self !== 'undefined' ? self : this);"), sandbox);
const Engine = sandbox.NovalyzEngine;
const sig = (be) => Engine.normaliser({ bien_etre: [be] }).signaux;

let ok = 0, ko = 0;
const check = (nom, cond, att, obt) => { if (cond) ok++; else { ko++; console.log(`  ❌ ${nom} — attendu ${att}, obtenu ${obt}`); } };

console.log('=== 1. Valeurs Core verrouillées ===');
check('CORE_SEUILS.sommeil.bas', CORE_SEUILS.sommeil.bas === 2, 2, CORE_SEUILS.sommeil.bas);
check('CORE_SEUILS.fatigue.haute', CORE_SEUILS.fatigue.haute === 4, 4, CORE_SEUILS.fatigue.haute);
check('CORE_SEUILS.douleur.forte', CORE_SEUILS.douleur.forte === 3, 3, CORE_SEUILS.douleur.forte);

console.log('=== 2. Frontières des signaux santé (NovalyzEngine réel) ===');
const CAS = [
  ['sommeil 1 → faible',      sig({ sommeil: 1 }).sommeilFaible === true,  true],
  ['sommeil 2 → faible',      sig({ sommeil: 2 }).sommeilFaible === true,  true],
  ['sommeil 3 → PAS faible',  sig({ sommeil: 3 }).sommeilFaible === false, false],
  ['fatigue 3 → PAS élevée',  sig({ fatigue: 3 }).fatigueElevee === false, false],
  ['fatigue 4 → élevée',      sig({ fatigue: 4 }).fatigueElevee === true,  true],
  ['douleur 2 → PAS élevée',  sig({ douleur: 2 }).douleurElevee === false, false],
  ['douleur 3 → élevée',      sig({ douleur: 3 }).douleurElevee === true,  true],
];
for (const [nom, cond] of CAS) { check(nom, cond, 'ok', 'ko'); console.log(`  ${(nom + '                      ').slice(0, 24)} ${cond ? '✅' : '❌'}`); }

console.log('=== 3. Override contextuel intensification (≠ Core) ===');
check('intensification.fatigueElevee = 5 conservé', /seuils:\s*\{\s*fatigueElevee:\s*5\s*\}/.test(APP), '5', '?');
check('base fatigue (Core) = 4', CORE_SEUILS.fatigue.haute === 4, 4, CORE_SEUILS.fatigue.haute);
console.log('  base 4 (Core) · intensification 5 (override front) — distincts ✅');

console.log('-'.repeat(70));
console.log(ko === 0 ? `✅ Verrou seuils santé + frontières : ${ok} vérifs.` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
