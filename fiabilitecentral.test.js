/* =============================================================================
 * PHASE 3E — Matrice de FIABILITÉ / CONFIANCE (référence).
 * Extrait CORE_FIABILITE + CORE_CONTEXTES du VRAI index.ts et reproduit À
 * L'IDENTIQUE les deux logiques du Core :
 *   - fiabiliteACWR(premiere, ctx, now, joursActifs28)  → ACWR interprétable ?
 *   - confiance(q)                                       → non_interpretable/faible/moyenne/haute
 * Vérifie que la config produit EXACTEMENT le comportement documenté, sur une
 * large matrice. 3E ne change aucune valeur : c'est un garde-fou de non-régression.
 * Distinction préservée : fiabilité ACWR ≠ confiance globale ≠ absence de données.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');
function extraire(nom) {
  const m = SRC.match(new RegExp('const\\s+' + nom + '\\s*=\\s*'));
  if (!m) throw new Error('introuvable: ' + nom);
  let i = m.index + m[0].length; const open = SRC[i], close = open === '[' ? ']' : '}';
  let d = 0, j = i; for (; j < SRC.length; j++) { const c = SRC[j]; if (c === open) d++; else if (c === close) { d--; if (d === 0) { j++; break; } } }
  return Function('"use strict"; return (' + SRC.slice(i, j) + ');')();
}
const CORE_FIABILITE = extraire('CORE_FIABILITE');
const CORE_CONTEXTES = extraire('CORE_CONTEXTES');

// Dates
const DAY = 86400000;
const NOW = new Date('2026-08-28T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const isoDaysAgo = (n) => (n == null ? null : iso(new Date(NOW.getTime() - n * DAY)));
function joursDepuis(isoStr) { if (!isoStr) return null; const dt = new Date(isoStr + 'T00:00:00Z'); return isNaN(dt) ? null : Math.floor((NOW - dt) / DAY); }

// ---- Copie fidèle de fiabiliteACWR (index.ts) ----
function fiabiliteACWR(premiere, ctxObj, joursActifs28) {
  const histo = joursDepuis(premiere);
  if (histo == null || histo < CORE_FIABILITE.histoMin) return false;
  if (joursActifs28 < CORE_FIABILITE.joursActifsMin) return false;
  if (ctxObj && String(ctxObj.etat || '') === 'retour_vacances') {
    const rd = joursDepuis(ctxObj.date_debut);
    if (rd != null && rd >= 0 && rd < CORE_CONTEXTES.retour_vacances.acwrRepriseJours) return false;
  }
  return true;
}
// ---- Copie fidèle du bloc confiance (index.ts) ----
function confiance(q, acwrForConf) {
  if (q.wellnessN === 0 && !q.hasCharge) return 'non_interpretable';
  if (q.jours < CORE_FIABILITE.confJoursFaible || q.wellnessN === 0) return 'faible';
  if (q.jours < CORE_FIABILITE.confJoursMoyen || q.wellnessN < CORE_FIABILITE.wellnessMin || acwrForConf == null) return 'moyenne';
  return 'haute';
}

let ok = 0, ko = 0;
const check = (nom, cond, att, obt) => { if (cond) ok++; else { ko++; console.log(`  ❌ ${nom} — attendu ${att}, obtenu ${obt}`); } };

// ===================== 1. Matrice FIABILITÉ ACWR =====================
console.log('=== Fiabilité ACWR ===');
const FIA = [
  // [nom, histoJours, joursActifs28, ctx, attendu(fiable?)]
  ['< 28 j (20)',                 20, 10, null, false],
  ['exactement 28 j',             28, 10, null, true],
  ['> 28 j (40)',                 40, 10, null, true],
  ['0 jour actif',                40, 0,  null, false],
  ['3 jours actifs',              40, 3,  null, false],
  ['5 jours actifs',              40, 5,  null, false],
  ['exactement 6 jours actifs',   40, 6,  null, true],
  ['> 6 jours actifs (10)',       40, 10, null, true],
  ['reprise vacances < 28 (5 j)', 60, 10, { etat: 'retour_vacances', date_debut: isoDaysAgo(5) },  false],
  ['reprise vacances = 28 j',     60, 10, { etat: 'retour_vacances', date_debut: isoDaysAgo(28) }, true],
  ['reprise vacances > 28 (40 j)',60, 10, { etat: 'retour_vacances', date_debut: isoDaysAgo(40) }, true],
  ['reprise blessure (n\'affecte pas ACWR)', 60, 10, { etat: 'retour_blessure', date_debut: isoDaysAgo(5) }, true],
];
for (const [nom, h, ja, ctx, att] of FIA) {
  const r = fiabiliteACWR(isoDaysAgo(h), ctx, ja);
  check(nom, r === att, att, r);
  console.log(`  ${(nom + '                                   ').slice(0, 40)} → ${r ? 'interprétable' : 'NON interprétable'} ${r === att ? '✅' : '❌'}`);
}
// Chronique nulle : ratio null → acwrOk = (acwr!=null && fiable!==false) = false (non interprétable)
const acwrOk = (acwr, fiable) => acwr != null && fiable !== false;
check('chronique nulle (acwr null) → non interprétable', acwrOk(null, true) === false, false, acwrOk(null, true));
console.log(`  ${'chronique nulle (acwr=null)'.padEnd(40)} → ${acwrOk(null, true) ? 'interprétable' : 'NON interprétable'} ✅`);

// ===================== 2. Matrice CONFIANCE =====================
console.log('=== Confiance globale ===');
const CONF = [
  // [nom, jours, wellnessN, hasCharge, acwrForConf, attendu]
  ['wellness absent + aucune charge', 30, 0, false, 1.0, 'non_interpretable'],
  ['wellness absent + charge',        30, 0, true,  1.0, 'faible'],
  ['historique < 7 j (5)',            5,  3, true,  1.0, 'faible'],
  ['historique 15 j (<21)',           15, 3, true,  1.0, 'moyenne'],
  ['wellness insuffisant (2) à 30 j', 30, 2, true,  1.0, 'moyenne'],
  ['ACWR non interprétable à 30 j',   30, 3, true,  null,'moyenne'],
  ['données complètes (30 j, w3, acwr)', 30, 3, true, 1.0, 'haute'],
  ['exactement 7 j',                  7,  3, true,  1.0, 'moyenne'],  // 7 non < 7 → pas faible ; <21 → moyenne
  ['exactement 21 j',                 21, 3, true,  1.0, 'haute'],    // 21 non < 21 ; w>=3 ; acwr ok → haute
  ['exactement 3 mesures wellness',   30, 3, true,  1.0, 'haute'],    // 3 non < 3
];
for (const [nom, j, w, hc, acwr, att] of CONF) {
  const r = confiance({ jours: j, wellnessN: w, hasCharge: hc }, acwr);
  check(nom, r === att, att, r);
  console.log(`  ${(nom + '                                   ').slice(0, 40)} → ${r} ${r === att ? '✅' : '❌'}`);
}

console.log('-'.repeat(72));
console.log(ko === 0 ? `✅ Fiabilité/confiance : ${ok} cas conformes à CORE_FIABILITE.` : `❌ ${ko} écart(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
