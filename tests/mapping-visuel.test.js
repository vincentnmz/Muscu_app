/* =============================================================================
 * PHASE 3B — Test du MAPPING VISUEL (front) + PARITÉ avec l'ancienne couleur Core.
 * Lit le VRAI front (js/app.js), extrait STATUT_VISUEL et vérifie que le mapping
 *   niveau (libellé) → couleur  reproduit EXACTEMENT les couleurs émises
 * auparavant par le backend (Phase 3A : #22c55e / #f5a623 / #e5484d).
 * → 100 % de parité visuelle, 0 changement de rendu.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function extraireLitteral(src, nom) {
  const m = src.match(new RegExp('const\\s+' + nom + '\\s*=\\s*'));
  if (!m) throw new Error('introuvable: ' + nom);
  let i = m.index + m[0].length;
  const open = src[i], close = open === '[' ? ']' : '}';
  let depth = 0, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { j++; break; } }
  }
  return Function('"use strict"; return (' + src.slice(i, j) + ');')();
}

const STATUT_VISUEL = extraireLitteral(SRC, 'STATUT_VISUEL');

let ok = 0, ko = 0;
const check = (nom, cond, att, obt) => {
  if (cond) ok++; else { ko++; console.log(`  ❌ ${nom} — attendu ${att}, obtenu ${obt}`); }
};

// ANCIENNE couleur produite par le Core (Phase 3A) — référence de parité.
const ANCIENNE_COULEUR = { 0: '#22c55e', 1: '#f5a623', 2: '#e5484d' };
// Table niveau numérique → libellé métier (contrat backend).
const LABEL = { 0: 'Prêt', 1: 'Vigilance', 2: 'À surveiller' };

console.log('=== Parité mapping front vs ancienne couleur Core ===');
console.log('niveau  libellé          front → couleur   ancienne   parité');
for (const n of [0, 1, 2]) {
  const label = LABEL[n];
  const couleurFront = STATUT_VISUEL[label];
  const parite = couleurFront === ANCIENNE_COULEUR[n];
  check(`niveau ${n} (${label})`, parite, ANCIENNE_COULEUR[n], couleurFront);
  console.log(`  ${n}     ${(label + '            ').slice(0, 15)}  ${couleurFront}          ${ANCIENNE_COULEUR[n]}   ${parite ? '✅' : '❌'}`);
}

// Vérifs de non-régression des profils (niveau → couleur affichée).
console.log('=== Profils : niveau métier → couleur affichée ===');
const PROFILS = [
  { nom: 'Lucas', niveau: 2, couleur: '#e5484d' },
  { nom: 'Enzo',  niveau: 2, couleur: '#e5484d' },
  { nom: 'Nathan',niveau: 1, couleur: '#f5a623' },
  { nom: 'Noah',  niveau: 1, couleur: '#f5a623' },
  { nom: 'Optimal', niveau: 0, couleur: '#22c55e' },
];
for (const p of PROFILS) {
  const c = STATUT_VISUEL[LABEL[p.niveau]];
  check(`${p.nom} niveau ${p.niveau} → ${p.couleur}`, c === p.couleur, p.couleur, c);
  console.log(`  ${(p.nom + '        ').slice(0, 8)} niveau ${p.niveau} → ${c} ${c === p.couleur ? '✅' : '❌'}`);
}

console.log('-'.repeat(60));
console.log(ko === 0 ? `✅ Mapping visuel : ${ok} parités OK, 0 changement de rendu.` : `❌ ${ko} écart(s).`);
if (ko > 0) process.exitCode = 1;
