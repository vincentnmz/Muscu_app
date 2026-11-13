/* PROGRAMME — boutons « Lourd / moyen » et « Léger » (retour client 13/11/2026).
 * Avant : le bouton classait l'exercice mais les cases Reps de la ligne restaient à 8–12 (seule une mention
 * « appliqué : 6–12 (catégorie) » changeait). Après : la fourchette de la catégorie est écrite dans les cases Reps
 * de la ligne (6–12 ou 8–20), via la même fonction que la saisie manuelle (cdSauverLigne : bornes + sauvegarde).
 * Retirer la catégorie ne touche pas aux reps. Vraies fonctions de js/app.js, dépendances d'affichage simulées. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
function extract(name) {
  const m = SRC.match(new RegExp('function\\s+' + name + '\\s*\\(')); if (!m) throw new Error('fn introuvable : ' + name);
  let i = SRC.indexOf('{', m.index), d = 0, j = i;
  for (; j < SRC.length; j++) { const c = SRC[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return SRC.slice(m.index, j);
}
let ok = 0, ko = 0; const eq = (c, n, g) => { if (c) ok++; else { ko++; console.error('  ✗ ' + n + (g !== undefined ? ' (got ' + JSON.stringify(g) + ')' : '')); } };
const S = { cats: [], persist: [], toasts: [], cdExoOpen: {}, console };
vm.createContext(S);
const pre = (SRC.match(/var _EXO_CAT_R = \{[^}]*\};/) || [''])[0] + '\n' + (SRC.match(/var _PROG_BORNES = \{[\s\S]*?\};/) || [''])[0];
vm.runInContext(pre + '\n' + ['_numOk', '_progValide', '_progOrdreReps', 'cdSauverLigne', '_pbcCatClic'].map(extract).join('\n')
  + '\nvar cdProgrammeLignes = [];'
  + '\nfunction renderProgrammeCoach() {} function showToast(m) { toasts.push(m); }'
  + '\nfunction _cdPersistLigne(l) { persist.push(JSON.parse(JSON.stringify(l))); return Promise.resolve(); }'
  + '\nfunction _exoCatSet(nom, val) { cats.push([nom, val]); }'
  + '\nthis.setLignes = function (L) { cdProgrammeLignes = L; }; this._pbcCatClic = _pbcCatClic;', S);
const ligne = (o) => Object.assign({ row_index: 7, seance_id: 'Push', exercice: 'Élévation latérale', series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 90 }, o || {});
const reset = (L) => { S.cats.length = 0; S.persist.length = 0; S.toasts.length = 0; S.setLignes(L); };

{ const L = [ligne()]; reset(L); S._pbcCatClic(7, 'Push', 'Élévation latérale', 'petit');
  eq(S.cats.length === 1 && S.cats[0][1] === 'petit', 'Léger : catégorie enregistrée', S.cats);
  eq(L[0].reps_mini === 8 && L[0].reps_max === 20, 'Léger : cases Reps = 8–20', L[0]);
  eq(S.persist.length === 1 && S.persist[0].reps_max === 20, 'Léger : ligne sauvegardée avec 8–20', S.persist); }
{ const L = [ligne({ exercice: 'Squat' })]; reset(L); S._pbcCatClic(7, 'Push', 'Squat', 'moyen');
  eq(L[0].reps_mini === 6 && L[0].reps_max === 12 && S.persist.length === 1, 'Lourd / moyen : cases Reps = 6–12 et sauvegarde', L[0]); }
{ const L = [ligne({ reps_mini: 10, reps_max: 15 })]; reset(L); S._pbcCatClic(7, 'Push', 'Élévation latérale', 'moyen');
  eq(L[0].reps_mini === 6 && L[0].reps_max === 12, 'reps déjà modifiées (10–15) : remplacées par la fourchette choisie', L[0]); }
{ const L = [ligne({ reps_mini: 8, reps_max: 20 })]; reset(L); S._pbcCatClic(7, 'Push', 'Élévation latérale', '');
  eq(S.cats.length === 1 && S.cats[0][1] === '' && S.persist.length === 0 && L[0].reps_mini === 8 && L[0].reps_max === 20, 'retirer la catégorie : reps inchangées, rien de sauvegardé côté ligne', { L: L[0], p: S.persist }); }
{ const A = ligne(), B = ligne({ row_index: 8, reps_mini: 8, reps_max: 12 }); reset([A, B]); S._pbcCatClic(7, 'Push', 'Élévation latérale', 'petit');
  eq(A.reps_max === 20 && B.reps_max === 12, 'seule la ligne cliquée change (autre ligne du même exercice inchangée)', [A.reps_max, B.reps_max]); }
// Force · 1–5 (porteur 13/11) : remplit les reps de la ligne, ne touche PAS à la catégorie de l'exercice.
{ const L = [ligne({ exercice: 'Squat' })]; reset(L);
  const i = SRC.indexOf('Force · 1–5</button>'), btn = SRC.slice(SRC.lastIndexOf('<button', i), i);
  eq(/onclick="cdSauverLigne\(' \+ ri \+ ',\\'' \+ sj \+ '\\',null,null,1,5,null,null\)"/.test(btn) && !/_exoCatSet|_pbcCatClic/.test(btn), 'bouton Force : appelle cdSauverLigne(…, 1, 5) sans changer la catégorie', btn.slice(0, 200));
  vm.runInContext('cdSauverLigne(7, "Push", null, null, 1, 5, null, null)', S);
  eq(L[0].reps_mini === 1 && L[0].reps_max === 5 && S.persist.length === 1 && S.cats.length === 0, 'Force : cases Reps = 1–5, ligne sauvegardée, catégorie inchangée', { L: L[0], cats: S.cats }); }
{ const html = SRC.slice(SRC.indexOf('var catBtn = function (k, t)'), SRC.indexOf('var catBtn = function (k, t)') + 400);
  eq(/onclick="_pbcCatClic\(' \+ ri \+ ',/.test(html), 'la carte d\'exercice appelle _pbcCatClic avec la ligne'); }

console.log(`programme-categorie-reps : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);
