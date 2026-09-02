/* =============================================================================
 * P0-A — Test d'EXÉCUTION du moteur de décision central (evaluerEtatAthlete).
 *
 * OBJECTIF : ce test n'exécute plus une COPIE de la logique — il extrait et
 * exécute la VRAIE fonction de production `evaluerEtatAthlete` de
 * supabase/functions/handler/index.ts (types TS retirés, Node ≥ 22), puis
 * vérifie ses sorties sur des cas déterministes dont les valeurs attendues sont
 * établies À LA MAIN à partir des règles métier (non circulaire).
 *
 * La fonction est PURE (aucun accès Supabase/Deno/horloge externe) : elle ne lit
 * que son argument `EtatInput` + les constantes CORE_*. On l'extrait donc telle
 * quelle, sans modifier index.ts, sans dupliquer la logique.
 *
 * Oracle SECONDAIRE : l'ancienne reproduction historique est CONSERVÉE (renommée
 * `reproductionEtat`) uniquement comme détecteur de divergence — si le vrai
 * moteur et la reproduction divergent sur une fixture, le test le SIGNALE (STOP,
 * aucune correction automatique). L'oracle PRIMAIRE reste les littéraux attendus.
 * =========================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripTypeScriptTypes } = require('node:module');

const SRC_PATH = path.join(__dirname, '..', 'supabase', 'functions', 'handler', 'index.ts');
const JS = stripTypeScriptTypes(fs.readFileSync(SRC_PATH, 'utf8'));

// --- Extracteurs (mêmes méthodes que agregats-*.test.js, prouvées) -----------
function extractFn(name) {
  const m = JS.match(new RegExp('function\\s+' + name + '\\s*\\('));
  if (!m) throw new Error('fn de production introuvable dans index.ts : ' + name);
  let i = JS.indexOf('{', m.index), d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return JS.slice(m.index, j);
}
function extractObj(name) { // const X = { ... }
  const m = JS.match(new RegExp('const\\s+' + name + '\\s*=\\s*'));
  if (!m) throw new Error('const introuvable : ' + name);
  const i = JS.indexOf('{', m.index); let d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } }
  return 'const ' + name + ' = ' + JS.slice(i, j) + ';';
}
function extractArr(name) { // const X = [ ... ]
  const m = JS.match(new RegExp('const\\s+' + name + '\\s*=\\s*'));
  if (!m) throw new Error('const (array) introuvable : ' + name);
  const i = JS.indexOf('[', m.index); let d = 0, j = i;
  for (; j < JS.length; j++) { const c = JS[j]; if (c === '[') d++; else if (c === ']') { d--; if (d === 0) { j++; break; } } }
  return 'const ' + name + ' = ' + JS.slice(i, j) + ';';
}
function extractArrow(name) { // const X = (...) => expr   (une ligne)
  const m = JS.match(new RegExp('const\\s+' + name + '\\s*=\\s*[^\\n]+'));
  if (!m) throw new Error('arrow introuvable : ' + name);
  return m[0].replace(/;?\s*$/, ';');
}

// Le VRAI corps de evaluerEtatAthlete (chaîne extraite depuis index.ts) — sert
// aussi au garde anti-reproduction plus bas.
const SRC_EVAL = extractFn('evaluerEtatAthlete');

const bundle = [
  extractObj('CORE_SEUILS'),
  extractArr('CORE_NIVEAUX'),
  extractObj('CORE_FIABILITE'),
  extractObj('CORE_CONTEXTES'),
  extractArrow('clampNiv'),
  extractFn('effetsContexte'),
  extractFn('interpreterACWR'),
  SRC_EVAL,
].join('\n\n');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(bundle + '\nthis.evaluerEtatAthlete = evaluerEtatAthlete;\nthis.interpreterACWR = interpreterACWR;\nthis.effetsContexte = effetsContexte;', sandbox);
const evaluerEtatAthlete = sandbox.evaluerEtatAthlete;

/* ============================ ORACLE SECONDAIRE ============================ *
 * Reproduction historique (ex-« copie fidèle »). N'est PLUS le sujet du test :
 * elle sert uniquement de second oracle indépendant pour détecter une éventuelle
 * divergence avec le vrai moteur. Sortie volontairement réduite/comparable. */
function reproductionEtat(s) {
  const STA = ['vert', 'orange', 'rouge'];
  const NIV = ['Prêt', 'Vigilance', 'À surveiller'];
  const ctx = s.ctxEtat || 'saison_normale';
  const reposPrevu = ctx === 'deload' || ctx === 'retour_vacances' || ctx === 'retour_blessure';
  const acwrOk = s.acwr != null && s.acwrFiable !== false;
  const acwrForConf = acwrOk ? s.acwr : null;
  let confiance;
  if (s.q.wellnessN === 0 && !s.q.hasCharge) confiance = 'non_interpretable';
  else if (s.q.jours < 7 || s.q.wellnessN === 0) confiance = 'faible';
  else if (s.q.jours < 21 || s.q.wellnessN < 3 || acwrForConf == null) confiance = 'moyenne';
  else confiance = 'haute';
  let surchargeN = 0;
  if (acwrOk) {
    surchargeN = s.acwr > 1.5 ? 2 : s.acwr > 1.3 ? 1 : 0;
    if (ctx === 'deload') surchargeN = Math.max(0, surchargeN - 1);
    if (ctx === 'retour_vacances') surchargeN = Math.min(2, surchargeN + 1);
  }
  const doul = s.douleur ?? 0, fat = s.fatigue ?? 0, som = s.sommeil, courb = s.courbatures ?? 0;
  const chargeHaute = surchargeN >= 1, sommeilBas = som != null && som <= 2, fatigueHaute = fat >= 4;
  const douleurGene = doul >= 2, douleurForte = doul >= 3;
  const tags = [];
  if (s.seances7 === 0 && s.injStatut !== 'indispo' && !reposPrevu) tags.push('absence:h');
  if (surchargeN >= 2) tags.push('surcharge:h');
  else if (surchargeN === 1) tags.push('charge:m');
  else if (acwrOk && s.acwr < 0.8 && s.seances7 > 0 && !reposPrevu) tags.push('sous_charge:m');
  if (douleurForte) tags.push('douleur:h'); else if (douleurGene) tags.push('douleur:m');
  if (fatigueHaute) tags.push('fatigue:m');
  if (sommeilBas) tags.push('sommeil:m');
  const rbPts = surchargeN + (douleurForte ? 2 : douleurGene ? 1 : 0) + (fatigueHaute ? 1 : 0) + (courb >= 4 ? 1 : 0);
  let risqueBlessureN = rbPts >= 3 ? 2 : rbPts >= 1 ? 1 : 0;
  if (ctx === 'retour_blessure') risqueBlessureN = Math.min(2, risqueBlessureN + 1);
  const recArr = [];
  if (som != null) recArr.push(som / 5);
  if (s.fatigue != null) recArr.push((6 - fat) / 5);
  if (s.courbatures != null) recArr.push((6 - courb) / 5);
  const recScore = recArr.length ? (recArr.reduce((a, b) => a + b, 0) / recArr.length) * 100 : null;
  const recFaible = recScore != null && recScore < 45;
  const recFaibleConcordante = recFaible && (chargeHaute || douleurGene);
  let niveau;
  if (s.injStatut === 'indispo') niveau = 2;
  else {
    const haute = tags.some(a => a.endsWith(':h'));
    const combo = fatigueHaute && sommeilBas && chargeHaute;
    const bad = haute || risqueBlessureN === 2 || recFaibleConcordante || combo;
    const mid = tags.length > 0 || risqueBlessureN === 1 || recFaible || (recScore != null && recScore < 60) || s.injStatut === 'retour_progressif';
    niveau = bad ? 2 : mid ? 1 : 0;
  }
  if (ctx === 'retour_blessure' && niveau === 0) niveau = 1;
  if (confiance === 'non_interpretable') niveau = 0;
  return { niveau, statut: STA[niveau], dispo: NIV[niveau], confiance, acwrOk, recScore: recScore == null ? null : Math.round(recScore), tags: tags.slice().sort() };
}

/* ============================ GARDE ANTI-REPRODUCTION ====================== *
 * Prouve que la fonction exécutée est bien celle de production, pas une copie. */
let ok = 0, ko = 0; const fails = [];
const check = (n, cond, exp, got) => { if (cond) ok++; else { ko++; fails.push(n); console.log('  ❌ ' + n + ' — attendu ' + JSON.stringify(exp) + ', obtenu ' + JSON.stringify(got)); } };

// 1) le corps extrait doit contenir des marqueurs présents UNIQUEMENT dans le
//    vrai moteur (absents de la reproduction historique).
['donnees_utilisees', 'acwr_categorie', 'contexte_tag', 'signaux', 'effetsContexte'].forEach(tok =>
  check('garde: corps prod contient « ' + tok + ' »', SRC_EVAL.indexOf(tok) !== -1, true, false));
// 2) la sortie réelle porte des champs que la reproduction ne produit pas.
const probe = evaluerEtatAthlete({ acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } });
['disponibilite', 'surcharge', 'risque_blessure', 'donnees_utilisees', 'acwr_categorie', 'signaux', 'recup'].forEach(k =>
  check('garde: sortie prod porte « ' + k + ' »', Object.prototype.hasOwnProperty.call(probe, k), true, Object.keys(probe)));
check('garde: extraction depuis index.ts (SRC non vide)', SRC_EVAL.length > 300, true, SRC_EVAL.length);

/* ============================ CAS DÉTERMINISTES =========================== *
 * `exp` = valeurs attendues établies À LA MAIN depuis les règles (oracle
 * primaire, non circulaire). `tags` = alertes normalisées `type:severite[0]`. */
const T = (r) => r.alertes.map(a => a.type + ':' + a.severite[0]).sort();

const CAS = [
  // A. États principaux
  { nom: 'A1 favorable → vert', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', dispo: 'Prêt', surcharge: 'Faible', risque_blessure: 'Faible', recup: 'Excellent', confiance: 'haute', acwr_fiable: true, acwr_categorie: 'normal', reco: 'RAS — maintenir la charge actuelle.', tags: [] } },
  { nom: 'A2 fatigue seule → orange', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 4, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', dispo: 'Vigilance', surcharge: 'Faible', risque_blessure: 'Modéré', recup: 'Bon', confiance: 'haute', acwr_categorie: 'normal', reco: 'Vigilance — surveiller les sensations, ne pas surcharger.', tags: ['fatigue:m'] } },
  { nom: 'A3 surcharge haute → rouge', in: { acwr: 1.6, acwrFiable: true, seances7: 4, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', dispo: 'À surveiller', surcharge: 'Élevé', risque_blessure: 'Modéré', recup: 'Excellent', confiance: 'haute', acwr_categorie: 'eleve', reco: 'Charge aiguë élevée (ACWR 1.60) — réduire le volume 48 h.', tags: ['surcharge:h'] } },

  // B. Frontières ACWR (x<seuil, x=seuil, x>seuil) — seuils 1.3 / 1.5 / 0.8
  { nom: 'B1 ACWR = 1.30 (=optMax) → pas de charge', in: { acwr: 1.3, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', surcharge: 'Faible', acwr_categorie: 'normal', reco: 'RAS — maintenir la charge actuelle.', tags: [] } },
  { nom: 'B2 ACWR = 1.31 (>optMax) → charge', in: { acwr: 1.31, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', surcharge: 'Modéré', risque_blessure: 'Modéré', acwr_categorie: 'vigilance', tags: ['charge:m'] } },
  { nom: 'B3 ACWR = 1.50 (=haut) → charge (pas surcharge)', in: { acwr: 1.5, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', surcharge: 'Modéré', acwr_categorie: 'vigilance', tags: ['charge:m'] } },
  { nom: 'B4 ACWR = 1.51 (>haut) → surcharge', in: { acwr: 1.51, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', surcharge: 'Élevé', acwr_categorie: 'eleve', tags: ['surcharge:h'], reco: 'Charge aiguë élevée (ACWR 1.51) — réduire le volume 48 h.' } },
  { nom: 'B5 ACWR = 0.80 (=bas) → pas de sous-charge', in: { acwr: 0.8, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', acwr_categorie: 'normal', tags: [], reco: 'RAS — maintenir la charge actuelle.' } },
  { nom: 'B6 ACWR = 0.79 (<bas) + séances → sous-charge', in: { acwr: 0.79, acwrFiable: true, seances7: 2, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', surcharge: 'Faible', risque_blessure: 'Faible', acwr_categorie: 'sous_charge', tags: ['sous_charge:m'], reco: 'Vigilance — surveiller les sensations, ne pas surcharger.' } },

  // Frontières douleur (gene=2 / forte=3) et sommeil (bas=2)
  { nom: 'C1 douleur = 2 (=gene) → gêne', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 2, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', risque_blessure: 'Modéré', recup: 'Excellent', acwr_categorie: 'normal', tags: ['douleur:m'], reco: 'Gêne récente — surveiller, avis kiné si besoin.' } },
  { nom: 'C2 douleur = 3 (=forte) → rouge', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 3, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', risque_blessure: 'Modéré', acwr_categorie: 'normal', tags: ['douleur:h'], reco: 'Douleur signalée — évaluer avant de charger.' } },
  { nom: 'C3 sommeil = 2 (=bas) → orange', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 2, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', recup: 'Bon', risque_blessure: 'Faible', acwr_categorie: 'normal', tags: ['sommeil:m'], reco: 'Vigilance — surveiller les sensations, ne pas surcharger.' } },

  // C. Données manquantes
  { nom: 'D1 nouvel athlète (aucune donnée) → vert forcé, non interprétable', in: { acwr: null, acwrFiable: true, seances7: 0, douleur: null, fatigue: null, sommeil: null, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 0, wellnessN: 0, hasCharge: false } },
    exp: { niveau: 0, statut: 'vert', dispo: 'Prêt', surcharge: 'Faible', risque_blessure: 'Faible', recup: '—', confiance: 'non_interpretable', acwr_fiable: false, acwr_categorie: 'non_interpretable', reco: 'Données insuffisantes pour établir une tendance.', tags: ['absence:h'] } },
  { nom: 'D2 charge sans bien-être → confiance faible, vert', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: null, fatigue: null, sommeil: null, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 0, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', confiance: 'faible', recup: '—', acwr_fiable: true, acwr_categorie: 'normal', tags: [], reco: 'RAS — maintenir la charge actuelle.' } },

  // D. Fiabilité
  { nom: 'E1 ACWR non fiable (acwrFiable=false) → aucune alerte charge malgré 1.6', in: { acwr: 1.6, acwrFiable: false, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', surcharge: 'Faible', confiance: 'moyenne', acwr_fiable: false, acwr_categorie: 'non_interpretable', tags: [], reco: 'RAS — maintenir la charge actuelle.', recup: 'Excellent' } },
  { nom: 'E2 confiance faible (jours < 7)', in: { acwr: 1.0, acwrFiable: true, seances7: 2, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 5, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', confiance: 'faible', tags: [] } },
  { nom: 'E3 confiance moyenne (wellnessN < 3)', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 2, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', confiance: 'moyenne', tags: [] } },

  // E. Contexte
  { nom: 'F1 deload atténue surcharge (2→1)', in: { acwr: 1.6, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'deload', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', surcharge: 'Modéré', risque_blessure: 'Modéré', contexte_tag: 'deload', acwr_categorie: 'eleve', tags: ['charge:m'], reco: 'Vigilance — surveiller les sensations, ne pas surcharger.' } },
  { nom: 'F2 retour_vacances aggrave surcharge (1→2)', in: { acwr: 1.4, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'retour_vacances', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', surcharge: 'Élevé', contexte_tag: 'retour_vacances', acwr_categorie: 'vigilance', tags: ['surcharge:h'], reco: 'Charge aiguë élevée (ACWR 1.40) — réduire le volume 48 h.' } },
  { nom: 'F3 retour_blessure : niveauMin + risqueDelta', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'retour_blessure', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', risque_blessure: 'Modéré', contexte_tag: 'retour_blessure', tags: [], reco: 'Vigilance — surveiller les sensations, ne pas surcharger.' } },
  { nom: 'F4 intensification : neutre mais tagué', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'intensification', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', contexte_tag: 'intensification', tags: [], reco: 'RAS — maintenir la charge actuelle.' } },
  { nom: 'F5 deload supprime la sous-charge (reposPrevu)', in: { acwr: 0.5, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'deload', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 0, statut: 'vert', tags: [], contexte_tag: 'deload', acwr_categorie: 'sous_charge', reco: 'RAS — maintenir la charge actuelle.' } },

  // F. Disponibilité / blessure / recommandation
  { nom: 'G1 indisponible → rouge, absence supprimée', in: { acwr: 1.0, acwrFiable: true, seances7: 0, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: 'indispo', ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', dispo: 'À surveiller', tags: [], reco: 'Indisponible — poursuivre la réathlétisation.' } },
  { nom: 'G2 retour progressif → orange', in: { acwr: 1.0, acwrFiable: true, seances7: 2, douleur: 1, fatigue: 2, sommeil: 4, courbatures: null, injStatut: 'retour_progressif', ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', risque_blessure: 'Faible', tags: [], reco: 'Retour progressif — respecter la progressivité de charge.' } },

  // G. Récupération : faible ISOLÉE → orange ; faible + signal concordant → rouge
  { nom: 'H1 récup faible ISOLÉE → orange (pas rouge)', in: { acwr: 1.0, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 3, sommeil: 1, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', recup: 'Faible', risque_blessure: 'Faible', tags: ['sommeil:m'], reco: 'Récupération faible — vigilance, alléger si ça persiste.' } },
  { nom: 'H2 récup faible + charge concordante → rouge', in: { acwr: 1.4, acwrFiable: true, seances7: 3, douleur: 0, fatigue: 3, sommeil: 1, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 2, statut: 'rouge', recup: 'Faible', risque_blessure: 'Modéré', tags: ['charge:m', 'sommeil:m'], reco: 'Récupération faible + autre signal — alléger et surveiller de près.' } },

  // H. sous-charge active en saison normale
  { nom: 'I1 sous-charge active (ACWR 0.5, saison normale)', in: { acwr: 0.5, acwrFiable: true, seances7: 2, douleur: 0, fatigue: 2, sommeil: 4, courbatures: null, injStatut: null, ctxEtat: 'saison_normale', q: { jours: 60, wellnessN: 5, hasCharge: true } },
    exp: { niveau: 1, statut: 'orange', acwr_categorie: 'sous_charge', tags: ['sous_charge:m'], reco: 'Vigilance — surveiller les sensations, ne pas surcharger.' } },
];

// ── Exécution : VRAI moteur vs littéraux attendus (oracle primaire) ──────────
for (const c of CAS) {
  const r = evaluerEtatAthlete(c.in);        // ← CODE DE PRODUCTION RÉEL
  const e = c.exp;
  if ('niveau' in e)          check(c.nom + ' · niveau', r.niveau === e.niveau, e.niveau, r.niveau);
  if ('statut' in e)          check(c.nom + ' · statut', r.statut === e.statut, e.statut, r.statut);
  if ('dispo' in e)           check(c.nom + ' · disponibilite', r.disponibilite && r.disponibilite.niveau === e.dispo, e.dispo, r.disponibilite);
  if ('surcharge' in e)       check(c.nom + ' · surcharge', r.surcharge === e.surcharge, e.surcharge, r.surcharge);
  if ('risque_blessure' in e) check(c.nom + ' · risque_blessure', r.risque_blessure === e.risque_blessure, e.risque_blessure, r.risque_blessure);
  if ('recup' in e)           check(c.nom + ' · recup', r.recup === e.recup, e.recup, r.recup);
  if ('confiance' in e)       check(c.nom + ' · confiance', r.confiance === e.confiance, e.confiance, r.confiance);
  if ('acwr_fiable' in e)     check(c.nom + ' · acwr_fiable', r.acwr_fiable === e.acwr_fiable, e.acwr_fiable, r.acwr_fiable);
  if ('acwr_categorie' in e)  check(c.nom + ' · acwr_categorie', r.acwr_categorie === e.acwr_categorie, e.acwr_categorie, r.acwr_categorie);
  if ('contexte_tag' in e)    check(c.nom + ' · contexte_tag', r.contexte_tag === e.contexte_tag, e.contexte_tag, r.contexte_tag);
  if ('reco' in e)            check(c.nom + ' · reco', r.reco === e.reco, e.reco, r.reco);
  if ('tags' in e)            check(c.nom + ' · alertes', JSON.stringify(T(r)) === JSON.stringify(e.tags.slice().sort()), e.tags, T(r));
}

// ── Oracle SECONDAIRE : détecteur de divergence prod ↔ reproduction ─────────
// Compare des champs comparables. Toute divergence = signal (aucune correction).
let divergences = 0;
for (const c of CAS) {
  const r = evaluerEtatAthlete(c.in);
  const rep = reproductionEtat(c.in);
  const prodTags = T(r);
  const same = r.niveau === rep.niveau && r.statut === rep.statut
    && (r.disponibilite && r.disponibilite.niveau) === rep.dispo
    && r.confiance === rep.confiance && r.acwr_fiable === rep.acwrOk
    && JSON.stringify(prodTags) === JSON.stringify(rep.tags);
  if (!same) {
    divergences++;
    console.log('  🔴 DIVERGENCE prod↔reproduction sur « ' + c.nom + ' »');
    console.log('     prod :', JSON.stringify({ niveau: r.niveau, statut: r.statut, dispo: r.disponibilite && r.disponibilite.niveau, confiance: r.confiance, acwr_fiable: r.acwr_fiable, tags: prodTags }));
    console.log('     repro:', JSON.stringify({ niveau: rep.niveau, statut: rep.statut, dispo: rep.dispo, confiance: rep.confiance, acwr_fiable: rep.acwrOk, tags: rep.tags }));
  }
}
check('oracle secondaire : aucune divergence prod↔reproduction', divergences === 0, 0, divergences);

// ── Bilan ───────────────────────────────────────────────────────────────────
console.log('-'.repeat(78));
console.log('P0-A — moteur central exécuté depuis index.ts : ' + CAS.length + ' cas · ' + ok + ' vérifs OK / ' + ko + ' échec(s).');
if (ko === 0) console.log('✅ Le vrai evaluerEtatAthlete (production) est exécuté et conforme aux attendus.');
else { console.log('❌ Échecs : ' + fails.join(' | ')); process.exit(1); }
