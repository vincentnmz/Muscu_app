/* =============================================================================
 * PHASE 3A — Test de PARITÉ DE CONFIGURATION
 * Lit le VRAI backend (supabase/functions/handler/index.ts), extrait les objets
 * CORE_* et vérifie :
 *   1. chaque valeur métier = valeur canonique 3A (aucune dérive pendant l'extraction) ;
 *   2. les anciens littéraux « magiques » ont bien disparu des fonctions du moteur
 *      (evaluerEtatAthlete / fiabiliteACWR / interpreterACWR) → centralisation réelle.
 * 3A = refactor de configuration : 0 changement de valeur, 0 changement de comportement.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts'), 'utf8');

let ok = 0, ko = 0;
const check = (nom, cond, attendu, obtenu) => {
  if (cond) { ok++; }
  else { ko++; console.log(`  ❌ ${nom} — attendu ${JSON.stringify(attendu)}, obtenu ${JSON.stringify(obtenu)}`); }
};

// --- Extraction d'un littéral objet/array équilibré à partir de `const NOM = ` ---
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
  const slice = src.slice(i, j);
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + slice + ');')();
}

const CORE_SEUILS    = extraireLitteral(SRC, 'CORE_SEUILS');
const CORE_NIVEAUX   = extraireLitteral(SRC, 'CORE_NIVEAUX');
const CORE_FIABILITE = extraireLitteral(SRC, 'CORE_FIABILITE');
const CORE_CONTEXTES = extraireLitteral(SRC, 'CORE_CONTEXTES');

console.log('=== 1. Valeurs de configuration = valeurs canoniques 3A ===');
// Seuils santé/charge
check('douleur.gene', CORE_SEUILS.douleur.gene === 2, 2, CORE_SEUILS.douleur.gene);
check('douleur.forte', CORE_SEUILS.douleur.forte === 3, 3, CORE_SEUILS.douleur.forte);
check('fatigue.haute', CORE_SEUILS.fatigue.haute === 4, 4, CORE_SEUILS.fatigue.haute);
check('sommeil.bas', CORE_SEUILS.sommeil.bas === 2, 2, CORE_SEUILS.sommeil.bas);
check('courbatures.haut', CORE_SEUILS.courbatures.haut === 4, 4, CORE_SEUILS.courbatures.haut);
check('recup.faible', CORE_SEUILS.recup.faible === 45, 45, CORE_SEUILS.recup.faible);
check('recup.moyen', CORE_SEUILS.recup.moyen === 60, 60, CORE_SEUILS.recup.moyen);
check('recup.bon', CORE_SEUILS.recup.bon === 75, 75, CORE_SEUILS.recup.bon);
check('acwr.bas', CORE_SEUILS.acwr.bas === 0.8, 0.8, CORE_SEUILS.acwr.bas);
check('acwr.optMax', CORE_SEUILS.acwr.optMax === 1.3, 1.3, CORE_SEUILS.acwr.optMax);
check('acwr.haut', CORE_SEUILS.acwr.haut === 1.5, 1.5, CORE_SEUILS.acwr.haut);
// Fiabilité / confiance
check('histoMin', CORE_FIABILITE.histoMin === 28, 28, CORE_FIABILITE.histoMin);
check('joursActifsMin', CORE_FIABILITE.joursActifsMin === 6, 6, CORE_FIABILITE.joursActifsMin);
check('confJoursFaible', CORE_FIABILITE.confJoursFaible === 7, 7, CORE_FIABILITE.confJoursFaible);
check('confJoursMoyen', CORE_FIABILITE.confJoursMoyen === 21, 21, CORE_FIABILITE.confJoursMoyen);
check('wellnessMin', CORE_FIABILITE.wellnessMin === 3, 3, CORE_FIABILITE.wellnessMin);
// Niveaux (labels / statuts / couleurs conservées 3A)
const NIVattendus = [
  { cle: 'optimal', label: 'Prêt', statut: 'vert', couleur: '#22c55e' },
  { cle: 'vigilance', label: 'Vigilance', statut: 'orange', couleur: '#f5a623' },
  { cle: 'action', label: 'À surveiller', statut: 'rouge', couleur: '#e5484d' },
];
NIVattendus.forEach((n, i) => {
  check(`niveau[${i}].label`, CORE_NIVEAUX[i].label === n.label, n.label, CORE_NIVEAUX[i].label);
  check(`niveau[${i}].statut`, CORE_NIVEAUX[i].statut === n.statut, n.statut, CORE_NIVEAUX[i].statut);
  check(`niveau[${i}].couleur`, CORE_NIVEAUX[i].couleur === n.couleur, n.couleur, CORE_NIVEAUX[i].couleur);
});
// Contextes (reposPrevu = parité du comportement actuel)
check('deload.reposPrevu', CORE_CONTEXTES.deload.reposPrevu === true, true, CORE_CONTEXTES.deload.reposPrevu);
check('retour_vacances.reposPrevu', CORE_CONTEXTES.retour_vacances.reposPrevu === true, true, CORE_CONTEXTES.retour_vacances.reposPrevu);
check('retour_blessure.reposPrevu', CORE_CONTEXTES.retour_blessure.reposPrevu === true, true, CORE_CONTEXTES.retour_blessure.reposPrevu);
check('saison_normale.reposPrevu', CORE_CONTEXTES.saison_normale.reposPrevu === false, false, CORE_CONTEXTES.saison_normale.reposPrevu);
check('intensification.reposPrevu', CORE_CONTEXTES.intensification.reposPrevu === false, false, CORE_CONTEXTES.intensification.reposPrevu);
check('retour_vacances.acwrRepriseJours', CORE_CONTEXTES.retour_vacances.acwrRepriseJours === 28, 28, CORE_CONTEXTES.retour_vacances.acwrRepriseJours);

console.log('=== 2. Les anciens littéraux magiques ont disparu du moteur ===');
// Slice de la fonction evaluerEtatAthlete
const evalStart = SRC.indexOf('function evaluerEtatAthlete');
const evalSlice = SRC.slice(evalStart, evalStart + 4000);
const interdits = [
  ['som <= 2', /som\s*<=\s*2\b/],
  ['fat >= 4', /fat\s*>=\s*4\b/],
  ['doul >= 2', /doul\s*>=\s*2\b/],
  ['doul >= 3', /doul\s*>=\s*3\b/],
  ['recScore >= 75', /recScore\s*>=\s*75\b/],
  ['recScore >= 60', /recScore\s*>=\s*60\b/],
  ['recScore >= 45', /recScore\s*>=\s*45\b/],
  ['recScore < 45', /recScore\s*<\s*45\b/],
  ['recScore < 60', /recScore\s*<\s*60\b/],
  ['jours < 7', /jours\s*<\s*7\b/],
  ['jours < 21', /jours\s*<\s*21\b/],
  ['wellnessN < 3', /wellnessN\s*<\s*3\b/],
];
for (const [nom, re] of interdits) {
  check('absent: ' + nom, !re.test(evalSlice), 'absent', re.test(evalSlice) ? 'PRÉSENT' : 'absent');
}
// fiabiliteACWR + interpreterACWR : plus de littéraux 28 / 6 / 0.8 / 1.3 / 1.5
const fiaStart = SRC.indexOf('function fiabiliteACWR');
const fiaSlice = SRC.slice(fiaStart, fiaStart + 600);
check('fiabilite: pas de « < 28 »', !/<\s*28\b/.test(fiaSlice), 'absent', /<\s*28\b/.test(fiaSlice) ? 'PRÉSENT' : 'absent');
check('fiabilite: référence CORE_FIABILITE', /CORE_FIABILITE\./.test(fiaSlice), 'présent', /CORE_FIABILITE\./.test(fiaSlice));
const interpStart = SRC.indexOf('function interpreterACWR');
const interpSlice = SRC.slice(interpStart, interpStart + 400);
check('interpreter: référence CORE_SEUILS.acwr', /CORE_SEUILS\.acwr\./.test(interpSlice), 'présent', /CORE_SEUILS\.acwr\./.test(interpSlice));

console.log('-'.repeat(70));
console.log(ko === 0 ? `✅ Parité de configuration OK — ${ok} vérifs, aucune dérive de valeur.` : `❌ ${ko} écart(s) sur ${ok + ko} vérifs.`);
if (ko > 0) process.exitCode = 1;
