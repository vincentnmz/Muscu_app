/* =============================================================================
 * PHASE 3C — Parité contexte ANCIEN (impératif) vs NOUVEAU (CORE_CONTEXTES).
 * Reproduit À L'IDENTIQUE :
 *   - l'ancien code impératif (ctx === 'deload' / 'retour_vacances' / 'retour_blessure') ;
 *   - le nouveau chemin piloté par CORE_CONTEXTES (effetsContexte + clampNiv),
 *     dont les valeurs sont EXTRAITES du vrai index.ts.
 * Balaye tous les contextes × toutes les valeurs de départ et exige ANCIEN === NOUVEAU.
 * Aucun effet de contexte ne doit changer.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

function extraireLitteral(src, nom) {
  const m = src.match(new RegExp('const\\s+' + nom + '\\s*=\\s*'));
  if (!m) throw new Error('introuvable: ' + nom);
  let i = m.index + m[0].length;
  const open = src[i], close = open === '[' ? ']' : '}';
  let depth = 0, j = i;
  for (; j < src.length; j++) { const c = src[j]; if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) { j++; break; } } }
  return Function('"use strict"; return (' + src.slice(i, j) + ');')();
}

const CORE_CONTEXTES = extraireLitteral(SRC, 'CORE_CONTEXTES');
const clampNiv = (n) => Math.max(0, Math.min(2, n));

// ---- NOUVEAU chemin (copie fidèle d'effetsContexte + applications d'index.ts) ----
function effetsContexte(ctxEtat) {
  const c = CORE_CONTEXTES[ctxEtat] || {};
  return {
    reposPrevu: c.reposPrevu === true,
    surchargeDelta: c.surchargeDelta || 0,
    niveauMin: c.niveauMin != null ? c.niveauMin : null,
    risqueDelta: c.risqueDelta || 0,
  };
}
function nouveau(ctxEtat, surchargeN0, risque0, niveau0) {
  const ctx = ctxEtat || 'saison_normale';
  const eff = effetsContexte(ctx);
  let surchargeN = surchargeN0;
  if (eff.surchargeDelta) surchargeN = clampNiv(surchargeN + eff.surchargeDelta);
  let risque = risque0;
  if (eff.risqueDelta) risque = clampNiv(risque + eff.risqueDelta);
  let niveau = niveau0;
  if (eff.niveauMin != null && niveau < eff.niveauMin) niveau = eff.niveauMin;
  return { reposPrevu: eff.reposPrevu, surchargeN, risque, niveau };
}

// ---- ANCIEN chemin (copie fidèle du code impératif pré-3C) ----
function ancien(ctxEtat, surchargeN0, risque0, niveau0) {
  const ctx = ctxEtat || 'saison_normale';
  const reposPrevu = ctx === 'deload' || ctx === 'retour_vacances' || ctx === 'retour_blessure';
  let surchargeN = surchargeN0;
  if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1);
  if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1);
  let risque = risque0;
  if (ctx === 'retour_blessure') risque = Math.min(2, risque + 1);
  let niveau = niveau0;
  if (ctx === 'retour_blessure' && niveau === 0) niveau = 1;
  return { reposPrevu, surchargeN, risque, niveau };
}

const CONTEXTES = ['saison_normale', 'deload', 'retour_vacances', 'retour_blessure', 'intensification', 'contexte_inconnu', '', null, undefined];

let ok = 0, ko = 0;
console.log('=== Parité effets de contexte : ANCIEN vs NOUVEAU ===');
console.log('contexte            reposPrevu  surcharge(s2)  risque(r1)  niveauMin  parité');
function paritOne(ctx) {
  let allEq = true;
  for (const s of [0, 1, 2]) for (const r of [0, 1, 2]) for (const n of [0, 1, 2]) {
    const a = ancien(ctx, s, r, n), b = nouveau(ctx, s, r, n);
    const eq = a.reposPrevu === b.reposPrevu && a.surchargeN === b.surchargeN && a.risque === b.risque && a.niveau === b.niveau;
    if (eq) ok++; else { ko++; allEq = false; console.log(`  ❌ ctx=${ctx} in(s${s},r${r},n${n}) ancien=${JSON.stringify(a)} nouveau=${JSON.stringify(b)}`); }
  }
  return allEq;
}
for (const ctx of CONTEXTES) {
  const a0 = ancien(ctx, 2, 1, 0), b0 = nouveau(ctx, 2, 1, 0);
  const allEq = paritOne(ctx);
  const label = (String(ctx) + '                   ').slice(0, 19);
  console.log(`  ${label} ${a0.reposPrevu ? 'oui' : 'non'}         s2→${b0.surchargeN}            r1→${b0.risque}          ${effetsContexte(ctx || 'saison_normale').niveauMin ?? '—'}         ${allEq ? '✅' : '❌'}`);
}
console.log('-'.repeat(78));
console.log(ko === 0 ? `✅ Parité contexte OK — ${ok} combinaisons, ancien === nouveau.` : `❌ ${ko} divergence(s) sur ${ok + ko}.`);
if (ko > 0) process.exitCode = 1;
