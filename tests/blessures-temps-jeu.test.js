/* =============================================================================
 * P2-B — Value-tests : temps_jeu (passthrough) · injByAth (équipe) · injActive (fiche).
 *
 * Ferme les trous de couverture identifiés par l'audit P2-A. On EXÉCUTE le vrai
 * code de production de supabase/functions/handler/index.ts (types TS retirés) :
 *   • temps_jeu : via la vraie fonction `aggMatchsFoot` — la prod fait
 *     `kpiFoot.temps_jeu = matchStats.minutes` (index.ts:1948), donc
 *     temps_jeu === aggMatchsFoot(seances).match_stats.minutes ;
 *   • injByAth / injActive : ce sont des BLOCS INLINE (dans handleGetSuiviEquipe /
 *     handleGetSuiviJoueur), pas des fonctions autonomes. On ne recopie PAS leur
 *     logique : on EXTRAIT LES OCTETS SOURCE EXACTS de ces blocs et on les exécute
 *     tels quels dans une enveloppe minimale fournissant leurs variables libres
 *     (injAll/athIds/fmtFR, blessures). Aucune modification de production.
 *
 * Valeurs attendues écrites à la main (non circulaire). Aucun test existant retiré.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC = path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts');
const JS = stripTypeScriptTypes(fs.readFileSync(SRC, 'utf8'));

// --- extraction d'une fonction nommée (P0-B) ---
function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn introuvable : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
// --- extraction VERBATIM d'un bloc inline « decl + for(...) {...} » ---
function sliceDeclLoop(declRe) {
  const m = JS.match(declRe);
  if (!m) throw new Error('bloc introuvable : ' + declRe);
  const start = m.index;
  const forIdx = JS.indexOf('for', start);
  let i = JS.indexOf('{', forIdx), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(start, j);
}

const SRC_INJBYATH = sliceDeclLoop(/const\s+injByAth\s*=/);
const SRC_INJACTIVE = sliceDeclLoop(/let\s+injActive\s*=/);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext([
  extractFn('fmtFR'),
  extractFn('aggMatchsFoot'),
  // enveloppes minimales autour des OCTETS SOURCE réels (non modifiés)
  'function _mkInjByAth(injAll, athIds, fmtFR){\n' + SRC_INJBYATH + '\n return injByAth; }',
  'function _mkInjActive(blessures){\n' + SRC_INJACTIVE + '\n return injActive; }',
  'this.fmtFR=fmtFR; this.aggMatchsFoot=aggMatchsFoot; this._mkInjByAth=_mkInjByAth; this._mkInjActive=_mkInjActive;',
].join('\n'), sandbox);
const { fmtFR, aggMatchsFoot, _mkInjByAth, _mkInjActive } = sandbox;

let ok = 0, ko = 0; const fails = [];
const eq = (n, got, exp) => { const p = JSON.stringify(got) === JSON.stringify(exp); if (p) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };
const truthy = (n, c) => { c ? ok++ : (ko++, fails.push(n), console.log('  ❌ ' + n)); };

/* ===================== GARDE ANTI-REPRODUCTION ===========================
 * On exécute bien les OCTETS de production, pas une copie. */
truthy('garde: injByAth exécute le vrai filtre athIds.has', SRC_INJBYATH.indexOf('athIds.has') !== -1);
truthy('garde: injByAth exécute le vrai critère retour_progressif', SRC_INJBYATH.indexOf('retour_progressif') !== -1);
truthy('garde: injActive exécute le vrai critère indispo/retour_progressif', SRC_INJACTIVE.indexOf("=== 'indispo'") !== -1 && SRC_INJACTIVE.indexOf('break') !== -1);
truthy('garde: aggMatchsFoot est une fonction', typeof aggMatchsFoot === 'function');

/* ===================== temps_jeu (= match_stats.minutes) ================== */
console.log('=== temps_jeu (via vrai aggMatchsFoot ; prod : kpiFoot.temps_jeu = matchStats.minutes) ===');
const mk = (dateIso, cles) => ({ date: dateIso, dateIso, cles });
const tj = (seances) => aggMatchsFoot(seances).match_stats.minutes;
const nbM = (seances) => aggMatchsFoot(seances).match_stats.nb;

// Cas 1 — aucun match (aucune séance de type match)
eq('temps_jeu · aucun match → nb 0', nbM({ T: mk('2026-08-20', { type_seance: 'entrainement', charge_interne: '400' }) }), 0);
eq('temps_jeu · aucun match → 0', tj({ T: mk('2026-08-20', { type_seance: 'entrainement', charge_interne: '400' }) }), 0);
eq('temps_jeu · aucune séance du tout → 0', tj({}), 0);
truthy('temps_jeu · 0 est un NOMBRE (pas null/—)', tj({}) === 0 && typeof tj({}) === 'number');
// Cas 2 — 25 min
eq('temps_jeu · 25 min', tj({ A: mk('2026-08-20', { type_seance: 'match', minutes_jouees: '25' }) }), 25);
// Cas 3 — match complet 90
eq('temps_jeu · 90 min', tj({ A: mk('2026-08-20', { type_seance: 'match', minutes_jouees: '90' }) }), 90);
// Cas 4 — plusieurs matchs 90+70+45
eq('temps_jeu · 90+70+45 = 205', tj({
  A: mk('2026-08-20', { type_seance: 'match', minutes_jouees: '90' }),
  B: mk('2026-08-13', { type_seance: 'match', minutes_jouees: '70' }),
  C: mk('2026-08-06', { type_seance: 'match', minutes_jouees: '45' }),
}), 205);
// Cas 5 — match SANS minutes → 0 (comportement verrouillé tel quel)
eq('temps_jeu · match sans minutes → 0 (verrouillé)', tj({ A: mk('2026-08-20', { type_seance: 'match', buts: '1' }) }), 0);
truthy('temps_jeu · match sans minutes : nb=1 mais minutes 0', nbM({ A: mk('2026-08-20', { type_seance: 'match', buts: '1' }) }) === 1);
// Cas 6 — données partielles (90 + absent) → 90
eq('temps_jeu · partiel (90 + absent) → 90', tj({
  A: mk('2026-08-20', { type_seance: 'match', minutes_jouees: '90' }),
  B: mk('2026-08-13', { type_seance: 'match', buts: '1' }),
}), 90);

/* ===================== injByAth (équipe) ================================== */
console.log('=== injByAth (bloc source exécuté) : filtre statut actif + isolation athIds ===');
const athIds = new Set(['A', 'B', 'C', 'E']);   // effectif : A,B,C,E (pas D)
const injAll = [
  { athlete_id: 'A', statut: 'indispo', type: 'Élongation', localisation: 'ischio', retour_terrain: '2026-09-10', retour_competition: '2026-09-20' },
  { athlete_id: 'B', statut: 'retour_progressif', type: 'Entorse', localisation: 'cheville', retour_terrain: '', retour_competition: '' },
  { athlete_id: 'C', statut: 'retabli', type: 'Déchirure', localisation: 'mollet', retour_terrain: '', retour_competition: '' },   // terminée → exclue
  { athlete_id: 'D', statut: 'indispo', type: 'Fracture', localisation: 'main', retour_terrain: '', retour_competition: '' },       // hors effectif → exclue
  { athlete_id: 'A', statut: 'en_cours', type: 'Autre', localisation: 'dos', retour_terrain: '', retour_competition: '' },          // statut non actif → exclu
];
const injByAth = _mkInjByAth(injAll, athIds, fmtFR);
eq('injByAth : seuls A et B retenus (isolation + statut actif)', Object.keys(injByAth).sort(), ['A', 'B']);
eq('injByAth[A].statut = indispo', injByAth.A && injByAth.A.statut, 'indispo');
eq('injByAth[A].type = Élongation (données de A, pas de B)', injByAth.A && injByAth.A.type, 'Élongation');
eq('injByAth[A].localisation = ischio', injByAth.A && injByAth.A.localisation, 'ischio');
eq('injByAth[A].retour_terrain formaté FR', injByAth.A && injByAth.A.retour_terrain, '10/09/2026');
eq('injByAth[B].statut = retour_progressif', injByAth.B && injByAth.B.statut, 'retour_progressif');
eq('injByAth[B].type = Entorse (isolation vs A)', injByAth.B && injByAth.B.type, 'Entorse');
truthy('injByAth : C (rétabli) absent', !('C' in injByAth));
truthy('injByAth : D (hors effectif) absent malgré indispo', !('D' in injByAth));
truthy('injByAth : E (dans effectif, aucune blessure) absent', !('E' in injByAth));
// anti-reproduction : blessure hors-effectif placée EN PREMIER → toujours exclue
const injByAth2 = _mkInjByAth(
  [{ athlete_id: 'D', statut: 'indispo', type: 'X', localisation: '', retour_terrain: '', retour_competition: '' },
   { athlete_id: 'A', statut: 'indispo', type: 'Y', localisation: '', retour_terrain: '', retour_competition: '' }],
  new Set(['A']), fmtFR);
eq('injByAth : hors-effectif en 1er reste exclu', Object.keys(injByAth2), ['A']);

/* ===================== injActive (fiche) ================================== */
console.log('=== injActive (bloc source exécuté) : 1re blessure active, ordre NON trié (verrouillé) ===');
eq('injActive · aucune blessure → null', _mkInjActive([]), null);
const b = (id, statut) => ({ id, statut, type: 't' + id });
// Cas 2 — une active
eq('injActive · une active → sélectionnée', _mkInjActive([b(1, 'indispo')]).id, 1);
// Cas 3 — terminée + active → active
eq('injActive · [rétablie, active] → active', _mkInjActive([b(1, 'retabli'), b(2, 'retour_progressif')]).id, 2);
// Cas 4 — plusieurs actives → PREMIÈRE (ordre non trié, contrat verrouillé, NON corrigé)
eq('injActive · plusieurs actives → la 1re rencontrée (contrat P2-A)', _mkInjActive([b(1, 'indispo'), b(2, 'retour_progressif')]).id, 1);
// Cas 5 — mélange : terminée, indispo, retour_progressif, terminée → 1re active = indispo (id 2)
eq('injActive · mélange → 1re répondant au critère (indispo id 2)', _mkInjActive([b(1, 'retabli'), b(2, 'indispo'), b(3, 'retour_progressif'), b(4, 'retabli')]).id, 2);
// aucune active (que des statuts non retenus) → null
eq('injActive · aucune active (en_cours/retabli) → null', _mkInjActive([b(1, 'en_cours'), b(2, 'retabli')]), null);

/* ===================== Bilan ============================================= */
console.log('-'.repeat(78));
console.log('P2-B — value-tests blessures & temps_jeu : ' + ok + ' OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ temps_jeu, injByAth (isolation) et injActive (contrat) verrouillés sur le vrai code de production.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
