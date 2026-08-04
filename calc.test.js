/* =============================================================================
 * Novalyz · Suite de tests des calculs
 * -----------------------------------------------------------------------------
 * Objectif : vérifier que les formules de l'app disent LA VÉRITÉ, en testant
 *   LE VRAI CODE (extrait de js/app.js, ou de index.html avant la refonte P0),
 *   pas une réécriture.
 *
 * Ce fichier NE MODIFIE RIEN dans l'app. Il extrait les fonctions pures
 * (moteur Novalyz, computeACWR, score du Bilan) et les confronte à des valeurs
 * calculées à la main. Un test rouge = un désaccord à investiguer.
 *
 * Lancement :  node tests/calc.test.js
 * =========================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Depuis la refonte P0, la logique vit dans js/app.js. Avant P0, elle était
// inline dans index.html. On lit js/app.js en priorité, puis on retombe sur
// index.html : le test reste vert des deux côtés de la migration.
// Chaque source peut être au même niveau (racine) ou un cran au-dessus (tests/).
function trouverSource() {
  const candidats = [
    path.join(__dirname, 'js', 'app.js'),            // calc.test.js à la racine (post-P0)
    path.join(__dirname, '..', 'js', 'app.js'),      // calc.test.js dans tests/  (post-P0)
    path.join(__dirname, 'index.html'),              // calc.test.js à la racine (pré-P0)
    path.join(__dirname, '..', 'index.html'),        // calc.test.js dans tests/  (pré-P0)
  ];
  for (const p of candidats) { if (fs.existsSync(p)) return p; }
  throw new Error('Source introuvable (js/app.js ou index.html, à côté ou un niveau au-dessus)');
}
const HTML = fs.readFileSync(trouverSource(), 'utf8');

// ---- Extraction du VRAI code depuis la source (js/app.js ou index.html) --------
function extractBetween(startMarker, endMarker, label) {
  const s = HTML.indexOf(startMarker);
  if (s === -1) throw new Error('Introuvable: ' + label + ' (début)');
  const e = HTML.indexOf(endMarker, s);
  if (e === -1) throw new Error('Introuvable: ' + label + ' (fin)');
  return HTML.slice(s, e + endMarker.length);
}

// 1) Le moteur Novalyz (IIFE UMD complète)
const engineCode = extractBetween(
  '(function (global) {',
  '})(typeof self !== \'undefined\' ? self : this);',
  'moteur Novalyz'
);

// 2) computeACWR (fonction pure)
const acwrCode = extractBetween(
  'function computeACWR(progressionParExo, volumeParJour) {',
  '\n}',
  'computeACWR'
);

// 3) WQ_DIMS + wqPositif (logique d'inversion fatigue/douleur du Bilan)
const wqDimsCode  = extractBetween('const WQ_DIMS = [', '];', 'WQ_DIMS');
const wqPositifCode = extractBetween('function wqPositif(dim, val) {', '\n}', 'wqPositif');

// 4) NovalyzContexte (module autonome, Phase 2) — extrait entre marqueurs dédiés
const contexteCode = extractBetween(
  '/* NOVALYZ_CONTEXTE_START',
  '/* NOVALYZ_CONTEXTE_END */',
  'module NovalyzContexte'
);

// ---- Sandbox d'exécution (pas de DOM) -----------------------------------------
const sandbox = {};
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.module = { exports: {} };
sandbox.console = console;
vm.createContext(sandbox);
vm.runInContext(engineCode, sandbox);
vm.runInContext(contexteCode, sandbox);
vm.runInContext(acwrCode + '\nthis.computeACWR = computeACWR;', sandbox);
vm.runInContext(wqDimsCode + '\n' + wqPositifCode + '\nthis.WQ_DIMS = WQ_DIMS; this.wqPositif = wqPositif;', sandbox);

const Engine = sandbox.NovalyzEngine;
const Ctx = sandbox.NovalyzContexte;
const computeACWR = sandbox.computeACWR;
const WQ_DIMS = sandbox.WQ_DIMS;
const wqPositif = sandbox.wqPositif;

// ---- Mini-framework d'assertions ----------------------------------------------
let pass = 0, fail = 0;
const fails = [];
function check(nom, cond, attendu, obtenu) {
  if (cond) { pass++; }
  else { fail++; fails.push({ nom, attendu, obtenu }); }
}
function eq(nom, obtenu, attendu) {
  check(nom, JSON.stringify(obtenu) === JSON.stringify(attendu), attendu, obtenu);
}
function approx(nom, obtenu, attendu, tol) {
  tol = tol || 0.001;
  check(nom, typeof obtenu === 'number' && Math.abs(obtenu - attendu) <= tol, attendu, obtenu);
}

// =============================================================================
// A) Score du Bilan — moyenne normalisée + inversion fatigue/douleur
// =============================================================================
// Barème : sommeil/energie/ressenti → 5 = bon ; fatigue/douleur → 5 = mauvais.
// wqPositif doit inverser fatigue & douleur (6 - n), pas les autres.
(function testBilan() {
  const parKey = {}; WQ_DIMS.forEach(d => parKey[d.key] = d);
  // Inversion correcte
  eq('wqPositif sommeil=4 (non inversé)', wqPositif(parKey.sommeil, 4), 4);
  eq('wqPositif fatigue=5 → 1 (inversé, 5=mauvais)', wqPositif(parKey.fatigue, 5), 1);
  eq('wqPositif fatigue=1 → 5 (inversé, 1=aucune)', wqPositif(parKey.fatigue, 1), 5);
  eq('wqPositif douleur=1 → 5 (inversé, aucune douleur=bon)', wqPositif(parKey.douleur, 1), 5);
  eq('wqPositif ressenti=3 (non inversé)', wqPositif(parKey.ressenti, 3), 3);
  eq('wqPositif absent → null', wqPositif(parKey.sommeil, ''), null);

  // Score global = (moyenne_positive - 1) / 4 * 100
  const score = (rep) => {
    const pos = WQ_DIMS.map(d => wqPositif(d, rep[d.key])).filter(v => v != null);
    const moy = pos.reduce((a, b) => a + b, 0) / pos.length;
    return Math.round((moy - 1) / 4 * 100);
  };
  // Tout au top : sommeil5 energie5 fatigue1 douleur1 ressenti5 → positifs tous 5 → 100
  approx('score parfait = 100', score({ sommeil:5, energie:5, fatigue:1, douleur:1, ressenti:5 }), 100);
  // Tout au pire : sommeil1 energie1 fatigue5 douleur5 ressenti1 → positifs tous 1 → 0
  approx('score pire = 0', score({ sommeil:1, energie:1, fatigue:5, douleur:5, ressenti:1 }), 0);
  // Cas réel Vincent : sommeil4 energie3 fatigue4(→2) douleur2(→4) ressenti3
  //   positifs = [4,3,2,4,3] moy=3.2 → (3.2-1)/4*100 = 55
  approx('score cas réel = 55', score({ sommeil:4, energie:3, fatigue:4, douleur:2, ressenti:3 }), 55);
})();

// =============================================================================
// B) computeACWR — charge aiguë 7j / chronique 28j
// =============================================================================
(function testACWR() {
  // Historique insuffisant (< 28 jours) → { insuffisant: true }
  const today = new Date(); today.setHours(0,0,0,0);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const jMoins = n => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };

  // Seulement 10 jours d'historique → insuffisant
  const court = {}; court[jMoins(0)] = 1000; court[jMoins(9)] = 1000;
  const rCourt = computeACWR({}, court);
  eq('ACWR historique court → insuffisant', rCourt && rCourt.insuffisant === true, true);

  // Charge constante sur 28 jours → ACWR ≈ 1.0
  const constant = {};
  for (let i = 0; i < 28; i++) constant[jMoins(i)] = 1000;
  const rConst = computeACWR({}, constant);
  check('ACWR charge constante ≈ 1.0', rConst && !rConst.insuffisant && Math.abs(rConst.ratio - 1) < 0.15, '≈1.0', rConst && rConst.ratio);

  // Pic récent : 28j à 500, mais 7 derniers jours à 2000 → ACWR > 1 (surcharge)
  const pic = {};
  for (let i = 0; i < 28; i++) pic[jMoins(i)] = (i < 7) ? 2000 : 500;
  const rPic = computeACWR({}, pic);
  check('ACWR pic récent → surcharge (>1.3)', rPic && !rPic.insuffisant && rPic.ratio > 1.3, '>1.3', rPic && rPic.ratio);

  // Aucune donnée → null (jamais une valeur inventée)
  eq('ACWR aucune donnée → null', computeACWR({}, {}), null);
})();

// =============================================================================
// C) Moteur Novalyz — priorité, null-safety, pas de faux positifs
// =============================================================================
(function testEngine() {
  check('Engine exposé', !!Engine && typeof Engine.analyser === 'function', 'fonction', typeof (Engine && Engine.analyser));

  // Données vides → aucune analyse inventée
  const vide = Engine.analyser({});
  check('Engine données vides → aucune analyse', Array.isArray(vide) && vide.length === 0, '[]', vide);

  // ACWR neutralisé : même un ACWR très élevé ne doit PLUS déclencher d'alerte
  const acwrHaut = Engine.analyser({ recent: { acwr: { valeur: 2.07 } } });
  const aTypeAcwr = (acwrHaut || []).some(a => /acwr/i.test(a.id) || /acwr/i.test(a.titre || ''));
  check('Engine ACWR désactivé → pas d\'alerte ACWR', !aTypeAcwr, 'aucune alerte ACWR', acwrHaut);

  // Sortie triée par priorité (critique avant info) quand plusieurs analyses
  const multi = Engine.analyser({
    recent: { derniere_seance: { rpe_moyen: 9 } },
    bien_etre: [{ fatigue: 5, douleur: 4 }],
    dashboard: { regularite: { seances_j7: 4 } }
  });
  if (Array.isArray(multi) && multi.length >= 2) {
    let trie = true;
    for (let i = 1; i < multi.length; i++) if ((multi[i-1].priorite || 0) < (multi[i].priorite || 0)) trie = false;
    check('Engine sortie triée par priorité décroissante', trie, 'triée', multi.map(a => a.priorite));
  }

  // Chaque analyse a la forme attendue
  const forme = (multi || []).every(a => a.type && a.titre && a.description);
  check('Engine analyses bien formées (type/titre/description)', forme, 'toutes OK', multi);
})();

// =============================================================================
// D) NovalyzContexte (Phase 2) — registre, résolution, politique, non-régression
// =============================================================================
(function testContexte() {
  check('Contexte exposé', !!Ctx && typeof Ctx.resoudre === 'function', 'fonction', typeof (Ctx && Ctx.resoudre));
  check('5 états essentiels présents',
    Ctx && ['saison_normale','deload','retour_vacances','retour_blessure','intensification'].every(k => Ctx.ETATS[k]),
    true, Ctx && Object.keys(Ctx.ETATS));

  // --- resoudre ---
  const rNorm = Ctx.resoudre({});
  eq('resoudre sans contexte → saison_normale', rNorm.etat, 'saison_normale');
  eq('saison_normale a une politique vide', JSON.stringify(rNorm.politique), '{}');

  const rDeload = Ctx.resoudre({ contexte: { etat: 'deload', date_debut: '2026-08-01', date_fin: '2026-08-07' } });
  eq('resoudre deload → etat deload', rDeload.etat, 'deload');
  eq('resoudre deload → mode decharge', rDeload.mode, 'decharge');
  eq('resoudre propage les dates', rDeload.date_fin, '2026-08-07');

  const rInconnu = Ctx.resoudre({ contexte: { etat: 'etat_bidon_xyz' } });
  eq('état inconnu → retombe sur saison_normale', rInconnu.etat, 'saison_normale');
  eq('état inconnu → drapeau inconnu=true', rInconnu.inconnu, true);

  // --- appliquer (neutralisation de signaux) ---
  const faitsIn = { valeurs: {}, signaux: { volumeFaible: true, forceBaisse: true, fatigueElevee: true } };
  const faitsOut = Ctx.appliquer(faitsIn, Ctx.ETATS.deload.politique);
  eq('appliquer deload neutralise volumeFaible', faitsOut.signaux.volumeFaible, null);
  eq('appliquer deload neutralise forceBaisse', faitsOut.signaux.forceBaisse, null);
  eq('appliquer NE touche PAS fatigueElevee', faitsOut.signaux.fatigueElevee, true);
  eq('appliquer ne mute pas l\'entrée (immuable)', faitsIn.signaux.volumeFaible, true);

  const faitsRepr = Ctx.appliquer({ signaux: {} }, Ctx.ETATS.retour_vacances.politique);
  eq('retour_vacances → comparaisons suspendues', faitsRepr.comparaisons_suspendues, true);

  // --- filtrerRegles ---
  const faux = [{ id: 'sous_entrainement', categorie: 'entraînement' }, { id: 'fatigue_generale', categorie: 'récupération' }, { id: 'surmenage', categorie: 'récupération' }];
  const gardees = Ctx.filtrerRegles(faux, Ctx.ETATS.deload.politique).map(r => r.id);
  check('deload suspend sous_entrainement + surmenage', !gardees.includes('sous_entrainement') && !gardees.includes('surmenage'), true, gardees);
  check('deload garde fatigue_generale', gardees.includes('fatigue_generale'), true, gardees);
  eq('saison_normale ne suspend aucune règle', Ctx.filtrerRegles(faux, {}).length, 3);

  // --- fusionnerSeuils ---
  const seuilsFus = Ctx.fusionnerSeuils(Engine.SEUILS, Ctx.ETATS.intensification.politique);
  eq('intensification surcharge fatigueElevee → 5', seuilsFus.fatigueElevee, 5);
  eq('fusionnerSeuils préserve les autres seuils', seuilsFus.sommeilFaible, Engine.SEUILS.sommeilFaible);
  eq('fusionnerSeuils ne mute pas SEUILS global', Engine.SEUILS.fatigueElevee, 4);

  // --- NON-RÉGRESSION MÉTIER : le vrai scénario "retour de vacances" ---
  // Progression en baisse + volume faible → le moteur crie "sous-entraînement"…
  const dataReprise = { dashboard: { progression: { en_progression: 0, en_baisse: 3 }, regularite: { seances_j7: 0, seances_prevues: 4 } } };
  const sansCtx = Engine.analyser(dataReprise);
  check('HORS contexte : sous_entrainement bien détecté',
    sansCtx.some(a => a.id === 'sous_entrainement'), true, sansCtx.map(a => a.id));

  // …mais en "retour_vacances" la couche contexte le supprime (double protection :
  // signal neutralisé ET règle suspendue).
  const pol = Ctx.resoudre({ contexte: { etat: 'retour_vacances' } }).politique;
  const faitsCtx = Ctx.appliquer(Engine.normaliser(dataReprise), pol);
  const reglesCtx = Ctx.filtrerRegles(Engine.REGLES, pol);
  const analysesCtx = reglesCtx.map(r => { try { const a = r.evaluer(faitsCtx); if (a) a.id = r.id; return a; } catch (e) { return null; } }).filter(Boolean);
  check('AVEC contexte retour_vacances : sous_entrainement supprimé',
    !analysesCtx.some(a => a.id === 'sous_entrainement'), true, analysesCtx.map(a => a.id));
})();

// ---- Rapport ------------------------------------------------------------------
console.log('\n=== Suite de tests Novalyz — calculs ===');
console.log(`✅ ${pass} réussis   ❌ ${fail} échecs\n`);
if (fail) {
  fails.forEach(f => {
    console.log('❌ ' + f.nom);
    console.log('   attendu : ' + JSON.stringify(f.attendu));
    console.log('   obtenu  : ' + JSON.stringify(f.obtenu));
  });
  process.exit(1);
} else {
  console.log('Tous les calculs testés disent la vérité. 🎯');
}
