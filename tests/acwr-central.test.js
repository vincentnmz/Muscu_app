/* =============================================================================
 * PHASE 2B — Moteur ACWR CENTRAL (référence testée, non encore câblée en prod)
 *
 * Démontre AVANT toute suppression que la chaîne centrale
 *   calculerChargeSport → normaliserCharge → calculerACWR
 *   → fiabiliteACWR → interpreterACWR
 * reproduit les valeurs des implémentations actuelles ET produit la bonne
 * interprétation métier, pour muscu ET football, avec les gardes-fous validés
 * (historique < 28 j / reprise < 28 j → NON INTERPRÉTABLE, sans alerte négative).
 *
 * Aucune modification de index.ts / app.js : c'est un banc d'essai.
 * =========================================================================== */

// ---------- Utilitaires dates ----------
const DAY = 86400000;
const NOW = new Date('2026-08-28T00:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);
const isoDaysAgo = (n) => iso(new Date(NOW.getTime() - n * DAY));
function joursDepuis(isoStr, now = NOW) {
  if (!isoStr) return null;
  const dt = new Date(isoStr + 'T00:00:00Z');
  if (isNaN(dt.getTime())) return null;
  return Math.floor((now.getTime() - dt.getTime()) / DAY);
}

/* =============================================================================
 * A. calculerChargeSport(sport, rows, now)  — ADAPTATEUR PAR SPORT
 *    Seule brique qui connaît la donnée du sport. Sortie NORMALISÉE commune :
 *    { chargeParJour: {isoDate: number}, premiere: isoDate|null }.
 *    → Ajouter un sport = ajouter un case, RIEN d'autre à toucher en aval.
 * =========================================================================== */
function calculerChargeSport(sport, rows, now = NOW) {
  const chargeParJour = {};
  let premiere = null;
  const add = (d, v) => {
    if (!d || !(v > 0)) return;
    chargeParJour[d] = (chargeParJour[d] || 0) + v;
    if (!premiere || d < premiere) premiere = d;
  };
  switch (sport) {
    case 'muscu':
      // Charge musculation = TONNAGE (charge × reps), agrégé par jour.
      for (const r of rows) add(r.date, (Number(r.charge) || 0) * (Number(r.reps) || 0));
      break;
    case 'foot':
      // Charge football = charge_interne (sRPE-like) déjà calculée, table indicateurs.
      for (const r of rows) if (r.cle === 'charge_interne') add(r.date, Number(r.valeur) || 0);
      break;
    default:
      // Sports non développés : adaptateur à fournir plus tard. Par défaut, si les
      // lignes portent déjà une charge normalisée {date, charge}, on la prend telle
      // quelle ; sinon aucune charge (ACWR non interprétable, pas d'alerte).
      for (const r of rows) add(r.date, Number(r.charge) || 0);
  }
  return { chargeParJour, premiere };
}

/* B. normaliserCharge — ici identité (la sortie de A est déjà la série journalière
 *    exploitée par le moteur). Point d'extension si un sport livrait un autre format. */
function normaliserCharge(chargeSport) { return chargeSport; }

/* =============================================================================
 * C. calculerACWR(chargeParJour, now) — RATIO SEUL, aucune décision.
 *    Méthode « coupled » (Gabbett) : aiguë = Σ 7 j ; chronique = Σ 28 j / 4.
 *    Identique aux formules actuelles (t7 / (t28/4)). null si chronique nulle.
 * =========================================================================== */
function calculerACWR(chargeParJour, now = NOW) {
  let aigue = 0, somme28 = 0;
  for (let d = 0; d < 28; d++) {
    const v = chargeParJour[iso(new Date(now.getTime() - d * DAY))] || 0;
    somme28 += v;
    if (d < 7) aigue += v;
  }
  const chronique = somme28 / 4;
  return {
    aigue,
    chronique,
    ratio: chronique > 0 ? Math.round((aigue / chronique) * 100) / 100 : null,
    joursActifs28: Object.keys(chargeParJour).filter(k => joursDepuis(k, now) >= 0 && joursDepuis(k, now) < 28).length,
  };
}

/* =============================================================================
 * D-fiab. fiabiliteACWR(premiere, ctx, now, joursActifs28) — GARDE-FOU CENTRALISÉ.
 *    false si : < 28 j d'historique  OU  reprise vacances < 28 j (chronique trouée)
 *    OU  chronique trouée = trop peu de jours actifs sur 28 j (< ACWR_MIN_JOURS_ACTIFS_28).
 *    Critère de FIABILITÉ uniquement — jamais un signal négatif.
 * =========================================================================== */
const ACWR_MIN_JOURS_ACTIFS_28 = 6;   // décision métier : < 6 jours actifs/28 → non interprétable
function fiabiliteACWR(premiere, ctx, now, joursActifs28) {
  const histo = joursDepuis(premiere, now);
  if (histo == null || histo < 28) return false;
  if (joursActifs28 < ACWR_MIN_JOURS_ACTIFS_28) return false;
  if (ctx && ctx.etat === 'retour_vacances') {
    const rd = joursDepuis(ctx.date_debut, now);
    if (rd != null && rd >= 0 && rd < 28) return false;
  }
  return true;
}

/* =============================================================================
 * D. interpreterACWR(ratio, fiable) — CATÉGORIE, pas de couleur d'athlète.
 *    Seuils uniques : sous_charge < 0.8 ; normal [0.8 ; 1.3] ; vigilance ]1.3 ; 1.5] ;
 *    eleve > 1.5. Non fiable / ratio absent → non_interpretable.
 * =========================================================================== */
const SEUILS_ACWR = { BAS: 0.8, OPT_MAX: 1.3, HAUT: 1.5 };
function interpreterACWR(ratio, fiable) {
  if (!fiable || ratio == null) return 'non_interpretable';
  if (ratio > SEUILS_ACWR.HAUT) return 'eleve';
  if (ratio > SEUILS_ACWR.OPT_MAX) return 'vigilance';
  if (ratio < SEUILS_ACWR.BAS) return 'sous_charge';
  return 'normal';
}

/* Impact métier de la catégorie sur le moteur d'état (surchargeN / alerte) — pour
 * vérifier le point 9 : le moteur ACWR ne décide pas seul du rouge. */
function impactEtat(categorie) {
  switch (categorie) {
    case 'eleve':            return { surchargeN: 2, alerte: 'surcharge:haute', rougeSeul: false };
    case 'vigilance':        return { surchargeN: 1, alerte: 'charge:moyenne',  rougeSeul: false };
    case 'sous_charge':      return { surchargeN: 0, alerte: 'sous_charge:moyenne', rougeSeul: false };
    case 'normal':           return { surchargeN: 0, alerte: null, rougeSeul: false };
    default:                 return { surchargeN: 0, alerte: null, rougeSeul: false }; // non interprétable : AUCUNE alerte négative
  }
}

/* =============================================================================
 * ANCIENNES formules (copie fidèle) pour le COMPARATIF ancien/nouveau.
 * =========================================================================== */
// Backend computeACWR (muscu) + inline getSuivi* (foot) : t7 / (t28/4).
function ancienBackend(chargeParJour, now = NOW) {
  let t7 = 0, t28 = 0;
  for (let d = 0; d < 28; d++) {
    const v = chargeParJour[iso(new Date(now.getTime() - d * DAY))] || 0;
    t28 += v; if (d < 7) t7 += v;
  }
  if (!t28) return null;                       // inline renvoie null…
  return Math.round(t7 / (t28 / 4) * 100) / 100;
}
// Front computeACWR : moyennes glissantes + garde 28 j PROPRE (sans reprise).
function ancienFront(chargeParJour, premiere, now = NOW) {
  const histo = premiere ? joursDepuis(premiere, now) + 1 : null;
  if (histo == null) return null;
  if (histo < 28) return { insuffisant: true };
  let acute = 0, chronic = 0;
  for (let i = 0; i < 28; i++) {
    const v = chargeParJour[iso(new Date(now.getTime() - i * DAY))] || 0;
    chronic += v; if (i < 7) acute += v;
  }
  const chronicAvg = chronic / 28;
  if (chronicAvg < 1) return null;
  return { ratio: Math.round((acute / 7 / chronicAvg) * 100) / 100 };
}

/* =============================================================================
 * SCÉNARIOS — générateur de série journalière.
 *   load(daysAgo) → charge du jour. On construit muscu (tonnage) ET foot
 *   (charge_interne) à partir de la MÊME série pour prouver l'équivalence sport.
 * =========================================================================== */
function serie(loadFn, histoJours) {
  const rowsMuscu = [], rowsFoot = [];
  for (let d = histoJours; d >= 0; d--) {
    const L = loadFn(d);
    if (L > 0) {
      const date = isoDaysAgo(d);
      rowsMuscu.push({ date, charge: L / 10, reps: 10 }); // tonnage = charge×reps = L
      rowsFoot.push({ date, cle: 'charge_interne', valeur: L });
    }
  }
  return { rowsMuscu, rowsFoot };
}

const CASES = [
  { nom: '1. Historique normal',        histo: 45, load: () => 500,                         attendu: 'normal' },
  { nom: '2. Historique insuffisant',   histo: 12, load: () => 500,                         attendu: 'non_interpretable' },
  { nom: '3. Retour vacances (rep 40j)',histo: 70, load: (d) => d < 40 ? 480 : 0, ctx: { etat: 'retour_vacances', date_debut: isoDaysAgo(40) }, attendu: 'normal' },
  { nom: '4. Reprise récente (5 j)',    histo: 70, load: (d) => d < 5 ? 600 : 0,  ctx: { etat: 'retour_vacances', date_debut: isoDaysAgo(5) },  attendu: 'non_interpretable' },
  { nom: '5. Charge aiguë élevée',      histo: 45, load: (d) => d < 7 ? 1100 : 500,          attendu: 'eleve' },
  { nom: '6. Chronique haute, aiguë basse', histo: 45, load: (d) => d < 7 ? 250 : 600,       attendu: 'sous_charge' },
  // Rampe MAÎTRISÉE : l'ACWR couplé reste en zone sûre (message métier voulu —
  // seule une hausse BRUTALE, cas 5, déclenche vigilance/élevé).
  { nom: '7. Augmentation progressive', histo: 45, load: (d) => Math.round(700 - d * 6),      attendu: 'normal' },
  { nom: '8. Diminution progressive',   histo: 45, load: (d) => Math.round(200 + d * 6),      attendu: 'sous_charge' },
  { nom: '9. Absence de séance (7 j)',  histo: 45, load: (d) => d < 7 ? 0 : 500,             attendu: 'sous_charge' },
  { nom: '10. Jours sans données épars',histo: 45, load: (d) => (d % 3 === 0 ? 900 : 0),      attendu: 'normal' },
  // Cas limites : pic aigu calibré sur base 500 (ratio couplé = 4X / (X + 3·500)).
  { nom: 'L. Seuil bas = 0.80',   histo: 45, load: (d) => d < 7 ? 375 : 500, attendu: 'normal' },       // ratio 0.80 → PAS sous-charge
  { nom: 'L. Seuil opt = 1.30',   histo: 45, load: (d) => d < 7 ? 722 : 500, attendu: 'normal' },       // ratio 1.30 → PAS vigilance
  { nom: 'L. Seuil haut = 1.50',  histo: 45, load: (d) => d < 7 ? 900 : 500, attendu: 'vigilance' },    // ratio 1.50 → PAS élevé
  { nom: 'L. Juste au-dessus 1.51', histo: 45, load: (d) => d < 7 ? 910 : 500, attendu: 'eleve' },      // ratio 1.51 → élevé
  // Cas ajoutés Phase 2B (seuil jours actifs = 6) :
  { nom: '11. 5 jours actifs / 28',     histo: 60, load: (d) => ([0, 5, 10, 15, 20].includes(d) || d === 40) ? 900 : 0, attenduFiable: false, attendu: 'non_interpretable' },
  { nom: '12. 6 jours actifs / 28',     histo: 60, load: (d) => ([0, 5, 10, 15, 20, 25].includes(d) || d === 40) ? 900 : 0, attenduFiable: true }, // >= 6 → interprété
  { nom: '13. Reprise après blessure',  histo: 60, load: () => 500, ctx: { etat: 'retour_blessure' },  attendu: 'normal' }, // retour_blessure n'invalide PAS l'ACWR
  { nom: '14. Absence réelle de charge',histo: 60, load: (d) => d >= 28 ? 500 : 0,                     attendu: 'non_interpretable' }, // a chargé avant, plus rien sur 28 j
  { nom: '15. Données totalement absentes', histo: 0, load: () => 0,                                    attendu: 'non_interpretable' },
];

function run() {
  const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, n);
  console.log(pad('SCÉNARIO', 30), pad('ratio', 7), pad('fiable', 7), pad('catégorie', 17), pad('muscu=foot', 11), pad('=ancien', 8), 'attendu');
  console.log('-'.repeat(100));
  let ko = 0;
  for (const c of CASES) {
    const { rowsMuscu, rowsFoot } = serie(c.load, c.histo);
    // Chaîne centrale — MUSCU
    const cm = normaliserCharge(calculerChargeSport('muscu', rowsMuscu));
    const am = calculerACWR(cm.chargeParJour);
    const fm = fiabiliteACWR(cm.premiere, c.ctx, NOW, am.joursActifs28);
    const catM = interpreterACWR(am.ratio, fm);
    // Chaîne centrale — FOOT (même série)
    const cf = normaliserCharge(calculerChargeSport('foot', rowsFoot));
    const af = calculerACWR(cf.chargeParJour);
    const ff = fiabiliteACWR(cf.premiere, c.ctx, NOW, af.joursActifs28);
    const catF = interpreterACWR(af.ratio, ff);
    // Ancien backend (même série) + ancien front
    const ratAnc = ancienBackend(cm.chargeParJour);
    const anF = ancienFront(cm.chargeParJour, cm.premiere);

    const sportEgal = (am.ratio === af.ratio && catM === catF);
    // « = ancien » : le ratio central reproduit le ratio backend quand la chronique existe.
    const egalAncien = (am.ratio === ratAnc) || (am.ratio == null && ratAnc == null);
    const okAtt = c.attendu ? (catM === c.attendu) : true;
    const okFiable = (c.attenduFiable == null) ? true : (fm === c.attenduFiable);
    if (!okAtt || !okFiable || !sportEgal || !egalAncien) ko++;

    console.log(
      pad(c.nom, 30),
      pad(am.ratio == null ? '—' : am.ratio, 7),
      pad(fm ? 'oui' : 'NON', 7),
      pad(catM, 17),
      pad(sportEgal ? '✅' : '❌', 11),
      pad(egalAncien ? '✅' : '❌', 8),
      (c.attendu || (c.attenduFiable != null ? 'fiable=' + c.attenduFiable : '')) + ' ' + ((okAtt && okFiable) ? '✅' : '❌')
    );
  }
  console.log('-'.repeat(100));
  // Point 15 : aucune catégorie ACWR (même 'eleve') ne met l'athlète en rouge à elle seule.
  const rougeSeul = ['normal', 'vigilance', 'sous_charge', 'eleve', 'non_interpretable']
    .some(cat => impactEtat(cat).rougeSeul);
  // Point 16 : ACWR non interprétable → AUCUNE alerte (ni surcharge ni sous-charge).
  const nonInterpSansAlerte = impactEtat('non_interpretable').alerte === null
    && impactEtat('non_interpretable').surchargeN === 0;
  console.log('Point 15 — ACWR élevé seul ≠ rouge automatique :', rougeSeul ? '❌' : '✅');
  console.log('Point 16 — ACWR non interprétable → aucune alerte négative :', nonInterpSansAlerte ? '✅' : '❌');
  if (rougeSeul || !nonInterpSansAlerte) ko++;
  console.log(ko === 0 ? '✅ Tous les attendus + équivalences (sport & ancien) + points métier vérifiés.' : `❌ ${ko} vérification(s) en échec.`);
}
run();
