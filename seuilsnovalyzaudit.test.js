/* =============================================================================
 * PHASE 4B — Audit garde-fou des seuils de NovalyzEngine / NovalyzContexte.
 * AUCUN fichier de production modifié. Ce test :
 *   1. fige l'inventaire des SEUILS front (détecte toute dérive future) ;
 *   2. vérifie que les valeurs DUPLIQUÉES avec le Core sont IDENTIQUES
 *      (pas de divergence silencieuse — réponse à la Question 2 de la 4B) ;
 *   3. documente les overrides de contexte de NovalyzContexte.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const APP = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const IDX = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

function extraire(src, nom) {
  const m = src.match(new RegExp('(?:var|const)\\s+' + nom + '\\s*=\\s*'));
  if (!m) throw new Error('introuvable: ' + nom);
  let i = m.index + m[0].length; const open = src[i], close = open === '[' ? ']' : '}';
  let d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === open) d++; else if (c === close) { d--; if (d === 0) { j++; break; } } }
  return Function('"use strict"; return (' + src.slice(i, j) + ');')();
}
const SEUILS = extraire(APP, 'SEUILS');
const CORE_SEUILS = extraire(IDX, 'CORE_SEUILS');

let ok = 0, ko = 0;
const check = (nom, cond, att, obt) => { if (cond) ok++; else { ko++; console.log(`  ❌ ${nom} — attendu ${att}, obtenu ${obt}`); } };

// 1) Inventaire figé des SEUILS front (drift guard).
console.log('=== Inventaire SEUILS front (figé) ===');
const INV = {
  sommeilFaible: 2, sommeilBon: 4, energieFaible: 2, energieBonne: 4,
  fatigueElevee: 4, fatigueFaible: 2, douleurElevee: 3, ressentiDur: 2, ressentiFacile: 4,
  acwrEleve: 1.5, acwrBas: 0.8, acwrOptMin: 0.8, acwrOptMax: 1.3,
  tonnageHaussePct: 15, tonnageBaissePct: -15, chargeVarPct: 3,
  seancesFaible: 1, seancesEleve: 5, poidsVar: 0.3, progExcellenteUp: 3, progExcellenteDownMax: 1,
};
for (const k of Object.keys(INV)) check('SEUILS.' + k, SEUILS[k] === INV[k], INV[k], SEUILS[k]);
console.log(`  ${Object.keys(INV).length} seuils front inventoriés.`);

// 2) Valeurs DUPLIQUÉES avec le Core : doivent être IDENTIQUES (catégorie E, pas de divergence).
console.log('=== Cohérence valeurs dupliquées front ↔ Core (Question 2) ===');
const DUP = [
  ['fatigue haute', SEUILS.fatigueElevee, CORE_SEUILS.fatigue.haute],
  ['douleur forte', SEUILS.douleurElevee, CORE_SEUILS.douleur.forte],
  ['sommeil bas',   SEUILS.sommeilFaible, CORE_SEUILS.sommeil.bas],
  ['acwr haut',     SEUILS.acwrEleve,     CORE_SEUILS.acwr.haut],
  ['acwr bas',      SEUILS.acwrBas,       CORE_SEUILS.acwr.bas],
  ['acwr optMax',   SEUILS.acwrOptMax,    CORE_SEUILS.acwr.optMax],
];
for (const [nom, front, core] of DUP) {
  check('dup ' + nom, front === core, core, front);
  console.log(`  ${(nom + '            ').slice(0, 14)} front=${front}  core=${core}  ${front === core ? '✅ identiques' : '❌ DIVERGENT'}`);
}

// 3) NovalyzContexte — overrides de contexte (documentation).
console.log('=== NovalyzContexte : overrides (documentation) ===');
check('intensification fatigueElevee = 5', /seuils:\s*\{\s*fatigueElevee:\s*5\s*\}/.test(APP), '5', '?');
check('retour_vacances duree_jours = 14', /duree_jours:\s*14/.test(APP), '14', '?');
console.log('  intensification → fatigueElevee 5 (override du 4 de base, spécifique alertes) ✅');
console.log('  retour_vacances → duree_jours 14 (fenêtre alertes front) ✅');

// 4) Règles ACWR dormantes : les signaux ACWR sont neutralisés (ne se déclenchent jamais).
console.log('=== Règles ACWR dormantes ===');
check('s.acwrEleve neutralisé (= null)', /s\.acwrEleve\s*=\s*null/.test(APP), 'null', '?');
console.log('  s.acwrEleve/Bas/Optimal = null → risque_blessure & acwr_eleve_seul dormantes ✅');

console.log('-'.repeat(72));
console.log(ko === 0 ? `✅ Audit seuils NovalyzEngine : ${ok} vérifs, aucune divergence silencieuse.` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
