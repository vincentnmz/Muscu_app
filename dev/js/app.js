
/* =============================================================================
 * Novalyz · Moteur d'analyse & de recommandation
 * -----------------------------------------------------------------------------
 * Rôle : INTERPRÉTER les données déjà calculées par l'application.
 *        Il ne recalcule JAMAIS une métrique, ne touche à aucune formule,
 *        à aucune base de données, à aucune interface.
 *
 * Utilisable identiquement côté Athlète et côté Coach (aucune duplication).
 *
 * Principe : architecture orientée règles.
 *   1. `normaliser(data)`  -> transforme des données brutes (structure app OU
 *                              objet plat) en un jeu de "faits" propre et stable.
 *   2. chaque règle est un objet indépendant { id, categorie, evaluer(faits) }.
 *   3. `analyser(data)`    -> exécute toutes les règles, agrège et TRIE par
 *                              priorité les analyses produites.
 *
 * Sortie : liste d'objets
 *   { id, type, priorite, niveau, categorie, titre, description, regle }
 *   - type      : 'success' | 'info' | 'warning' | 'critical'
 *   - priorite  : 'succes'  | 'info' | 'important' | 'critique'  (sert au tri)
 *   - niveau    : 'faible'  | 'moyen' | 'eleve'                  (intensité)
 *
 * Extensibilité : pour ajouter une règle, on pousse un objet dans REGLES.
 *                 Aucune autre partie du moteur n'a besoin d'être modifiée.
 * ========================================================================== */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  /* ---------------------------------------------------------------------------
   * SEUILS — tous les paramètres réglables sont centralisés ici.
   * (Modifier un seuil ne demande de toucher à rien d'autre.)
   * ------------------------------------------------------------------------- */
  var SEUILS = {
    // Bien-être : échelle 1..5. sommeil/energie/ressenti -> 5 = bon.
    //             fatigue/douleur -> 5 = mauvais (barème naturel).
    sommeilFaible: 2, sommeilBon: 4,
    energieFaible: 2, energieBonne: 4,
    fatigueElevee: 4, fatigueFaible: 2,
    douleurElevee: 3,
    ressentiDur: 2, ressentiFacile: 4,

    // ACWR
    acwrEleve: 1.5, acwrBas: 0.8, acwrOptMin: 0.8, acwrOptMax: 1.3,

    // Charge / volume (évolutions en %)
    tonnageHaussePct: 15, tonnageBaissePct: -15, chargeVarPct: 3,

    // Volume via nb de séances 7j
    seancesFaible: 1, seancesEleve: 5,

    // Poids (kg)
    poidsVar: 0.3,

    // Progression (nombre d'exercices en hausse / baisse)
    progExcellenteUp: 3, progExcellenteDownMax: 1
  };

  /* ---------------------------------------------------------------------------
   * Helpers de lecture tolérants
   * ------------------------------------------------------------------------- */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return isNaN(n) ? null : n;
  }
  // Renvoie la première valeur définie parmi les chemins fournis (fonctions).
  function premier() {
    for (var i = 0; i < arguments.length; i++) {
      try { var v = arguments[i](); if (v !== undefined && v !== null && v !== '') return v; }
      catch (e) { /* chemin absent : on continue */ }
    }
    return null;
  }
  // Signal booléen "sûr" : ne renvoie true/false que si la valeur existe, sinon null.
  function sig(valeur, predicat) {
    if (valeur === null || valeur === undefined) return null;
    return !!predicat(valeur);
  }
  // true seulement si TOUS les signaux valent exactement true (null/false -> pas de déclenchement).
  function tous() {
    for (var i = 0; i < arguments.length; i++) { if (arguments[i] !== true) return false; }
    return true;
  }
  // true si AU MOINS un signal vaut true.
  function auMoinsUn() {
    for (var i = 0; i < arguments.length; i++) { if (arguments[i] === true) return true; }
    return false;
  }

  /* ---------------------------------------------------------------------------
   * NORMALISATION  —  ★ CONTRAT D'ENTRÉE DU MOTEUR (point de branchement multisport)
   * Transforme `data` (structure getAppData OU objet plat) en "faits".
   * Chaque champ est nullable : une donnée absente => signal null => la règle
   * qui en dépend ne se déclenche pas (aucun faux positif).
   *
   * ─── CONTRAT (voir docs/moteur-analyse.md) ────────────────────────────────
   * Le moteur ne connaît AUCUN sport. Il ne lit que des indicateurs génériques.
   * Pour brancher un nouveau sport, on N'ÉCRIT PAS de nouveau moteur : on
   * fournit un `data` dont ces champs sont renseignés (le module fait la
   * traduction depuis ses mesures propres) :
   *
   *   Bien-être (universel)  : sommeil, energie, fatigue, douleur, ressenti  (1..5)
   *   Charge (universel)     : acwr, rpe7j
   *   Volume/Perf (par sport): tonnage7j/volumeSemaine, tonnageEvolPct,
   *                            charge28EvolPct   ← muscu remplit avec tonnage/1RM ;
   *                            foot remplirait avec distance/charge GPS
   *   Poids (universel)      : poids + évolution
   *   Disponibilité          : blessure/pause  → neutralise les règles d'assiduité
   *
   * Tant qu'un module remplit ces clés, les 13 REGLES fonctionnent sans
   * modification. C'est toute la mécanique de l'architecture multisport.
   * ------------------------------------------------------------------------- */
  function normaliser(data) {
    data = data || {};
    var be     = Array.isArray(data.bien_etre) ? (data.bien_etre[0] || {}) : (data.bienEtre || {});
    var dash   = data.dashboard  || {};
    var recent = data.recent     || {};
    var comp   = data.comparison || {};
    var hist   = data.historique || {};
    var glob   = data.global     || {};
    var poids  = Array.isArray(data.poids) ? data.poids : [];
    var prog   = dash.progression || data.progression || {};

    var r = {}; // valeurs numériques brutes

    // --- Bien-être ---
    r.sommeil  = num(premier(function(){return be.sommeil;},  function(){return data.sommeil;}));
    r.energie  = num(premier(function(){return be.energie;},  function(){return data.energie;}));
    r.fatigue  = num(premier(function(){return be.fatigue;},  function(){return data.fatigue;}));
    r.douleur  = num(premier(function(){return be.douleur;},  function(){return data.douleur;}));
    r.ressenti = num(premier(function(){return be.ressenti;}, function(){return data.ressenti;}));
    r.zone     = premier(function(){return be.zone;}, function(){return data.zoneDouleur;});

    // --- Charge / récupération ---
    r.acwr = num(premier(
      function(){return recent.acwr && recent.acwr.valeur;},
      function(){return dash.acwr;},
      function(){return data.acwr;}
    ));
    r.rpe7j = num(premier(
      function(){return recent.j7 && recent.j7.rpe_moyen;},
      function(){return data.rpe;}
    ));

    // --- Tonnage / volume ---
    r.tonnage7j = num(premier(
      function(){return dash.tonnage && dash.tonnage.j7;},
      function(){return recent.j7 && recent.j7.tonnage;},
      function(){return data.tonnage;}
    ));
    r.tonnageEvolPct = num(premier(
      function(){return dash.tonnage && dash.tonnage.evol_pct;},
      function(){return comp.j7_vs_j7prec && comp.j7_vs_j7prec.tonnage && comp.j7_vs_j7prec.tonnage.evol_pct;}
    ));
    r.charge28EvolPct = num(premier(
      function(){return comp.j28_vs_j28prec && comp.j28_vs_j28prec.charge && comp.j28_vs_j28prec.charge.evol_pct;},
      function(){return data.forceEvolPct;}
    ));
    r.volumeSemaine = premier(
      function(){return hist.volume_semaine;},
      function(){return data.volumeParMuscle;}
    ) || [];
    r.muscleRetard = premier(
      function(){return glob.muscle_retard;},
      function(){return dash.muscle_retard;}
    );

    // --- Progression ---
    r.progUp   = num(premier(function(){return prog.en_progression;}, function(){return data.progressionUp;}));
    r.progDown = num(premier(function(){return prog.en_baisse;},      function(){return data.progressionDown;}));

    // --- Régularité ---
    var reg = dash.regularite || data.regularite || {};
    r.seances7j     = num(premier(function(){return reg.seances_j7;}, function(){return recent.j7 && recent.j7.seances;}, function(){return reg.seances_semaine;}));
    r.seancesPrevues = num(function(){return reg.seances_prevues;}());

    // --- Poids ---
    r.poidsActuel = num(premier(function(){return poids[0] && poids[0].poids;}, function(){return data.poids;}));
    r.poidsEvol   = (poids.length >= 2) ? (num(poids[0].poids) - num(poids[1].poids)) : num(data.evolutionPoids);

    // --- Records ---
    r.recordsRecents = num(premier(function(){return glob.records_30j;}, function(){return dash.records_mois;}));
    r.totalSeances   = num(function(){return glob.total_seances;}());

    /* -----------------------------------------------------------------------
     * SIGNAUX qualitatifs (true / false / null) — le vocabulaire des règles.
     * --------------------------------------------------------------------- */
    var s = {};
    // Bien-être
    s.sommeilFaible  = sig(r.sommeil,  function(v){return v <= SEUILS.sommeilFaible;});
    s.sommeilBon     = sig(r.sommeil,  function(v){return v >= SEUILS.sommeilBon;});
    s.energieFaible  = sig(r.energie,  function(v){return v <= SEUILS.energieFaible;});
    s.energieBonne   = sig(r.energie,  function(v){return v >= SEUILS.energieBonne;});
    s.fatigueElevee  = sig(r.fatigue,  function(v){return v >= SEUILS.fatigueElevee;});
    s.fatigueFaible  = sig(r.fatigue,  function(v){return v <= SEUILS.fatigueFaible;});
    s.douleurElevee  = sig(r.douleur,  function(v){return v >= SEUILS.douleurElevee;});
    s.douleurAbsente = sig(r.douleur,  function(v){return v <= 1;});
    s.ressentiDur    = sig(r.ressenti, function(v){return v <= SEUILS.ressentiDur;});

    // ACWR — désactivé pour l'instant (peu fiable en muscu ; à réactiver pour un module Hyrox).
    // On neutralise les signaux pour qu'aucune règle ACWR ne se déclenche.
    s.acwrEleve   = null;
    s.acwrBas     = null;
    s.acwrOptimal = null;

    // Progression
    s.progressionHausse = (r.progUp != null && r.progDown != null) ? (r.progUp > r.progDown) : null;
    s.progressionBaisse = (r.progUp != null && r.progDown != null) ? (r.progDown > r.progUp) : null;
    s.progressionStable = (r.progUp != null && r.progDown != null) ? (r.progUp === r.progDown) : null;
    s.progressionExcellente = (r.progUp != null && r.progDown != null)
      ? (r.progUp >= SEUILS.progExcellenteUp && r.progDown <= SEUILS.progExcellenteDownMax) : null;

    // Volume (proxys robustes : nb de séances 7j + évolution du tonnage)
    var volFaibleSeances = sig(r.seances7j, function(v){return v <= SEUILS.seancesFaible;});
    var volEleveSeances  = sig(r.seances7j, function(v){return v >= SEUILS.seancesEleve;});
    var volFaibleTonnage = sig(r.tonnageEvolPct, function(v){return v <= SEUILS.tonnageBaissePct;});
    var volEleveTonnage  = sig(r.tonnageEvolPct, function(v){return v >= SEUILS.tonnageHaussePct;});
    s.volumeFaible = (volFaibleSeances === null && volFaibleTonnage === null) ? null : auMoinsUn(volFaibleSeances, volFaibleTonnage);
    s.volumeEleve  = (volEleveSeances  === null && volEleveTonnage  === null) ? null : auMoinsUn(volEleveSeances,  volEleveTonnage);

    // Force (proxy : évolution des charges sur 28j, sinon progression)
    s.forceBaisse = (r.charge28EvolPct != null) ? (r.charge28EvolPct < -SEUILS.chargeVarPct) : s.progressionBaisse;
    s.forceHausse = (r.charge28EvolPct != null) ? (r.charge28EvolPct >  SEUILS.chargeVarPct) : s.progressionHausse;

    // Poids
    s.poidsBaisse = sig(r.poidsEvol, function(v){return v < -SEUILS.poidsVar;});
    s.poidsHausse = sig(r.poidsEvol, function(v){return v >  SEUILS.poidsVar;});

    // Régularité
    s.regulariteExcellente = (r.seances7j != null && r.seancesPrevues) ? (r.seances7j >= r.seancesPrevues) : null;
    s.regulariteFaible     = (r.seances7j != null && r.seancesPrevues) ? (r.seances7j < r.seancesPrevues * 0.5) : sig(r.seances7j, function(v){return v === 0;});

    // Divers
    s.recordRecent = sig(r.recordsRecents, function(v){return v > 0;});

    return { valeurs: r, signaux: s };
  }

  /* ---------------------------------------------------------------------------
   * Fabrique d'analyse (uniformise la sortie + calcule le `type` depuis la priorité)
   * ------------------------------------------------------------------------- */
  var TYPE_PAR_PRIORITE = { critique: 'critical', important: 'warning', info: 'info', succes: 'success' };
  var RANG_PRIORITE     = { critique: 4, important: 3, info: 2, succes: 1 };

  function analyse(o) {
    return {
      type:        TYPE_PAR_PRIORITE[o.priorite] || 'info',
      priorite:    o.priorite,
      niveau:      o.niveau || 'moyen',
      categorie:   o.categorie,
      titre:       o.titre,
      description: o.description
    };
  }

  /* ---------------------------------------------------------------------------
   * RÈGLES — chacune est autonome. `evaluer(f)` renvoie une analyse ou null.
   * f = { valeurs, signaux }.  On ne lit que `f.signaux` (déjà seuillés).
   * Pour ajouter une règle : ajouter un objet ici. Rien d'autre à modifier.
   * ------------------------------------------------------------------------- */
  var REGLES = [
    {
      id: 'fatigue_generale', categorie: 'récupération',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.sommeilFaible, s.energieFaible, s.fatigueElevee)) return null;
        return analyse({ priorite: 'important', niveau: 'eleve', categorie: this.categorie,
          titre: 'Fatigue générale probable',
          description: 'Sommeil faible, énergie basse et fatigue musculaire élevée simultanément. Prévoir de la récupération avant de reprendre les charges lourdes.' });
      }
    },
    {
      id: 'surcharge_locale', categorie: 'blessure',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.douleurElevee, s.volumeEleve)) return null;
        var zone = f.valeurs.zone ? (' (' + f.valeurs.zone + ')') : '';
        return analyse({ priorite: 'important', niveau: 'eleve', categorie: this.categorie,
          titre: 'Surcharge locale probable',
          description: 'Douleur marquée' + zone + ' alors que le volume est en forte hausse. Réduire le volume sur cette zone et surveiller.' });
      }
    },
    {
      id: 'sous_entrainement', categorie: 'entraînement',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.progressionBaisse, s.volumeFaible)) return null;
        return analyse({ priorite: 'important', niveau: 'moyen', categorie: this.categorie,
          titre: 'Sous-entraînement probable',
          description: 'La progression baisse alors que le volume est faible. Le stimulus est probablement insuffisant : augmenter progressivement le volume.' });
      }
    },
    {
      id: 'surmenage', categorie: 'récupération',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.progressionBaisse, s.volumeEleve, s.fatigueElevee)) return null;
        return analyse({ priorite: 'critique', niveau: 'eleve', categorie: this.categorie,
          titre: 'Surmenage probable',
          description: 'Volume élevé + fatigue élevée + progression qui baisse : signes d\'accumulation. Envisager une semaine de décharge.' });
      }
    },
    {
      id: 'deficit_energetique', categorie: 'nutrition',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.poidsBaisse, s.forceBaisse)) return null;
        return analyse({ priorite: 'important', niveau: 'moyen', categorie: this.categorie,
          titre: 'Déficit énergétique probable',
          description: 'Le poids diminue et la force baisse en parallèle. Vérifier les apports caloriques et protéiques.' });
      }
    },
    {
      id: 'risque_blessure', categorie: 'blessure',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.acwrEleve, s.douleurElevee, s.fatigueElevee)) return null;
        return analyse({ priorite: 'critique', niveau: 'eleve', categorie: this.categorie,
          titre: 'Risque accru de blessure',
          description: 'Charge aiguë élevée (ACWR), douleur et fatigue combinées. Réduire fortement la charge sur les prochaines séances.' });
      }
    },
    {
      id: 'acwr_eleve_seul', categorie: 'charge',
      evaluer: function (f) {
        var s = f.signaux;
        // Ne se déclenche que si le risque combiné (règle ci-dessus) ne s'applique pas.
        if (s.acwrEleve !== true) return null;
        if (tous(s.douleurElevee, s.fatigueElevee)) return null;
        return analyse({ priorite: 'info', niveau: 'moyen', categorie: this.categorie,
          titre: 'Charge en hausse rapide',
          description: 'Le ratio charge aiguë / chronique (ACWR) est élevé. Progresser plus doucement pour laisser le corps s\'adapter.' });
      }
    },
    {
      id: 'bonne_adaptation', categorie: 'entraînement',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.progressionHausse, s.sommeilBon, s.fatigueFaible)) return null;
        return analyse({ priorite: 'succes', niveau: 'moyen', categorie: this.categorie,
          titre: 'Bonne adaptation à l\'entraînement',
          description: 'Progression en hausse, bon sommeil et fatigue faible : l\'athlète encaisse bien la charge actuelle.' });
      }
    },
    {
      id: 'tres_bonne_adherence', categorie: 'adhérence',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.regulariteExcellente, s.progressionExcellente)) return null;
        return analyse({ priorite: 'succes', niveau: 'eleve', categorie: this.categorie,
          titre: 'Très bonne adhérence au programme',
          description: 'Régularité et progression excellentes. Continuer sur cette dynamique.' });
      }
    },
    {
      id: 'marge_progression', categorie: 'entraînement',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.fatigueFaible, s.volumeFaible, s.progressionStable)) return null;
        return analyse({ priorite: 'info', niveau: 'faible', categorie: this.categorie,
          titre: 'Possibilité d\'augmenter la charge',
          description: 'Fatigue faible, volume faible et progression stable : il reste de la marge pour augmenter progressivement la charge.' });
      }
    },
    {
      id: 'recuperation_optimale', categorie: 'récupération',
      evaluer: function (f) {
        var s = f.signaux;
        if (!tous(s.fatigueFaible, s.sommeilBon, s.douleurAbsente)) return null;
        // Évite le doublon avec "bonne adaptation" (qui inclut la progression).
        if (s.progressionHausse === true) return null;
        return analyse({ priorite: 'succes', niveau: 'faible', categorie: this.categorie,
          titre: 'Bonne récupération',
          description: 'Les marqueurs de récupération (sommeil, fatigue, douleur) sont au vert.' });
      }
    },
    {
      id: 'douleur_signalee', categorie: 'blessure',
      evaluer: function (f) {
        var s = f.signaux;
        if (s.douleurElevee !== true) return null;
        // Si déjà couvert par surcharge locale / risque blessure, ne pas dupliquer.
        if (s.volumeEleve === true) return null;
        if (tous(s.acwrEleve, s.fatigueElevee)) return null;
        var zone = f.valeurs.zone ? (' · zone : ' + f.valeurs.zone) : '';
        return analyse({ priorite: 'important', niveau: 'moyen', categorie: this.categorie,
          titre: 'Douleur signalée',
          description: 'Une douleur significative a été déclarée' + zone + '. Adapter la charge et surveiller son évolution.' });
      }
    },
    {
      id: 'irregularite', categorie: 'adhérence',
      evaluer: function (f) {
        var s = f.signaux;
        if (s.regulariteFaible !== true) return null;
        return analyse({ priorite: 'info', niveau: 'moyen', categorie: this.categorie,
          titre: 'Régularité insuffisante',
          description: 'Le nombre de séances est en dessous de l\'objectif. Relancer l\'athlète pour maintenir la dynamique.' });
      }
    }
  ];

  /* ---------------------------------------------------------------------------
   * MOTEUR
   * ------------------------------------------------------------------------- */
  // Athlète en vacances/pause : aucune alerte. Reprend seul dès que la date du
  // jour dépasse la fin (fenêtre de dates, pas de flag manuel). Fait générique
  // « disponibilité » lu par le moteur (voir docs/moteur-analyse.md).
  function _enPauseData(data) {
    var p = data && data.pause;
    if (!p) return false;
    function toD(s) {
      var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = toD(p.debut), f = toD(p.fin);
    if (d && today < d) return false;   // vacances pas encore commencées
    if (f && today > f) return false;   // vacances terminées -> alertes reprennent
    return !!(d || f);
  }

  function analyser(data, options) {
    options = options || {};
    if (_enPauseData(data)) return [];   // en vacances : rien à signaler (mute total)

    /* --- Phase 3 : CONTEXTE DE PERFORMANCE -----------------------------------
     * Résolution lazy (le module NovalyzContexte est chargé après le moteur).
     * Absent → comportement d'origine strictement identique (non-régression).
     * saison_normale → politique vide → aucun effet. */
    var Ctx = global.NovalyzContexte || null;
    var ctx = Ctx ? Ctx.resoudre(data) : null;
    var politique = ctx ? ctx.politique : {};

    // 1) Seuils contextualisés (ex : intensification tolère une fatigue haute).
    //    On surcharge SEUILS le temps de la normalisation, puis on restaure.
    var faits;
    if (Ctx && politique.seuils) {
      var _seuilsOrig = SEUILS;
      try { SEUILS = Ctx.fusionnerSeuils(SEUILS, politique); faits = normaliser(data); }
      finally { SEUILS = _seuilsOrig; }
    } else {
      faits = normaliser(data);
    }

    // 2) Application de la politique : neutralise des signaux + filtre les règles.
    if (Ctx) faits = Ctx.appliquer(faits, politique);
    var regles = Ctx ? Ctx.filtrerRegles(REGLES, politique) : REGLES;
    var etatCourant = ctx ? ctx.etat : 'saison_normale';
    /* ---------------------------------------------------------------------- */

    var resultats = [];
    for (var i = 0; i < regles.length; i++) {
      var regle = regles[i];
      try {
        var res = regle.evaluer(faits);
        if (res) { res.id = regle.id; res.regle = regle.id; res.contexte = etatCourant; resultats.push(res); }
      } catch (e) {
        // Une règle qui échoue ne doit jamais casser le moteur.
        if (options.debug && global.console) global.console.warn('[NovalyzEngine] règle en échec:', regle.id, e);
      }
    }
    // Tri : priorité décroissante (critique -> succès), stable.
    resultats.sort(function (a, b) { return (RANG_PRIORITE[b.priorite] || 0) - (RANG_PRIORITE[a.priorite] || 0); });

    if (options.limite && resultats.length > options.limite) resultats = resultats.slice(0, options.limite);
    return resultats;
  }

  /* ---------------------------------------------------------------------------
   * API publique
   * ------------------------------------------------------------------------- */
  var NovalyzEngine = {
    version:    VERSION,
    analyser:   analyser,     // (data[, options]) -> [analyses triées]
    normaliser: normaliser,   // (data) -> { valeurs, signaux }  (utile pour debug/tests)
    REGLES:     REGLES,       // exposé pour extension / inspection
    SEUILS:     SEUILS        // seuils réglables à chaud
  };

  // UMD léger : navigateur (window / self / this) + CommonJS + Apps Script.
  global.NovalyzEngine = NovalyzEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = NovalyzEngine;

})(typeof self !== 'undefined' ? self : this);




/* NOVALYZ_CONTEXTE_START — Couche « Contexte de performance » (Phase 2)
 * =============================================================================
 * Novalyz · Contexte de performance — module NOYAU, sport-agnostique
 * -----------------------------------------------------------------------------
 * Répond à « POURQUOI » avant que le moteur interprète le « QUOI ».
 * Un athlète est, à une date donnée, dans un ÉTAT (deload, retour de vacances…).
 * Chaque état porte une POLITIQUE : un petit vocabulaire que le moteur applique
 * pour ne pas prendre une baisse VOULUE pour une régression.
 *
 * Ce module est AUTONOME : il ne branche rien. L'intégration au moteur se fait
 * en Phase 3 (2 insertions dans NovalyzEngine.analyser). Ici : le registre, la
 * résolution de l'état actif, et les transformations (neutraliser un signal,
 * suspendre une règle, fusionner un seuil).
 *
 * VOCABULAIRE DE POLITIQUE (volontairement réduit) :
 *   suspendre    : [id|categorie]  → ces règles ne s'évaluent pas
 *   neutraliser  : [signal]        → force le signal à null (cesse de compter)
 *   seuils       : {clé: valeur}   → surcharge un SEUILS (voir fusionnerSeuils)
 *   suspendre_comparaisons: bool   → coupe les comparaisons directes/historiques
 *   mode         : string          → étiquette pour l'UI (reprise, décharge…)
 *
 * Ajouter un état = ajouter une entrée dans ETATS. Rien d'autre à modifier.
 * ========================================================================== */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  // Registre déclaratif des états. `saison_normale` = défaut, politique VIDE
  // (le moteur se comporte alors exactement comme sans contexte : non-régression).
  var ETATS = {
    saison_normale: {
      libelle: 'Saison normale',
      politique: {}
    },
    deload: {
      libelle: 'Semaine de décharge',
      politique: {
        mode: 'decharge',
        // La baisse de volume/charge est VOULUE : elle cesse de compter comme négative.
        neutraliser: ['volumeFaible', 'forceBaisse', 'progressionBaisse'],
        suspendre:   ['sous_entrainement', 'surmenage']
      }
    },
    retour_vacances: {
      libelle: 'Retour de vacances',
      politique: {
        mode: 'reprise_progressive',
        duree_jours: 14,
        neutraliser: ['progressionBaisse', 'forceBaisse'],
        suspendre:   ['sous_entrainement', 'irregularite'],
        suspendre_comparaisons: true
      }
    },
    retour_blessure: {
      libelle: 'Retour de blessure',
      politique: {
        mode: 'reprise',
        neutraliser: ['progressionBaisse', 'forceBaisse', 'volumeFaible'],
        suspendre:   ['sous_entrainement', 'irregularite', 'surmenage'],
        suspendre_comparaisons: true
      }
    },
    intensification: {
      libelle: 'Phase d\'intensification',
      politique: {
        mode: 'intensification',
        // Fatigue élevée ATTENDUE : on ne la signale qu'au maximum de l'échelle.
        seuils: { fatigueElevee: 5 }
      }
    }
  };

  /* --- Résolution de l'état actif ------------------------------------------
   * Lit `data.contexte` (déjà résolu par le backend : l'état du jour, ou null).
   * Un état inconnu retombe proprement sur `saison_normale` (extensibilité sûre). */
  function resoudre(data) {
    var ctx = data && data.contexte;
    var cle = (ctx && ctx.etat) ? String(ctx.etat).trim() : 'saison_normale';
    var connu = Object.prototype.hasOwnProperty.call(ETATS, cle);
    var def = connu ? ETATS[cle] : ETATS.saison_normale;
    return {
      etat:           connu ? cle : 'saison_normale',
      libelle:        def.libelle || cle,
      politique:      def.politique || {},
      mode:           (def.politique && def.politique.mode) || null,
      date_debut:     ctx ? (ctx.date_debut || null) : null,
      date_fin:       ctx ? (ctx.date_fin || null) : null,
      jours_restants: (ctx && ctx.jours_restants != null) ? ctx.jours_restants : null,
      source:         ctx ? (ctx.source || null) : null,
      inconnu:        !connu && !!(ctx && ctx.etat)   // état posé mais non reconnu
    };
  }

  /* --- Application de la politique aux faits (signaux) ----------------------
   * Renvoie une COPIE des faits : neutralise les signaux demandés + pose le
   * drapeau `comparaisons_suspendues`. NE touche PAS aux seuils (voir fusionnerSeuils). */
  function appliquer(faits, politique) {
    politique = politique || {};
    faits = faits || {};
    var signaux = {}, src = faits.signaux || {};
    for (var k in src) { if (Object.prototype.hasOwnProperty.call(src, k)) signaux[k] = src[k]; }
    var neutraliser = politique.neutraliser || [];
    for (var i = 0; i < neutraliser.length; i++) signaux[neutraliser[i]] = null; // cesse de compter
    return {
      valeurs: faits.valeurs || {},
      signaux: signaux,
      comparaisons_suspendues: !!politique.suspendre_comparaisons
    };
  }

  /* --- Filtrage des règles suspendues --------------------------------------
   * `suspendre` peut viser un id de règle OU une catégorie. On garde tout ce
   * qui n'est pas explicitement suspendu. */
  function filtrerRegles(regles, politique) {
    regles = regles || [];
    politique = politique || {};
    var stop = politique.suspendre || [];
    if (!stop.length) return regles.slice();
    var set = {};
    for (var i = 0; i < stop.length; i++) set[String(stop[i])] = true;
    return regles.filter(function (r) { return !set[String(r.id)] && !set[String(r.categorie)]; });
  }

  /* --- Fusion des seuils ----------------------------------------------------
   * Renvoie une COPIE de `seuils` avec les surcharges de la politique appliquées.
   * Utilisé en Phase 3 pour alimenter normaliser() sans muter les SEUILS globaux. */
  function fusionnerSeuils(seuils, politique) {
    seuils = seuils || {};
    politique = politique || {};
    var out = {};
    for (var k in seuils) { if (Object.prototype.hasOwnProperty.call(seuils, k)) out[k] = seuils[k]; }
    var over = politique.seuils || {};
    for (var j in over) { if (Object.prototype.hasOwnProperty.call(over, j)) out[j] = over[j]; }
    return out;
  }

  // Liste des états (pour un futur sélecteur UI).
  function etatsDisponibles() {
    var out = [];
    for (var cle in ETATS) {
      if (!Object.prototype.hasOwnProperty.call(ETATS, cle)) continue;
      out.push({ cle: cle, libelle: ETATS[cle].libelle || cle, mode: (ETATS[cle].politique && ETATS[cle].politique.mode) || null });
    }
    return out;
  }

  var NovalyzContexte = {
    version:          VERSION,
    ETATS:            ETATS,
    resoudre:         resoudre,
    appliquer:        appliquer,
    filtrerRegles:    filtrerRegles,
    fusionnerSeuils:  fusionnerSeuils,
    etatsDisponibles: etatsDisponibles
  };

  global.NovalyzContexte = NovalyzContexte;
  if (typeof module !== 'undefined' && module.exports) module.exports = NovalyzContexte;

})(typeof self !== 'undefined' ? self : this);
/* NOVALYZ_CONTEXTE_END */




/* =============================================================================
 * CARTE DU CODE — index.html  (voir docs/architecture.md)
 * -----------------------------------------------------------------------------
 * Novalyz = NOYAU sport-agnostique + MODULES sport. La musculation est le
 * premier module. L'isolation est LOGIQUE (dans ce fichier unique), pas
 * physique : on déploie un seul index.html. Chaque section est étiquetée :
 *
 *   [NOYAU]        générique, ne connaît aucun sport  → réutilisable partout
 *   [MODULE MUSCU] spécifique musculation             → 1er module
 *   [MIXTE]        structure noyau + rendu muscu       → à scinder à terme
 *   [UI]           présentation / plateforme
 *
 * Plan du fichier :
 *   Bloc 1 (~1561) : [NOYAU] NovalyzEngine — moteur d'analyse (autonome)
 *   Bloc 2 (~1993) : logique app
 *       SESSION ............ [NOYAU]
 *       AUTH ............... [NOYAU]
 *       DEBUG .............. [UI]
 *       ESPACE COACH ....... [NOYAU]
 *       DETAIL ATHLETE ..... [MIXTE]
 *       TABLEAU RÉCAP ...... [MIXTE]
 *       PROGRAMME (CRUD) ... [MODULE MUSCU]
 *       CHAT COACH↔ATHLETE . [NOYAU]
 *       APP (athlète) ...... [MIXTE]
 *   Bloc 3 (~7728) : [MODULE MUSCU] Bilan PDF
 *
 * Contrat d'extension multisport : un module n'écrit PAS de nouveau moteur.
 * Il alimente NovalyzEngine.normaliser() avec des indicateurs génériques
 * (voir le contrat documenté au-dessus de la fonction normaliser, bloc 1).
 * ========================================================================== */
const SCRIPT_URL = "https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service";

/* =============================================================================
 * SPORTS (Phase 2/3) — registre des sports. Le sport est fourni par le backend
 * (hérité du coach). Chaque sport définit ses libellés d'affichage ; l'UI les
 * applique via [data-sport-label] (Phase 3). Défaut : 'muscu'.
 * Pour ajouter un sport : une entrée ici, rien d'autre à toucher (noyau neutre).
 * ========================================================================== */
const SPORTS = {
  muscu:      { cle: 'muscu',      nom: 'Musculation', athlete: 'Athlète', athletes: 'Athlètes', groupe: 'Groupe' },
  foot:       { cle: 'foot',       nom: 'Football',    athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Équipe' },
  hockey:     { cle: 'hockey',     nom: 'Hockey',      athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Équipe' },
  basket:     { cle: 'basket',     nom: 'Basketball',  athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Équipe' },
  hand:       { cle: 'hand',       nom: 'Handball',    athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Équipe' },
  rugby:      { cle: 'rugby',      nom: 'Rugby',       athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Équipe' },
  tennis:     { cle: 'tennis',     nom: 'Tennis',      athlete: 'Joueur',  athletes: 'Joueurs',  groupe: 'Groupe' },
  athletisme: { cle: 'athletisme', nom: 'Athlétisme',  athlete: 'Athlète', athletes: 'Athlètes', groupe: 'Groupe' },
  natation:   { cle: 'natation',   nom: 'Natation',    athlete: 'Nageur',  athletes: 'Nageurs',  groupe: 'Groupe' },
  combat:     { cle: 'combat',     nom: 'Sports de combat', athlete: 'Combattant', athletes: 'Combattants', groupe: 'Groupe' }
};
function sportConfig(cle) { return SPORTS[cle] || SPORTS.muscu; }
// Sport actif courant : athlète -> son sport ; sinon coach -> son sport ; sinon muscu.
function sportActif() {
  if (typeof dernierAppData !== 'undefined' && dernierAppData && dernierAppData.sport) return dernierAppData.sport;
  if (typeof coach !== 'undefined' && coach && coach.sport) return coach.sport;
  return 'muscu';
}
function libelleSport(champ) { return sportConfig(sportActif())[champ] || champ; }

// Phase 3 — applique les libellés du sport actif à tous les [data-sport-label].
// Chaque élément garde son texte muscu par défaut (secours si sport inconnu).
function appliquerLibellesSport() {
  try {
    document.querySelectorAll('[data-sport-label]').forEach(function(el) {
      var v = libelleSport(el.getAttribute('data-sport-label'));
      if (v) el.textContent = v;
    });
  } catch (e) {}
}

/* Tests physiques (catalogue générique, tous sports). sensHaut = "plus haut = mieux". */
const TESTS_CATALOG = [
  { cle:'vma',        nom:'VMA',           unite:'km/h', sensHaut:true },
  { cle:'sprint_10m', nom:'Sprint 10 m',   unite:'s',    sensHaut:false },
  { cle:'sprint_30m', nom:'Sprint 30 m',   unite:'s',    sensHaut:false },
  { cle:'cmj',        nom:'CMJ (détente)', unite:'cm',   sensHaut:true },
  { cle:'yoyo_test',  nom:'Yo-Yo Test',    unite:'m',    sensHaut:true },
  { cle:'squat_jump', nom:'Squat Jump',    unite:'cm',   sensHaut:true },
  { cle:'test_vitesse', nom:'Test de vitesse', unite:'km/h', sensHaut:true },
  { cle:'agilite_5_10_5', nom:'Agilité 5-10-5', unite:'s', sensHaut:false },
  { cle:'force_iso',  nom:'Force isométrique', unite:'kg', sensHaut:true },
  { cle:'force_max',  nom:'Force maximale', unite:'kg',  sensHaut:true },
  { cle:'1rm',        nom:'1RM',           unite:'kg',   sensHaut:true }
];
function testInfo(cle) {
  for (var i = 0; i < TESTS_CATALOG.length; i++) if (TESTS_CATALOG[i].cle === cle) return TESTS_CATALOG[i];
  return { cle: cle, nom: cle, unite: '', sensHaut: true };
}

// Helper icône SVG (famille unique, style Lucide) pour les contenus générés en JS
function ic(name, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '"><use href="#i-' + name + '"/></svg>'; }

// ==================== HELPERS DE COMPOSANTS (charte .nv-*) ====================
// Générateurs UNIQUES pilotés par css/components.css. Remplacent les fabriques
// inline dupliquées (kpi/gpsTile/heroPill/chip…). Un seul point de vérité par
// composant → restyler = éditer les tokens/classes, pas chasser du HTML inline.
// nvStat(num, label, {size:'sm'|'lg', tone:'accent'|'good'|'warn'|'danger'|'on-accent',
//                     tile:bool, color:'<css>', class:'…', wrapStyle:'…'})
function nvStat(num, label, opts) {
  opts = opts || {};
  var cls = 'nv-stat';
  if (opts.size)  cls += ' nv-stat--' + opts.size;
  if (opts.tone)  cls += ' nv-stat--' + opts.tone;
  if (opts.tile)  cls += ' nv-stat--tile';
  if (opts.class) cls += ' ' + opts.class;
  var ns = opts.color ? ' style="color:' + opts.color + '"' : '';
  var ws = opts.wrapStyle ? ' style="' + opts.wrapStyle + '"' : '';
  return '<div class="' + cls + '"' + ws + '>'
       + '<div class="nv-stat-num"' + ns + '>' + num + '</div>'
       + '<div class="nv-stat-label">' + label + '</div></div>';
}
// nvChip(text, {tone:'good'|'warn'|'danger'|'info'|'accent', cat:'run'|'bike'|…, sm:bool, class:'…'})
function nvChip(text, opts) {
  opts = opts || {};
  var cls = 'nv-chip';
  if (opts.tone) cls += ' nv-chip--' + opts.tone;
  if (opts.cat)  cls += ' nv-chip--cat nv-chip--' + opts.cat;
  if (opts.sm)   cls += ' nv-chip--sm';
  if (opts.class) cls += ' ' + opts.class;
  return '<span class="' + cls + '">' + text + '</span>';
}
// nvLabel(text, {sm:bool, accent:bool, style:'…'})
function nvLabel(text, opts) {
  opts = opts || {};
  var cls = 'nv-label';
  if (opts.sm)     cls += ' nv-label--sm';
  if (opts.accent) cls += ' nv-label--accent';
  return '<div class="' + cls + '"' + (opts.style ? ' style="' + opts.style + '"' : '') + '>' + text + '</div>';
}
// Mappe une couleur de statut (hex) sur un ton sémantique de la charte, pour que
// les pastilles/statuts passent par les tokens au lieu d'une couleur en dur.
function _toneFromColor(c) {
  c = String(c || '').toLowerCase();
  if (/e5484d|dc3545|ef4444|d93a3f|ff4444|dc2626/.test(c)) return 'danger';
  if (/f5a623|f59f00|e07800|eab308|f97316|ff9500/.test(c)) return 'warn';
  if (/22c55e|00a854|00c96e|16a34a|10b981/.test(c))        return 'good';
  return 'accent';
}

// Échappe le HTML des contenus fournis par l'utilisateur (anti-XSS) avant injection via innerHTML.
function escapeHtml(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const MAPPING_SEANCE = {
  'Full body':             null,
  'Upper':                 ['Pectoraux', 'Dos', 'Epaule', 'Biceps', 'Triceps', 'Abdominaux'],
  'Push':                  ['Pectoraux', 'Epaule', 'Triceps', 'Abdominaux'],
  'Pull':                  ['Dos', 'Biceps', 'Abdominaux'],
  'Jambes compléte':       ['Jambe', 'Quadriceps', 'Ischio', 'Fessier', 'Aducteur', 'Mollets', 'Abdominaux'],
  'Jambes Quadriceps':     ['Quadriceps', 'Jambe', 'Aducteur', 'Mollets', 'Abdominaux'],
  'Jambes Ischio-fessier': ['Ischio', 'Fessier', 'Aducteur', 'Mollets', 'Abdominaux'],
  'Dos Bras':              ['Dos', 'Biceps', 'Triceps', 'Abdominaux'],
  'Dos Epaule':            ['Dos', 'Epaule', 'Abdominaux'],
  'Pec Bras':              ['Pectoraux', 'Biceps', 'Triceps', 'Abdominaux'],
  'Pec Epaule':            ['Pectoraux', 'Epaule', 'Abdominaux'],
};

let athlete = null;
let seance = [];
let exoEnCours = null;
let serieNum = 1;
let exercicesData = [];
let programmeSeance = [];
let lastPerfData = {};
function couleurGroupe(g) { const c = ['#f59f00','#a855f7','#ec4899','#14b8a6']; let h=0; for (let i=0;i<g.length;i++) h=(h*31+g.charCodeAt(i))%c.length; return c[h]; }

// Date locale du jour au format YYYY-MM-DD. À utiliser pour toute date « aujourd'hui »
// par défaut : toISOString() renvoie l'heure UTC, donc entre minuit et 2h (heure d'été
// FR) il donne encore la veille → séances datées d'un jour en arrière.
function _todayLocalStr() {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
}

function normaliserNomExo(s) {
  return String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function getPerf(nom) {
  if (lastPerfData[nom]) return lastPerfData[nom];
  const cible = normaliserNomExo(nom);
  const cle = Object.keys(lastPerfData).find(k => normaliserNomExo(k) === cible);
  return cle ? lastPerfData[cle] : null;
}

function getNiveauExperience(annees) {
  const a = Number(annees) || 0;
  if (a <= 3) return 'debutant';
  if (a <= 7) return 'intermediaire';
  if (a <= 12) return 'avance';
  return 'expert';
}
let indexExoProgramme = 0;
let historiqueData = [];

// ==================== SESSION ==================== [NOYAU]
window.addEventListener('load', async () => {
  // Pré-chauffe Apps Script dès le chargement de la page : réduit le cold start au login.
  fetch(SCRIPT_URL + '?action=ping').catch(() => {});

  // Applique le thème enregistré dès le chargement (login inclus) — évite le retour en dark au refresh
  if (localStorage.getItem('muscu_theme') === 'light') document.body.classList.add('light-mode');
  // Service worker : rend l'app disponible hors-ligne (salles de sport sans réseau)
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
    // Clic sur une notif alors que l'app est déjà ouverte → le SW nous demande
    // de relire la cible déposée dans le cache.
    try {
      navigator.serviceWorker.addEventListener('message', function (e) {
        var d = e.data || {};
        if (d.type === 'novalyz-notif-check') _checkNotifCache();
      });
    } catch (e) {}
  }
  // iOS relance/ramène l'app au premier plan sans forcément recharger la page :
  // on revérifie la cible à chaque retour au premier plan.
  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) _checkNotifCache();
    });
  } catch (e) {}
  // Retour d'autorisation Google Health (?code=…) → échange les jetons.
  try { _traiterRetourGoogleHealth(); } catch (e) {}
  // Clic sur une notif alors que l'app était fermée : cible passée en ?notif=…
  // (Android/desktop) ou déposée dans un cache par le SW (iOS, params ignorés).
  try {
    var _nq = new URLSearchParams(location.search).get('notif');
    if (_nq) {
      _notifPending = _nq;
      if (history.replaceState) history.replaceState(null, '', location.pathname);
    }
  } catch (e) {}
  _checkNotifCache();
  // Synchronise les séances enregistrées hors-ligne, si connexion revenue
  if (typeof flushSeancesOffline === 'function') { try { flushSeancesOffline(); } catch (e) {} }
  const savedCoach = localStorage.getItem('muscu_coach');
  if (savedCoach) {
    try {
      coach = JSON.parse(savedCoach);
      await ouvrirEspaceCoach();
      return;
    } catch(e) { localStorage.removeItem('muscu_coach'); }
  }
  const saved = localStorage.getItem('muscu_athlete');
  if (saved) {
    try {
      athlete = JSON.parse(saved);
      await ouvrirApp();
    } catch(e) { localStorage.removeItem('muscu_athlete'); }
  }
});

// ==================== AUTH ==================== [NOYAU]
// Affiche / masque un champ mot de passe (bouton œil).
function togglePwd(id, btn) {
  var el = document.getElementById(id); if (!el) return;
  var reveal = el.type === 'password';
  el.type = reveal ? 'text' : 'password';
  if (btn) { btn.textContent = reveal ? '🙈' : '👁'; btn.setAttribute('aria-label', reveal ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); }
}

async function seConnecter() {
  const login = document.getElementById('inp-login').value.trim();
  const password = document.getElementById('inp-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!login) { errEl.textContent = 'Entre ton login.'; return; }
  if (!password) { errEl.textContent = 'Entre ton mot de passe.'; return; }
  errEl.textContent = 'Connexion...';
  try {
    // Identifiants dans le CORPS (POST), plus dans l'URL. text/plain = requête simple (pas de préflight CORS).
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', login, password })
    });
    const data = await res.json();
    if (data.success) {
      athlete = data.athlete;
      localStorage.setItem('muscu_athlete', JSON.stringify(athlete));
      ouvrirApp();
    } else { errEl.textContent = data.error || 'Login ou mot de passe incorrect.'; }
  } catch(e) { errEl.textContent = 'Erreur de connexion.'; }
}

async function sInscrire() {
  const prenom = document.getElementById('reg-prenom').value.trim();
  const taille = document.getElementById('reg-taille').value.trim();
  const login = document.getElementById('reg-login').value.trim();
  const sportSel = document.getElementById('reg-sport');
  const sport = sportSel ? sportSel.value : 'muscu';
  // "Années de pratique" n'est demandé qu'en muscu (surcharge progressive). Sinon 0.
  const annees = (sport === 'muscu') ? document.getElementById('reg-annees').value.trim() : '0';
  const ddn = document.getElementById('reg-ddn').value;
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';
  if (!prenom || !login || !ddn || !taille) { errEl.textContent = 'Remplis tous les champs.'; return; }
  if (sport === 'muscu' && annees === '') { errEl.textContent = 'Indique tes années de pratique.'; return; }
  if (login.length !== 4 || isNaN(login)) { errEl.textContent = 'Le login doit être 4 chiffres.'; return; }
  if (!password || password.length < 6) { errEl.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
  if (!document.getElementById('reg-consent').checked) { errEl.textContent = 'Tu dois accepter la politique de confidentialité.'; return; }
  errEl.textContent = 'Création...';
  try {
    // Inscription en POST (données + mot de passe dans le corps, pas dans l'URL)
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'register', login, prenom, ddn, taille, annees, password, sport })
    });
    const data = await res.json();
    if (data.success) {
      athlete = data.athlete;
      localStorage.setItem('muscu_athlete', JSON.stringify(athlete));
      showToast('✅ Bienvenue ' + prenom + ' !');
      ouvrirApp();
    } else { errEl.textContent = data.message || 'Ce login est déjà utilisé.'; }
  } catch(e) { errEl.textContent = 'Erreur. Réessaie.'; }
}

function arreterChronoEtReinitSeance() {
  if (typeof timerInterval !== 'undefined' && timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  const ov = document.getElementById('timer-overlay');
  if (ov) ov.classList.remove('active');
  seance = []; exoEnCours = null; serieNum = 1; programmeSeance = [];
  ['card-exo-actuel','card-liste-seance','card-hors-programme','recap-block','seance-progress'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  const sb = document.getElementById('saisie-block'); if (sb) sb.style.display = 'block';
  const sel = document.getElementById('sel-seance-id'); if (sel) sel.value = '';
  const bv = document.getElementById('btn-valider'); if (bv) bv.style.display = 'none';
}

// ==================== DEBUG ==================== [UI]
async function debugChargerDonnees() {
  const out = document.getElementById('debug-output');
  const panel = document.getElementById('debug-panel');
  if (!out) return;
  const id = athlete ? athlete.athlete_id : null;
  if (!id) { out.textContent = 'Aucun athlète connecté.'; if (panel) panel.style.display = 'block'; return; }
  out.textContent = 'Chargement…';
  if (panel) panel.style.display = 'block';
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(id)}&nocache=${Date.now()}`);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch(e) { out.textContent = 'Erreur : ' + e.message; }
}
function debugCopier() {
  const out = document.getElementById('debug-output');
  if (!out) return;
  navigator.clipboard.writeText(out.textContent).then(() => alert('JSON copié !')).catch(() => alert('Copie manuelle nécessaire'));
}

function debugCoachOuvrir() {
  const p = document.getElementById('debug-panel-coach');
  if (!p) return;
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
async function debugCoachCharger() {
  const out = document.getElementById('debug-coach-output');
  if (!out || !coachAthleteCourant) { if (out) out.textContent = 'Aucun athlète sélectionné.'; return; }
  out.textContent = 'Chargement…';
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(coachAthleteCourant.athlete_id)}&nocache=${Date.now()}`);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
  } catch(e) { out.textContent = 'Erreur : ' + e.message; }
}
function debugCoachCopier() {
  const out = document.getElementById('debug-coach-output');
  if (!out) return;
  navigator.clipboard.writeText(out.textContent).then(() => alert('JSON copié !')).catch(() => alert('Copie manuelle nécessaire'));
}

async function supprimerMonCompte() {
  if (!athlete || !athlete.athlete_id) return;
  if (!confirm('Supprimer définitivement ton compte et TOUTES tes données ? Cette action est irréversible.')) return;
  if (!confirm('Dernière confirmation : es-tu vraiment sûr ?')) return;
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'supprimerCompte', athlete_id: athlete.athlete_id })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('muscu_athlete');
      showToast('Compte supprimé.');
      setTimeout(() => location.reload(), 1200);
    } else {
      showToast('Erreur : ' + (data.error || 'suppression impossible'), 'var(--danger)');
    }
  } catch(e) { showToast('Erreur réseau.', 'var(--danger)'); }
}

// Ferme les overlays/modales et vide les cartes contexte (évite qu'ils restent
// affichés par-dessus l'écran de connexion au moment de la déconnexion).
function _fermerOverlaysEtContexte() {
  document.documentElement.classList.remove('fjd-open');   // libère le défilement de la page
  ['detail-joueur-overlay', 'modal-contexte'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['dash-contexte', 'cd-contexte'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.innerHTML = '';
  });
}

function seDeconnecter() {
  arreterChronoEtReinitSeance();
  _fermerOverlaysEtContexte();
  athlete = null;
  localStorage.removeItem('muscu_athlete');
  document.getElementById('view-login').classList.add('active');
  document.getElementById('view-app').classList.remove('active');
  document.getElementById('tabs-bar').style.display = 'none';
  document.body.classList.remove('has-bottom-nav');
  document.getElementById('btn-logout').style.display = 'none';
  document.getElementById('inp-login').value = '';
  document.getElementById('inp-password').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('reg-error').textContent = '';
  switchTab('accueil');
  // Après switchTab (qui écrit le libellé d'onglet « Accueil ») : on rétablit la
  // marque sur l'écran de connexion. Doit rester la DERNIÈRE écriture du titre.
  document.getElementById('header-nom').textContent = 'Novalyz';
}

// ==================== ESPACE COACH ==================== [NOYAU]
let coach = null;
let athletesCoach = [];

function toggleEspaceCoach(ev) {
  if (ev) ev.preventDefault();
  // Bascule vers la vue coach seule (on masque tout le bloc athlète)
  document.getElementById('auth-seg-athlete').style.display = 'none';
  document.getElementById('auth-login').style.display = 'none';
  document.getElementById('auth-signup').style.display = 'none';
  document.getElementById('lien-espace-coach-wrap').style.display = 'none';
  document.getElementById('card-login-coach').style.display = 'block';
}

function retourEspaceAthlete(ev) {
  if (ev) ev.preventDefault();
  document.getElementById('card-login-coach').style.display = 'none';
  document.getElementById('auth-seg-athlete').style.display = '';
  document.getElementById('lien-espace-coach-wrap').style.display = '';
  switchAuthMode('login'); // ré-affiche le bloc login athlète
}

async function seConnecterCoach() {
  const login = document.getElementById('inp-login-coach').value.trim();
  const password = document.getElementById('inp-password-coach').value;
  const errEl = document.getElementById('login-coach-error');
  errEl.textContent = '';
  if (!login) { errEl.textContent = 'Entre ton login coach.'; return; }
  if (!password) { errEl.textContent = 'Entre ton mot de passe.'; return; }
  errEl.textContent = 'Connexion...';
  try {
    // Identifiants dans le CORPS (POST), plus dans l'URL.
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'loginCoach', login, password })
    });
    const data = await res.json();
    if (data.success) {
      coach = data.coach;
      localStorage.setItem('muscu_coach', JSON.stringify(coach));
      localStorage.removeItem('muscu_coach_vue');
      ouvrirEspaceCoach();
    } else { errEl.textContent = data.error || 'Login ou mot de passe incorrect.'; }
  } catch(e) { errEl.textContent = 'Erreur de connexion.'; }
}

function ouvrirReglagesCoach() {
  const overlay = document.getElementById('coach-reglages-overlay');
  const drawer  = document.getElementById('coach-reglages-drawer');
  const nomEl   = document.getElementById('coach-reglages-nom');
  if (nomEl && coach) nomEl.textContent = coach.nom || 'Coach';
  // Sélecteur de sport : options depuis le registre SPORTS, valeur = sport du coach
  const sel = document.getElementById('coach-sport-select');
  if (sel) {
    sel.innerHTML = Object.keys(SPORTS).map(function(cle) {
      return `<option value="${cle}">${SPORTS[cle].nom}</option>`;
    }).join('');
    sel.value = (coach && coach.sport) ? coach.sport : 'muscu';
  }
  if (overlay) { overlay.style.display = 'block'; }
  if (drawer)  { drawer.style.display = 'block'; }
}

// Enregistre le sport choisi (backend col E) puis rafraîchit les libellés.
async function enregistrerSportCoach() {
  const sel = document.getElementById('coach-sport-select');
  if (!sel || !coach || !coach.coach_id) return;
  const nouveauSport = sel.value;
  const ancien = coach.sport;
  coach.sport = nouveauSport;                 // optimiste : l'UI réagit tout de suite
  appliquerLibellesSport();
  try { renderListeAthletesCoach(); } catch (e) {}
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveSportCoach', coach_id: coach.coach_id, sport: nouveauSport })
    });
    showToast('Sport mis à jour : ' + (SPORTS[nouveauSport] ? SPORTS[nouveauSport].nom : nouveauSport));
  } catch (e) {
    coach.sport = ancien;                     // rollback si échec réseau
    appliquerLibellesSport();
    showToast('Échec de la mise à jour du sport');
  }
}

function fermerReglagesCoach() {
  document.getElementById('coach-reglages-overlay').style.display = 'none';
  document.getElementById('coach-reglages-drawer').style.display = 'none';
}

async function supprimerCompteCoach() {
  if (!coach || !coach.coach_id) return;
  if (!confirm('Supprimer définitivement votre compte coach ?\n\nVos athlètes seront déliés mais leurs données conservées. Cette action est irréversible.')) return;
  if (!confirm('Dernière confirmation : voulez-vous vraiment supprimer ce compte ?')) return;
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteCoach', coach_id: coach.coach_id })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Compte supprimé.');
      setTimeout(() => {
        coach = null;
        localStorage.removeItem('muscu_coach');
        localStorage.removeItem('muscu_coach_vue');
        document.body.classList.remove('coach-active');
        showView('view-landing');
      }, 1200);
    } else {
      showToast('Erreur : ' + (data.error || 'suppression échouée'), '#e5484d');
    }
  } catch (err) {
    showToast('Erreur réseau.', '#e5484d');
  }
}

function seDeconnecterCoach() {
  _fermerOverlaysEtContexte();
  coach = null;
  localStorage.removeItem('muscu_coach');
  localStorage.removeItem('muscu_coach_vue');
  document.body.classList.remove('coach-active');
  document.body.classList.remove('athlete-selected');
  document.getElementById('view-coach').classList.remove('active');
  document.getElementById('view-coach-detail').classList.remove('active');
  document.body.classList.remove('cd-nav');
  document.getElementById('view-login').classList.add('active');
  // Remettre l'écran de connexion à son état de base (vue athlète visible)
  document.getElementById('login-coach-error').textContent = '';
  document.getElementById('inp-login-coach').value = '';
  retourEspaceAthlete();
}

async function ouvrirEspaceCoach() {
  arreterChronoEtReinitSeance();
  document.body.classList.add('coach-active');
  document.getElementById('view-login').classList.remove('active');
  document.getElementById('view-coach').classList.add('active');
  document.body.classList.remove('has-bottom-nav');
  document.getElementById('tabs-bar').style.display = 'none';
  // Thème clair/sombre disponible aussi côté coach (bouton dans le header coach)
  const coachLight = localStorage.getItem('muscu_theme') === 'light';
  document.body.classList.toggle('light-mode', coachLight);
  syncThemeUI();
  document.getElementById('header-nom-coach').textContent = coach.nom;
  _setSportIco('ct-sport-ico-use', coach && coach.sport);   // icône du header selon le sport
  // Identité de rôle (couleur de header + pastille) — coach / prépa
  var _role = (coach && coach.role) || 'coach';
  document.body.dataset.role = _role;
  var _eb = document.getElementById('coach-header-eyebrow');
  if (_eb) _eb.textContent = _role === 'prepa' ? 'Espace prépa physique' : 'Espace coach';
  var _chip = document.getElementById('coach-role-chip');
  if (_chip) { _chip.textContent = _role === 'prepa' ? 'Prépa' : 'Coach'; _chip.style.display = 'inline-block'; }
  const listeEl = document.getElementById('liste-athletes-coach');
  listeEl.innerHTML = '<div class="loader">Chargement...</div>';
  await chargerAlertesTraitees();
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCoachAthletes&coach_id=${encodeURIComponent(coach.coach_id)}`);
    const data = await res.json();
    const athletes = data.athletes || [];
    if (athletes.length === 0) {
      document.getElementById('coach-home-body').style.display = 'none';
      const _ck = document.getElementById('prepa-cockpit');
      if (_ck) _ck.style.display = 'none';
      listeEl.style.display = '';
      listeEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px">Aucun athlète associé à ton compte. Utilise le bouton « Lier un athlète » en haut pour en ajouter.</div>';
      return;
    }
    athletesCoach = athletes;
    renderListeAthletesCoach(); // role-aware : prépa → cockpit, coach → accueil classique
    // Restaurer la fiche athlète consultée avant un rechargement
    try {
      const vue = JSON.parse(localStorage.getItem('muscu_coach_vue') || 'null');
      if (vue && vue.athlete_id) {
        const a = athletesCoach.find(x => String(x.athlete_id) === String(vue.athlete_id));
        if (a) { await ouvrirDetailAthleteCoach(a, vue.tab); }
      }
    } catch(e) {}
  } catch(e) {
    listeEl.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
  }
}

let lierModeActuel = 'lier';

function ouvrirModalLierAthlete() {
  document.getElementById('inp-lier-login').value = '';
  ['crea-prenom','crea-login','crea-taille','crea-ddn','crea-annees','crea-password'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('lier-error').textContent = '';
  switchLierMode('lier');
  document.getElementById('modal-lier-athlete').style.display = 'flex';
}

function fermerModalLierAthlete() {
  document.getElementById('modal-lier-athlete').style.display = 'none';
}

// Bascule entre "Lier un compte existant" et "Créer un nouveau compte".
function switchLierMode(mode) {
  lierModeActuel = mode;
  document.getElementById('lier-mode-lier').style.display  = (mode === 'lier')  ? 'block' : 'none';
  document.getElementById('lier-mode-creer').style.display = (mode === 'creer') ? 'block' : 'none';
  const tL = document.getElementById('lier-tab-lier'), tC = document.getElementById('lier-tab-creer');
  tL.style.background = mode === 'lier'  ? 'var(--accent)' : 'transparent';
  tL.style.color      = mode === 'lier'  ? 'var(--on-accent)' : 'var(--text-muted)';
  tC.style.background = mode === 'creer' ? 'var(--accent)' : 'transparent';
  tC.style.color      = mode === 'creer' ? 'var(--on-accent)' : 'var(--text-muted)';
  document.getElementById('lier-submit-btn').textContent = mode === 'creer' ? 'Créer' : 'Lier';
  document.getElementById('lier-error').textContent = '';
  // "Années de pratique" seulement si le sport du coach est la muscu (l'athlète en hérite).
  const anneesWrap = document.getElementById('crea-annees-wrap');
  const sportCoach = (coach && coach.sport) ? coach.sport : 'muscu';
  if (anneesWrap) anneesWrap.style.display = (sportCoach === 'muscu') ? '' : 'none';
}

// Dispatcher du bouton principal selon l'onglet actif.
function submitLierAthlete() {
  if (lierModeActuel === 'creer') creerAthlete();
  else lierAthlete();
}

// Le coach crée un athlète : compte rattaché direct, sport hérité du coach.
async function creerAthlete() {
  const errEl = document.getElementById('lier-error');
  errEl.textContent = '';
  const prenom = document.getElementById('crea-prenom').value.trim();
  const login  = document.getElementById('crea-login').value.trim();
  const taille = document.getElementById('crea-taille').value.trim();
  const ddn    = document.getElementById('crea-ddn').value;
  const password = document.getElementById('crea-password').value;
  const sportCoach = (coach && coach.sport) ? coach.sport : 'muscu';
  const annees = (sportCoach === 'muscu') ? document.getElementById('crea-annees').value.trim() : '0';
  if (!prenom || !login || !ddn || !taille) { errEl.textContent = 'Remplis tous les champs.'; return; }
  if (login.length !== 4 || isNaN(login)) { errEl.textContent = 'Le login doit être 4 chiffres.'; return; }
  if (!password || password.length < 6) { errEl.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
  if (sportCoach === 'muscu' && annees === '') { errEl.textContent = 'Indique les années de pratique.'; return; }
  errEl.textContent = 'Création...';
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'coachCreerAthlete', coach_id: coach.coach_id, prenom, login, ddn, taille, annees, password })
    });
    const data = await res.json();
    if (data.success) {
      fermerModalLierAthlete();
      await chargerAthletesCoach();
      showToast('✅ ' + prenom + ' créé et rattaché');
    } else {
      errEl.textContent = data.error || 'Création impossible.';
    }
  } catch(e) { errEl.textContent = 'Erreur de connexion.'; }
}

async function lierAthlete() {
  const loginAth = document.getElementById('inp-lier-login').value.trim();
  const errEl = document.getElementById('lier-error');
  errEl.textContent = '';
  if (!loginAth) { errEl.textContent = 'Entre le login de l\'athlète.'; return; }
  errEl.textContent = 'Liaison en cours...';
  try {
    const res = await fetch(`${SCRIPT_URL}?action=lierAthlete&login_athlete=${encodeURIComponent(loginAth)}&coach_id=${encodeURIComponent(coach.coach_id)}`);
    const data = await res.json();
    if (data.success) {
      fermerModalLierAthlete();
      await chargerAthletesCoach();
    } else {
      errEl.textContent = data.error || 'Athlète introuvable.';
    }
  } catch(e) { errEl.textContent = 'Erreur de connexion.'; }
}

function renderListeAthletesCoach() {
  document.getElementById('liste-athletes-coach').innerHTML = '';
  document.getElementById('coach-stat-total').textContent = athletesCoach.length;
  appliquerLibellesSport(); // Phase 3 : localise les libellés selon le sport du coach

  // Rôle prépa → accueil dédié (cockpit charge), quel que soit le sport.
  if ((coach && coach.role) === 'prepa') {
    const _lst = document.getElementById('liste-athletes-coach');
    if (_lst) _lst.style.display = 'none';
    document.getElementById('coach-home-body').style.display = 'none';
    majSelectAthletesCoach();
    renderCockpitPrepa();
    return;
  }
  const _ck = document.getElementById('prepa-cockpit');
  if (_ck) _ck.style.display = 'none';
  const _lst = document.getElementById('liste-athletes-coach');
  if (_lst) _lst.style.display = '';

  // Sport ≠ muscu → vue générique "Suivi équipe" (lit l'onglet Indicateurs).
  // Muscu → dashboard historique inchangé.
  if (coach && coach.sport && coach.sport !== 'muscu') {
    document.getElementById('coach-home-body').style.display = 'none';
    renderSuiviEquipe();
    majSelectAthletesCoach();
    return;
  }

  document.getElementById('coach-home-body').style.display = 'block';
  renderCoachSynthese(athletesCoach); // async : charge getAppData par athlète, remplit table + KPIs
  majSelectAthletesCoach();
}

// select caché (compatibilité navigation)
function majSelectAthletesCoach() {
  const sel = document.getElementById('coach-select-athlete');
  if (sel) {
    sel.innerHTML = '<option value="">—</option>' +
      athletesCoach.map((a, i) => `<option value="${i}">${a.nom}</option>`).join('');
    sel.value = '';
  }
}

// Détail d'un joueur (sports co) : ouvre l'overlay et charge getSuiviJoueur.
async function ouvrirDetailJoueurFoot(athlete_id, mode) {
  const ov = document.getElementById('detail-joueur-overlay');
  const body = document.getElementById('detail-joueur-body');
  body.innerHTML = '<div class="loader">Chargement…</div>';
  ov.style.display = 'flex';
  // Verrouille le défilement de la page du dessous (coach/prépa) tant que
  // l'overlay est ouvert : sinon deux ascenseurs (celui de l'overlay + celui de
  // la page derrière). L'overlay a sa propre zone qui défile (.fjd-scroll).
  document.documentElement.classList.add('fjd-open');
  cdJoueurCourant = athlete_id;
  cdMode = mode || 'coach';   // 'coach' (édition) ou 'athlete' (lecture seule, sa propre page)
  let d;
  try {
    const _ctrl = new AbortController();
    const _tSlow = setTimeout(() => showToast('Serveur en démarrage, quelques secondes…', 'var(--warn)'), 6000);
    const _tKill = setTimeout(() => _ctrl.abort(), 30000);
    const res = await fetch(`${SCRIPT_URL}?action=getSuiviJoueur&athlete_id=${encodeURIComponent(athlete_id)}`, { signal: _ctrl.signal });
    clearTimeout(_tSlow); clearTimeout(_tKill);
    d = await res.json();
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Délai dépassé (30 s). Rafraîchis la page.' : 'Erreur de chargement.';
    body.innerHTML = `<div style="color:var(--text-muted);padding:12px">${msg}</div>`;
    return;
  }

  cdJoueurNom = d.nom || 'Joueur';
  const COL = { rouge:'#e5484d', orange:'#f5a623' };
  const acwr = d.acwr;
  const acwrCol = (acwr!=null && acwr>1.5) ? COL.rouge : (acwr!=null && acwr>1.3) ? COL.orange : 'var(--good)';
  const kpi = (v,l,c)=>nvStat(v, l, { color:(c||''), wrapStyle:'flex:1' });
  const wLast = (d.wellness||[]).slice(-1)[0] || {};
  const seances = d.seances || [];
  const ligneSeance = s=>`
    <tr>
      <td style="padding:6px 8px;">${s.date}</td>
      <td style="padding:6px 8px;">${s.type==='match'?'Match':'Entraîn.'}</td>
      <td style="padding:6px 8px;text-align:right;">${s.duree??'—'}</td>
      <td style="padding:6px 8px;text-align:right;">${s.rpe??'—'}</td>
      <td style="padding:6px 8px;text-align:right;">${s.charge??'—'}</td>
      <td style="padding:6px 8px;text-align:right;">${s.distance_hi??'—'}</td>
    </tr>`;
  const rows = seances.map(ligneSeance).join('');
  const matchs = seances.filter(s=>s.type==='match');
  const matchRows = matchs.map(ligneSeance).join('');

  // Disponibilité dérivée (même logique que le suivi équipe — pas de fabrication)
  const dispo = (d.moteur && d.moteur.disponibilite) ? {t:d.moteur.disponibilite.niveau, c:d.moteur.disponibilite.couleur}
              : (acwr!=null && acwr>1.5) ? {t:'À risque',c:COL.rouge}
              : (acwr!=null && acwr>1.3) ? {t:'Vigilance',c:COL.orange}
              : {t:'Disponible',c:'#22c55e'};
  const initiales = ((d.nom||'?').trim().split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2) || '?').toUpperCase();

  const dl = (k,v)=>`<div class="djt-dl"><span>${k}</span><b>${v}</b></div>`;
  const aVenir = '<span style="color:var(--text-muted);font-weight:600;">à renseigner</span>';
  const soon = txt=>`<div class="dash-card" style="padding:16px;color:var(--text-muted);font-size:12.5px;line-height:1.55;margin-bottom:12px;">${txt}</div>`;
  const tblSeances = html=>`
    <div class="dash-card" style="padding:6px;overflow-x:auto;margin-bottom:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="color:var(--text-muted);text-align:left;">
          <th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Type</th>
          <th style="padding:6px 8px;text-align:right;">Durée</th><th style="padding:6px 8px;text-align:right;">RPE</th>
          <th style="padding:6px 8px;text-align:right;">Charge</th><th style="padding:6px 8px;text-align:right;">Dist.HI</th>
        </tr></thead><tbody>${html}</tbody>
      </table>
    </div>`;

  // Stats de match (backend enrichi) — fallback gracieux si la démo n'est pas encore reseedée
  const msAgg = d.match_stats || null;
  const matchsRich = Array.isArray(d.matchs) ? d.matchs : [];
  const noteCol = n => n==null ? 'var(--text-muted)' : (n>=7 ? '#22c55e' : (n>=6 ? '#f5a623' : '#e5484d'));
  const richMatchRows = matchsRich.map(m=>`
    <div style="display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--border);">
      <span style="min-width:40px;text-align:center;font-weight:800;font-size:13px;padding:4px 6px;border-radius:8px;color:${noteCol(m.note)};background:${noteCol(m.note)}1a;">${m.note!=null?m.note:'—'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;">${m.date}</div>
        <div style="font-size:11px;color:var(--text-muted);">${m.minutes!=null?m.minutes+"'":'—'}${m.buts?' · '+m.buts+' but'+(m.buts>1?'s':''):''}${m.passes_d?' · '+m.passes_d+' passe'+(m.passes_d>1?'s':'')+' déc.':''}</div>
      </div>
      ${(m.xg!=null||m.xa!=null)?`<div style="text-align:right;font-size:10px;color:var(--text-muted);line-height:1.4;">xG ${m.xg!=null?m.xg:'—'}<br>xA ${m.xa!=null?m.xa:'—'}</div>`:''}
    </div>`).join('');
  // Stats par poste (catalogue §6) : bloc de stats + axes radar propres à chaque poste
  const POSTE_STATS = {
    'Attaquant': { head:{cle:'buts',l:'Buts',type:'total'}, stats:[
      {cle:'buts',l:'Buts (saison)',type:'total',max:8,col:'var(--accent)'},
      {cle:'xg',l:'xG (saison)',type:'total1',max:6,col:'var(--violet)'},
      {cle:'xa',l:'xA (saison)',type:'total1',max:5,col:'#22d3ee'},
      {cle:'tirs',l:'Tirs / match',type:'moy',max:6,col:'var(--warn)'},
      {cle:'tirs_cadres',l:'Tirs cadrés / match',type:'moy',max:4,col:'#22c55e'},
      {cle:'passes_cles',l:'Passes clés / match',type:'moy',max:4,col:'var(--accent)'},
      {cle:'centres_reussis',l:'Centres réussis / match',type:'moy',max:3,col:'#22d3ee'}
    ], radar:[['buts','Buts',8,'total',3],['tirs','Tirs',6,'moy',3],['tirs_cadres','Cadrés',4,'moy',1.6],['passes_cles','P. clés',4,'moy',1.8],['xa','xA',5,'total',2]] },
    'Milieu': { head:{cle:'passes_progressives',l:'P. prog./m',type:'moy'}, stats:[
      {cle:'passes_reussies',l:'Passes réussies / match',type:'moy',max:80,col:'var(--accent)'},
      {cle:'passes_progressives',l:'Passes progressives / match',type:'moy',max:12,col:'var(--violet)'},
      {cle:'ballons_recuperes',l:'Ballons récupérés / match',type:'moy',max:14,col:'#22d3ee'},
      {cle:'pressings_reussis',l:'Pressings réussis / match',type:'moy',max:18,col:'var(--warn)'},
      {cle:'duels_gagnes',l:'Duels gagnés / match',type:'moy',max:12,col:'#22c55e'}
    ], radar:[['passes_reussies','Passes',80,'moy',52],['passes_progressives','Prog.',12,'moy',6],['ballons_recuperes','Récup.',14,'moy',8],['pressings_reussis','Press.',18,'moy',10],['duels_gagnes','Duels',12,'moy',6]] },
    'Défenseur': { head:{cle:'interceptions',l:'Interc./m',type:'moy'}, stats:[
      {cle:'interceptions',l:'Interceptions / match',type:'moy',max:7,col:'var(--accent)'},
      {cle:'tacles_reussis',l:'Tacles réussis / match',type:'moy',max:8,col:'#22c55e'},
      {cle:'degagements',l:'Dégagements / match',type:'moy',max:11,col:'#22d3ee'},
      {cle:'duels_gagnes',l:'Duels gagnés / match',type:'moy',max:12,col:'var(--violet)'},
      {cle:'fautes',l:'Fautes / match',type:'moy',max:4,col:'var(--warn)'}
    ], radar:[['interceptions','Interc.',7,'moy',3.5],['tacles_reussis','Tacles',8,'moy',4],['degagements','Dégag.',11,'moy',6],['duels_gagnes','Duels',12,'moy',6]] },
    'Gardien': { head:{cle:'arrets',l:'Arrêts/m',type:'moy'}, stats:[
      {cle:'arrets',l:'Arrêts / match',type:'moy',max:7,col:'var(--accent)'},
      {cle:'xgot_arrete',l:'xGOT arrêté (saison)',type:'total1',max:8,col:'var(--violet)'},
      {cle:'relances_reussies',l:'Relances réussies / match',type:'moy',max:30,col:'#22d3ee'},
      {cle:'sorties_aeriennes',l:'Sorties aériennes / match',type:'moy',max:5,col:'#22c55e'}
    ], radar:[['arrets','Arrêts',7,'moy',3],['relances_reussies','Relances',30,'moy',20],['sorties_aeriennes','Sorties',5,'moy',2],['xgot_arrete','xGOT',8,'total',3]] }
  };
  const cfgPoste = POSTE_STATS[d.poste] || null;
  const aggV = (cle,type)=>{ const a = d.match_agg && d.match_agg[cle]; if(!a) return null; return type==='total'?a.total:(type==='total1'?Math.round(a.total*10)/10:a.moy); };
  const matchKpis = msAgg ? `<div class="fjd-kpis">
        <div class="v2-kpi"><div class="kv">${msAgg.note_moy!=null?msAgg.note_moy:'—'}</div><div class="kk">Note moy.</div></div>
        ${cfgPoste ? `<div class="v2-kpi"><div class="kv">${aggV(cfgPoste.head.cle,cfgPoste.head.type)!=null?aggV(cfgPoste.head.cle,cfgPoste.head.type):'—'}</div><div class="kk">${escapeHtml(cfgPoste.head.l)}</div></div>` : `<div class="v2-kpi"><div class="kv">${msAgg.buts||0}</div><div class="kk">Buts</div></div>`}
        <div class="v2-kpi"><div class="kv">${msAgg.minutes||0}</div><div class="kk">Minutes</div></div>
        <div class="v2-kpi"><div class="kv">${msAgg.nb||0}</div><div class="kk">Matchs</div></div>
      </div>` : '';

  // Formulaire de saisie d'un match (coach) — champs adaptés au poste (§6)
  const matchInputs = cfgPoste ? cfgPoste.stats.map(s=>{
    const lbl = s.l.replace(/ \/ match| \(saison\)/,'');
    return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;"><label style="font-size:12px;color:var(--text-muted);">${lbl}</label><input id="cd-mstat-${s.cle}" type="number" step="0.01" style="width:110px;"></div>`;
  }).join('') : '';
  const matchForm = (cdMode==='coach' && cfgPoste) ? `
    <button id="cd-match-add" onclick="document.getElementById('cd-match-form').style.display='block';this.style.display='none';" class="btn btn-outline" style="margin:2px 0 12px;">+ Saisir un match</button>
    <div id="cd-match-form" class="dash-card" style="display:none;padding:12px 13px;margin-bottom:12px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;"><input id="cd-m-date" type="date" style="flex:1;"><input id="cd-m-heure" type="time" style="width:105px;"><input id="cd-m-note" type="number" step="0.1" placeholder="Note" style="width:75px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:10px;"><input id="cd-m-min" type="number" placeholder="Minutes" style="flex:1;"><input id="cd-m-duree" type="number" placeholder="Durée min" style="flex:1;"><input id="cd-m-rpe" type="number" placeholder="RPE" style="width:80px;"></div>
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
        <select id="cd-m-intensite-prevue" style="flex:1;"><option value="">Int. prévue</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
        <select id="cd-m-intensite" style="flex:1;"><option value="">Int. réalisée</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);white-space:nowrap;padding:0 2px;"><input id="cd-m-titulaire" type="checkbox" checked> Titul.</label>
      </div>
      ${matchInputs}
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button onclick="cdSaveMatch()" class="btn btn-accent" style="flex:1;margin:0;">Enregistrer le match</button>
        <button onclick="ouvrirDetailJoueurFoot(cdJoueurCourant)" class="btn btn-outline" style="flex:1;margin:0;">Annuler</button>
      </div>
    </div>` : '';

  // Objectifs (Profil) — catalogue §2
  const objTag = {developpement_physique:{l:'Développement physique',c:'accent'}, prevention:{l:'Prévention',c:'warn'}, performance:{l:'Performance',c:'violet'}, retour_blessure:{l:'Retour blessure',c:'warn'}, maintien:{l:'Maintien',c:'accent'}};
  const objStatut = {en_cours:{l:'Sur la voie',c:'#22c55e'}, a_surveiller:{l:'À surveiller',c:'#f5a623'}, atteint:{l:'Atteint',c:'#22c55e'}};
  const tagBg = {accent:'rgba(59,130,246,.14)', warn:'rgba(245,158,11,.15)', violet:'rgba(139,92,246,.16)'};
  const tagFg = {accent:'#bcd3ff', warn:'#ffcf7a', violet:'#d6c8ff'};
  const objCatOptions = ['developpement_physique','prevention','performance','retour_blessure','maintien'].map(k=>`<option value="${k}">${(objTag[k]||{l:k}).l}</option>`).join('');
  const objForm = cdMode==='coach' ? `
    <button id="cd-obj-add" onclick="document.getElementById('cd-obj-form').style.display='block';this.style.display='none';" class="btn btn-outline" style="margin:2px 0 12px;">+ Ajouter un objectif</button>
    <div id="cd-obj-form" class="dash-card" style="display:none;padding:12px 13px;margin-bottom:12px;">
      <select id="cd-obj-cat" style="width:100%;margin-bottom:8px;">${objCatOptions}</select>
      <input id="cd-obj-desc" placeholder="Description de l'objectif" style="width:100%;margin-bottom:8px;">
      <select id="cd-obj-stat" style="width:100%;margin-bottom:10px;"><option value="en_cours">Sur la voie</option><option value="a_surveiller">À surveiller</option><option value="atteint">Atteint</option></select>
      <div style="display:flex;gap:8px;">
        <button onclick="cdAjoutObjectif()" class="btn btn-accent" style="flex:1;margin:0;">Ajouter</button>
        <button onclick="ouvrirDetailJoueurFoot(cdJoueurCourant)" class="btn btn-outline" style="flex:1;margin:0;">Annuler</button>
      </div>
    </div>` : '';
  const objectifsHtml = ((Array.isArray(d.objectifs) && d.objectifs.length) ? d.objectifs.map(o=>{
    const tg = objTag[o.categorie] || {l:o.categorie, c:'accent'};
    const st = objStatut[o.statut] || {l:o.statut||'', c:'var(--text-muted)'};
    return `<div class="dash-card" style="padding:12px 13px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <span style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:3px 8px;border-radius:6px;color:${tagFg[tg.c]};background:${tagBg[tg.c]};">${escapeHtml(tg.l)}</span>
        <span style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;font-weight:800;color:${st.c};">${escapeHtml(st.l)}</span>${cdMode==='coach'?`<button onclick="cdSupprObjectif('${o.id}')" title="Supprimer" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:15px;line-height:1;padding:0 2px;">×</button>`:''}</span>
      </div>
      <div style="font-size:12.5px;line-height:1.35;">${escapeHtml(o.description||'')}</div>
    </div>`;
  }).join('') : soon('Aucun objectif défini pour ce joueur.')) + objForm;

  // Blessures / réathlé (Profil) — catalogue §9
  const injStatut = {retour_progressif:{l:'Retour progressif',c:'#f5a623'}, retabli:{l:'Rétabli',c:'#22c55e'}, indispo:{l:'Indisponible',c:'#e5484d'}};
  const blesForm = cdMode==='coach' ? `
    <button id="cd-bles-add" onclick="document.getElementById('cd-bles-form').style.display='block';this.style.display='none';" class="btn btn-outline" style="margin:2px 0 12px;">+ Ajouter une blessure</button>
    <div id="cd-bles-form" class="dash-card" style="display:none;padding:12px 13px;margin-bottom:12px;">
      <input id="cd-bles-type" placeholder="Type (Élongation, Entorse…)" style="width:100%;margin-bottom:8px;">
      <input id="cd-bles-loc" placeholder="Localisation (Ischio-jambier droit…)" style="width:100%;margin-bottom:8px;">
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <select id="cd-bles-grav" style="flex:1;"><option value="Légère">Légère</option><option value="Modérée">Modérée</option><option value="Sévère">Sévère</option></select>
        <input id="cd-bles-duree" type="number" placeholder="Indispo (j)" style="width:120px;">
      </div>
      <select id="cd-bles-stat" style="width:100%;margin-bottom:10px;"><option value="indispo">Indisponible</option><option value="retour_progressif">Retour progressif</option><option value="retabli">Rétabli</option></select>
      <div style="display:flex;gap:8px;">
        <button onclick="cdAjoutBlessure()" class="btn btn-accent" style="flex:1;margin:0;">Ajouter</button>
        <button onclick="ouvrirDetailJoueurFoot(cdJoueurCourant)" class="btn btn-outline" style="flex:1;margin:0;">Annuler</button>
      </div>
    </div>` : '';
  const blessuresHtml = ((Array.isArray(d.blessures) && d.blessures.length) ? `<div class="dash-card" style="padding:4px 14px;margin-bottom:12px;">` + d.blessures.map(b=>{
    const st = injStatut[b.statut] || {l:b.statut||'', c:'var(--text-muted)'};
    const det = [b.gravite, (b.duree?('indispo '+b.duree+' j'):''), (b.retour_terrain?('retour terrain '+b.retour_terrain):''), (b.retour_competition?('retour compét. '+b.retour_competition):'')].filter(Boolean).join(' · ');
    return `<div style="display:flex;gap:11px;padding:12px 0;border-top:1px solid var(--border);align-items:flex-start;">
      <span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap;color:${st.c};background:${st.c}1a;border:1px solid ${st.c}55;">${escapeHtml(st.l)}</span>
      <div style="min-width:0;flex:1;">
        <b style="font-size:13px;">${escapeHtml((b.type||'') + (b.localisation ? (' — '+b.localisation) : ''))}</b>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;line-height:1.45;">${escapeHtml(det)}</div>
      </div>
      ${cdMode==='coach'?`<button onclick="cdSupprBlessure('${b.id}')" title="Supprimer" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:15px;line-height:1;padding:0 2px;">×</button>`:''}
    </div>`;
  }).join('') + `</div>` : soon('Aucune blessure enregistrée.')) + blesForm;

  // Stats de match PAR POSTE (barres, échelle = repère du poste) — onglet Match
  const clampF = v => Math.max(0, Math.min(100, Math.round(v)));
  const statBar = (lbl,val,pct,col)=>`<div style="margin-bottom:11px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;"><span style="color:var(--text-muted);">${lbl}</span><b>${val}</b></div><div style="height:6px;border-radius:4px;background:var(--surface2);overflow:hidden;"><span style="display:block;height:100%;border-radius:4px;width:${clampF(pct)}%;background:${col};"></span></div></div>`;
  const statsMatchHtml = (cfgPoste && d.match_agg) ? `<div class="dash-card" style="padding:14px;margin-bottom:12px;">
      ${cfgPoste.stats.map(s=>{ const v = aggV(s.cle, s.type); return statBar(s.l, v!=null?v:'—', (v!=null&&s.max)?(v/s.max*100):0, s.col||'var(--accent)'); }).join('')}
    </div>` : '';

  // Heatmap SVG (6×3 zones) — onglet Match
  const heatCol = v => v>=75?'#ef4444':(v>=50?'#f97316':(v>=28?'#eab308':'#22c55e'));
  const buildHeat = zones => {
    if(!zones||!zones.length) return '';
    const cols=6, rows=3, W=340, H=200, cw=W/cols, ch=H/rows;
    let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;border-radius:10px;background:#0e2419;max-width:420px;margin:0 auto;">`;
    zones.forEach((v,i)=>{ const c=i%cols, r=Math.floor(i/cols); s+=`<rect x="${(c*cw).toFixed(1)}" y="${(r*ch).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="${heatCol(v)}" opacity="${(0.12+v/100*0.62).toFixed(2)}"/>`; });
    s+=`<rect x="4" y="4" width="${W-8}" height="${H-8}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/><line x1="${W/2}" y1="4" x2="${W/2}" y2="${H-4}" stroke="rgba(255,255,255,.35)"/><circle cx="${W/2}" cy="${H/2}" r="24" fill="none" stroke="rgba(255,255,255,.35)"/></svg>`;
    s+=`<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10px;color:var(--text-muted);margin-top:8px;"><span>Faible</span><span style="color:#22c55e">▮</span><span style="color:#eab308">▮</span><span style="color:#f97316">▮</span><span style="color:#ef4444">▮ Forte</span><span style="margin-left:auto">sens du jeu →</span></div>`;
    return s;
  };

  // Radar SVG par poste — polygone joueur + polygone "repère du poste" (référence)
  const buildRadar = () => {
    if(!cfgPoste || !d.match_agg) return '';
    const axes = cfgPoste.radar, N = axes.length;
    const cx=130, cy=118, R=76;
    const pt=(i,rad)=>{const a=-Math.PI/2+i*2*Math.PI/N;return [cx+rad*Math.cos(a),cy+rad*Math.sin(a)];};
    const poly=(fn,fill,stroke,sw)=>{let p='';for(let i=0;i<N;i++){const nv=Math.max(0,Math.min(100,fn(i)));const q=pt(i,R*nv/100);p+=q[0].toFixed(1)+','+q[1].toFixed(1)+' ';}return `<polygon points="${p}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;};
    let s=`<svg viewBox="0 0 260 236" width="100%" style="max-width:300px;height:auto;display:block;margin:0 auto;">`;
    [0.25,0.5,0.75,1].forEach(f=>{let p='';for(let i=0;i<N;i++){const q=pt(i,R*f);p+=q[0].toFixed(1)+','+q[1].toFixed(1)+' ';}s+=`<polygon points="${p}" fill="none" stroke="rgba(255,255,255,.07)"/>`;});
    for(let i=0;i<N;i++){const q=pt(i,R);s+=`<line x1="${cx}" y1="${cy}" x2="${q[0].toFixed(1)}" y2="${q[1].toFixed(1)}" stroke="rgba(255,255,255,.07)"/>`;const l=pt(i,R+15);s+=`<text x="${l[0].toFixed(1)}" y="${(l[1]+3).toFixed(1)}" fill="#8ea3c4" font-size="9" text-anchor="middle">${axes[i][1]}</text>`;}
    s+=poly(i=>(axes[i][4]/axes[i][2])*100, 'rgba(142,163,196,.13)', 'rgba(142,163,196,.55)', 1.5);
    s+=poly(i=>{ const v=aggV(axes[i][0],axes[i][3])||0; return (v/axes[i][2])*100; }, 'rgba(59,130,246,.24)', '#3b82f6', 2);
    s+=`</svg><div style="display:flex;gap:16px;justify-content:center;font-size:10.5px;color:var(--text-muted);margin-top:2px;"><span><b style="color:#3b82f6">▮</b> ${escapeHtml((d.nom||'Joueur').split(' ')[0])}</span><span><b style="color:#8ea3c4">▮</b> Repère du poste</span></div>`;
    return s;
  };

  // Bien-être (§3) / récup (§10) — carte d'affichage + formulaire de saisie (mode athlète)
  const WB_META = [
    {k:'sommeil',l:'Sommeil',good:true},{k:'energie',l:'Énergie',good:true},
    {k:'fatigue',l:'Fatigue',good:false},{k:'motivation',l:'Motivation',good:true},
    {k:'stress',l:'Stress',good:false},{k:'courbatures',l:'Courbatures',good:false},
    {k:'douleur',l:'Douleurs',good:false},{k:'dispo_mentale',l:'Dispo. mentale',good:true}
  ];
  const be = d.bienetre || {};
  const wbColor = (v,good)=>{ const lvl = good ? v : (6-v); return lvl>=4?'#22c55e':(lvl>=3?'#f5a623':'#e5484d'); };
  const bienetreCard = WB_META.some(m=>be[m.k]!=null) ? `<div class="dash-card" style="padding:14px;margin-bottom:12px;">${WB_META.filter(m=>be[m.k]!=null).map(m=>{const v=be[m.k];return `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;"><span style="color:var(--text-muted);">${m.l}</span><b>${v}/5</b></div><div style="height:6px;border-radius:4px;background:var(--surface2);overflow:hidden;"><span style="display:block;height:100%;border-radius:4px;width:${v/5*100}%;background:${wbColor(v,m.good)};"></span></div></div>`;}).join('')}</div>` : '';
  const bilanRow = (k,l)=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;"><span style="font-size:12.5px;">${l}</span><select id="cd-b-${k}" style="width:70px;"><option value="">–</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>`;
  const bilanForm = (cdMode==='athlete') ? `
    <button id="cd-bilan-add" onclick="document.getElementById('cd-bilan-form').style.display='block';this.style.display='none';" class="btn btn-accent" style="margin:2px 0 12px;">Faire le point du jour</button>
    <div id="cd-bilan-form" class="dash-card" style="display:none;padding:12px 13px;margin-bottom:12px;">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px;">Avant la séance (1 faible · 5 élevé)</div>
      ${WB_META.map(m=>bilanRow(m.k,m.l)).join('')}
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:12px 0 8px;">Après la séance (récup)</div>
      ${[['fatigue_post','Fatigue ressentie'],['difficulte_seance','Difficulté'],['satisfaction','Satisfaction'],['douleur_post','Douleurs']].map(x=>bilanRow(x[0],x[1])).join('')}
      <textarea id="cd-bilan-comment" placeholder="Commentaire (optionnel)" style="width:100%;margin-top:4px;min-height:44px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;padding:8px;font-family:inherit;"></textarea>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button onclick="cdSaveBilan()" class="btn btn-accent" style="flex:1;margin:0;">Enregistrer</button>
        <button onclick="ouvrirDetailJoueurFoot(cdJoueurCourant,'athlete')" class="btn btn-outline" style="flex:1;margin:0;">Annuler</button>
      </div>
    </div>` : '';

  // Analyse — sorties du moteur (§12). La reco n'est montrée qu'au coach (l'app constate, le coach prescrit).
  const mot = d.moteur;
  const colRisque = v => v==='Élevé'?'#e5484d':v==='Modéré'?'#f5a623':'#22c55e';
  const colRecup = v => (v==='Excellent'||v==='Bon')?'#22c55e':v==='Moyen'?'#f5a623':v==='Faible'?'#e5484d':'var(--text-muted)';
  const motCell = (l,v,c)=>`<div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:3px;">${l}</div><div style="font-size:14px;font-weight:800;color:${c||'var(--text)'};">${escapeHtml(v)}</div></div>`;
  const analyseCard = mot ? `<div class="dash-card" style="padding:14px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        ${motCell('Disponibilité', mot.disponibilite.niveau, mot.disponibilite.couleur)}
        ${motCell('Risque surcharge', mot.surcharge, colRisque(mot.surcharge))}
        ${motCell('État récup', mot.recup, colRecup(mot.recup))}
        ${motCell('Risque blessure', mot.risque_blessure, colRisque(mot.risque_blessure))}
      </div>
      ${(cdMode==='coach' && mot.reco) ? `<div style="font-size:12.5px;line-height:1.45;margin-top:12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">${mot.contexte_tag ? `<span style="display:inline-block;font-size:10px;font-weight:800;background:var(--accent);color:var(--on-accent);border-radius:4px;padding:1px 6px;margin-right:6px;vertical-align:middle;">${escapeHtml(mot.contexte_tag)}</span>` : ''}<b style="color:var(--accent);">Reco</b> · ${escapeHtml(mot.reco)}</div>` : ''}
    </div>` : '';

  // Phase 6 — NovalyzEngine appliqué aux données foot : bien-être → signaux communs.
  // Le noyau n'est pas modifié ; on lui fournit les entrées que normaliser() sait lire.
  let novalyzAlertes = [];
  if (typeof NovalyzEngine !== 'undefined' && d.bienetre && Object.keys(d.bienetre).length) {
    try { novalyzAlertes = NovalyzEngine.analyser({ bienEtre: d.bienetre, contexte: d.contexte }) || []; } catch(e) {}
  }
  const novalyzCard = novalyzAlertes.length ? `<div class="dash-card" style="padding:4px 0 0;margin-bottom:12px;">${
    novalyzAlertes.map((a,i) => {
      const c = analyseCouleur(a.type);
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 14px;${i<novalyzAlertes.length-1?'border-bottom:1px solid var(--border);':''}">`
        + `<div style="flex:0 0 4px;align-self:stretch;background:${c};border-radius:2px;min-height:36px;"></div>`
        + `<div style="min-width:0;"><div style="font-size:13px;font-weight:800;color:${c};">${analyseIcone(a.type)} ${escapeHtml(a.titre)}</div>`
        + `<div style="font-size:12px;color:var(--text-muted);line-height:1.45;margin-top:2px;">${escapeHtml(a.description)}</div></div></div>`;
    }).join('')
  }</div>` : '';

  // Charge externe GPS (§8) — agrégat 7 jours (onglet Charge)
  const gps = d.gps;
  const gpsTile = (v,l)=>nvStat(v, l);
  const gpsUnit = u=>`<span style="font-size:11px;color:var(--text-muted);"> ${u}</span>`;
  const gpsCard = (gps && gps.n) ? `<div class="dash-card" style="padding:14px;margin-bottom:12px;"><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px 8px;">
      ${gpsTile((gps.distance/1000).toFixed(1)+gpsUnit('km'),'Distance')}
      ${gpsTile(Math.round(gps.distance_hi)+gpsUnit('m'),'Dist. HI')}
      ${gpsTile(Math.round(gps.sprint_distance||0)+gpsUnit('m'),'Sprint dist.')}
      ${gpsTile(gps.sprints,'Sprints')}
      ${gpsTile(gps.accel+' / '+gps.decel,'Accél/Décél')}
      ${gpsTile(gps.vmax?gps.vmax.toFixed(1)+gpsUnit('km/h'):'—','Vitesse max')}
      ${gpsTile(Math.round(gps.charge_gps)+gpsUnit('UA'),'Charge GPS')}
    </div></div>` : '';

  // KPI de charge (§11) — charge mensuelle, monotonie, strain, temps de jeu (onglet Charge)
  const kf = d.kpi_foot;
  const kpiFootCard = kf ? `<div class="dash-card" style="padding:14px;margin-bottom:12px;"><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 8px;">
      ${gpsTile((kf.charge_mensuelle||0).toLocaleString('fr-FR')+gpsUnit('UA'),'Charge · 28 j')}
      ${gpsTile(kf.monotonie!=null?kf.monotonie:'—','Monotonie')}
      ${gpsTile(kf.strain!=null?kf.strain.toLocaleString('fr-FR'):'—','Strain')}
      ${gpsTile((kf.temps_jeu||0)+gpsUnit('min'),'Temps de jeu')}
    </div></div>` : '';

  // Header pleine largeur (hors zone à largeur limitée) — peuplé sur #fjd-topbar.
  try {
    var _tb = document.getElementById('fjd-topbar');
    if (_tb) {
      var _iconBtn = 'background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 9px;cursor:pointer;line-height:1;flex-shrink:0;';
      var _gearSvg = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
      var _back = (cdMode === 'coach')
        ? `<button onclick="fermerDetailJoueurFoot()" title="Retour" style="${_iconBtn}"><svg class="ico ico-btn"><use href="#i-arrow-left"/></svg></button>` : '';
      // Athlète : Réglages + Déco (il a déjà l'onglet Conversation).
      // Coach/prépa : Réglages + Conversation (messagerie) + Déco.
      var _right = (cdMode === 'athlete')
        ? `<button onclick="if(typeof ouvrirReglagesAthlete==='function'){ouvrirReglagesAthlete();}else{fermerDetailJoueurFoot();if(typeof switchTab==='function')switchTab('reglages');}" title="Réglages" style="${_iconBtn}">${_gearSvg}</button>
           <button class="logout-btn" onclick="fermerDetailJoueurFoot();seDeconnecter();" title="Déconnexion"><svg class="ico ico-btn"><use href="#i-logout"/></svg>Déco</button>`
        : `<button onclick="ouvrirReglagesCoach()" title="Réglages" style="${_iconBtn}">${_gearSvg}</button>
           <button onclick="ouvrirMessagerieCoach()" title="Conversations" style="${_iconBtn}"><svg class="ico"><use href="#i-message"/></svg></button>
           <button class="logout-btn" onclick="seDeconnecterCoach()" title="Déconnexion"><svg class="ico ico-btn"><use href="#i-logout"/></svg>Déco</button>`;
      // Header épuré (comme la fiche muscu) : nom de l'onglet + boutons. Toutes
      // les infos joueur (nom, poste, club, dispo) sont déplacées dans le bloc
      // « hero » en haut de l'onglet Profil (voir #fjd-hero plus bas).
      _tb.innerHTML = `
        <div style="display:flex;align-items:center;gap:9px;min-width:0;flex:1;">
          ${_back}
          <svg class="ico" style="width:20px;height:20px;color:var(--accent);flex-shrink:0;"><use href="#${_sportIcoId(d.sport)}"/></svg>
          <h1 id="fjd-tab-title" style="font-size:18px;font-weight:800;line-height:1.1;margin:0;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text);">Profil</h1>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">${_right}</div>`;
      _tb.style.display = 'flex';
    }
  } catch (e) {}

  body.innerHTML = `
    <!-- Onglets vue joueur : barre du bas sur mobile (.djt-tabs) -->
    <div class="sub-tabs djt-tabs">
      <button class="sub-tab active" data-i="0" onclick="switchDetailJoueurTab(0)"><span class="dj-ico">${ic('note')}</span><span>Profil</span></button>
      <button class="sub-tab" data-i="1" onclick="switchDetailJoueurTab(1)"><span class="dj-ico">${ic('gauge')}</span><span>Charge</span></button>
      <button class="sub-tab" data-i="4" onclick="switchDetailJoueurTab(4)"><span class="dj-ico">${ic('dumbbell')}</span><span>Renfo</span></button>
      <button class="sub-tab" data-i="2" onclick="switchDetailJoueurTab(2)"><span class="dj-ico">${ic('trophy')}</span><span>Match</span></button>
      <button class="sub-tab" data-i="3" onclick="switchDetailJoueurTab(3)"><span class="dj-ico">${ic('message')}</span><span>Conversation</span></button>
    </div>

    <!-- Corps en grille (main + rail desktop), comme #cd-body muscu -->
    <div class="fjd-body">
    <div class="fjd-main">

    <!-- PANEL 0 : PROFIL -->
    <div class="djt-panel" data-i="0">
      <!-- Hero d'accueil (comme le briefing muscu) : Bonjour + nom + infos joueur.
           L'avatar accepte une photo (d.photo) et retombe sur les initiales sinon. -->
      <div id="fjd-hero" class="fjd-hero">
        <div class="fjd-hero-av">${d.photo ? `<img src="${escapeHtml(d.photo)}" alt="">` : escapeHtml(initiales)}</div>
        <div style="min-width:0;flex:1;">
          <div class="fjd-hero-grt">Bonjour 👋</div>
          <div class="fjd-hero-name">${escapeHtml(d.nom || 'Joueur')}</div>
          <div class="fjd-hero-pills">
            <span class="fjd-pill" style="background:color-mix(in srgb, ${dispo.c} 12%, transparent);border-color:color-mix(in srgb, ${dispo.c} 28%, transparent);color:${dispo.c};"><span style="width:8px;height:8px;border-radius:50%;background:${dispo.c};"></span>${escapeHtml(dispo.t)}</span>
            ${d.poste ? `<span class="fjd-pill">⚽ ${escapeHtml(d.poste)}</span>` : ''}
            ${d.club ? `<span class="fjd-pill">🛡️ ${escapeHtml(d.club)}</span>` : ''}
            ${d.categorie ? `<span class="fjd-pill">${escapeHtml(d.categorie)}</span>` : ''}
          </div>
        </div>
      </div>
      <!-- État du jour (forme) — même bloc que la page athlète muscu -->
      <div class="v2-sec" id="fjd-etat-sec" style="display:none;"><div class="st">${ic('activity')}État du jour</div></div>
      <div class="dash-card" id="fjd-etat-card" style="padding:16px;margin-bottom:12px;display:none;"><div id="fjd-etat-content"></div></div>
      ${analyseCard ? `<div class="v2-sec"><div class="st">${ic('activity')}Analyse</div></div>${analyseCard}` : ''}
      <div class="v2-sec"><div class="st">${ic('note')}Identité</div></div>
      <div class="dash-card" style="padding:4px 14px;margin-bottom:12px;">
        ${dl('Poste', d.poste ? escapeHtml(d.poste) : '—')}
        ${dl('Jambe dominante', d.jambe_dominante ? escapeHtml(d.jambe_dominante) : '—')}
        ${dl('Taille · Poids', (d.taille ? d.taille+' cm' : '—') + ' · ' + (d.poids ? d.poids+' kg' : '—'))}
        ${dl('Né le', d.ddn ? escapeHtml(d.ddn) + (d.age!=null ? ` <span style="color:var(--text-muted);font-weight:600;">(${d.age} ans)</span>` : '') : '—')}
        ${dl('Sexe', d.sexe ? escapeHtml(d.sexe==='H'?'Homme':(d.sexe==='F'?'Femme':d.sexe)) : '—')}
        ${dl('Club · Catégorie', (d.club?escapeHtml(d.club):'—')+(d.categorie?' · '+escapeHtml(d.categorie):''))}
        ${d.discipline ? dl('Discipline', escapeHtml(d.discipline)) : ''}
        ${dl('Au club depuis', d.date_entree ? escapeHtml(d.date_entree) : '—')}
        ${dl('Antécédents', d.antecedents ? escapeHtml(d.antecedents) : '<span style="color:var(--text-muted);font-weight:600;">aucun</span>')}
      </div>
      <div class="v2-sec"><div class="st">${ic('target')}Objectifs</div></div>
      ${objectifsHtml}
      <div class="v2-sec"><div class="st">${ic('alert')}Blessures &amp; réathlé</div></div>
      ${blessuresHtml}
    </div>

    <!-- PANEL 1 : CHARGE & PHYSIQUE (données réelles) -->
    <div class="djt-panel" data-i="1" style="display:none;">
      <div class="fjd-kpis">
        <div class="v2-kpi"><div class="kv" style="color:${acwrCol};">${acwr!=null?acwr.toFixed(2):'—'}</div><div class="kk">ACWR</div></div>
        <div class="v2-kpi"><div class="kv">${(d.charge_7j||0).toLocaleString('fr-FR')}</div><div class="kk">Charge 7j</div></div>
        <div class="v2-kpi"><div class="kv">${wLast.fatigue??'—'}</div><div class="kk">Fatigue</div></div>
        <div class="v2-kpi"><div class="kv">${wLast.douleur??'—'}</div><div class="kk">Douleur</div></div>
      </div>
      ${bilanForm}
      ${bienetreCard ? `<div class="v2-sec"><div class="st">${ic('gauge')}Bien-être${cdMode==='athlete'?' · ton point du jour':''}</div></div>${bienetreCard}` : ''}
      ${novalyzCard ? `<div class="v2-sec"><div class="st">${ic('zap')}Analyse Novalyz</div></div>${novalyzCard}` : ''}
      ${gpsCard ? `<div class="v2-sec"><div class="st">${ic('gauge')}Charge externe (GPS) · 7 jours</div></div>${gpsCard}` : ''}
      <div class="v2-sec"><div class="st">${ic('barchart')}Charge hebdomadaire (UA)</div></div>
      <div class="dash-card" style="padding:14px 12px 10px;margin-bottom:12px;"><canvas id="canvas-charge-joueur" width="420" height="130" style="width:100%;height:130px;display:block;"></canvas></div>
      ${kpiFootCard ? `<div class="v2-sec"><div class="st">${ic('trending')}Charge · monotonie / strain</div></div>${kpiFootCard}` : ''}
      <div class="v2-sec"><div class="st">${ic('dumbbell')}Dernières séances</div></div>
      ${tblSeances(rows||'<tr><td style="padding:8px;color:var(--text-muted)">Aucune séance</td></tr>')}
      <div class="v2-sec"><div class="st">${ic('clipboard')}Tests physiques</div></div>
      <div id="detail-tests-body"><div class="loader">Chargement…</div></div>
    </div>

    <!-- PANEL 4 : RENFORCEMENT (muscu) — prépa édite, le joueur consulte -->
    <div class="djt-panel" data-i="4" style="display:none;">
      <div class="v2-sec"><div class="st">${ic('dumbbell')}Programme de renforcement</div></div>
      ${cdMode === 'athlete'
        ? `<div style="font-size:12px;color:var(--text-muted);background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 12px;margin-bottom:10px;">🔒 Programme défini par ton préparateur physique — en lecture seule.</div>`
        : ''}
      <div id="fjd-programme-content"><div class="loader">Chargement…</div></div>
      ${cdMode === 'athlete'
        ? ''
        : `<button class="btn btn-outline" style="margin-top:10px;width:100%;" onclick="cdAjouterSeance()">+ Nouvelle séance</button>`}
    </div>

    <!-- PANEL 2 : MATCH & TECHNIQUE -->
    <div class="djt-panel" data-i="2" style="display:none;">
      ${matchKpis}
      ${matchForm}
      ${statsMatchHtml ? `<div class="v2-sec"><div class="st">${ic('barchart')}Statistiques${d.poste?' · '+escapeHtml(d.poste):''}</div></div>${statsMatchHtml}` : ''}
      <div class="v2-sec"><div class="st">${ic('trophy')}Derniers matchs</div></div>
      ${matchsRich.length ? `<div class="dash-card" style="padding:2px 14px 6px;margin-bottom:12px;">${richMatchRows}</div>`
        : (matchs.length ? tblSeances(matchRows) : soon('Aucun match enregistré. Ajoute une séance de type « match » (ou relance <b>seedDemoFoot()</b>).'))}
      ${(d.heatmap&&d.heatmap.length) ? `<div class="v2-sec"><div class="st">${ic('activity')}Heatmap · zones d'activité</div></div><div class="dash-card" style="padding:12px;margin-bottom:12px;">${buildHeat(d.heatmap)}</div>` : ''}
      ${(cfgPoste && d.match_agg) ? `<div class="v2-sec"><div class="st">${ic('target')}Radar technique${d.poste?' · '+escapeHtml(d.poste):''}</div></div><div class="dash-card" style="padding:8px 8px 4px;">${buildRadar()}</div>` : ''}
      ${(!d.heatmap||!d.heatmap.length) && !(cfgPoste && d.match_agg) ? soon('Stats de match — relance <b>seedDemoFoot()</b> pour générer les données par poste.') : ''}
    </div>

    <!-- PANEL 3 : CONVERSATION -->
    <div class="djt-panel" data-i="3" style="display:none;">
      <div style="background:var(--surface);border-radius:16px;border:1px solid var(--border);margin-bottom:12px;width:100%;box-sizing:border-box;">
        <div id="djt-conv-messages" style="min-height:180px;max-height:52vh;overflow-y:auto;padding:16px 14px;"></div>
        <div style="padding:10px 12px;border-top:1px solid var(--border);display:flex;flex-direction:row;gap:8px;align-items:flex-end;width:100%;box-sizing:border-box;">
          <textarea id="djt-conv-input" placeholder="Votre message…"
            style="flex:1 1 0;min-width:0;min-height:72px;resize:none;border:1px solid var(--border);border-radius:10px;padding:8px 12px;font-size:13.5px;background:var(--surface2);color:var(--text);font-family:inherit;box-sizing:border-box;"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();envoyerMessageJoueur();}"></textarea>
          <button onclick="envoyerMessageJoueur()" class="btn-accent" style="flex:0 0 auto;width:auto;padding:10px 16px;border-radius:10px;border:none;font-size:14px;font-weight:700;white-space:nowrap;cursor:pointer;align-self:flex-end;">Envoyer</button>
        </div>
      </div>
    </div>

    </div><!-- /fjd-main -->
    <aside class="fjd-rail">
      ${carteContexteHTML(d.contexte, athlete_id, 'foot')}
      <div class="dash-card" style="padding:14px;margin-bottom:12px;">
        ${nvLabel('Disponibilité', { sm:true, style:'margin-bottom:8px;' })}
        <div style="display:inline-flex;align-items:center;gap:8px;font-size:var(--fs-md);font-weight:var(--fw-heavy);color:${dispo.c};"><span style="width:10px;height:10px;border-radius:50%;background:${dispo.c};"></span>${escapeHtml(dispo.t)}</div>
      </div>
      <div class="dash-card" style="padding:14px;margin-bottom:12px;">
        ${nvLabel('Charge', { sm:true, style:'margin-bottom:6px;' })}
        <div style="display:flex;align-items:baseline;gap:6px;"><span style="font-size:var(--fs-xl);font-weight:var(--fw-heavy);color:${acwrCol};">${acwr!=null?acwr.toFixed(2):'—'}</span><span style="font-size:var(--fs-xs);color:var(--text-muted);">ACWR</span></div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Charge 7j : <b style="color:var(--text);">${(d.charge_7j||0).toLocaleString('fr-FR')}</b> UA</div>
      </div>
      <div class="dash-card" style="padding:14px;">
        ${nvLabel('Dernière séance', { sm:true, style:'margin-bottom:6px;' })}
        <div style="font-size:var(--fs-md);font-weight:var(--fw-heavy);">${(d.seances&&d.seances[0])?d.seances[0].date:'—'}</div>
        <div style="font-size:11px;color:var(--text-muted);">${(d.seances&&d.seances[0])?(d.seances[0].type==='match'?'Match':'Entraînement'):''}</div>
      </div>
    </aside>
    </div><!-- /fjd-body -->`;

  // La barre d'onglets sort de la zone qui défile pour être un enfant direct de
  // l'overlay (barre du bas fiable). Elle survit au remplacement du body : on
  // retire donc toute barre restée d'une ouverture précédente avant d'ajouter
  // la nouvelle (sinon les barres s'empilent → « deux barres » sur mobile).
  try {
    // Retire toute barre déjà déplacée dans l'overlay lors d'une ouverture précédente
    // (elle survit au remplacement du body → sinon empilement = « double barre »).
    var _kids = Array.prototype.slice.call(ov.children);
    for (var _k = 0; _k < _kids.length; _k++) {
      if (_kids[_k].classList && _kids[_k].classList.contains('djt-tabs')) _kids[_k].remove();
    }
    var _navEl = body.querySelector('.djt-tabs');
    if (ov && _navEl) ov.appendChild(_navEl);
  } catch (e) {}

  // Étape 4 — onglets adaptés au rôle. Onglets (data-i) : 0 Profil · 1 Charge&physique
  // · 4 Renfo (muscu) · 2 Match&technique · 3 Conversation.
  //   • Prépa  : Profil · Charge · Renfo · Conversation  (cache Match)
  //   • Coach  : Profil · Renfo · Match · Conversation   (cache Charge)
  //   • Athlète (sa page) : Profil · Charge · Match · Conversation (Renfo caché tant que
  //     l'exécution joueur n'est pas branchée — à venir).
  // Le rôle prépa n'existe que pour les sports co ; la muscu (fiche à part) n'est pas concernée.
  try {
    var _r = (coach && coach.role) || 'coach';
    // Renfo (4) TOUJOURS visible sur la fiche joueur foot (quel que soit rôle/mode).
    // Coach cache Charge (1) ; prépa cache Match (2) ; athlète voit tout.
    var _hide = (cdMode !== 'coach') ? [] : (_r === 'prepa' ? [2] : [1]);
    _hide.forEach(function (i) {
      var b = ov.querySelector('.djt-tabs [data-i="' + i + '"]'); if (b) b.style.display = 'none';
      var p = body.querySelector('.djt-panel[data-i="' + i + '"]'); if (p) p.style.display = 'none';
    });
  } catch (e) {}

  _chargeJoueurData = d.charge_hebdo || [];
  dessinerChargeJoueur(_chargeJoueurData);
  renderTestsJoueur(d.athlete_id);
  // Bloc « État du jour » (forme) — réutilise le composant de la page athlète muscu,
  // alimenté par le bien-être foot (le plus récent en premier).
  try {
    var _well = (d.wellness || []).slice().reverse();
    renderEtatDuJour({ bien_etre: _well, recent: null }, { sec: 'fjd-etat-sec', card: 'fjd-etat-card', cont: 'fjd-etat-content' });
  } catch (_) {}
}
// Données de la courbe de charge du joueur ouvert — pour redessiner net quand
// l'onglet Charge (masqué au 1er rendu) devient visible.
let _chargeJoueurData = [];

// Édition objectifs / blessures (côté coach) — joueur actuellement ouvert
let cdJoueurCourant = null;
let cdJoueurNom = '';
let cdMode = 'coach';   // 'coach' = édition ; 'athlete' = lecture seule (le joueur voit sa propre page)
function _cdVal(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function _cdPost(obj){ return fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify(obj) }).then(r=>r.json()).catch(()=>({})); }
async function cdAjoutObjectif(){
  const desc = _cdVal('cd-obj-desc');
  if(!desc){ if(typeof showToast==='function') showToast('Description requise'); return; }
  await _cdPost({ action:'saveObjectifJoueur', athlete_id:cdJoueurCourant, categorie:_cdVal('cd-obj-cat'), description:desc, statut:_cdVal('cd-obj-stat') });
  if(typeof showToast==='function') showToast('Objectif ajouté');
  ouvrirDetailJoueurFoot(cdJoueurCourant);
}
async function cdSupprObjectif(id){
  if(!confirm('Supprimer cet objectif ?')) return;
  await _cdPost({ action:'deleteObjectifJoueur', id:id });
  ouvrirDetailJoueurFoot(cdJoueurCourant);
}
async function cdAjoutBlessure(){
  const type = _cdVal('cd-bles-type');
  if(!type){ if(typeof showToast==='function') showToast('Type requis'); return; }
  await _cdPost({ action:'saveBlessure', athlete_id:cdJoueurCourant, type:type, localisation:_cdVal('cd-bles-loc'), gravite:_cdVal('cd-bles-grav'), duree:_cdVal('cd-bles-duree'), statut:_cdVal('cd-bles-stat') });
  if(typeof showToast==='function') showToast('Blessure ajoutée');
  ouvrirDetailJoueurFoot(cdJoueurCourant);
}
async function cdSupprBlessure(id){
  if(!confirm('Supprimer cette blessure ?')) return;
  await _cdPost({ action:'deleteBlessure', id:id });
  ouvrirDetailJoueurFoot(cdJoueurCourant);
}
async function cdSaveMatch(){
  const stats = {};
  document.querySelectorAll('#cd-match-form [id^="cd-mstat-"]').forEach(el=>{ if(el.value!=='') stats[el.id.replace('cd-mstat-','')] = el.value; });
  const tit = document.getElementById('cd-m-titulaire');
  await _cdPost({ action:'saveMatch', athlete_id:cdJoueurCourant, date:_cdVal('cd-m-date'), heure:_cdVal('cd-m-heure'), note:_cdVal('cd-m-note'), minutes_jouees:_cdVal('cd-m-min'), duree:_cdVal('cd-m-duree'), rpe:_cdVal('cd-m-rpe'), intensite_prevue:_cdVal('cd-m-intensite-prevue'), intensite_realisee:_cdVal('cd-m-intensite'), titulaire:(tit && tit.checked)?1:0, stats });
  if(typeof showToast==='function') showToast('Match enregistré');
  ouvrirDetailJoueurFoot(cdJoueurCourant);
}
async function cdSaveBilan(){
  const vals = {};
  document.querySelectorAll('#cd-bilan-form [id^="cd-b-"]').forEach(el=>{ if(el.value!=='') vals[el.id.replace('cd-b-','')] = el.value; });
  await _cdPost({ action:'saveBilanAthlete', athlete_id:cdJoueurCourant, vals, commentaire:_cdVal('cd-bilan-comment') });
  if(typeof showToast==='function') showToast('Point du jour enregistré');
  ouvrirDetailJoueurFoot(cdJoueurCourant, 'athlete');
}

// Titre affiché dans le header selon l'onglet (comme #cd-tab-title muscu)
const DJT_TAB_LABELS = { 0: 'Profil', 1: 'Charge & physique', 2: 'Match', 3: 'Conversation', 4: 'Renforcement' };

// Onglets de la page joueur (overlay détail)
function switchDetailJoueurTab(i) {
  document.querySelectorAll('#detail-joueur-overlay .sub-tab').forEach(b=>b.classList.toggle('active', +b.dataset.i===i));
  document.querySelectorAll('#detail-joueur-body .djt-panel').forEach(p=>{ p.style.display = (+p.dataset.i===i) ? 'block' : 'none'; });
  // Le header reprend le titre de l'onglet courant (comme la fiche athlète muscu).
  var _t = document.getElementById('fjd-tab-title'); if (_t && DJT_TAB_LABELS[i]) _t.textContent = DJT_TAB_LABELS[i];
  // Remonte en haut du contenu à chaque changement d'onglet.
  var _sc = document.querySelector('#detail-joueur-overlay .fjd-scroll'); if (_sc) _sc.scrollTop = 0;
  // Onglet Charge : le canvas était masqué au 1er rendu (clientWidth=0) → on le
  // redessine maintenant qu'il est visible, à la bonne largeur (rendu net).
  if (i === 1) requestAnimationFrame(() => dessinerChargeJoueur(_chargeJoueurData || []));
  if (i === 3) chargerConversationJoueur();
  if (i === 4) ouvrirRenfoJoueur();
}

// Onglet « Renfo » (prépa) — réutilise le builder de programme muscu, ciblé sur
// le joueur foot courant et sur le conteneur de la fiche joueur.
function ouvrirRenfoJoueur() {
  // Le joueur (cdMode 'athlete') consulte son programme en lecture seule : c'est
  // le prépa qui le définit. En mode 'coach' (prépa), le programme reste éditable.
  progCtx = { el: 'fjd-programme-content', athleteId: cdJoueurCourant, athleteNom: cdJoueurNom || '', readonly: (cdMode === 'athlete') };
  chargerProgrammeCoach();
}

// Conversation coach ↔ joueur foot (onglet 3)
async function chargerConversationJoueur() {
  const el = document.getElementById('djt-conv-messages');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Chargement…</div>';
  let msgs = [];
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCommentaires&athlete_id=${encodeURIComponent(cdJoueurCourant)}`);
    const data = await res.json();
    msgs = data.commentaires || [];
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">Erreur de chargement.</div>';
    return;
  }
  const isCoach = cdMode === 'coach';
  const luKey = isCoach ? ('foot_lu_coach_' + cdJoueurCourant) : ('foot_lu_athlete_' + cdJoueurCourant);
  const nonLusIds = msgs.filter(c => isCoach ? (c.auteur === 'athlete') : (c.auteur !== 'athlete')).filter(c => !estLu(c, luKey)).map(c => c.id);
  if (nonLusIds.length) {
    ajouterLusLocaux(luKey, nonLusIds);
    fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({ action:'marquerCommentairesLus', ids: nonLusIds }) });
    msgs.forEach(c => { if (nonLusIds.includes(c.id)) c.lu = true; });
  }
  const savedCac = coachAthleteCourant;
  coachAthleteCourant = { nom: cdJoueurNom || 'Joueur' };
  renderBullesChat(msgs, 'djt-conv-messages', isCoach);
  coachAthleteCourant = savedCac;
}

async function envoyerMessageJoueur() {
  const inp = document.getElementById('djt-conv-input');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  const isCoach = cdMode === 'coach';
  const auteur = isCoach ? 'coach' : 'athlete';
  const auteur_nom = isCoach ? (coach && coach.nom ? coach.nom : 'Coach') : (athlete && athlete.nom ? athlete.nom : 'Joueur');
  const coach_id = isCoach ? (coach && coach.coach_id || '') : (athlete && athlete.coach_id || '');
  const coach_nom = isCoach ? (coach && coach.nom || '') : '';
  inp.value = '';
  inp.disabled = true;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveCommentaire', auteur, auteur_nom, athlete_id: cdJoueurCourant, message: msg, coach_id, coach_nom })
    });
  } catch(e) {}
  inp.disabled = false;
  setTimeout(() => chargerConversationJoueur(), 600);
}

// Tests physiques d'un joueur : liste (valeur + évolution) et ajout rapide.
async function renderTestsJoueur(athlete_id) {
  const cont = document.getElementById('detail-tests-body');
  if (!cont) return;
  let data;
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getTests&athlete_id=${encodeURIComponent(athlete_id)}`);
    data = await res.json();
  } catch (e) { cont.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px;">Erreur.</div>'; return; }

  const items = (data.tests || []).map(t => {
    const info = testInfo(t.cle);
    const pts = t.points || [];
    const dernier = pts.length ? pts[pts.length-1].valeur : null;
    const premier = pts.length ? pts[0].valeur : null;
    let evol = '';
    if (pts.length >= 2 && premier != null && dernier != null && premier !== dernier) {
      const diff = Math.round((dernier - premier) * 100) / 100;
      const mieux = info.sensHaut ? diff > 0 : diff < 0;
      const col = mieux ? '#22c55e' : '#e5484d';
      evol = `<span style="color:${col};font-size:11px;font-weight:700;">${mieux?'▲':'▼'} ${diff>0?'+':''}${diff} ${t.unite}</span>`;
    }
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 4px;border-bottom:1px solid var(--border);">
      <div style="font-size:13px;font-weight:700;">${info.nom} <span style="font-size:10px;color:var(--text-muted);font-weight:600;">(${pts.length} mesure${pts.length>1?'s':''})</span></div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${evol}
        <div style="font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;">${dernier!=null?dernier:'—'} <span style="font-size:11px;color:var(--text-muted);font-weight:600;">${t.unite}</span></div>
      </div>
    </div>`;
  }).join('');

  const options = TESTS_CATALOG.map(t => `<option value="${t.cle}">${t.nom} (${t.unite})</option>`).join('');
  cont.innerHTML = `
    <div class="dash-card" style="padding:8px 12px;margin-bottom:12px;">
      ${items || '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Aucun test enregistré.</div>'}
      <div style="display:flex;gap:6px;margin-top:10px;align-items:center;flex-wrap:wrap;">
        <select id="test-cle" style="flex:1;min-width:130px;font-size:12px;padding:8px;">${options}</select>
        <input id="test-val" type="number" step="0.01" placeholder="Valeur" style="width:78px;font-size:12px;padding:8px;">
        <button onclick="ajouterTest('${athlete_id}')" class="btn btn-accent" style="width:auto;margin:0;padding:8px 14px;font-size:12px;">+ Ajouter</button>
      </div>
    </div>`;
}

async function ajouterTest(athlete_id) {
  const cle = document.getElementById('test-cle').value;
  const val = document.getElementById('test-val').value;
  if (val === '') return;
  const info = testInfo(cle);
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveTest', athlete_id, cle, valeur: val, unite: info.unite })
    });
    showToast('Test ajouté');
    renderTestsJoueur(athlete_id);
  } catch (e) { showToast('Erreur'); }
}

function fermerDetailJoueurFoot(ev) {
  document.getElementById('detail-joueur-overlay').style.display = 'none';
  document.documentElement.classList.remove('fjd-open');   // rend le défilement à la page
}

function dessinerChargeJoueur(data) {
  const canvas = document.getElementById('canvas-charge-joueur');
  if (!canvas || !data.length) return;
  const ctx = canvas.getContext('2d');
  // Buffer dimensionné à la taille réelle affichée × densité écran : sinon le
  // bitmap fixe (420px) est étiré en CSS 100% → rendu flou sur les vues larges.
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 420;
  const cssH = canvas.clientHeight || 130;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // on dessine en px CSS, net en HiDPI
  const W=cssW, H=cssH, PAD={t:12,r:10,b:24,l:38};
  const cW=W-PAD.l-PAD.r, cH=H-PAD.t-PAD.b;
  const maxV=Math.max.apply(null, data.map(d=>d.charge).concat([1]));
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(128,128,128,0.15)'; ctx.lineWidth=1; ctx.font='9px sans-serif';
  for(let i=0;i<=2;i++){const y=PAD.t+cH-(i/2)*cH;ctx.beginPath();ctx.moveTo(PAD.l,y);ctx.lineTo(PAD.l+cW,y);ctx.stroke();
    ctx.fillStyle='rgba(128,128,128,0.7)';ctx.textAlign='right';ctx.fillText(Math.round(maxV*i/2),PAD.l-5,y+3);}
  const gap=cW/data.length, barW=Math.max(6,gap*0.5);
  data.forEach((d,i)=>{const x=PAD.l+i*gap+gap/2; const bh=(d.charge/maxV)*cH; const y=PAD.t+cH-bh;
    ctx.fillStyle='#3b82f6'; ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x-barW/2,y,barW,bh,[3,3,0,0]); else ctx.rect(x-barW/2,y,barW,bh);
    ctx.fill();
    ctx.fillStyle='rgba(128,128,128,0.85)';ctx.textAlign='center';ctx.fillText(d.label||d.semaine,x,PAD.t+cH+14);});
}

/* ===== Cockpit prépa physique (Étape 3b) ================================== *
 * Accueil dédié au rôle « prépa » : synthèse charge/dispo de l'équipe,
 * priorités du jour (joueurs à risque + action suggérée) et effectif filtrable.
 * Lit le même endpoint que le Suivi équipe (getSuiviEquipe) mais l'oriente
 * « gestion de la charge » et ouvre la fiche athlète (onglets prépa, Étape 4).
 * Code couleur du rôle = header uniquement ; le corps utilise --accent + sémantique. */
let _cockpitState = { joueurs: [], equipe: {}, filtre: null };

// Hero « Briefing du jour » partagé (accueils coach & prépa foot) — même langage
// visuel que l'accueil coach muscu : dégradé accent, anneau %, grand nombre, pastilles.
function _briefingHero(eq, total, labelJoueurs, greetingName) {
  const aGerer = eq.rouge || 0;
  const pct = total ? Math.round((total - aGerer) / total * 100) : 0;
  const dateFR = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const ring = (p, size, stroke, color, track) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, p)) / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
  };
  const pill = (n, label) => nvStat(n, label, { size:'sm', tone:'on-accent', class:'nv-stat--tile-accent', wrapStyle:'flex:1' });
  const labelAthlete = libelleSport('athlete').toLowerCase();
  return `
    <div style="position:relative;border-radius:20px;padding:18px;overflow:hidden;color:var(--on-accent);background:linear-gradient(135deg,var(--accent),var(--accent-strong));box-shadow:var(--shadow);margin-bottom:14px;">
      <div style="position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.12);"></div>
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.9;">Bonjour ${escapeHtml(greetingName || 'Coach')}</div>
        <div style="font-size:12px;opacity:.9;margin-top:2px;">${dateFR} · ${total} ${labelJoueurs} suivi${total > 1 ? 's' : ''}</div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:14px;">
          <div style="position:relative;width:64px;height:64px;flex-shrink:0;">
            ${ring(pct, 64, 6, '#fff', 'rgba(255,255,255,.28)')}
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="font-size:16px;font-weight:800;">${pct}%</div><div style="font-size:8px;opacity:.9;text-transform:uppercase;letter-spacing:.05em;">sous contrôle</div></div>
          </div>
          <div style="flex:1;min-width:0;"><div style="font-size:34px;font-weight:800;line-height:1;">${aGerer}</div><div style="font-size:12.5px;opacity:.92;margin-top:4px;font-weight:600;">${aGerer === 0 ? 'effectif sous contrôle 🎉' : labelAthlete + (aGerer > 1 ? 's' : '') + ' à gérer aujourd\'hui'}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          ${pill(eq.orange||0, 'à surveiller')}
          ${pill(eq.indispo||0, 'indispo')}
          ${pill((eq.charge_equipe||0).toLocaleString('fr-FR'), 'charge 7j')}
        </div>
      </div>
    </div>`;
}

// Action suggérée selon le type d'alerte principale (vocabulaire prépa).
const _COCKPIT_ACTIONS = {
  absence:     'Reprendre contact · replanifier une séance',
  surcharge:   'Réduire la charge · récupération active',
  charge:      'Surveiller la montée de charge',
  sous_charge: 'Réintroduire de la charge progressivement',
  douleur:     'Bilan douleur · avis kiné si besoin',
  fatigue:     'Alléger la séance · soigner le sommeil',
  sommeil:     'Point sommeil · hygiène de récupération',
};

async function renderCockpitPrepa() {
  const cont = document.getElementById('prepa-cockpit');
  if (!cont) return;
  cont.style.display = 'block';
  cont.innerHTML = '<div class="loader">Analyse de la charge…</div>';
  let data;
  try {
    const _ctrl = new AbortController();
    const _tSlow = setTimeout(() => showToast('Serveur en démarrage, quelques secondes…', 'var(--warn)'), 6000);
    const _tKill = setTimeout(() => _ctrl.abort(), 30000);
    const res = await fetch(`${SCRIPT_URL}?action=getSuiviEquipe&coach_id=${encodeURIComponent(coach.coach_id)}`, { signal: _ctrl.signal });
    clearTimeout(_tSlow); clearTimeout(_tKill);
    data = await res.json();
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Délai dépassé (30 s). Rafraîchis la page.' : 'Erreur de chargement.';
    cont.innerHTML = `<div style="color:var(--text-muted);padding:12px">${msg}</div>`;
    return;
  }

  const joueurs = data.joueurs || [];
  const eq = data.equipe || {};
  _cockpitState.joueurs = joueurs;
  _cockpitState.equipe = eq;
  _cockpitState.filtre = null;
  const labelJoueurs = libelleSport('athletes').toLowerCase();

  if (!joueurs.length) {
    cont.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px">Aucun ${libelleSport('athlete').toLowerCase()} associé à ton compte. Utilise « Lier un athlète » en haut pour composer ton effectif.</div>`;
    return;
  }

  const COL = { rouge: '#e5484d', orange: '#f5a623', vert: '#22c55e' };

  // ---- Hero « Briefing du jour » (composant partagé, même visuel que l'accueil coach muscu) ----
  const header = _briefingHero(eq, joueurs.length, labelJoueurs, coach ? coach.nom : 'Prépa');
  // ---- Bandeau chiffres équipe (charge / fatigue / progression) ----
  const kpi = (n, lbl, col) => nvStat(n, lbl, { color:(col||''), wrapStyle:'flex:1' });
  const statsCard = `
    <div class="dash-card" style="padding:14px 16px;margin-bottom:14px;">
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
        ${kpi(eq.fatigue_moyenne!=null ? eq.fatigue_moyenne+'/5' : '—', 'Fatigue moy.', eq.fatigue_moyenne!=null && eq.fatigue_moyenne>=4 ? COL.orange : '')}
        ${kpi(eq.bienetre_moyen!=null ? eq.bienetre_moyen+'/5' : '—', 'Bien-être moy.')}
        ${kpi(`<span style="color:#22c55e">${eq.en_progression||0}</span> · <span style="color:#e5484d">${eq.en_regression||0}</span>`, 'Prog. · Régr.')}
      </div>
    </div>`;

  // À gérer aujourd'hui : joueurs rouges, raison + action prépa suggérée
  const prioritaires = joueurs.filter(j => j.statut === 'rouge');
  const prioHtml = prioritaires.length ? `
    <div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-alert"/></svg>À gérer aujourd'hui</div></div>
    <div class="dash-card" style="padding:2px 14px;margin-bottom:14px;border-left:3px solid ${COL.rouge};">
      ${prioritaires.map(j => {
        const al = (j.alertes||[]).find(x => x.severite === 'haute') || (j.alertes||[])[0] || {};
        const action = _COCKPIT_ACTIONS[al.type] || 'À évaluer';
        return `<div onclick="_cockpitOuvrir('${j.athlete_id}')" style="display:flex;align-items:flex-start;gap:11px;padding:12px 0;border-top:1px solid var(--border);cursor:pointer;">
          <span style="width:9px;height:9px;border-radius:50%;background:${COL.rouge};flex-shrink:0;margin-top:4px;display:inline-block;"></span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:800;">${escapeHtml(j.nom)}${j.poste ? ` <span style="font-size:11px;color:var(--accent);font-weight:700;">${escapeHtml(j.poste)}</span>` : ''}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:1px;">${escapeHtml(al.message || 'Situation à risque')}</div>
            <div style="font-size:12px;color:var(--accent);font-weight:700;margin-top:4px;">→ ${escapeHtml(action)}</div>
          </div>
          <svg class="ico" style="color:var(--text-muted);flex-shrink:0;margin-top:2px;"><use href="#i-chevron-right"/></svg>
        </div>`;
      }).join('')}
    </div>` : `
    <div class="dash-card" style="padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:10px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${COL.vert};flex-shrink:0;display:inline-block;"></span>
      <div style="font-size:13px;color:var(--text-muted);">Aucun joueur à risque aujourd'hui. Effectif sous contrôle. 👍</div>
    </div>`;

  // Filtres effectif
  const FILTRES = [
    ['', 'Tous'], ['surcharge', 'Surcharge'], ['sous_charge', 'Sous-charge'],
    ['fatigue', 'Fatigue'], ['sommeil', 'Sommeil'], ['douleur', 'Douleur'],
    ['absence', 'Absence'], ['blessure', 'Blessés'],
  ];
  const fBtn = (val, lbl, on) => `<button data-cfiltre="${val}" onclick="_cockpitFiltrer(this.dataset.cfiltre||null)" style="flex:0 0 auto;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid ${on?'var(--accent-dim)':'var(--border)'};background:${on?'var(--accent-a14)':'var(--surface2)'};color:${on?'var(--accent)':'var(--text-muted)'};">${lbl}</button>`;
  const filtresHtml = `<div style="display:flex;gap:6px;padding:8px 0 12px;overflow-x:auto;scrollbar-width:none;">${FILTRES.map(([v,l]) => fBtn(v, l, v==='')).join('')}</div>`;

  cont.innerHTML = `
    ${header}
    ${statsCard}
    ${prioHtml}
    <div class="v2-sec"><div class="st">Effectif</div></div>
    ${filtresHtml}
    <div id="cockpit-effectif"></div>`;
  _cockpitRenderEffectif();
}

// Un joueur passe-t-il le filtre actif ?
function _cockpitMatch(j, f) {
  if (!f) return true;
  if (f === 'blessure') return !!j.blesse;
  const types = (j.alertes||[]).map(a => a.type);
  if (f === 'surcharge') return types.includes('surcharge') || types.includes('charge');
  return types.includes(f);
}

function _cockpitRenderEffectif() {
  const box = document.getElementById('cockpit-effectif');
  if (!box) return;
  const COL = { rouge: '#e5484d', orange: '#f5a623', vert: '#22c55e' };
  const dot = c => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></span>`;
  const list = _cockpitState.joueurs.filter(j => _cockpitMatch(j, _cockpitState.filtre));
  if (!list.length) {
    box.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:16px 4px;">Aucun joueur dans cette catégorie.</div>`;
    return;
  }
  const metric = (v, lbl) => `<div style="text-align:center;min-width:52px;"><div style="font-size:15px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;">${v}</div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${lbl}</div></div>`;
  box.innerHTML = list.map(j => {
    // Indisponible (blessé) : traité comme un état à part (gris), pas comme « au vert ».
    const col = j.blesse === 'indispo' ? 'var(--text-muted)' : (COL[j.statut] || COL.vert);
    const acwrTxt = j.acwr != null ? j.acwr.toFixed(2) : '—';
    const acwrCol = (j.acwr != null && j.acwr > 1.5) ? COL.rouge : (j.acwr != null && j.acwr > 1.3) ? COL.orange : 'var(--text)';
    const chips = (j.alertes||[]).map(al => {
      const c = al.severite === 'haute' ? COL.rouge : COL.orange;
      return `<span style="display:inline-block;font-size:11px;font-weight:700;color:${c};background:${c}1a;border-radius:20px;padding:3px 10px;">${al.message}</span>`;
    }).join(' ');
    const blesseChip = j.blesse ? `<span style="display:inline-block;font-size:11px;font-weight:700;color:var(--text-muted);background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:3px 10px;">${j.blesse==='indispo'?'Indisponible':'Retour progressif'}</span>` : '';
    return `
      <div class="dash-card" onclick="_cockpitOuvrir('${j.athlete_id}')" style="padding:13px 14px;margin-bottom:9px;border-left:3px solid ${col};cursor:pointer;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;">
            ${dot(col)}
            <div style="min-width:0;">
              <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(j.nom)} ${j.progression==='progression'?'<span style="color:#22c55e;">▲</span>':(j.progression==='regression'?'<span style="color:#e5484d;">▼</span>':'')}</div>
              <div style="font-size:11px;color:var(--text-muted);">${j.poste ? `<span style="color:var(--accent);font-weight:700;">${escapeHtml(j.poste)}</span> · ` : ''}${j.derniere_seance ? 'Dernière séance : '+j.derniere_seance : 'Aucune séance'}</div>
              ${j.login ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">🔑 login <b style="color:var(--text);">${escapeHtml(j.login)}</b> · mdp <b style="color:var(--text);">foot1234</b></div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-shrink:0;">
            ${metric(`<span style="color:${acwrCol}">${acwrTxt}</span>`, 'ACWR')}
            ${metric(j.seances_7j, 'Séances 7j')}
            ${metric(j.fatigue_moy!=null ? j.fatigue_moy : '—', 'Fatigue')}
          </div>
        </div>
        ${(chips||blesseChip) ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${chips}${blesseChip}</div>` : ''}
      </div>`;
  }).join('');
}

function _cockpitFiltrer(f) {
  _cockpitState.filtre = f || null;
  document.querySelectorAll('[data-cfiltre]').forEach(b => {
    const on = b.dataset.cfiltre === (f || '');
    b.style.background = on ? 'var(--accent-a14)' : 'var(--surface2)';
    b.style.borderColor = on ? 'var(--accent-dim)' : 'var(--border)';
    b.style.color = on ? 'var(--accent)' : 'var(--text-muted)';
  });
  _cockpitRenderEffectif();
}

// Ouvre la fiche du joueur. Sports co (foot…) → fiche joueur dédiée (bien-être,
// charge/ACWR, blessures, RTP). Muscu → fiche athlète classique.
// L'adaptation fine des onglets par rôle viendra à l'Étape 4.
function _cockpitOuvrir(athlete_id) {
  if (coach && coach.sport && coach.sport !== 'muscu') {
    ouvrirDetailJoueurFoot(athlete_id, 'coach');
    return;
  }
  const a = (athletesCoach || []).find(x => String(x.athlete_id) === String(athlete_id));
  if (a) ouvrirDetailAthleteCoach(a);
}

// Vue "Suivi équipe" (sports collectifs) — lit getSuiviEquipe (onglet Indicateurs).
async function renderSuiviEquipe() {
  const cont = document.getElementById('liste-athletes-coach');
  cont.innerHTML = '<div class="loader">Analyse de l\'équipe…</div>';
  let data;
  try {
    const _ctrl = new AbortController();
    const _tSlow = setTimeout(() => showToast('Serveur en démarrage, quelques secondes…', 'var(--warn)'), 6000);
    const _tKill = setTimeout(() => _ctrl.abort(), 30000);
    const res = await fetch(`${SCRIPT_URL}?action=getSuiviEquipe&coach_id=${encodeURIComponent(coach.coach_id)}`, { signal: _ctrl.signal });
    clearTimeout(_tSlow); clearTimeout(_tKill);
    data = await res.json();
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Délai dépassé (30 s). Rafraîchis la page.' : 'Erreur de chargement.';
    cont.innerHTML = `<div style="color:var(--text-muted);padding:12px">${msg}</div>`;
    return;
  }

  const joueurs = data.joueurs || [];
  const eq = data.equipe || {};
  const labelJoueurs = libelleSport('athletes').toLowerCase();

  if (!joueurs.length) {
    cont.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px">Aucun ${libelleSport('athlete').toLowerCase()} pour l'instant. Utilise « Lier un athlète » en haut.</div>`;
    return;
  }

  const dot = c => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></span>`;
  const COL = { rouge: '#e5484d', orange: '#f5a623', vert: '#22c55e' };

  // Bandeau équipe — hero « Briefing » partagé (même visuel que l'accueil coach muscu / cockpit prépa)
  const kpi = (n, lbl, col) => nvStat(n, lbl, { color:(col||''), wrapStyle:'flex:1' });
  const header = _briefingHero(eq, joueurs.length, labelJoueurs, coach ? coach.nom : 'Coach') + `
    <div class="dash-card" style="padding:14px 16px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
        ${kpi(eq.fatigue_moyenne!=null ? eq.fatigue_moyenne+'/5' : '—', 'Fatigue moy.', eq.fatigue_moyenne!=null && eq.fatigue_moyenne>=4 ? COL.orange : '')}
        ${kpi(eq.bienetre_moyen!=null ? eq.bienetre_moyen+'/5' : '—', 'Bien-être moy.')}
        ${kpi(`<span style="color:#22c55e">${eq.en_progression||0}</span> · <span style="color:#e5484d">${eq.en_regression||0}</span>`, 'Prog. · Régr.')}
      </div>
    </div>`;

  // Blessés & retours (§13)
  const blesses = data.blesses || [];
  const injLbl = { indispo:{l:'Indisponible',c:COL.rouge}, retour_progressif:{l:'Retour progressif',c:COL.orange} };
  const blessesHtml = blesses.length ? `
    <div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-alert"/></svg>Blessés &amp; retours</div></div>
    <div class="dash-card" style="padding:2px 14px;margin-bottom:12px;">
      ${blesses.map(b=>{ const st=injLbl[b.statut]||{l:b.statut,c:'var(--text-muted)'}; const retour = b.statut==='indispo' ? (b.retour_terrain?('retour prévu '+b.retour_terrain):'indisponible') : (b.retour_competition?('compét. '+b.retour_competition):'retour terrain fait'); return `<div onclick="ouvrirDetailJoueurFoot('${b.athlete_id}')" style="display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--border);cursor:pointer;"><span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap;color:${st.c};background:${st.c}1a;border:1px solid ${st.c}55;">${st.l}</span><div style="flex:1;min-width:0;"><b style="font-size:13px;">${escapeHtml(b.nom)}</b><div style="font-size:11px;color:var(--text-muted);">${escapeHtml((b.type||'')+(b.localisation?(' — '+b.localisation):''))}</div></div><span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${escapeHtml(retour)}</span></div>`; }).join('')}
    </div>` : '';

  // Liste joueurs (triés par risque côté backend)
  const cards = joueurs.map(j => {
    const col = COL[j.statut] || COL.vert;
    const metric = (v, lbl) => `<div style="text-align:center;min-width:52px;"><div style="font-size:15px;font-weight:800;color:var(--text);font-variant-numeric:tabular-nums;">${v}</div><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${lbl}</div></div>`;
    const acwrTxt = j.acwr != null ? j.acwr.toFixed(2) : '—';
    const acwrCol = (j.acwr != null && j.acwr > 1.5) ? COL.rouge : (j.acwr != null && j.acwr > 1.3) ? COL.orange : 'var(--text)';
    const chips = (j.alertes||[]).map(al => {
      const c = al.severite === 'haute' ? COL.rouge : COL.orange;
      return `<span style="display:inline-block;font-size:11px;font-weight:700;color:${c};background:${c}1a;border-radius:20px;padding:3px 10px;">${al.message}</span>`;
    }).join(' ');
    return `
      <div class="dash-card" onclick="ouvrirDetailJoueurFoot('${j.athlete_id}')" style="padding:13px 14px;margin-bottom:9px;border-left:3px solid ${col};cursor:pointer;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;align-items:center;gap:9px;flex:1;min-width:0;">
            ${dot(col)}
            <div style="min-width:0;">
              <div style="font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(j.nom)} ${j.progression==='progression'?'<span style="color:#22c55e;">▲</span>':(j.progression==='regression'?'<span style="color:#e5484d;">▼</span>':'')}</div>
              <div style="font-size:11px;color:var(--text-muted);">${j.poste ? `<span style="color:var(--accent);font-weight:700;">${escapeHtml(j.poste)}</span> · ` : ''}${j.derniere_seance ? 'Dernière séance : '+j.derniere_seance : 'Aucune séance'}</div>
              ${j.login ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">🔑 login <b style="color:var(--text);">${escapeHtml(j.login)}</b> · mdp <b style="color:var(--text);">foot1234</b></div>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:10px;flex-shrink:0;">
            ${metric(`<span style="color:${acwrCol}">${acwrTxt}</span>`, 'ACWR')}
            ${metric(j.seances_7j, 'Séances 7j')}
            ${metric(j.fatigue_moy!=null ? j.fatigue_moy : '—', 'Fatigue')}
          </div>
        </div>
        ${chips ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">${chips}</div>` : ''}
      </div>`;
  }).join('');

  // Alertes de la semaine — agrégées depuis les alertes joueurs
  const toutesAlertes = joueurs
    .filter(j => j.alertes && j.alertes.length)
    .flatMap(j => j.alertes.map(al => ({ ...al, nom: j.nom, athlete_id: j.athlete_id })))
    .sort((a, b) => (a.severite === 'haute' ? 0 : 1) - (b.severite === 'haute' ? 0 : 1))
    .slice(0, 6);
  const alertesSemaineHtml = toutesAlertes.length ? `
    <div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-bell"/></svg>Alertes de la semaine</div></div>
    <div class="dash-card" style="padding:2px 14px;margin-bottom:12px;">
      ${toutesAlertes.map(al => {
        const c = al.severite === 'haute' ? COL.rouge : COL.orange;
        return `<div onclick="ouvrirDetailJoueurFoot('${al.athlete_id}')" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--border);cursor:pointer;">
          <span style="width:8px;height:8px;border-radius:50%;background:${c};flex-shrink:0;display:inline-block;"></span>
          <div style="flex:1;min-width:0;">
            <span style="font-size:13px;font-weight:700;">${escapeHtml(al.nom)}</span>
            <span style="font-size:12px;color:var(--text-muted);"> — ${escapeHtml(al.message)}</span>
          </div>
          <svg class="ico" style="color:var(--text-muted);flex-shrink:0;"><use href="#i-chevron-right"/></svg>
        </div>`;
      }).join('')}
    </div>` : '';

  // Courbe charge équipe (SVG inline — 8 semaines)
  const chargeHebdo = data.charge_hebdo || [];
  let courbeHtml = '';
  if (chargeHebdo.length >= 2) {
    const W = 280, H = 64, PAD = 4;
    const vals = chargeHebdo.map(s => s.charge);
    const maxC = Math.max(...vals) || 1;
    const barW = Math.floor((W - PAD * 2) / vals.length) - 3;
    const bars = vals.map((v, i) => {
      const x = PAD + i * ((W - PAD * 2) / vals.length);
      const bh = Math.max(3, Math.round((v / maxC) * (H - 16)));
      const y = H - bh;
      const isLast = i === vals.length - 1;
      const col = isLast ? 'var(--accent)' : 'var(--accent-a15)';
      const lbl = chargeHebdo[i].sem.slice(0, 5);
      return `<rect x="${x.toFixed(1)}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${col}"/>
              <text x="${(x + barW/2).toFixed(1)}" y="${H + 1}" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-family="sans-serif">${lbl}</text>`;
    }).join('');
    courbeHtml = `
      <div class="v2-sec" style="margin-top:4px;"><div class="st"><svg class="ico"><use href="#i-activity"/></svg>Charge collective — 8 semaines</div></div>
      <div class="dash-card" style="padding:14px 16px 18px;margin-bottom:12px;overflow:hidden;">
        <svg width="100%" viewBox="0 0 ${W} ${H + 10}" style="display:block;overflow:visible;">
          ${bars}
        </svg>
      </div>`;
  }

  const showComp = sportConfig(coach && coach.sport).groupe === 'Équipe';
  const _eqTabBtn = (t, on) => `<button data-eqtab="${t}" onclick="switchEquipeTab('${t}')" style="flex:1;text-align:center;padding:11px 4px;font-size:13px;font-weight:700;border:none;border-bottom:2px solid ${on?'var(--accent)':'transparent'};color:${on?'var(--text)':'var(--text-muted)'};background:none;cursor:pointer;">${t==='suivi'?'Suivi équipe':'Comparatif équipe'}</button>`;
  const tabBar = showComp ? `<div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:0;">${_eqTabBtn('suivi',true)}${_eqTabBtn('comp',false)}</div>` : '';

  const suiviHtml = `<div id="eq-tab-suivi">
    <div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-gauge"/></svg>Suivi de l'équipe — ${joueurs.length} ${labelJoueurs}</div></div>
    ${header}${alertesSemaineHtml}${blessesHtml}${courbeHtml}
    <div class="v2-sec"><div class="st">Effectif</div></div>
    ${cards}
  </div>`;

  let compHtml = '';
  if (showComp) {
    _eqCompState.joueurs = joueurs;
    _eqCompState.poste = null;
    _eqCompState.sortCol = 2;
    _eqCompState.sortDir = -1;
    const postes = [...new Set(joueurs.map(j => j.poste).filter(Boolean))].sort();
    const pBtnStyle = (on) => `flex:0 0 auto;padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid ${on?'var(--accent-dim)':'var(--border)'};background:${on?'var(--accent-a14)':'var(--surface2)'};color:${on?'var(--accent)':'var(--text-muted)'};`;
    const posteBtns = [`<button data-eqposte="" onclick="_eqPoste(this.dataset.eqposte||null)" style="${pBtnStyle(true)}">Tous</button>`,
      ...postes.map(p => `<button data-eqposte="${escapeHtml(p)}" onclick="_eqPoste(this.dataset.eqposte||null)" style="${pBtnStyle(false)}">${escapeHtml(p)}</button>`)
    ].join('');
    compHtml = `<div id="eq-tab-comp" style="display:none;padding-top:4px;">
      <div style="display:flex;gap:6px;padding:8px 0 10px;overflow-x:auto;scrollbar-width:none;">${posteBtns}</div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table id="eq-comp-table" style="width:100%;border-collapse:collapse;font-size:12px;"></table></div>
        <div style="padding:8px 12px;font-size:10px;color:var(--text-muted);border-top:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span><span style="width:7px;height:7px;border-radius:50%;display:inline-block;background:var(--good);margin-right:3px;vertical-align:middle;"></span>Meilleur</span>
          <span><span style="width:7px;height:7px;border-radius:50%;display:inline-block;background:var(--bad);margin-right:3px;vertical-align:middle;"></span>ACWR ≥ 1.5</span>
          <span>En-tête → tri · Ligne → fiche joueur</span>
        </div>
      </div>
    </div>`;
  }

  cont.innerHTML = tabBar + suiviHtml + compHtml;
  if (showComp) setTimeout(_eqCompRender, 0);
}

let _eqCompState = { joueurs: [], poste: null, sortCol: 2, sortDir: -1 };

function switchEquipeTab(t) {
  ['suivi','comp'].forEach(id => {
    const el = document.getElementById('eq-tab-'+id);
    if (el) el.style.display = (id===t) ? 'block' : 'none';
  });
  document.querySelectorAll('[data-eqtab]').forEach(b => {
    const on = b.dataset.eqtab === t;
    b.style.color = on ? 'var(--text)' : 'var(--text-muted)';
    b.style.borderBottomColor = on ? 'var(--accent)' : 'transparent';
  });
}

function _eqCompRender() {
  const { joueurs, poste, sortCol, sortDir } = _eqCompState;
  const list = poste ? joueurs.filter(j => j.poste === poste) : joueurs;
  const COLS = [
    ['Joueur','nom',null],['St','statut',null],
    ['ACWR','acwr','acwr'],['Bien-être','bienetre_moyen','haut'],
    ['Fatigue','fatigue_moy','bas'],['Séances 7j','seances_7j','haut']
  ];
  const best = {};
  COLS.forEach(([,key,dir],ci) => {
    if (dir==='haut') { const vals=list.map(j=>j[key]).filter(v=>v!=null); if(vals.length) best[ci]=Math.max(...vals); }
    if (dir==='bas')  { const vals=list.map(j=>j[key]).filter(v=>v!=null); if(vals.length) best[ci]=Math.min(...vals); }
  });
  const rows = [...list].sort((a,b) => {
    const key=COLS[sortCol][1], va=a[key]??'', vb=b[key]??'';
    if (typeof va==='number'&&typeof vb==='number') return (va-vb)*sortDir;
    return String(va).localeCompare(String(vb))*sortDir;
  });
  const ini = n => n.split(/[\s.]+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const thS = ci => `padding:9px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;border-bottom:1px solid var(--border);text-align:${ci>=2?'right':'left'};white-space:nowrap;color:${ci===sortCol?'var(--text)':'var(--text-muted)'};${ci>=2?'cursor:pointer;':''}`;
  const head = '<thead><tr>'+COLS.map(([lbl,,],ci) => `<th style="${thS(ci)}"${ci>=2?` onclick="_eqSortBy(${ci})"`:''} >${lbl}${ci===sortCol?(sortDir<0?' ↓':' ↑'):''}</th>`).join('')+'</tr></thead>';
  const body = '<tbody>'+rows.map(j => '<tr onclick="ouvrirDetailJoueurFoot(\''+j.athlete_id+'\')" style="cursor:pointer;">'+COLS.map(([,key,dir],ci) => {
    const v = j[key];
    if (key==='nom') return `<td style="padding:9px 8px;white-space:nowrap;"><div style="display:flex;align-items:center;gap:6px;"><div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#1a3260,#0d1a30);border:1px solid var(--border);font-size:9px;font-weight:800;color:#cfe0ff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ini(v)}</div><b style="font-size:12px;">${escapeHtml(v)}</b></div></td>`;
    if (key==='statut') { const sc=v==='rouge'?'#e5484d':v==='orange'?'#f5a623':'#22c55e'; return `<td style="padding:9px 8px;text-align:right;"><span style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${sc};"></span></td>`; }
    const al = 'padding:9px 8px;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;';
    if (dir==='acwr') { const ac=v==null?'var(--text-muted)':v>1.5?'#e5484d':v>1.3?'#f5a623':'#22c55e'; return `<td style="${al}color:${ac};font-weight:800;">${v!=null?v.toFixed(2):'—'}</td>`; }
    const isBest=v!=null&&v===best[ci], disp=v!=null?(Number.isInteger(v)?v:v.toFixed(1)):'—';
    return `<td style="${al}${isBest?'color:var(--good);font-weight:800;':''}">${disp}</td>`;
  }).join('')+'</tr>').join('')+'</tbody>';
  const tbl = document.getElementById('eq-comp-table');
  if (tbl) tbl.innerHTML = head+body;
}

function _eqSortBy(ci) {
  if (_eqCompState.sortCol===ci) _eqCompState.sortDir*=-1; else { _eqCompState.sortCol=ci; _eqCompState.sortDir=-1; }
  _eqCompRender();
}

function _eqPoste(p) {
  _eqCompState.poste = p||null;
  _eqCompState.sortCol = 2;
  _eqCompState.sortDir = -1;
  document.querySelectorAll('[data-eqposte]').forEach(b => {
    const on = b.dataset.eqposte===(p||'');
    b.style.background = on ? 'var(--accent-a14)' : 'var(--surface2)';
    b.style.borderColor = on ? 'var(--accent-dim)' : 'var(--border)';
    b.style.color = on ? 'var(--accent)' : 'var(--text-muted)';
  });
  _eqCompRender();
}

function joursDepuis(dateVal) {
  if (!dateVal) return '—';
  const ts = parseChatDate(dateVal);
  if (!ts) return String(dateVal);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const j = Math.round((now - d) / 86400000);
  if (j <= 0) return "aujourd'hui";
  if (j === 1) return 'hier';
  return `il y a ${j} j`;
}

function labelAlerteCourt(a) {
  const alertes = alertesActives(a);
  if (alertes.length === 0) return null;
  const map = { fatigue: 'Fatigue', surcharge: 'Surcharge', irregularite: 'Absence', stagnation: 'Stagnation', regression: 'Régression' };
  const principale = alertes.find(al => al.severite === 'haute') || alertes[0];
  return map[principale.type] || (principale.type || 'Alerte');
}

async function renderCoachSynthese(athletes) {
  const el = document.getElementById('coach-synthese');
  if (!el) return;
  if (!athletes || athletes.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px">Aucun athlète associé à ton compte.</div>';
    return;
  }
  el.innerHTML = '<div class="loader">Analyse des athlètes…</div>';

  // Charge les données de chaque athlète (mêmes calculs que la page détail)
  const datas = await Promise.all(athletes.map(async a => {
    try { const r = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(a.athlete_id)}`); return await r.json(); }
    catch(e) { return null; }
  }));

  // Messages non lus par athlète (auteur = athlète, non lus côté coach) → notif dès l'accueil
  const msgNonLus = await Promise.all(athletes.map(async a => {
    try {
      const r = await fetch(`${SCRIPT_URL}?action=getCommentaires&athlete_id=${encodeURIComponent(a.athlete_id)}&nocache=${Date.now()}`);
      const d = await r.json();
      return (d.commentaires || []).filter(c => c.auteur === 'athlete' && !estLu(c, 'muscu_lu_coach')).length;
    } catch(e) { return 0; }
  }));
  // Badge total de messages non lus dans le header de l'accueil coach
  (function(){
    const total = msgNonLus.reduce((s, n) => s + (n || 0), 0);
    const b = document.getElementById('coach-msg-badge');
    if (b) { b.textContent = total; b.style.display = total > 0 ? 'block' : 'none'; }
  })();

  const enrich = athletes.map((a, i) => {
    let m = null;
    try { if (datas[i]) m = computeMarqueursCoach(datas[i], a); }
    catch (err) { console.error('Marqueurs KO pour', a.nom, err); }
    // Données pour les marqueurs de carte + mini-courbe
    const d = datas[i] || {};
    const rpe = (d.recent && d.recent.j7 && d.recent.j7.rpe_moyen != null) ? d.recent.j7.rpe_moyen
              : (d.dashboard && d.dashboard.recuperation ? d.dashboard.recuperation.rpe_moyen : null);
    const _reg = d.dashboard && d.dashboard.regularite ? d.dashboard.regularite : null;
    const seancesSem = _reg ? (_reg.seances_semaine != null ? _reg.seances_semaine : _reg.seances_j7) : null;
    let spark = [];
    const _vpj = (d.recent && d.recent.volume_par_jour) ? d.recent.volume_par_jour
               : (d.historique && d.historique.volume_par_jour ? d.historique.volume_par_jour : null);
    if (_vpj) {
      spark = Object.keys(_vpj).sort()
        .map(k => Number(_vpj[k])).filter(v => !isNaN(v)).slice(-8);
    }
    const tonnage = d.dashboard && d.dashboard.tonnage ? d.dashboard.tonnage : null;
    const streak = d.dashboard && d.dashboard.streak ? d.dashboard.streak.semaines : null;
    return { a, i, m, rpe, seancesSem, spark, tonnage, streak, msgNonLus: msgNonLus[i] || 0, enPause: estEnPause(d.pause) };
  });
  enrich.sort((x, y) => {
    const rx = x.m ? x.m.statut.rank : -1, ry = y.m ? y.m.statut.rank : -1;
    return (ry - rx) || String(x.a.nom).localeCompare(String(y.a.nom));
  });

  // KPIs — les athlètes en vacances ne comptent ni dans "à surveiller" ni "action".
  document.getElementById('coach-stat-surveiller').textContent = enrich.filter(e => !e.enPause && e.m && e.m.statut.rank >= 1).length;
  document.getElementById('coach-stat-action').textContent = enrich.filter(e => !e.enPause && e.m && e.m.statut.rank === 2).length;
  const absents = enrich.filter(e => {
    const dt = e.m && e.m.derniere ? e.m.derniere.date : null;
    if (!dt) return true; // aucune séance connue = absent
    const ts = parseChatDate(dt);
    if (!ts) return false;
    return (Date.now() - ts) / 86400000 > 7;
  }).length;
  const absEl = document.getElementById('coach-stat-absents');
  if (absEl) { absEl.textContent = absents; absEl.style.color = absents > 0 ? 'var(--warn)' : 'var(--good)'; }

  const initiales = nom => (nom || '?').split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
  // Mini-courbe de forme (tonnage des dernières séances)
  const miniSpark = (pts, color) => {
    if (!pts || pts.length < 2) return '<div style="width:56px;flex-shrink:0;"></div>';
    const W=56,H=26,min=Math.min(...pts),max=Math.max(...pts),span=(max-min)||1;
    const x=k=>(k/(pts.length-1))*W, y=v=>H-3-((v-min)/span)*(H-6);
    const d=pts.map((v,k)=>`${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(' L');
    return `<svg width="56" height="26" viewBox="0 0 ${W} ${H}" style="flex-shrink:0;"><path d="M${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  // Détermine la raison de priorité d'un athlète
  const infoPrio = (e) => {
    const { a, m } = e;
    const dsAge = (m && m.derniere) ? (Date.now() - (parseChatDate(m.derniere.date) || Date.now())) / 86400000 : Infinity;
    // Couleurs en HEX (nécessaire pour l'ajout d'alpha ${color}14 — un var() ne le permet pas)
    const WARN = '#f59f00', BAD = '#f0505a';
    // (Les messages non lus ne sont PLUS listés ici — ils remontent via l'icône 💬 du header)
    // En vacances : aucune raison de priorité (ni absence, ni alerte, ni synthèse).
    if (e.enPause) return null;
    if (dsAge > 7) return { icon:'💤', txt: (m && m.derniere) ? `${joursDepuis(m.derniere.date)} sans séance` : 'Aucune séance', color: WARN };
    const al = labelAlerteCourt(a);
    if (al) return { icon:'⚠', txt: al, color: (m && m.statut.rank===2) ? BAD : WARN };
    // Intervention seulement s'il reste une alerte de synthèse rouge NON traitée
    if (m && m.statut.rank===2 && synthAlertesActivesCoach(a.athlete_id, m).length) return { icon:'⚠', txt:'Intervention conseillée', color: BAD };
    return null;
  };

  // ---- Bloc « À traiter en priorité » ----
  const prioritaires = enrich.map(e => ({ e, p: infoPrio(e) })).filter(x => x.p);
  let prioHtml = '';
  if (prioritaires.length) {
    prioHtml = `<div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-bell"/></svg>À traiter en priorité</div></div>` +
      prioritaires.map(({ e, p }) => `
        <div onclick="ouvrirAthleteDepuisSelect('${e.i}')" style="display:flex;align-items:center;gap:11px;padding:12px 14px;border-radius:13px;margin-bottom:8px;cursor:pointer;background:${p.color}14;border:1px solid ${p.color}44;">
          <div style="width:34px;height:34px;border-radius:10px;background:${p.color}22;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">${p.icon}</div>
          <div style="flex:1;min-width:0;"><div style="font-size:13.5px;font-weight:700;">${escapeHtml(e.a.nom)}</div><div style="font-size:11.5px;color:var(--text-muted);">${p.txt}</div></div>
          <span style="color:var(--text-muted);font-size:18px;">›</span>
        </div>`).join('');
  }

  // ---- Bloc « Analyse Novalyz » (moteur, par athlète) ----
  let briefingHtml = '';
  if (typeof NovalyzEngine !== 'undefined') {
    const insights = [];
    enrich.forEach(e => {
      let ana = [];
      try { ana = NovalyzEngine.analyser(datas[e.i] || {}) || []; } catch (err) { ana = []; }
      const top = ana.find(x => x.type === 'critical' || x.type === 'warning');
      if (top) insights.push({ e, top });
    });
    insights.sort((x, y) => (y.top.priorite || 0) - (x.top.priorite || 0));
    if (insights.length) {
      briefingHtml = `<div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-activity"/></svg>Analyse Novalyz</div></div>` +
        insights.map(({ e, top }) => {
          const c = analyseCouleur(top.type);
          return `<div onclick="ouvrirAthleteDepuisSelect('${e.i}')" style="display:flex;align-items:flex-start;gap:11px;padding:12px 14px;border-radius:13px;margin-bottom:8px;cursor:pointer;background:var(--surface);border:1px solid var(--border);border-left:4px solid ${c};">
            <div style="min-width:0;flex:1;">
              <div style="font-size:13.5px;font-weight:700;">${escapeHtml(e.a.nom)}</div>
              <div style="font-size:12.5px;font-weight:700;color:${c};margin-top:2px;">${analyseIcone(top.type)} ${escapeHtml(top.titre)}</div>
              <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;margin-top:2px;">${escapeHtml(top.description)}</div>
            </div>
            <span style="color:var(--text-muted);font-size:18px;flex-shrink:0;">›</span>
          </div>`;
        }).join('');
    }
  }

  // ---- Liste complète ----
  const listeHtml = `<div class="v2-sec"><div class="st"><svg class="ico"><use href="#i-gauge"/></svg>Mes ${libelleSport('athletes').toLowerCase()}</div></div>` +
    enrich.map(({ a, i, m, rpe, seancesSem, spark, tonnage, streak, enPause }) => {
    const s = m ? m.statut : { color: 'var(--text-muted)', label: '—', rank: -1 };
    const meta = [];
    if (seancesSem != null) meta.push(`<span><b style="color:var(--text);">${seancesSem}</b> séance${seancesSem>1?'s':''}/sem</span>`);
    if (rpe != null) meta.push(`<span>RPE <b style="color:var(--text);">${rpe}</b></span>`);
    const _tval = tonnage ? (tonnage.j7 != null ? tonnage.j7 : tonnage.semaine) : null;
    const _tevol = tonnage ? (tonnage.evol_pct != null ? tonnage.evol_pct : tonnage.evol) : null;
    if (_tval > 0) {
      const tc = _tevol != null ? (_tevol >= 0 ? '#00c96e' : '#f59f00') : 'var(--text)';
      const tarr = _tevol != null ? ` ${_tevol >= 0 ? '▲' : '▼'}${Math.abs(_tevol)}%` : '';
      meta.push(`<span>Tonnage <b style="color:${tc};">${_tval}t${tarr}</b></span>`);
    }
    if (streak != null && streak > 0) meta.push(`<span>🔥 <b style="color:#f5a524;">${streak} sem.</b></span>`);
    if (m && m.volLabel && m.volLabel !== 'N/A') meta.push(`<span style="color:${m.volColor};font-weight:700;">${m.volLabel}</span>`);
    if (m && m.progLabel && m.progLabel !== 'N/A') meta.push(`<span style="color:${m.progColor};font-weight:700;">${m.progLabel}</span>`);
    const badgeVacances = enPause ? `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,179,237,.12);color:#63b3ed;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:800;white-space:nowrap;">🏖️ Vacances</span>` : '';
    return `<div onclick="ouvrirAthleteDepuisSelect('${i}')" style="display:flex;align-items:center;gap:12px;padding:13px 14px;background:var(--surface);border:1px solid ${enPause ? 'rgba(99,179,237,.3)' : 'var(--border)'};border-radius:14px;margin-bottom:9px;cursor:pointer;transition:border-color .15s;" onmouseenter="this.style.borderColor='var(--accent-dim)'" onmouseleave="this.style.borderColor='${enPause ? 'rgba(99,179,237,.3)' : 'var(--border)'}'">
      <div style="width:44px;height:44px;border-radius:13px;background:${enPause ? 'rgba(99,179,237,.12)' : s.color+'22'};color:${enPause ? '#63b3ed' : s.color};font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${enPause ? '🏖️' : initiales(a.nom)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;"><span style="font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(a.nom)}</span>${badgeVacances}</div>
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:2px;display:flex;gap:9px;flex-wrap:wrap;">${enPause ? '<span style="color:#63b3ed;">Pas d\'alerte absence pendant les vacances</span>' : meta.join('<span style="opacity:.4">·</span>')}</div>
      </div>
      ${enPause ? '' : miniSpark(spark, s.color)}
      ${enPause ? '' : `<span style="display:inline-flex;align-items:center;gap:6px;background:${s.color}1a;color:${s.color};padding:5px 11px;border-radius:var(--radius-pill);font-size:11.5px;font-weight:800;white-space:nowrap;flex-shrink:0;"><span style="width:7px;height:7px;border-radius:50%;background:${s.color};"></span>${s.label}</span>`}
    </div>`;
  }).join('');

  // ---- Hero « Briefing du jour » (Concept A) ----
  const total = athletes.length;
  const aVoir = prioritaires.length;
  const nbSurveiller = enrich.filter(e => e.m && e.m.statut.rank >= 1).length;
  const nbInterv = enrich.filter(e => e.m && e.m.statut.rank === 2).length;
  const pctAJour = total ? Math.round((total - aVoir) / total * 100) : 0;
  const dateFR = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const svgRing = (pct, size, stroke, color, track) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
  };
  const heroPill = (n, label) => nvStat(n, label, { size:'sm', tone:'on-accent', class:'nv-stat--tile-accent', wrapStyle:'flex:1' });
  const heroHtml = `
    <div style="position:relative;border-radius:20px;padding:18px;overflow:hidden;color:var(--on-accent);background:linear-gradient(135deg,var(--accent),var(--accent-strong));box-shadow:var(--shadow);margin-bottom:16px;">
      <div style="position:absolute;right:-40px;top:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.12);"></div>
      <div style="position:relative;z-index:1;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.9;">Bonjour ${escapeHtml(coach ? coach.nom : 'Coach')}</div>
        <div style="font-size:12px;opacity:.9;margin-top:2px;">${dateFR} · ${total} athlète${total > 1 ? 's' : ''} suivi${total > 1 ? 's' : ''}</div>
        <div style="display:flex;align-items:center;gap:16px;margin-top:14px;">
          <div style="position:relative;width:64px;height:64px;flex-shrink:0;">
            ${svgRing(pctAJour, 64, 6, '#fff', 'rgba(255,255,255,.28)')}
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><div style="font-size:16px;font-weight:800;">${pctAJour}%</div><div style="font-size:8px;opacity:.9;text-transform:uppercase;letter-spacing:.05em;">à jour</div></div>
          </div>
          <div style="flex:1;min-width:0;"><div style="font-size:34px;font-weight:800;line-height:1;">${aVoir}</div><div style="font-size:12.5px;opacity:.92;margin-top:4px;font-weight:600;">${aVoir === 0 ? 'tout le monde est à jour 🎉' : 'athlète' + (aVoir > 1 ? 's' : '') + ' à voir aujourd\'hui'}</div></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          ${heroPill(nbSurveiller, 'à surveiller')}
          ${heroPill(nbInterv, 'intervention')}
          ${heroPill(absents, 'absents')}
        </div>
      </div>
    </div>`;

  el.innerHTML = heroHtml + prioHtml + briefingHtml + listeHtml;
}

function ouvrirAthleteDepuisSelect(idx) {
  if (idx === '' || idx === null || idx === undefined) return;
  const a = athletesCoach[Number(idx)];
  if (a) ouvrirDetailAthleteCoach(a);
}

// ---- Messagerie coach (liste des conversations depuis l'accueil) ----
function fermerMessagerieCoach() {
  document.getElementById('coach-messagerie-overlay').style.display = 'none';
  document.getElementById('coach-messagerie-drawer').style.display = 'none';
}
async function ouvrirMessagerieCoach() {
  const overlay = document.getElementById('coach-messagerie-overlay');
  const drawer  = document.getElementById('coach-messagerie-drawer');
  const liste   = document.getElementById('coach-messagerie-liste');
  if (!drawer || !liste) return;
  overlay.style.display = 'block';
  drawer.style.display = 'flex';
  liste.innerHTML = '<div class="loader">Chargement...</div>';
  const athletes = athletesCoach || [];
  if (!athletes.length) { liste.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:13px;">Aucun athlète.</div>'; return; }
  // Récupère les messages de chaque athlète (dernier message + non lus)
  const infos = await Promise.all(athletes.map(async (a) => {
    try {
      const r = await fetch(`${SCRIPT_URL}?action=getCommentaires&athlete_id=${encodeURIComponent(a.athlete_id)}&nocache=${Date.now()}`);
      const d = await r.json();
      const msgs = (d.commentaires || []).slice().sort((x, y) => parseChatDate(y.date) - parseChatDate(x.date));
      // Lu si : serveur (c.lu), clé muscu, OU clé foot par athlète (conversation foot).
      const lusFoot = getLusLocaux('foot_lu_coach_' + a.athlete_id);
      const nonLus = msgs.filter(c => c.auteur === 'athlete' && !estLu(c, 'muscu_lu_coach') && !lusFoot.has(String(c.id))).length;
      return { a, dernier: msgs[0] || null, nonLus };
    } catch (e) { return { a, dernier: null, nonLus: 0 }; }
  }));
  // Tri : non lus d'abord, puis message le plus récent
  infos.sort((x, y) => (y.nonLus - x.nonLus) || (parseChatDate(y.dernier && y.dernier.date) - parseChatDate(x.dernier && x.dernier.date)));
  const initiales = nom => (nom || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  liste.innerHTML = infos.map(({ a, dernier, nonLus }) => {
    const idx = athletesCoach.indexOf(a);
    const apercu = dernier ? (dernier.auteur === 'athlete' ? '' : 'Toi : ') + String(dernier.message).slice(0, 42) : 'Aucun message';
    const heure = dernier ? formatChatDate(dernier.date).split(' ').slice(-1)[0] : '';
    return `<div onclick="ouvrirConversationDepuisMessagerie('${idx}')" style="display:flex;align-items:center;gap:11px;padding:11px 10px;border-radius:12px;cursor:pointer;${nonLus>0?'background:var(--accent-a08);':''}">
      <div style="width:42px;height:42px;border-radius:12px;background:var(--accent-a12);color:var(--accent-strong);font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initiales(a.nom)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(a.nom)}</span>${nonLus>0?`<span style="background:var(--accent);color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;line-height:16px;text-align:center;padding:0 3px;flex-shrink:0;">${nonLus}</span>`:''}</div>
        <div style="font-size:11.5px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">${escapeHtml(apercu)}</div>
      </div>
      <span style="font-size:10px;color:var(--text-muted);flex-shrink:0;">${heure}</span>
    </div>`;
  }).join('');
}
function ouvrirConversationDepuisMessagerie(idx) {
  fermerMessagerieCoach();
  const a = athletesCoach[Number(idx)];
  if (!a) return;
  // Route selon le sport : joueur foot → fiche foot (onglet conversation), sinon vue muscu.
  const estFoot = (coach && coach.sport && coach.sport !== 'muscu') || (a.sport && a.sport !== 'muscu');
  if (estFoot && typeof ouvrirDetailJoueurFoot === 'function') {
    ouvrirDetailJoueurFoot(a.athlete_id, 'coach');
    if (typeof switchDetailJoueurTab === 'function') setTimeout(() => switchDetailJoueurTab(3), 60);
  } else {
    ouvrirDetailAthleteCoach(a, 'conseils');
  }
}

// ---- Alertes traitées (stockage local, remise à zéro chaque semaine) ----
function lundiCourantISO() {
  const d = new Date();
  const jour = d.getDay();
  const diff = (jour === 0 ? -6 : 1 - jour);
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.toISOString().split('T')[0];
}
let alertesTraiteesCache = {};
async function chargerAlertesTraitees() {
  if (!coach) { alertesTraiteesCache = {}; return; }
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAlertesTraitees&coach_id=${encodeURIComponent(coach.coach_id)}`);
    const data = await res.json();
    alertesTraiteesCache = data.traitees || {};
  } catch(e) { alertesTraiteesCache = {}; }
}
function identifiantStableAlerte(al) {
  // Le message peut contenir des valeurs dynamiques (RPE, %) qui changent à chaque recalcul.
  // On utilise un identifiant stable : le type, + le nom de l'exercice pour les stagnations.
  if (al.type === 'stagnation') return 'stagnation|' + al.message.split(' : aucun progrès')[0];
  return al.type || al.message;
}
function cleAlerte(athleteId, al) { return athleteId + '|' + identifiantStableAlerte(al); }
function alerteEstTraitee(athleteId, al) {
  return alertesTraiteesCache[cleAlerte(athleteId, al)] === lundiCourantISO();
}
function marquerAlerteTraitee(athleteId, al) {
  if (!coach) return;
  const cle = cleAlerte(athleteId, al);
  alertesTraiteesCache[cle] = lundiCourantISO();
  renderListeAthletesCoach();
  // Rafraîchir l'accueil (Concept A) pour que l'alerte traitée en parte aussi
  if (typeof athletesCoach !== 'undefined' && athletesCoach && athletesCoach.length) {
    try { renderCoachSynthese(athletesCoach); } catch (e) {}
  }
  fetch(SCRIPT_URL, {
    method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify({ action: 'marquerAlerteTraitee', coach_id: coach.coach_id, cle, semaine: lundiCourantISO() })
  });
}
function alertesActives(a) {
  return (a.alertes || []).filter(al => !alerteEstTraitee(a.athlete_id, al));
}
// Alertes de synthèse ROUGES encore actives (non traitées) pour un athlète
function synthAlertesActivesCoach(athleteId, m) {
  if (!m) return [];
  const list = [];
  if (m.volColor === '#e5484d' || m.volColor === 'var(--bad)') list.push('synth-volume');
  if (m.progColor === '#e5484d') list.push('synth-progression');
  if (m.recupColor === '#e5484d') list.push('synth-recup');
  if (m.regColor === '#e5484d') list.push('synth-regularite');
  return list.filter(t => !alerteEstTraitee(athleteId, { type: t }));
}

function renderCoachSurveiller(athletes) {
  const card = document.getElementById('coach-surveiller-card');
  const titre = document.getElementById('coach-surveiller-titre');
  const content = document.getElementById('coach-surveiller-content');
  const couleurSeverite = { haute: '#e5484d', moyenne: '#f5a623', basse: '#a3a3a3' };

  // Athlètes avec au moins une alerte NON TRAITÉE
  const aSurveiller = athletes.filter(a => alertesActives(a).length > 0);

  if (aSurveiller.length === 0) {
    // Le KPI "À surveiller: 0" suffit — on masque le bandeau pour éviter la redondance
    card.style.display = 'none';
    return;
  }

  card.className = 'dash-card dash-card-accent-orange';
  const nb = aSurveiller.length;
  titre.textContent = `⚠️ ${nb} athlète${nb>1?'s':''} à surveiller`;

  content.innerHTML = aSurveiller.map((a, i) => {
    const alertes = alertesActives(a);
    const sevMax = alertes.some(al => al.severite === 'haute') ? 'haute'
      : alertes.some(al => al.severite === 'moyenne') ? 'moyenne' : 'basse';
    const couleur = couleurSeverite[sevMax];
    const lignesAlertes = alertes.map((al, j) => `
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <div style="flex:1;font-size:11px;color:${couleurSeverite[al.severite] || '#a3a3a3'};font-weight:600">⚠️ ${al.message}${al.recurrence_semaines > 1 ? ` <span style="color:var(--text-muted);font-weight:400">(depuis ${al.recurrence_semaines} semaines)</span>` : ''}</div>
        <button class="btn-sm btn-outline btn-traiter" data-aidx="${i}" data-jidx="${j}" style="white-space:nowrap" onclick="event.stopPropagation()">✓ Traité</button>
      </div>`).join('');
    return `
      <div style="padding:10px;background:${couleur}1a;border-radius:8px;margin-top:8px">
        <div class="coach-surv-head" data-idx="${i}" style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <div style="background:${couleur};color:#fff;font-weight:800;font-size:13px;min-width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center">${i+1}</div>
          <div style="flex:1;font-size:14px;font-weight:800">${a.nom}</div>
          <div style="font-size:16px;color:${couleur}">›</div>
        </div>
        ${lignesAlertes}
      </div>`;
  }).join('');

  // Clic sur l'en-tête → ouvrir le détail
  content.querySelectorAll('.coach-surv-head').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-idx'));
      ouvrirDetailAthleteCoach(aSurveiller[idx]);
    });
  });
  // Clic sur "Traité" → masquer cette alerte pour la semaine
  content.querySelectorAll('.btn-traiter').forEach(el => {
    el.addEventListener('click', () => {
      const a = aSurveiller[parseInt(el.getAttribute('data-aidx'))];
      const al = alertesActives(a)[parseInt(el.getAttribute('data-jidx'))];
      if (a && al) marquerAlerteTraitee(a.athlete_id, al);
    });
  });

  card.style.display = 'block';
}

// ==================== DETAIL ATHLETE (COACH) ==================== [MIXTE]
let coachAthleteData = null;       // résultat getAppData de l'athlète sélectionné
let coachAthleteCourant = null;    // objet athlète (depuis la liste, contient alertes/annees)
let cdProgressionData = {};
let cdTendancesData = null;
let cdSeancesDates = {};
let cdCalDate = new Date();

function retourListeAthletesCoach() {
  document.getElementById('view-coach-detail').classList.remove('active');
  document.getElementById('view-coach').classList.add('active');
  document.body.classList.remove('cd-nav');
  document.body.classList.remove('athlete-selected');
  coachAthleteCourant = null;
  localStorage.removeItem('muscu_coach_vue');
  const sel = document.getElementById('coach-select-athlete');
  if (sel) sel.value = '';
}

// Retour contextuel : depuis un onglet -> Aperçu ; depuis l'Aperçu -> liste des athlètes
function retourCoachDetail() {
  const ov = document.getElementById('cdtab-overview');
  if (ov && ov.style.display === 'none') {
    switchCoachDetailTab('overview');
    window.scrollTo(0, 0);
  } else {
    retourListeAthletesCoach();
  }
}

const CD_TAB_LABELS = { overview: 'Aperçu', seances: 'Séances', prog: 'Progression', volume: 'Volume', cal: 'Agenda', conseils: 'Conversation', programme: 'Programme' };
function switchCoachDetailTab(tab) {
  if (tab === 'volume') tab = 'prog';   // Volume fusionné dans Progression
  ['overview','seances','prog','volume','cal','conseils','programme'].forEach(t => {
    const el = document.getElementById('cdtab-' + t); if (el) el.style.display = t === tab ? 'block' : 'none';
    const btn = document.getElementById('cdtab-btn-' + t); if (btn) btn.classList.toggle('active', t === tab);
  });
  const ttl = document.getElementById('cd-tab-title');
  if (ttl && CD_TAB_LABELS[tab]) ttl.textContent = CD_TAB_LABELS[tab];
  const cdH = document.getElementById('cd-header'); if (cdH) cdH.style.transform = 'translateY(0)'; // header visible au changement d'onglet
  // Repart en haut du contenu à chaque changement d'onglet (évite les sauts de scroll)
  window.scrollTo(0, 0);
  // Fait défiler la pastille active au centre (pour que Programme & co restent accessibles)
  const btnActif = document.getElementById('cdtab-btn-' + tab);
  if (btnActif && btnActif.scrollIntoView) btnActif.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  // Mémoriser l'onglet courant pour le restaurer après un rechargement
  if (coachAthleteCourant) {
    try { localStorage.setItem('muscu_coach_vue', JSON.stringify({ athlete_id: coachAthleteCourant.athlete_id, tab: tab })); } catch(e) {}
  }
  if (tab === 'programme') {
    progCtx = { el: 'cd-programme-content', athleteId: null, athleteNom: null }; // contexte muscu
    chargerProgrammeCoach();
  }
  majRailVisibilite(tab);
}

// Sur bureau le rail est toujours visible ; sur mobile seulement sur l'Aperçu
function majRailVisibilite(tab) {
  const rail = document.getElementById('cd-rail');
  if (!rail) return;
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  rail.style.display = (desktop || tab === 'overview') ? '' : 'none';
}

function coachNiveauKey(annees) {
  const n = getNiveauExperience(annees); // debutant / intermediaire / avance / expert
  if (n === 'debutant') return 'debutant';
  if (n === 'intermediaire') return 'intermediaire';
  return 'experimente'; // avance + expert
}

async function ouvrirDetailAthleteCoach(a, initialTab) {
  coachAthleteCourant = a;
  document.getElementById('view-coach').classList.remove('active');
  document.getElementById('view-coach-detail').classList.add('active');
  document.body.classList.add('cd-nav');
  document.body.classList.add('athlete-selected');
  surlignerAthleteSidebar(a.athlete_id);
  // Bloc « Bonjour » (onglet Aperçu) : nom + avatar (initiales) + pastilles infos.
  var _heroNom = document.getElementById('cd-hero-name'); if (_heroNom) _heroNom.textContent = a.nom;
  var _heroAv = document.getElementById('cd-hero-av');
  if (_heroAv) _heroAv.textContent = (a.nom || '?').split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase();
  _setSportIco('cd-sport-ico-use', a.sport);   // icône du header (haltère muscu)
  const niv = getNiveauExperience(a.annees_pratique);
  const nivLabel = { debutant:'Débutant', intermediaire:'Intermédiaire', avance:'Avancé', expert:'Expert' }[niv];
  const bits = [nivLabel];
  if (a.objectif) bits.push(a.objectif);
  bits.push(`${a.annees_pratique || 0} an${(a.annees_pratique||0)>1?'s':''}`);
  if (a.poids) bits.push(`${a.poids} kg`);
  var _heroPills = document.getElementById('cd-hero-pills');
  if (_heroPills) _heroPills.innerHTML = bits.filter(Boolean).map(b => `<span class="fjd-pill">${escapeHtml(String(b))}</span>`).join('');
  switchCoachDetailTab(initialTab || 'overview');
  cdCalDate = new Date();

  // Alertes (déjà disponibles dans l'objet a) - reset des conseils avant chargement
  commentairesAthleteActuel = [];
  renderAlertesCoach();

  // Reset les zones en chargement
  const indEl = document.getElementById('cd-indicateurs'); if (indEl) indEl.innerHTML = '<div class="loader">Chargement...</div>';
  ['cd-recup','cd-prog-semaine','cd-muscle','cd-volume-content','cd-tendances-content','cd-acwr-content','cd-cmp28-content'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '<div class="loader">Chargement...</div>';
  });
  ['cd-cmp28-sec','cd-cmp28-card'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  document.getElementById('cd-progression-content').innerHTML = '';
  document.getElementById('cd-seances-content').innerHTML = '';
  document.getElementById('cd-seances-detail-content').innerHTML = '<div class="loader">Chargement...</div>';
  document.getElementById('cd-acwr-chart-content').innerHTML = '';
  document.getElementById('cd-comment-input').value = '';
  document.getElementById('cd-commentaires-liste').innerHTML = '<div class="loader">Chargement...</div>';
  chargerCommentairesCoach(a.athlete_id);

  try {
    const res = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(a.athlete_id)}`);
    const data = await res.json();
    coachAthleteData = data;
    cdProgressionData = data.historique ? (data.historique.progression_par_exo || {}) : {};
    cdTendancesData = data.historique ? (data.historique.tendances || null) : null;
    cdSeancesDates = data.historique ? (data.historique.dates_seances || {}) : {};

    renderCoachOverview(data);
    try { renderCarteContexte(data.contexte, coachAthleteCourant && coachAthleteCourant.athlete_id, 'cd-contexte', 'muscu'); } catch (_) {}
    renderEtatDuJourCoach(data);
    renderAnalyseCoach(data);
    renderCoachRecordsEtRegression(data.historique);
    renderCoachIndicateurs(data);
    renderAlertesCoach(data);
    afficherGraphiquePoidsCoach(data.poids || []);
    renderCoachVolume(data);
    afficherCoachTendances(4);
    renderCoachExerciceSelect(data);
    renderCoachCalendrier();
    renderCoachSeances(data);
    chargerSeancesDetailCoach(a.athlete_id, data);
    renderACWR(data);
  } catch(e) {
    document.getElementById('cd-recup').innerHTML = '<div class="error-msg">Erreur de chargement</div>';
  }
}

// Records + exercices en régression (détail coach), à partir de progression_par_exo
function renderCoachRecordsEtRegression(hist) {
  const prog = (hist && hist.progression_par_exo) || {};
  // --- Records (meilleure charge réelle, pas le 1RM) ---
  const rCard = document.getElementById('cd-records-card'), rEl = document.getElementById('cd-records');
  const rSec = document.getElementById('cd-records-sec');
  const records = calculerRecords(hist);
  if (rCard && rEl) {
    if (records.length === 0) { rCard.style.display = 'none'; if (rSec) rSec.style.display = 'none'; }
    else {
      rCard.style.display = ''; if (rSec) rSec.style.display = 'flex';
      rEl.innerHTML = records.slice(0, 5).map((r, i, arr) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < arr.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
          <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-a12);color:var(--accent);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.exo}</div>
            <div style="font-size:11px;color:var(--text-muted);">${r.reps} reps · ${r.date}</div>
          </div>
          <div style="font-size:16px;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;flex-shrink:0;">${r.charge}<span style="font-size:10px;color:var(--text-muted);font-weight:600;">kg</span></div>
        </div>`).join('');
    }
  }
  // --- Exercices en régression (1RM récent < meilleur précédent) ---
  const gCard = document.getElementById('cd-regression-card'), gEl = document.getElementById('cd-regression');
  const regs = [];
  Object.keys(prog).forEach(exo => {
    const perfs = prog[exo] || [];
    if (perfs.length < 3) return;
    const rmRecent = calc1RM(perfs[0].charge, perfs[0].reps);
    let bestBefore = null;
    for (let i = 1; i < perfs.length; i++) {
      const rm = calc1RM(perfs[i].charge, perfs[i].reps);
      if (rm !== null && (bestBefore === null || rm > bestBefore)) bestBefore = rm;
    }
    if (rmRecent !== null && bestBefore !== null && rmRecent < bestBefore * 0.98) {
      regs.push({ exo, drop: Math.round((1 - rmRecent / bestBefore) * 100), recent: perfs[0] });
    }
  });
  if (gCard && gEl) {
    if (regs.length === 0) { gCard.style.display = 'none'; }
    else {
      gCard.style.display = ''; regs.sort((a, b) => b.drop - a.drop);
      gEl.innerHTML = regs.slice(0, 5).map((r, i, arr) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;${i < arr.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
          <div style="min-width:0;">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.exo}</div>
            <div style="font-size:11px;color:var(--text-muted);">Actuel : ${r.recent.charge}kg × ${r.recent.reps} · ${r.recent.date}</div>
          </div>
          <span style="font-size:14px;font-weight:800;color:var(--warn);flex-shrink:0;margin-left:10px;">−${r.drop}%</span>
        </div>`).join('');
    }
  }
}

function renderCoachOverview(data) {
  const dash = data.dashboard || {};

  // Enrichir le bloc « Bonjour » avec le poids réel (si connu et pas déjà présent)
  if (data.poids && data.poids.length && coachAthleteCourant) {
    const hp = document.getElementById('cd-hero-pills');
    if (hp && !/kg/.test(hp.textContent)) hp.insertAdjacentHTML('beforeend', `<span class="fjd-pill">${escapeHtml(String(data.poids[0].poids))} kg</span>`);
  }

  // Régularité
  const reg = dash.regularite || {};
  const faites = reg.seances_semaine != null ? reg.seances_semaine : (reg.seances_j7 || 0);
  const prevues = reg.seances_prevues || 0;
  const pct = prevues > 0 ? Math.min(100, Math.round(faites/prevues*100)) : 0;
  document.getElementById('cd-reg-faites').textContent = faites;
  document.getElementById('cd-reg-prevues').textContent = prevues;
  document.getElementById('cd-reg-bar').style.width = pct + '%';

  // Dernière séance
  if (dash.derniere_seance) {
    document.getElementById('cd-derniere-date').textContent = dash.derniere_seance.date;
    document.getElementById('cd-derniere-nom').textContent =
      `${dash.derniere_seance.seance_id} · ${dash.derniere_seance.nb_series} séries · RPE ${dash.derniere_seance.rpe_moyen}`;
  } else {
    document.getElementById('cd-derniere-date').textContent = 'Jamais';
    document.getElementById('cd-derniere-nom').textContent = '';
  }

  // Récupération — depuis Charge récente ou ancien champ
  const recupEl = document.getElementById('cd-recup');
  const recupObj = buildRecupFromData(data) || dash.recuperation || null;
  if (recupObj) {
    const r = recupObj;
    const sc = r.statut === 'optimal' ? 'var(--good)' : r.statut === 'modere' ? 'var(--warn)' : 'var(--v2-bad)';
    const scA = r.statut === 'optimal' ? 'var(--good-a)' : r.statut === 'modere' ? 'var(--warn-a)' : 'var(--bad-a)';
    const se = r.statut === 'optimal' ? '💪' : r.statut === 'modere' ? '😮‍💨' : '🥵';
    const sl = r.statut === 'optimal' ? 'Bien récupéré' : r.statut === 'modere' ? 'Fatigue modérée' : 'Fatigue élevée';
    recupEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:46px;height:46px;border-radius:13px;background:${scA};display:flex;align-items:center;justify-content:center;font-size:21px;flex-shrink:0">${se}</div>
        <div style="font-size:var(--fs-lg);font-weight:800;color:${sc}">${sl}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div class="dash-stat"><div class="dash-stat-num" style="color:${r.rpe_color}">${r.rpe_moyen !== null ? r.rpe_moyen : '—'}</div><div class="dash-stat-label">RPE moy. 7j</div></div>
        <div class="dash-stat"><div class="dash-stat-num" style="color:${dash.tonnage ? ((dash.tonnage.evol_pct != null ? dash.tonnage.evol_pct : dash.tonnage.evol) >= 0 ? 'var(--good)' : 'var(--warn)') : 'var(--text-subtle)'};font-size:15px">${dash.tonnage ? (dash.tonnage.j7 != null ? dash.tonnage.j7 : dash.tonnage.semaine) + 't' : '—'}</div><div class="dash-stat-label">Tonnage 7j</div></div>
        <div class="dash-stat"><div class="dash-stat-num" style="color:var(--warn);font-size:18px">🔥${dash.streak ? dash.streak.semaines : 0}</div><div class="dash-stat-label">Sem. d'affilée</div></div>
      </div>
      <div style="border-left:3px solid ${sc};background:var(--surface2);border-radius:0 10px 10px 0;padding:9px 11px">
        <div style="font-size:11px;font-weight:700;margin-bottom:3px;color:${sc}">${ic('lightbulb')} Suggestion auto (à valider par toi)</div>
        <div style="font-size:12px;opacity:0.85">${r.conseil}</div>
        ${(() => {
          const sujetR = r.statut === 'optimal' ? 'récupération' : r.statut === 'modere' ? 'fatigue modérée' : 'fatigue élevée';
          return dejaConseille(sujetR)
            ? `<div style="margin-top:8px;font-size:12px;color:var(--good);font-weight:700">✅ Déjà conseillé</div>
               <button class="btn-sm btn-outline" style="margin-top:6px" onclick="repondreAlerte('${sujetR}')">${ic('pencil')} Ajouter un autre conseil</button>`
            : `<button class="btn-sm btn-outline" style="margin-top:8px" onclick="repondreAlerte('${sujetR}')">${ic('pencil')} En faire un conseil</button>`;
        })()}
      </div>`;
  } else {
    recupEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;margin-top:6px">Pas encore assez de données.</div>';
  }

  // Progression semaine — même logique que la vue athlète avec fallback sur comparison
  const progEl = document.getElementById('cd-prog-semaine');
  const chargeDetailsCd = (dash.progression && dash.progression.details && dash.progression.details.length > 0)
    ? dash.progression.details
    : (((data.comparison || {}).j7_vs_j7prec || {}).charge_details || []);
  const enProgCd   = chargeDetailsCd.filter(d => d.up).length;
  const enBaisseCd = chargeDetailsCd.filter(d => d.down && !d.up).length;
  if (chargeDetailsCd.length > 0) {
    const up = chargeDetailsCd.filter(d => d.up).map(d => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--good-a);border-radius:6px;margin-bottom:4px">
        <span style="font-size:11px;color:var(--good);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${d.exercice}</span>
        <span style="font-size:11px;color:var(--good);white-space:nowrap">${d.variation}</span></div>`).join('');
    const down = chargeDetailsCd.filter(d => d.down && !d.up).map(d => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bad-a);border-radius:6px;margin-bottom:4px">
        <span style="font-size:11px;color:var(--danger);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${d.exercice}</span>
        <span style="font-size:11px;color:var(--danger);white-space:nowrap">${d.variation}</span></div>`).join('');
    progEl.innerHTML = `
      <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;opacity:.7;">Évolution · 7j vs 7j précédents</div>
      <div class="v2-pgrid" style="margin-bottom:${(enProgCd||enBaisseCd)?'12px':'0'}">
        <div class="v2-pstat" style="background:var(--good-a)"><div class="pn" style="color:var(--good)">${enProgCd}</div><div class="pk">exercices<br>en progression</div></div>
        <div class="v2-pstat" style="background:var(--bad-a)"><div class="pn" style="color:var(--v2-bad)">${enBaisseCd}</div><div class="pk">exercices<br>en baisse</div></div>
      </div>
      ${enProgCd   > 0 ? `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">En progression</div>${up}` : ''}
      ${enBaisseCd > 0 ? `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;margin:8px 0 4px">En baisse</div>${down}` : ''}
      ${enProgCd === 0 && enBaisseCd === 0 ? '<div style="color:var(--text-muted);font-size:13px">Charges stables · 7 derniers jours</div>' : ''}`;
  } else {
    progEl.innerHTML = `
      <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;opacity:.7;">Évolution · 7j vs 7j précédents</div>
      <div style="color:var(--text-muted);font-size:13px;">Pas encore assez de séances pour comparer — il faut au moins une séance dans les 7j précédents.</div>`;
  }

  // Charge récente : Variabilité + Charge accumulée (ajout sous le bloc récup)
  const j7recent = ((data.recent || {}).j7 || {});
  const monotonie7 = j7recent.monotonie;
  const strain7    = j7recent.strain;
  if (recupEl && (monotonie7 != null || strain7 != null)) {
    const monotonieStr   = monotonie7 != null ? monotonie7.toFixed(2) : null;
    const strainStr      = strain7 != null ? Math.round(strain7) : null;
    const monotonieColor = monotonie7 == null ? 'var(--text-subtle)' : monotonie7 > 2 ? 'var(--danger)' : monotonie7 > 1.5 ? 'var(--warn)' : 'var(--good)';
    const monotonieLabel = monotonie7 == null ? '' : monotonie7 > 2 ? 'Charge monotone' : monotonie7 > 1.5 ? 'Modérée' : 'Variée';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid var(--border);padding-top:10px;margin-top:10px;';
    grid.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:17px;font-weight:800;color:${monotonieColor};">${monotonieStr || '—'}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Variabilité · 7j</div>
        ${monotonieLabel ? `<div style="font-size:9px;color:${monotonieColor};margin-top:1px;">${monotonieLabel}</div>` : ''}
      </div>
      <div style="text-align:center;">
        <div style="font-size:17px;font-weight:800;color:var(--text);">${strainStr != null ? strainStr.toLocaleString('fr') : '—'}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Charge accumulée · 7j</div>
      </div>`;
    recupEl.appendChild(grid);
  }

  // Volume par muscle — barres v2
  renderDashVolumeBars(data.historique ? (data.historique.volume_semaine || []) : [], 'cd-muscle');

  // Historique global : Muscle en retard — bannière au-dessus des barres
  const globalEng = data.global || {};
  if (globalEng.muscle_retard) {
    const mr = globalEng.muscle_retard;
    const muscleEl = document.getElementById('cd-muscle');
    if (muscleEl) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:rgba(245,159,0,0.12);border:1px solid rgba(245,159,0,0.35);border-radius:8px;padding:8px 11px;margin-bottom:10px;display:flex;align-items:center;gap:8px;';
      banner.innerHTML = `<span style="font-size:14px;">⚠️</span><div><div style="font-size:11px;font-weight:700;color:var(--warn);">${mr.muscle} en retard <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-left:4px;">Historique global</span></div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${mr.series_faites} séries / ${mr.series_min} min · objectif ${mr.series_optimale} séries</div></div>`;
      muscleEl.insertBefore(banner, muscleEl.firstChild);
    }
  }

  // Évolution : Tendance mensuelle j28 vs j28prec
  const cmp28 = (data.comparison || {}).j28_vs_j28prec || {};
  const cmp28Sec  = document.getElementById('cd-cmp28-sec');
  const cmp28Card = document.getElementById('cd-cmp28-card');
  const cmp28El   = document.getElementById('cd-cmp28-content');
  if (cmp28El && (cmp28.tonnage || cmp28.seances || cmp28.charge)) {
    if (cmp28Sec)  cmp28Sec.style.display  = '';
    if (cmp28Card) cmp28Card.style.display = '';
    const t28 = cmp28.tonnage || {}, s28 = cmp28.seances || {}, c28 = cmp28.charge || {}, rpe28 = cmp28.rpe || {};
    const fmtEvol = v => v == null ? '—' : v > 0 ? '▲ +'+v+'%' : v < 0 ? '▼ '+v+'%' : '→ stable';
    const colEvol = v => v == null ? 'var(--text-muted)' : v >= 5 ? 'var(--good)' : v <= -10 ? 'var(--bad)' : 'var(--warn)';
    cmp28El.innerHTML = `
      <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;opacity:.7;">Évolution · 28j vs 28j précédents</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
          <div style="font-size:14px;font-weight:800;color:${colEvol(t28.evol_pct)};">${fmtEvol(t28.evol_pct)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Tonnage · 28j</div>
          ${t28.courant != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${t28.courant}t vs ${t28.precedent}t</div>` : ''}
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
          <div style="font-size:14px;font-weight:800;color:${colEvol(c28.evol_pct)};">${c28.evol_pct != null ? (c28.evol_pct > 0 ? '▲ +'+c28.evol_pct+'%' : c28.evol_pct < 0 ? '▼ '+c28.evol_pct+'%' : '→ stable') : '—'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Charges · 28j</div>
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
          <div style="font-size:14px;font-weight:800;color:${colEvol(s28.evol_pct)};">${fmtEvol(s28.evol_pct)}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Séances · 28j</div>
          ${s28.courant != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${s28.courant} vs ${s28.precedent}</div>` : ''}
        </div>
        <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
          <div style="font-size:14px;font-weight:800;color:${rpe28.diff != null ? (rpe28.diff > 0.5 ? 'var(--bad)' : rpe28.diff < -0.5 ? 'var(--good)' : 'var(--text)') : 'var(--text-muted)'};">${rpe28.courant != null ? rpe28.courant : '—'}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">RPE moyen · 28j</div>
          ${rpe28.diff != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${rpe28.diff > 0 ? '+' : ''}${rpe28.diff} vs préc.</div>` : ''}
        </div>
      </div>`;
  }
}

function renderCoachExerciceSelect(data) {
  const exercices = data.historique ? (data.historique.exercices || []) : [];
  const sel = document.getElementById('cd-sel-exercice');
  sel.innerHTML = '<option value="">— Choisir un exercice —</option>';
  exercices.forEach(e => {
    const o = document.createElement('option');
    o.value = e; o.textContent = e; sel.appendChild(o);
  });
  document.getElementById('cd-progression-content').innerHTML =
    '<div style="font-size:13px;color:var(--text-muted)">Choisis un exercice pour voir son évolution.</div>';
}

function afficherCoachProgressionExo() {
  const exo = document.getElementById('cd-sel-exercice').value;
  const el = document.getElementById('cd-progression-content');
  if (!exo || !cdProgressionData[exo]) { el.innerHTML = ''; return; }
  const perfs = cdProgressionData[exo];
  if (perfs.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aucune donnée</div>'; return; }

  const first = perfs[perfs.length - 1];
  const last = perfs[0];
  const diffCharge = last.charge - first.charge;
  const diffReps = last.reps - first.reps;
  const progGlobale = diffCharge > 0 ? `+${diffCharge}kg` : diffReps > 0 ? `+${diffReps} reps` : 'Stable';
  const progCouleur = diffCharge > 0 || diffReps > 0 ? '#00c96e' : 'var(--text-muted)';

  const rm1Last = calc1RM(last.charge, last.reps);
  const rm1First = calc1RM(first.charge, first.reps);
  const rm1Diff = (rm1Last !== null && rm1First !== null) ? Math.round((rm1Last - rm1First) * 10) / 10 : null;

  const aSemaines12Coach = compterSemaines(perfs) >= 2;
  el.innerHTML = renderProg12Semaines(perfs) + `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:8px">
      <span style="font-size:12px;color:var(--text-muted)">Progression totale</span>
      <span style="font-size:13px;font-weight:700;color:${progCouleur}">${progGlobale}</span>
    </div>
    ${rm1Last !== null ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:8px">
      <span style="font-size:12px;color:var(--text-muted)">1RM estimé (Epley)</span>
      <span style="font-size:13px;font-weight:700;color:var(--accent)">${rm1Last}kg ${rm1Diff !== null && rm1Diff !== 0 ? `<span style="color:${rm1Diff > 0 ? '#00c96e' : 'var(--danger)'};font-size:11px">(${rm1Diff > 0 ? '+' : ''}${rm1Diff}kg)</span>` : ''}</span>
    </div>` : ''}
    ${aSemaines12Coach ? '' : `<div style="display:flex;gap:6px;margin-bottom:8px;">
      <button id="cd-pce-charge" onclick="dessinerCoachProgChart('charge')" style="background:var(--accent);color:var(--on-accent);border:none;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">Charge</button>
      <button id="cd-pce-1rm" onclick="dessinerCoachProgChart('1rm')" style="background:var(--surface2);color:var(--text-muted);border:none;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">1RM est.</button>
    </div>
    <canvas id="chart-1rm-coach" style="width:100%;height:108px;display:block;margin-bottom:10px"></canvas>`}
    <table style="width:100%;font-size:12px;border-collapse:collapse">
      <tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border)">
        <td style="padding:5px 0">Date</td><td style="padding:5px 0;text-align:center">Séance</td>
        <td style="padding:5px 0;text-align:center">Charge</td><td style="padding:5px 0;text-align:center">Reps</td>
        <td style="padding:5px 0;text-align:center">1RM est.</td>
        <td style="padding:5px 0;text-align:center">Évol.</td>
      </tr>
      ${perfs.map((p, i) => {
        const prev = perfs[i+1];
        let evol = '—', evolColor = 'var(--text-muted)';
        if (prev) {
          if (p.charge > prev.charge) { evol = '↑'; evolColor = '#00c96e'; }
          else if (p.charge < prev.charge) { evol = '↓'; evolColor = 'var(--danger)'; }
          else if (p.reps > prev.reps) { evol = '↑'; evolColor = '#c8f000'; }
          else if (p.reps < prev.reps) { evol = '↓'; evolColor = 'var(--danger)'; }
          else { evol = '='; }
        }
        const isLast = i === 0;
        const rm1 = calc1RM(p.charge, p.reps);
        return `<tr style="border-bottom:1px solid var(--surface2);${isLast ? 'font-weight:700' : ''}">
          <td style="padding:6px 0;color:var(--text)">${p.date}</td>
          <td style="padding:6px 0;text-align:center;color:var(--text-muted);font-size:11px">${(p.seance||'').substring(0,8)}</td>
          <td style="padding:6px 0;text-align:center;color:${isLast ? 'var(--accent)' : 'var(--text)'}">${p.charge}kg</td>
          <td style="padding:6px 0;text-align:center;color:${isLast ? 'var(--accent)' : 'var(--text)'}">${p.reps}</td>
          <td style="padding:6px 0;text-align:center;color:var(--text-muted);font-size:11px">${rm1 !== null ? rm1 + 'kg' : '—'}</td>
          <td style="padding:6px 0;text-align:center;color:${evolColor};font-size:16px;font-weight:700">${evol}</td>
        </tr>`;
      }).join('')}
    </table>`;
  cdProgExoChrono = perfs.slice().reverse();
  if (!aSemaines12Coach) dessinerCoachProgChart('charge');
}

let cdProgExoChrono = null;
function dessinerCoachProgChart(mode) {
  if (!cdProgExoChrono || !cdProgExoChrono.length) return;
  const c = cdProgExoChrono;
  const vals = c.map(p => mode === '1rm' ? calc1RM(p.charge, p.reps) : p.charge).filter(v => v !== null && v !== undefined);
  drawLineChart('chart-1rm-coach', vals, 'var(--accent)', { unit: 'kg', xLabels: [c[0] && c[0].date, c[c.length - 1] && c[c.length - 1].date] });
  [['cd-pce-charge', 'charge'], ['cd-pce-1rm', '1rm']].forEach(([id, mo]) => {
    const btn = document.getElementById(id);
    if (btn) { const on = mo === mode; btn.style.background = on ? 'var(--accent)' : 'var(--surface2)'; btn.style.color = on ? 'var(--on-accent)' : 'var(--text-muted)'; }
  });
}

function afficherCoachTendances(semaines) {
  const el = document.getElementById('cd-tendances-content');
  document.getElementById('cd-btn-tend-4').style.background = semaines === 4 ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('cd-btn-tend-4').style.color = semaines === 4 ? '#000' : 'var(--text-muted)';
  document.getElementById('cd-btn-tend-8').style.background = semaines === 8 ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('cd-btn-tend-8').style.color = semaines === 8 ? '#000' : 'var(--text-muted)';

  if (!cdTendancesData) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Pas assez de données</div>'; return; }
  const t = semaines === 4 ? cdTendancesData.s4 : cdTendancesData.s8;
  if (!t) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Pas assez de données sur cette période</div>'; return; }

  const sc = t.statut === 'positif' ? '#00c96e' : t.statut === 'plateau' ? '#f59f00' : 'var(--danger)';
  const sl = t.statut === 'positif' ? '🟢 Adaptation positive' : t.statut === 'plateau' ? '⚠️ Plateau' : '🔴 Régression';
  const sd = t.statut === 'positif' ? 'Volume et charges en progression' : t.statut === 'plateau' ? 'Charges stables depuis plusieurs semaines' : 'Charges en baisse ou RPE en forte hausse';

  const ligne = (label, vd, vf, unite, up) => {
    const diff = vf - vd;
    const pct = vd > 0 ? Math.round(diff/vd*100) : 0;
    const c = up === null ? 'var(--text-muted)' : (up ? '#00c96e' : 'var(--danger)');
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--surface2)">
      <div><div style="font-size:12px;font-weight:700">${label}</div>
      <div style="font-size:11px;color:var(--text-muted)">${vd}${unite} → ${vf}${unite}</div></div>
      <span style="background:${c}1a;color:${c};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700">${pct>0?'+':''}${pct}%</span></div>`;
  };
  el.innerHTML = `
    ${ligne('Volume hebdo', t.volume_debut, t.volume_fin, ' séries', t.volume_fin >= t.volume_debut)}
    ${ligne('RPE moyen', t.rpe_debut, t.rpe_fin, '', null)}
    ${ligne('Charge moyenne S1', t.charge_debut, t.charge_fin, 'kg', t.charge_fin >= t.charge_debut)}
    <div style="background:${sc}1a;border-radius:8px;padding:10px 12px;margin-top:10px">
      <div style="font-size:12px;font-weight:700;color:${sc}">${sl}</div>
      <div style="font-size:11px;color:${sc};opacity:0.8;margin-top:2px">${sd}</div>
    </div>`;
}

// Calcul commun des 5 marqueurs (utilisé par les feux du détail ET le tableau accueil)
// -> garantit des chiffres identiques partout. `a` = objet athlète (annees_pratique + alertes)
// Reconstruit un objet récupération depuis les nouvelles données Charge récente
function buildRecupFromData(data) {
  const recent = data.recent || {};
  const j7 = recent.j7 || {};
  const rpe = j7.rpe_moyen != null ? j7.rpe_moyen : null;
  if (rpe === null) return null;
  let statut, conseil;
  if (rpe > 8.5) { statut = 'eleve'; conseil = 'RPE élevé — prévois une séance légère ou un jour de repos actif.'; }
  else if (rpe > 7.5) { statut = 'modere'; conseil = 'Fatigue modérée — maintiens l\'intensité mais surveille les signaux de ton athlète.'; }
  else { statut = 'optimal'; conseil = 'Bonne récupération — athlète disponible pour une séance exigeante.'; }
  const rpe_color = statut === 'optimal' ? '#00c96e' : statut === 'modere' ? '#f59f00' : '#e5484d';
  // Champs rétrocompat
  const dash = data.dashboard || {};
  const tonnage = dash.tonnage || {};
  return { statut, conseil, rpe_moyen: rpe, rpe_color,
    volume_semaine: j7.tonnage || null, volume_moyenne_prec: tonnage.j7_prec || null };
}

function computeMarqueursCoach(data, a) {
  const dash = data.dashboard || {};
  const hist = data.historique || {};
  const annees = a ? a.annees_pratique : 0;

  // 1. Progression (comptes hausse/baisse de la semaine)
  const prog = dash.progression || {};
  const enProg = prog.en_progression || 0, enBaisse = prog.en_baisse || 0;
  let progColor, progLabel;
  if (enProg === 0 && enBaisse === 0) { progColor = '#aaa'; progLabel = 'N/A'; }
  else if (enProg > enBaisse) { progColor = '#00c96e'; progLabel = `${enProg}↑/${enBaisse}↓`; }
  else if (enProg === enBaisse) { progColor = '#f59f00'; progLabel = `${enProg}↑/${enBaisse}↓`; }
  else { progColor = '#e5484d'; progLabel = `${enProg}↑/${enBaisse}↓`; }

  // 2. ACWR — vérifier d'abord si on a ≥28 jours d'historique
  let acwrColor, acwrLabel, acwrRatio = null;
  const acwrLocal = computeACWR(hist.progression_par_exo || {}, hist.volume_par_jour || {});
  const acwrBackend = (dash.acwr != null) ? Number(dash.acwr) : null;
  // Cohérent avec l'athlète : on affiche si le local est OK OU si le backend a une valeur
  const acwrInsuffisant = (!acwrLocal || acwrLocal.insuffisant) && acwrBackend == null;
  if (!acwrInsuffisant) {
    // Utiliser la valeur backend si disponible, sinon locale
    const ratio = acwrBackend != null ? acwrBackend : acwrLocal.ratio;
    acwrRatio = ratio;
    if (ratio >= 0.8 && ratio <= 1.3) { acwrColor = '#00c96e'; }
    else if (ratio > 1.5) { acwrColor = '#e5484d'; }
    else if (ratio > 1.3) { acwrColor = '#f59f00'; }
    else { acwrColor = '#4da6ff'; }  // < 0.8 : sous-charge
    acwrLabel = `ACWR ${ratio}`;
  } else {
    // Moins de 28 jours : ne pas afficher l'ACWR
    acwrColor = '#aaa'; acwrLabel = '< 4 sem.';
  }

  // 3. Volume muscles
  const niv = getNiveauExperience(annees);
  const niveauKey = niv === 'debutant' ? 'debutant' : niv === 'intermediaire' ? 'intermediaire' : 'experimente';
  const volSem = hist.volume_semaine || [];
  let volColor = '#aaa', volLabel = 'N/A';
  const volTrained = volSem.filter(v => (v.faites || 0) > 0);
  if (volTrained.length === 0 && volSem.length > 0) {
    volColor = '#e5484d'; volLabel = 'Aucune séance';
  } else if (volTrained.length > 0) {
    let belowMev = false, aboveMav = true;
    volTrained.forEach(v => {
      const cibleArr = VOLUME_CIBLE[v.muscle] ? VOLUME_CIBLE[v.muscle][niveauKey] : [10, 14];
      const mev = cibleArr[0] || 0, mav = cibleArr[1] || 0;
      const faites = v.faites || 0;
      if (faites < mev) belowMev = true;
      if (faites < mav) aboveMav = false;
    });
    if (belowMev) { volColor = 'var(--bad)'; volLabel = 'Trop peu de séries'; }
    else if (!aboveMav) { volColor = 'var(--warn)'; volLabel = 'Volume correct'; }
    else { volColor = 'var(--good)'; volLabel = 'Volume optimal'; }
  }

  // 4. Régularité (prorata des jours écoulés)
  const reg = dash.regularite || {};
  const faites = reg.seances_semaine != null ? reg.seances_semaine : (reg.seances_j7 || 0);
  const prevues = reg.seances_prevues || 0;
  let regColor, regLabel;
  if (prevues === 0) { regColor = '#aaa'; regLabel = 'N/A'; }
  else {
    const jourSemaine = (new Date().getDay() + 6) % 7 + 1;
    const attenduActuel = prevues * (jourSemaine / 7);
    if (faites >= prevues) { regColor = '#00c96e'; regLabel = `${faites}/${prevues}`; }
    else if (faites >= attenduActuel - 0.5) { regColor = '#00c96e'; regLabel = `${faites}/${prevues}`; }
    else if (faites >= attenduActuel - 1.5) { regColor = '#f59f00'; regLabel = `${faites}/${prevues}`; }
    else { regColor = '#e5484d'; regLabel = `${faites}/${prevues}`; }
  }

  // 5. Récupération — depuis Charge récente ou ancien champ
  const recupObj = buildRecupFromData(data) || dash.recuperation || {};
  let recupColor, recupLabel;
  if (!recupObj.statut) { recupColor = '#aaa'; recupLabel = 'N/A'; }
  else if (recupObj.statut === 'optimal') { recupColor = '#00c96e'; recupLabel = 'Récup OK'; }
  else if (recupObj.statut === 'modere') { recupColor = '#f59f00'; recupLabel = 'Modérée'; }
  else { recupColor = '#e5484d'; recupLabel = 'Fatigue'; }

  // Statut global : pire des marqueurs + alertes
  // (ACWR exclu : il est masqué de l'affichage, il ne doit donc plus influencer le statut)
  const couleurs = [progColor, volColor, regColor, recupColor];
  const alertes = a ? alertesActives(a) : [];
  const interTypes = ['fatigue', 'surcharge', 'irregularite'];
  const alerteGrave = alertes.some(al => al.severite === 'haute' || interTypes.includes(al.type));
  let statut;
  if (couleurs.includes('#e5484d') || alerteGrave) statut = { rank: 2, color: '#e5484d', label: 'Action' };
  else if (couleurs.includes('#f59f00') || alertes.length > 0) statut = { rank: 1, color: '#f5a623', label: 'Surveillance' };
  else statut = { rank: 0, color: '#00c96e', label: 'Optimal' };

  return {
    progColor, progLabel, acwrColor, acwrLabel, acwrRatio,
    volColor, volLabel, regColor, regLabel, recupColor, recupLabel, statut,
    derniere: dash.derniere_seance || null
  };
}

function renderCoachIndicateurs(data) {
  const el = document.getElementById('cd-indicateurs');
  if (!el) return;
  const m = computeMarqueursCoach(data, coachAthleteCourant);
  const indicateurs = [
    { label: 'Progression', color: m.progColor, val: m.progLabel },
    { label: 'Volume', color: m.volColor, val: m.volLabel },
    { label: 'Régularité', color: m.regColor, val: m.regLabel },
    { label: 'Récupération', color: m.recupColor, val: m.recupLabel },
  ];
  el.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;">
    ${indicateurs.map(ind => `
      <div class="v2-kpi" style="display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="v2-dot" style="background:${ind.color};box-shadow:0 0 6px ${ind.color}55;"></span>
          <span style="font-size:9.5px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.03em;">${ind.label}</span>
        </div>
        <div style="font-size:14px;color:${ind.color};font-weight:800;line-height:1;">${ind.val}</div>
      </div>`).join('')}
  </div>`;
}

function renderCoachVolume(data) {
  const volumes = data.historique ? (data.historique.volume_semaine || []) : [];
  const niveauKey = coachNiveauKey(coachAthleteCourant ? coachAthleteCourant.annees_pratique : 0);
  const mr = (data && data.global) ? data.global.muscle_retard : null;
  renderVolumeOptionA(volumes, 'cd-volume-content', niveauKey, mr);
  renderBilanBalance(volumes, 'cd-balance-content');
}

function cdCalNaviguer(direction) {
  cdCalDate.setMonth(cdCalDate.getMonth() + direction);
  renderCoachCalendrier();
}

function renderCoachCalendrier() {
  const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const annee = cdCalDate.getFullYear();
  const moisIdx = cdCalDate.getMonth();
  document.getElementById('cd-cal-titre').textContent = `${mois[moisIdx]} ${annee}`;
  const today = new Date();
  const premierJour = new Date(annee, moisIdx, 1);
  const dernierJour = new Date(annee, moisIdx + 1, 0);
  let debutOffset = premierJour.getDay() - 1;
  if (debutOffset < 0) debutOffset = 6;
  const grid = document.getElementById('cd-cal-grid');
  grid.innerHTML = '';
  const prevDernier = new Date(annee, moisIdx, 0).getDate();
  for (let i = debutOffset - 1; i >= 0; i--) {
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--border)';
    d.textContent = prevDernier - i; grid.appendChild(d);
  }
  for (let j = 1; j <= dernierJour.getDate(); j++) {
    const d = document.createElement('div');
    const dateStr = `${String(j).padStart(2,'0')}/${String(moisIdx+1).padStart(2,'0')}/${annee}`;
    const isToday = j === today.getDate() && moisIdx === today.getMonth() && annee === today.getFullYear();
    const hasSeance = cdSeancesDates[dateStr];
    const isFutur = new Date(annee, moisIdx, j) > today;
    if (isToday) {
      d.style.cssText = 'background:var(--accent);border-radius:6px;text-align:center;padding:5px 2px;font-size:11px;color:var(--on-accent);font-weight:700';
      d.textContent = j;
    } else if (hasSeance) {
      d.style.cssText = 'background:#e8f8f0;border-radius:6px;text-align:center;padding:3px 1px;font-size:11px;color:#007a41;font-weight:700';
      d.title = hasSeance;
      d.innerHTML = `<div style="font-size:10px">${j}</div><div style="font-size:7px;color:#007a41;line-height:1.2;font-weight:600">${String(hasSeance).substring(0,4)}</div>`;
    } else if (isFutur) {
      d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--border)';
      d.textContent = j;
    } else {
      d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--text)';
      d.textContent = j;
    }
    grid.appendChild(d);
  }
}

function renderCoachSeances(data) {
  const el = document.getElementById('cd-seances-content');
  if (!el) return;
  const dates = data.historique ? (data.historique.dates_seances || {}) : {};
  const entries = Object.keys(dates).map(dateStr => {
    const parts = dateStr.split('/');
    return { date: dateStr, tri: new Date(parts[2], parts[1]-1, parts[0]).getTime(), seance: dates[dateStr] };
  }).sort((a,b) => b.tri - a.tri).slice(0, 15);
  el.innerHTML = entries.length === 0
    ? '<div style="font-size:13px;color:var(--text-muted)">Aucune séance</div>'
    : entries.map(s => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:6px">
        <span style="font-size:13px;font-weight:700">${s.seance}</span>
        <span style="font-size:12px;color:var(--text-muted)">${s.date}</span>
      </div>`).join('');
}

function renderCoachSeancesDetail(data) {
  const el = document.getElementById('cd-seances-detail-content');
  if (!el) return;
  const prog = data.historique ? (data.historique.progression_par_exo || {}) : {};
  const datesSeances = data.historique ? (data.historique.dates_seances || {}) : {};

  // Convertit n'importe quel format date en {dmy: dd/mm/yyyy, iso: yyyy-mm-dd}
  function normDate(d) {
    if (!d) return null;
    if (d.includes('-') && d.split('-').length === 3) {
      const p = d.split('-');
      return { iso: d, dmy: `${p[2]}/${p[1]}/${p[0]}` };
    }
    if (d.includes('/') && d.split('/').length === 3) {
      const p = d.split('/');
      return { dmy: d, iso: `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}` };
    }
    return null;
  }

  // Grouper par dmy (dd/mm/yyyy) depuis progression_par_exo
  const parDate = {};
  Object.entries(prog).forEach(([exo, perfs]) => {
    (perfs || []).forEach(p => {
      const nd = normDate(p.date);
      if (!nd) return;
      if (!parDate[nd.dmy]) parDate[nd.dmy] = { iso: nd.iso, exos: [] };
      parDate[nd.dmy].exos.push({ exo, charge: p.charge, reps: p.reps, rpe: p.rpe });
    });
  });

  // Nom séance depuis dates_seances (clé dd/mm/yyyy)
  const nomParDmy = {};
  Object.entries(datesSeances).forEach(([dmy, nom]) => { nomParDmy[dmy] = nom; });

  const entries = Object.keys(parDate).map(dmy => {
    const { iso, exos } = parDate[dmy];
    return { iso, date: dmy, tri: new Date(iso).getTime(), seance: nomParDmy[dmy] || 'Séance', exos };
  }).sort((a,b) => b.tri - a.tri).slice(0, 20);

  if (entries.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune séance enregistrée</div>'; return; }

  el.innerHTML = seancesCardsHTML(entries);
}

// Rendu commun : entries = [{date, seance, exos:[{exo, series:[{charge,reps,rpe}]}]}]
// (accepte aussi l'ancien format exos:[{exo,charge,reps,rpe}] -> regroupé ici)
function seancesCardsHTML(entries) {
  if (!entries || entries.length === 0) {
    return '<div style="color:var(--text-muted);font-size:13px;">Aucune séance enregistrée</div>';
  }
  return entries.map((s, idx) => {
    // Normaliser en exercices -> séries
    let ordreExo, parExo;
    if (s.exos.length && s.exos[0] && Array.isArray(s.exos[0].series)) {
      // Déjà groupé (endpoint getSeancesDetail)
      ordreExo = s.exos.map(x => x.exo);
      parExo = {}; s.exos.forEach(x => { parExo[x.exo] = x.series; });
    } else {
      // Ancien format plat : une entrée par perf
      parExo = {}; ordreExo = [];
      s.exos.forEach(e => {
        if (!parExo[e.exo]) { parExo[e.exo] = []; ordreExo.push(e.exo); }
        parExo[e.exo].push(e);
      });
    }
    const nbExos = ordreExo.length;
    const nbSeries = ordreExo.reduce((n, exo) => n + parExo[exo].length, 0);

    const exoBlocks = nbExos > 0
      ? ordreExo.map(exo => {
          const series = parExo[exo];
          const seriesLignes = series.map((e, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
              <span style="font-size:11px;color:var(--accent);font-weight:700;min-width:52px;">Série ${e.serie || (i + 1)}</span>
              <span style="font-size:12px;color:var(--text);font-weight:600;white-space:nowrap;">${e.charge ? e.charge + ' kg' : '—'} × ${e.reps || '—'} reps${e.rpe ? ` <span style="color:var(--text-muted);font-weight:400;">· RPE ${e.rpe}</span>` : ''}</span>
            </div>`).join('');
          return `
            <div style="background:var(--surface2);border-radius:8px;padding:8px 10px;margin-bottom:8px;">
              <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:4px;display:flex;justify-content:space-between;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${exo}</span>
                <span style="font-size:10px;color:var(--text-muted);font-weight:600;">${series.length} série${series.length>1?'s':''}</span>
              </div>
              ${seriesLignes}
            </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--text-muted);padding:6px 0;">Pas de détail disponible (données antérieures)</div>';

    return `
      <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden;">
        <div onclick="toggleSeanceCoach(${idx})" style="display:flex;justify-content:space-between;align-items:center;padding:12px;cursor:pointer;background:var(--surface);">
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--accent);">${s.seance}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${s.date}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${nbExos > 0 ? `<span style="background:var(--accent-a15);color:var(--accent);font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;">${nbExos} exo${nbExos>1?'s':''} · ${nbSeries} série${nbSeries>1?'s':''}</span>` : ''}
            <span id="seance-arrow-${idx}" style="font-size:14px;color:var(--text-muted);transition:transform 0.2s;">›</span>
          </div>
        </div>
        <div id="seance-detail-${idx}" style="display:none;padding:10px 12px 12px;">
          ${exoBlocks}
        </div>
      </div>`;
  }).join('');
}

// Charge le détail complet des séries depuis l'endpoint (repli sur progression_par_exo)
async function chargerSeancesDetailCoach(athlete_id, dataFallback) {
  const el = document.getElementById('cd-seances-detail-content');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getSeancesDetail&athlete_id=${encodeURIComponent(athlete_id)}`);
    const data = await res.json();
    const seances = (data && data.seances) || [];
    if (seances.length === 0) { renderCoachSeancesDetail(dataFallback); return; }
    const tri = dmy => { const p = String(dmy).split('/'); return p.length === 3 ? new Date(+p[2], +p[1]-1, +p[0]).getTime() : 0; };
    const entries = seances
      .map(s => ({ date: s.date, seance: s.seance_id || 'Séance', exos: s.exos || [], tri: tri(s.date) }))
      .sort((a, b) => b.tri - a.tri)
      .slice(0, 20);
    if (el) el.innerHTML = seancesCardsHTML(entries);
  } catch(e) {
    renderCoachSeancesDetail(dataFallback);
  }
}

function toggleSeanceCoach(idx) {
  const detail = document.getElementById('seance-detail-' + idx);
  const arrow = document.getElementById('seance-arrow-' + idx);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : 'block';
  if (arrow) arrow.style.transform = open ? '' : 'rotate(90deg)';
}

// ==================== TABLEAU RÉCAP ATHLÈTES (COACH) ==================== [MIXTE]
function tendance1RM(prog) {
  const epley = (c, r) => (parseFloat(c) || 0) * (1 + (parseFloat(r) || 0) / 30);
  const deltas = [];
  Object.values(prog || {}).forEach(perfs => {
    if (!perfs || perfs.length < 2) return;
    const s = perfs.filter(p => p.charge && p.reps).slice().sort((a, b) => parseChatDate(a.date) - parseChatDate(b.date));
    if (s.length < 2) return;
    const first = epley(s[0].charge, s[0].reps);
    const last = epley(s[s.length - 1].charge, s[s.length - 1].reps);
    if (first > 0) deltas.push((last - first) / first);
  });
  if (!deltas.length) return { pct: null };
  return { pct: Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length * 100) };
}

function marqueurRecap(data, a) {
  const dash = data.dashboard || {};
  const hist = data.historique || {};
  // Progression
  const prog = dash.progression || {};
  const enProg = prog.en_progression || 0, enBaisse = prog.en_baisse || 0;
  const progC = (enProg === 0 && enBaisse === 0) ? '#aaa'
    : (enProg > enBaisse) ? '#00c96e'
    : (enProg === enBaisse) ? '#f59f00' : '#e5484d';
  // ACWR
  const acwr = computeACWR(hist.progression_par_exo || {}, hist.volume_par_jour || {});
  let acwrC, acwrTxt;
  if (!acwr || acwr.insuffisant) { acwrC = '#aaa'; acwrTxt = '—'; }
  else if (acwr.ratio >= 0.8 && acwr.ratio <= 1.3) { acwrC = '#00c96e'; acwrTxt = acwr.ratio; }
  else if (acwr.ratio > 1.5) { acwrC = '#e5484d'; acwrTxt = acwr.ratio; }
  else { acwrC = '#f59f00'; acwrTxt = acwr.ratio; }
  // Récupération
  const r = dash.recuperation || {};
  const recupC = !r.statut ? '#aaa' : r.statut === 'optimal' ? '#00c96e' : r.statut === 'modere' ? '#f59f00' : '#e5484d';
  // Volume muscles
  const niv = getNiveauExperience(a.annees_pratique);
  const niveauKeyV = niv === 'debutant' ? 'debutant' : niv === 'intermediaire' ? 'intermediaire' : 'experimente';
  const volSem = hist.volume_semaine || [];
  let volC = '#aaa';
  const volTrainedV = volSem.filter(v => (v.faites || 0) > 0);
  if (volTrainedV.length === 0 && volSem.length > 0) {
    volC = '#e5484d';
  } else if (volTrainedV.length > 0) {
    let below = false, allMav = true;
    volTrainedV.forEach(v => {
      const cArr = VOLUME_CIBLE[v.muscle] ? VOLUME_CIBLE[v.muscle][niveauKeyV] : [10, 14];
      const mev = cArr[0] || 0, mav = cArr[1] || 0;
      const faites = v.faites || 0;
      if (faites < mev) below = true;
      if (faites < mav) allMav = false;
    });
    volC = below ? 'var(--bad)' : !allMav ? 'var(--warn)' : 'var(--good)';
  }
  // Dernière séance
  const ds = (dash.derniere_seance && dash.derniere_seance.date) ? dash.derniere_seance.date : '—';
  // Alertes
  const nbAl = alertesActives(a).length;
  // 1RM tendance
  const t = tendance1RM(hist.progression_par_exo || {});
  return { progC, acwrC, acwrTxt, recupC, volC, ds, nbAl, t1rm: t.pct };
}

async function ouvrirRecapAthletes() {
  const ov = document.getElementById('coach-recap-overlay');
  const el = document.getElementById('coach-recap-content');
  ov.style.display = 'block';
  document.body.style.overflow = 'hidden';
  el.innerHTML = '<div class="loader">Chargement des données de chaque athlète…</div>';
  try {
    const results = await Promise.all((athletesCoach || []).map(async a => {
      try {
        const res = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(a.athlete_id)}`);
        const data = await res.json();
        return { a, m: marqueurRecap(data, a) };
      } catch(e) { return { a, m: null }; }
    }));
    el.innerHTML = renderRecapTable(results);
  } catch(e) {
    el.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
  }
}

function fermerRecapAthletes() {
  document.getElementById('coach-recap-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function ouvrirDetailDepuisRecap(athleteId) {
  fermerRecapAthletes();
  const a = athletesCoach.find(x => String(x.athlete_id) === String(athleteId));
  if (a) ouvrirDetailAthleteCoach(a);
}

function renderRecapTable(results) {
  const dot = c => `<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${c};box-shadow:0 0 4px ${c}66;"></span>`;
  const sorted = results.slice().sort((x, y) => {
    const nx = x.m ? x.m.nbAl : 0, ny = y.m ? y.m.nbAl : 0;
    return (ny - nx) || String(x.a.nom).localeCompare(String(y.a.nom));
  });
  const t1rmCell = pct => {
    if (pct === null || pct === undefined) return '<span style="color:var(--text-muted)">—</span>';
    if (pct >= 2) return `<span style="color:#00c96e;font-weight:700">↗ +${pct}%</span>`;
    if (pct <= -2) return `<span style="color:#e5484d;font-weight:700">↘ ${pct}%</span>`;
    return `<span style="color:var(--text-muted)">→ ${pct}%</span>`;
  };
  const th = t => `<th style="text-align:center;padding:10px 8px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);font-weight:700;white-space:nowrap;">${t}</th>`;
  const rows = sorted.map(({ a, m }) => {
    if (!m) return `<tr style="border-top:1px solid var(--border);"><td style="padding:12px 8px;font-weight:800;">${a.nom}</td><td colspan="6" style="color:var(--text-muted);font-size:12px;">Données indisponibles</td></tr>`;
    const niv = { debutant:'Débutant', intermediaire:'Intermédiaire', avance:'Avancé', expert:'Expert' }[getNiveauExperience(a.annees_pratique)] || '';
    const alBadge = m.nbAl > 0
      ? `<span style="background:#e5484d;color:#fff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:20px;">${m.nbAl}</span>`
      : `<span style="color:#00c96e;font-weight:700;">✓</span>`;
    return `
      <tr onclick="ouvrirDetailDepuisRecap('${a.athlete_id}')" style="border-top:1px solid var(--border);cursor:pointer;" onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
        <td style="padding:12px 10px;min-width:120px;">
          <div style="font-weight:800;font-size:14px;">${a.nom}</div>
          <div style="font-size:10px;color:var(--text-muted);">${niv}</div>
        </td>
        <td style="text-align:center;">${dot(m.progC)}</td>
        <td style="text-align:center;">${dot(m.recupC)}</td>
        <td style="text-align:center;">${dot(m.volC)}</td>
        <td style="text-align:center;font-size:12px;white-space:nowrap;">${m.ds}</td>
        <td style="text-align:center;">${alBadge}</td>
        <td style="text-align:center;font-size:12px;white-space:nowrap;">${t1rmCell(m.t1rm)}</td>
      </tr>`;
  }).join('');

  return `
    <div style="overflow-x:auto;border:1px solid var(--border);border-radius:12px;">
      <table style="width:100%;border-collapse:collapse;min-width:640px;">
        <thead><tr style="background:var(--surface2);">
          <th style="text-align:left;padding:10px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);font-weight:700;">Athlète</th>
          ${th('Progression')}${th('Récup.')}${th('Volume')}${th('Dern. séance')}${th('Alertes')}${th('1RM tendance')}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:11px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:14px;">
      <span>${dot('#00c96e')} OK</span>
      <span>${dot('#f59f00')} À surveiller</span>
      <span>${dot('#e5484d')} Alerte</span>
      <span>${dot('#aaa')} Données insuffisantes</span>
      <span style="margin-left:auto;">Clique une ligne pour ouvrir le détail</span>
    </div>`;
}

function computeACWR(progressionParExo, volumeParJour) {
  // Utilise volume_par_jour (exact, depuis Performance sheet) si dispo, sinon proxy
  let volumes = {};
  if (volumeParJour && Object.keys(volumeParJour).length > 0) {
    volumes = volumeParJour;
  } else {
    Object.values(progressionParExo).forEach(perfs => {
      (perfs || []).forEach(p => {
        if (!p.date || !p.charge || !p.reps) return;
        if (!volumes[p.date]) volumes[p.date] = 0;
        volumes[p.date] += (parseFloat(p.reps) || 0) * (parseFloat(p.charge) || 0);
      });
    });
  }
  const now = new Date(); now.setHours(0,0,0,0);
  const jour = 86400000;

  // Première séance connue (pour ne pas diluer la charge chronique avec des jours "avant le début")
  let premierTs = null;
  Object.keys(volumes).forEach(k => {
    if (!volumes[k]) return;
    const p = k.split('-');
    if (p.length !== 3) return;
    const ts = new Date(+p[0], +p[1] - 1, +p[2]).getTime();
    if (premierTs === null || ts < premierTs) premierTs = ts;
  });
  if (premierTs === null) return null;

  const joursDepuisDebut = Math.floor((now.getTime() - premierTs) / jour) + 1;
  // Il faut ~4 semaines d'historique pour un ACWR fiable (Gabbett) : sinon la charge
  // chronique est calculée sur trop peu de jours et un pic isolé fausse le ratio.
  if (joursDepuisDebut < 28) return { insuffisant: true, joursDepuisDebut };

  const chronicDays = Math.min(28, joursDepuisDebut);
  const acuteDays = Math.min(7, joursDepuisDebut);

  const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  let acute = 0, chronic = 0;
  for (let i = 0; i < chronicDays; i++) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = isoLocal(d); // clés volume_par_jour en heure locale (toISOString décalait d'un jour)
    const v = volumes[key] || 0;
    if (i < acuteDays) acute += v;
    chronic += v;
  }
  const acuteAvg = acute / acuteDays;
  const chronicAvg = chronic / chronicDays;
  if (chronicAvg < 1) return null;
  return {
    ratio: Math.round((acuteAvg / chronicAvg) * 100) / 100,
    volumes,
    exact: !!(volumeParJour && Object.keys(volumeParJour).length > 0),
    chronicDays
  };
}

function renderACWR(data) {
  const el = document.getElementById('cd-acwr-content');
  if (!el) return;
  const prog = data.historique ? (data.historique.progression_par_exo || {}) : {};
  const vpj = data.historique ? (data.historique.volume_par_jour || {}) : {};
  const result = computeACWR(prog, vpj);
  const backend = (data.dashboard && data.dashboard.acwr != null) ? Number(data.dashboard.acwr) : null;
  const localOk = result && !result.insuffisant;

  // Si le calcul local est insuffisant mais que le backend a une valeur (comme côté athlète),
  // on affiche la valeur backend pour rester cohérent entre les deux côtés.
  if (!localOk && backend != null && !isNaN(backend)) {
    const z = backend < 0.8 ? { label: 'Sous-charge', color: '#00c9ff', bg: 'rgba(0,201,255,0.1)', conseil: 'Volume trop faible — augmente progressivement la charge hebdomadaire.' }
      : backend <= 1.3 ? { label: 'Zone optimale', color: '#00c96e', bg: 'rgba(0,201,110,0.1)', conseil: 'Charge aiguë bien équilibrée par rapport à la charge chronique. Continue.' }
      : backend <= 1.5 ? { label: 'Attention', color: '#f59f00', bg: 'rgba(245,159,0,0.1)', conseil: 'Augmentation rapide de la charge — surveille les signes de fatigue.' }
      : { label: 'Zone danger', color: 'var(--danger)', bg: 'rgba(255,68,68,0.1)', conseil: 'Charge aiguë très élevée vs chronique — risque de blessure. Réduire le volume.' };
    const pctb = Math.min(100, (backend / 2) * 100);
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-top:6px;">
        <div style="text-align:center;min-width:64px;">
          <div style="font-size:28px;font-weight:800;color:${z.color};">${backend.toFixed(2)}</div>
          <div style="font-size:10px;color:var(--text-muted);">ratio ACWR</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:700;color:${z.color};margin-bottom:6px;">${z.label}</div>
          <div style="position:relative;background:var(--surface2);border-radius:20px;height:8px;margin-bottom:4px;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${pctb}%;background:${z.color};border-radius:20px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-muted);">
            <span>0</span><span style="color:#00c96e;">0.8–1.3</span><span style="color:#f59f00;">1.5</span><span>2.0+</span>
          </div>
        </div>
      </div>
      <div style="margin-top:10px;background:${z.bg};border-left:3px solid ${z.color};border-radius:0 8px 8px 0;padding:8px 10px;font-size:12px;color:var(--text);">
        ${ic('lightbulb')} ${z.conseil}
      </div>
      <div style="margin-top:8px;font-size:10px;color:var(--text-muted);">Gabbett (2016) · valeur calculée côté serveur</div>`;
    document.getElementById('cd-acwr-chart-content').innerHTML = '';
    return;
  }

  if (result === null) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;margin-top:6px;">Pas assez de données (besoin d\'au moins 4 semaines d\'historique)</div>';
    return;
  }
  if (result.insuffisant) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;margin-top:6px;">⏳ ACWR en construction — ${result.joursDepuisDebut} jour${result.joursDepuisDebut>1?'s':''} d'historique. Fiable à partir de ~4 semaines de séances régulières.</div>`;
    return;
  }

  const { ratio, volumes, exact, chronicDays } = result;
  const partiel = chronicDays < 28;
  const zone = ratio < 0.8 ? { label: 'Sous-charge', color: '#00c9ff', bg: 'rgba(0,201,255,0.1)', conseil: 'Volume trop faible — augmente progressivement la charge hebdomadaire.' }
    : ratio <= 1.3 ? { label: 'Zone optimale', color: '#00c96e', bg: 'rgba(0,201,110,0.1)', conseil: 'Charge aiguë bien équilibrée par rapport à la charge chronique. Continue.' }
    : ratio <= 1.5 ? { label: 'Attention', color: '#f59f00', bg: 'rgba(245,159,0,0.1)', conseil: 'Augmentation rapide de la charge — surveille les signes de fatigue.' }
    : { label: 'Zone danger', color: 'var(--danger)', bg: 'rgba(255,68,68,0.1)', conseil: 'Charge aiguë très élevée vs chronique — risque de blessure. Réduire le volume.' };

  const pct = Math.min(100, (ratio / 2) * 100);
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;margin-top:6px;">
      <div style="text-align:center;min-width:64px;">
        <div style="font-size:28px;font-weight:800;color:${zone.color};">${ratio.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text-muted);">ratio ACWR</div>
      </div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:${zone.color};margin-bottom:6px;">${zone.label}</div>
        <div style="position:relative;background:var(--surface2);border-radius:20px;height:8px;margin-bottom:4px;">
          <div style="position:absolute;left:0;top:0;height:100%;width:${pct}%;background:${zone.color};border-radius:20px;transition:width 0.4s;"></div>
          <div style="position:absolute;left:40%;top:-3px;width:1px;height:14px;background:#00c96e;opacity:0.5;"></div>
          <div style="position:absolute;left:65%;top:-3px;width:1px;height:14px;background:#f59f00;opacity:0.5;"></div>
          <div style="position:absolute;left:75%;top:-3px;width:1px;height:14px;background:var(--danger);opacity:0.5;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-muted);">
          <span>0</span><span style="color:#00c96e;">0.8–1.3</span><span style="color:#f59f00;">1.5</span><span>2.0+</span>
        </div>
      </div>
    </div>
    <div style="margin-top:10px;background:${zone.bg};border-left:3px solid ${zone.color};border-radius:0 8px 8px 0;padding:8px 10px;font-size:12px;color:var(--text);">
      ${ic('lightbulb')} ${zone.conseil}
    </div>
    <div style="margin-top:8px;font-size:10px;color:var(--text-muted);">Gabbett (2016) · Charge aiguë 7j / charge chronique ${chronicDays}j${partiel ? ' (historique partiel)' : ''} · ${exact ? '✅ Données exactes (séries réelles)' : '⚠️ Proxy (données exactes non encore chargées)'}</div>`;

  renderACWRChart(volumes);
}

function renderACWRChart(volumes) {
  const el = document.getElementById('cd-acwr-chart-content');
  if (!el) return;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const semaines = [];
  for (let w = 7; w >= 0; w--) {
    let vol = 0;
    for (let d = 0; d < 7; d++) {
      const dt = new Date(now); dt.setDate(dt.getDate() - w * 7 - d);
      vol += volumes[iso(dt)] || 0;
    }
    const lundi = new Date(now); lundi.setDate(lundi.getDate() - w * 7 - ((now.getDay() + 6) % 7));
    semaines.push({ vol, date: lundi.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) });
  }
  const max = Math.max(...semaines.map(s => s.vol), 1);
  const fmt = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(Math.round(v));
  const H = 120, plot = H - 20;
  const avg = semaines.reduce((a, s) => a + s.vol, 0) / (semaines.filter(s => s.vol > 0).length || 1);
  el.innerHTML = `
    <div style="position:relative;height:${H}px;">
      <div style="position:absolute;left:0;right:0;bottom:${Math.round((avg / max) * plot) + 0}px;border-top:1px dashed var(--border);"></div>
      <div style="position:absolute;left:0;bottom:${Math.round((avg / max) * plot) + 2}px;font-size:9px;color:var(--text-muted);background:var(--surface);padding:0 3px;">moy. ${fmt(avg)}</div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:${H}px;">
        ${semaines.map((s, i) => {
          const h = s.vol === 0 ? 3 : Math.max(4, Math.round((s.vol / max) * plot));
          const isLast = i === semaines.length - 1;
          const op = s.vol === 0 ? '1' : isLast ? '1' : '0.45';
          const bg = s.vol === 0 ? 'var(--surface2)' : 'var(--accent)';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;min-width:0;">
            <div style="font-size:9px;font-weight:700;color:${isLast ? 'var(--accent)' : 'var(--text-muted)'};font-variant-numeric:tabular-nums;line-height:1;">${s.vol ? fmt(s.vol) : ''}</div>
            <div title="Semaine du ${s.date} · ${Math.round(s.vol)} kg soulevés" style="width:100%;height:${h}px;background:${bg};opacity:${op};border-radius:5px 5px 0 0;"></div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-top:5px;">
      ${semaines.map((s, i) => `<div style="flex:1;text-align:center;font-size:9px;color:var(--text-muted);${i % 2 ? 'opacity:0.45;' : ''}">${s.date}</div>`).join('')}
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:8px;line-height:1.4;">Tonnage hebdomadaire (charge × reps), semaine du lundi indiqué. Barre pleine = semaine en cours ; pointillés = moyenne sur 8 semaines.</div>`;
}

function renderCoachAthleteGrid(athletes) {
  const grid = document.getElementById('coach-athletes-grid');
  if (!grid) return;
  const couleurSeverite = { haute: '#e5484d', moyenne: '#f5a623', basse: '#aaa' };
  const sorted = [...athletes].sort((a, b) => {
    const na = alertesActives(a).length, nb = alertesActives(b).length;
    return nb - na || String(a.nom).localeCompare(String(b.nom));
  });
  grid.innerHTML = sorted.map(a => {
    const alertes = alertesActives(a);
    const nb = alertes.length;
    const sevMax = nb === 0 ? null : alertes.some(al => al.severite === 'haute') ? 'haute' : alertes.some(al => al.severite === 'moyenne') ? 'moyenne' : 'basse';
    const niv = getNiveauExperience(a.annees_pratique);
    const nivLabel = { debutant:'Débutant', intermediaire:'Intermédiaire', avance:'Avancé', expert:'Expert' }[niv] || '';
    const types = alertes.map(al => al.type || '');
    const dotProg = types.some(t => t === 'stagnation' || t === 'regression') ? '#e5484d' : '#00c96e';
    const dotRecup = types.some(t => t === 'fatigue' || t === 'surcharge') ? (types.some(t => t === 'surcharge') ? '#e5484d' : '#f59f00') : '#00c96e';
    const dotReg = types.some(t => t === 'irregularite') ? '#f59f00' : '#00c96e';
    const dotsHtml = `<div style="display:flex;gap:5px;align-items:center;margin-top:8px;">
      <div title="Progression" style="width:9px;height:9px;border-radius:50%;background:${dotProg};box-shadow:0 0 4px ${dotProg}66;flex-shrink:0;"></div>
      <div title="Récupération" style="width:9px;height:9px;border-radius:50%;background:${dotRecup};box-shadow:0 0 4px ${dotRecup}66;flex-shrink:0;"></div>
      <div title="Régularité" style="width:9px;height:9px;border-radius:50%;background:${dotReg};box-shadow:0 0 4px ${dotReg}66;flex-shrink:0;"></div>
    </div>`;
    const idxOrig = athletes.indexOf(a);
    const estActif = coachAthleteCourant && String(coachAthleteCourant.athlete_id) === String(a.athlete_id);
    return `
      <div class="coach-athlete-card${estActif ? ' actif' : ''}" data-athlete-id="${a.athlete_id}" onclick="ouvrirAthleteDepuisSelect('${idxOrig}')" style="background:var(--surface);border:1px solid ${estActif ? 'var(--accent)' : 'var(--border)'};border-radius:12px;padding:12px;cursor:pointer;transition:border-color 0.2s;" onmouseenter="this.style.borderColor='var(--accent)'" onmouseleave="this.style.borderColor=this.classList.contains('actif')?'var(--accent)':'var(--border)'">
        <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.nom}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">${nivLabel}</div>
        ${dotsHtml}
      </div>`;
  }).join('');
}

function surlignerAthleteSidebar(athleteId) {
  document.querySelectorAll('.coach-athlete-card').forEach(c => {
    const actif = String(c.getAttribute('data-athlete-id')) === String(athleteId);
    c.classList.toggle('actif', actif);
    c.style.borderColor = actif ? 'var(--accent)' : 'var(--border)';
  });
}

// ==================== PROGRAMME (CRUD COACH) ==================== [MODULE MUSCU]
let cdProgrammeLignes = [];

// Contexte du builder de programme — permet de le piloter sur n'importe quelle
// fiche (muscu : #cd-programme-content + coachAthleteCourant ; renfo prépa sur
// fiche joueur : #fjd-programme-content + le joueur foot courant).
let progCtx = { el: 'cd-programme-content', athleteId: null, athleteNom: null };
function _progEl()         { return document.getElementById(progCtx.el); }
function _progAthleteId()  { return progCtx.athleteId || (coachAthleteCourant && coachAthleteCourant.athlete_id) || null; }
function _progAthleteNom() { return progCtx.athleteNom || (coachAthleteCourant && coachAthleteCourant.nom) || ''; }
function _progReadonly()   { return !!(progCtx && progCtx.readonly); }   // joueur = consultation seule

// Recharge le programme du contexte courant (progCtx doit être positionné avant
// le 1er appel par l'ouvreur ; les rafraîchissements internes le réutilisent).
async function chargerProgrammeCoach() {
  const el = _progEl();
  const aid = _progAthleteId();
  if (!aid) return;
  if (el) el.innerHTML = '<div class="loader">Chargement...</div>';
  if (exercicesData.length === 0) await chargerExercices();
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCoachProgramme&athlete_id=${encodeURIComponent(aid)}`);
    const data = await res.json();
    cdProgrammeLignes = data.lignes || [];
    renderProgrammeCoach();
  } catch(e) {
    if (el) el.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
  }
}

function renderProgrammeCoach() {
  const el = _progEl();
  if (!el) return;
  const ro = _progReadonly();   // lecture seule (joueur) : pas d'édition
  const seances = {};
  const ordre = [];
  cdProgrammeLignes.forEach(l => {
    if (!seances[l.seance_id]) { seances[l.seance_id] = []; ordre.push(l.seance_id); }
    seances[l.seance_id].push(l);
  });
  if (ordre.length === 0) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text-muted)">Aucune séance dans le programme.</div>';
    return;
  }
  const champNum = (val, ph, handlerArgs, label) => `
    <div style="flex:1;min-width:64px">
      <label style="font-size:9px;color:var(--text-muted);margin-bottom:3px;display:block;text-transform:none;letter-spacing:0">${label}</label>
      <input type="number" value="${val}" placeholder="${ph}" onchange="${handlerArgs}" style="font-size:15px;padding:9px 8px;width:100%;min-width:0;text-align:center;margin-bottom:0">
    </div>`;

  // Champs éditables d'un exercice (sélecteur + séries/reps/repos). extraBtn = bouton optionnel (délier).
  const champsExo = (l, seanceId, extraBtn) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <select onchange="cdSauverLigne(${l.row_index},'${seanceId}',this.value,null,null,null,null,null)" style="font-size:14px;padding:9px 10px;flex:1;min-width:0;margin-bottom:0;font-weight:700">${exercicesData.map(e => `<option value="${e.exercice}"${e.exercice === l.exercice ? ' selected' : ''}>${e.exercice}</option>`).join('')}</select>
      ${extraBtn || ''}
      <button class="btn-sm btn-danger-sm" onclick="cdSupprimerLigne(${l.row_index})" title="Supprimer" style="width:38px;height:38px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg class="ico"><use href="#i-trash"/></svg></button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${champNum(l.series_prevues, '3', `cdSauverLigne(${l.row_index},'${seanceId}',null,this.value,null,null,null,null)`, 'Séries')}
      ${champNum(l.reps_mini, '8', `cdSauverLigne(${l.row_index},'${seanceId}',null,null,this.value,null,null,null)`, 'Reps min')}
      ${champNum(l.reps_max, '12', `cdSauverLigne(${l.row_index},'${seanceId}',null,null,null,this.value,null,null)`, 'Reps max')}
      ${champNum(l.repos_sec || '', '90', `cdSauverLigne(${l.row_index},'${seanceId}',null,null,null,null,this.value,null)`, 'Repos (s)')}
    </div>`;

  // Dropdown pour lier un exercice (ajoute au superset ancré sur ligneAncre)
  const selLier = (ligneAncre, seanceId, exclus) => `
    <select onchange="if(this.value){cdLierExerciceParNom(${ligneAncre.row_index},'${seanceId}',this.value);this.value='';}" style="font-size:13px;padding:8px 10px;width:auto;min-width:150px;margin-bottom:0;margin-top:10px" title="Lier à un exercice (superset)">
      <option value="">🔗 Lier un exercice…</option>
      ${exercicesData.filter(e => !exclus.includes(e.exercice)).map(e => `<option value="${e.exercice}">${e.exercice}</option>`).join('')}
    </select>`;

  // Muscle d'un exercice (via le catalogue), résumé séries × reps
  const muscleDe = nom => { const e = exercicesData.find(x => x.exercice === nom); return e && e.muscle ? e.muscle : ''; };
  const resumeQty = l => {
    const s = l.series_prevues || '–';
    const rmin = l.reps_mini, rmax = l.reps_max;
    const reps = (rmin && rmax) ? `${rmin}-${rmax}` : (rmin || rmax || '–');
    return `${s} <span style="color:var(--text-muted);font-weight:600">×</span> ${reps}`;
  };
  // Ligne compacte (mode lecture) — le crayon ouvre le bloc d'édition.
  // En lecture seule (joueur) : pas de clic ni de crayon, simple consultation.
  const ligneLecture = (l, accent) => {
    const mus = muscleDe(l.exercice);
    return `
      <div ${ro ? '' : `onclick="cdToggleExo(${l.row_index})"`} style="display:flex;align-items:center;gap:11px;padding:10px 4px;${ro ? '' : 'cursor:pointer'}">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:${accent||'var(--text)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.exercice}</div>
          ${mus ? `<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-top:2px">${mus}</div>` : ''}
        </div>
        <span style="font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap">${resumeQty(l)}</span>
        ${ro ? '' : `<span class="pencil-prog" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);width:32px;height:32px;border-radius:9px;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">✎</span>`}
      </div>`;
  };

  el.innerHTML = ordre.map((seanceId, si) => {
    // Regrouper les exercices en unités : soit seuls, soit en superset (même groupe_id)
    const lignes = seances[seanceId];
    const unites = [];
    const groupesVus = {};
    lignes.forEach(l => {
      if (l.groupe_id) {
        if (groupesVus[l.groupe_id]) return; // déjà traité via le premier membre
        groupesVus[l.groupe_id] = true;
        const membres = lignes.filter(o => o.groupe_id === l.groupe_id);
        unites.push({ type: 'groupe', groupeId: l.groupe_id, membres });
      } else {
        unites.push({ type: 'single', ligne: l });
      }
    });

    const blocEdit = (l, seanceId, extraBtn, extraSel) => {
      const ouvertExo = !!cdExoOpen[l.row_index];
      return `<div id="exo-edit-${l.row_index}" style="border-top:1px solid var(--border);padding-top:10px;margin-top:2px;${ouvertExo?'':'display:none'}">
          ${champsExo(l, seanceId, extraBtn)}
          ${extraSel || ''}
        </div>`;
    };
    const cartes = unites.map(u => {
      if (u.type === 'single') {
        const l = u.ligne;
        return `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:4px 12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.25)">
          ${ligneLecture(l)}
          ${ro ? '' : blocEdit(l, seanceId, null, selLier(l, seanceId, [l.exercice]))}
        </div>`;
      }
      // Superset : une seule carte avec tous les membres empilés
      const coul = couleurGroupe(u.groupeId);
      const nomsMembres = u.membres.map(m => m.exercice);
      return `
        <div style="background:var(--surface);border:1px solid var(--border);border-left:4px solid ${coul};border-radius:10px;padding:12px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.25)">
          <div style="font-size:11px;font-weight:800;color:${coul};margin-bottom:6px;letter-spacing:0.5px">${ic('link')} SUPERSET · ${u.membres.length} exercices enchaînés</div>
          ${u.membres.map((m, i) => `
            ${i > 0 ? `<div style="text-align:center;color:${coul};font-size:16px;font-weight:800;margin:-2px 0 4px">↓</div>` : ''}
            <div style="background:var(--surface2);border-radius:8px;padding:2px 10px;margin-bottom:8px">
              ${ligneLecture(m, coul)}
              ${ro ? '' : blocEdit(m, seanceId, `<button onclick="cdRetirerDuGroupe(${m.row_index},'${seanceId}')" title="Retirer du superset" style="background:${coul}1a;border:1px solid ${coul};color:${coul};border-radius:8px;width:38px;height:38px;padding:0;cursor:pointer;font-size:12px;flex-shrink:0;font-weight:700">✕</button>`)}
            </div>`).join('')}
          ${ro ? '' : selLier(u.membres[0], seanceId, nomsMembres)}
        </div>`;
    }).join('');

    const ouvert = (seanceId in cdProgOpen) ? cdProgOpen[seanceId] : (si === 0);
    return `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:0;margin-bottom:12px;overflow:hidden">
      <div onclick='cdToggleSeanceProg(${si}, ${JSON.stringify(seanceId)})' style="display:flex;align-items:center;justify-content:space-between;padding:13px 14px;background:var(--accent-a08);cursor:pointer">
        <div style="font-size:15px;font-weight:800;color:var(--accent);display:flex;align-items:center;gap:8px"><svg class="ico"><use href="#i-clipboard"/></svg>${seanceId}</div>
        <div style="display:flex;align-items:center;gap:9px">
          <span style="font-size:11px;font-weight:800;background:var(--accent-a14);color:var(--accent);padding:2px 9px;border-radius:20px">${lignes.length} exo${lignes.length>1?'s':''}</span>
          <span id="prog-arrow-${si}" style="font-size:15px;color:var(--text-muted);transition:transform .2s;transform:${ouvert?'rotate(90deg)':'none'}">›</span>
        </div>
      </div>
      <div id="prog-body-${si}" style="padding:12px 14px;border-top:1px solid var(--border);${ouvert?'':'display:none'}">
        ${cartes}
        ${ro ? '' : `<button onclick="cdAjouterExercice('${seanceId}')" style="width:100%;margin-top:4px;padding:12px;border:1.5px dashed var(--accent-dim);background:var(--accent-a08);color:var(--accent);border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;"><span style="font-size:18px;line-height:1;">+</span> Ajouter un exercice</button>`}
      </div>
    </div>`;
  }).join('');
}

// État d'ouverture des exercices (mode édition via crayon) — conservé entre les re-rendus
let cdExoOpen = {};
function cdToggleExo(rowIndex) {
  cdExoOpen[rowIndex] = !cdExoOpen[rowIndex];
  const bloc = document.getElementById('exo-edit-' + rowIndex);
  if (bloc) bloc.style.display = cdExoOpen[rowIndex] ? 'block' : 'none';
}

// État d'ouverture des séances (accordéon) — conservé entre les re-rendus
let cdProgOpen = {};
function cdToggleSeanceProg(si, seanceId) {
  cdProgOpen[seanceId] = !((seanceId in cdProgOpen) ? cdProgOpen[seanceId] : (si === 0));
  const body = document.getElementById('prog-body-' + si);
  const arrow = document.getElementById('prog-arrow-' + si);
  if (body) body.style.display = cdProgOpen[seanceId] ? 'block' : 'none';
  if (arrow) arrow.style.transform = cdProgOpen[seanceId] ? 'rotate(90deg)' : 'none';
}

function cdSauverLigne(rowIndex, seanceId, exercice, series, repsMini, repsMax, reposSec, groupeId) {
  const ligne = cdProgrammeLignes.find(l => l.row_index === rowIndex);
  if (!ligne) return;
  if (exercice !== null) ligne.exercice = exercice;
  if (series !== null) ligne.series_prevues = Number(series);
  if (repsMini !== null) ligne.reps_mini = Number(repsMini);
  if (repsMax !== null) ligne.reps_max = Number(repsMax);
  if (reposSec !== null) ligne.repos_sec = Number(reposSec);
  if (groupeId !== null) { ligne.groupe_id = groupeId.trim().toUpperCase(); renderProgrammeCoach(); }
  else if (exercice !== null) { cdExoOpen[rowIndex] = true; renderProgrammeCoach(); } // MAJ live du nom/muscle affiché
  return fetch(SCRIPT_URL, {
    method: 'POST', headers: {'Content-Type': 'text/plain'},
    body: JSON.stringify({
      action: 'saveProgrammeLigne', row_index: rowIndex, athlete_id: _progAthleteId(),
      seance_id: ligne.seance_id, exercice: ligne.exercice,
      series_prevues: ligne.series_prevues, reps_mini: ligne.reps_mini, reps_max: ligne.reps_max,
      repos_sec: ligne.repos_sec, groupe_id: ligne.groupe_id || ''
    })
  });
}

function genGroupeId(seanceId) {
  const utilises = new Set(cdProgrammeLignes.filter(l => l.seance_id === seanceId && l.groupe_id).map(l => l.groupe_id));
  const lettres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const c of lettres) if (!utilises.has(c)) return c;
  return 'G' + Math.floor(Math.random() * 100);
}

function cdAjouterPartenaire(rowIndex, seanceId, partnerRowIndexStr) {
  const ligne = cdProgrammeLignes.find(l => l.row_index === rowIndex);
  const partenaire = cdProgrammeLignes.find(l => l.row_index === Number(partnerRowIndexStr));
  if (!ligne || !partenaire) return;
  const groupeId = ligne.groupe_id || partenaire.groupe_id || genGroupeId(seanceId);
  ligne.groupe_id = groupeId;
  partenaire.groupe_id = groupeId;
  cdSauverLigne(rowIndex, seanceId, null, null, null, null, null, groupeId);
  cdSauverLigne(partenaire.row_index, seanceId, null, null, null, null, null, groupeId);
  renderProgrammeCoach();
}

function cdRetirerDuGroupe(rowIndex, seanceId) {
  const ligne = cdProgrammeLignes.find(l => l.row_index === rowIndex);
  if (!ligne) return;
  ligne.groupe_id = '';
  cdSauverLigne(rowIndex, seanceId, null, null, null, null, null, '');
  renderProgrammeCoach();
}

// Lier par nom d'exercice : si l'exercice n'est pas encore dans la séance, on l'ajoute puis on le lie.
async function cdLierExerciceParNom(rowIndex, seanceId, exerciceNom) {
  if (!exerciceNom) return;
  const ligne = cdProgrammeLignes.find(l => l.row_index === rowIndex);
  if (!ligne) return;
  const groupeId = ligne.groupe_id || genGroupeId(seanceId);
  ligne.groupe_id = groupeId;

  const existant = cdProgrammeLignes.find(l => l.seance_id === seanceId && l.exercice === exerciceNom && l.row_index !== rowIndex);
  if (existant) {
    existant.groupe_id = groupeId;
    // On attend la persistance avant de recharger pour éviter d'écraser un changement récent
    await cdSauverLigne(rowIndex, seanceId, null, null, null, null, null, groupeId);
    await cdSauverLigne(existant.row_index, seanceId, null, null, null, null, null, groupeId);
    renderProgrammeCoach();
  } else {
    // Sauver d'abord la ligne courante (avec son exercice à jour) AVANT de créer la ligne liée et de recharger
    await cdSauverLigne(rowIndex, seanceId, null, null, null, null, null, groupeId);
    const body = {
      action: 'saveProgrammeLigne', athlete_id: _progAthleteId(),
      athlete_nom: _progAthleteNom(), seance_id: seanceId, exercice: exerciceNom,
      series_prevues: ligne.series_prevues || 3, reps_mini: ligne.reps_mini || 8,
      reps_max: ligne.reps_max || 12, repos_sec: ligne.repos_sec || 90, groupe_id: groupeId
    };
    await fetch(SCRIPT_URL, { method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify(body) });
    await chargerProgrammeCoach();
  }
}

async function cdAjouterExercice(seanceId) {
  if (exercicesData.length === 0) return;
  const exo = exercicesData[0];
  const body = {
    action: 'saveProgrammeLigne', athlete_id: _progAthleteId(),
    athlete_nom: _progAthleteNom(), seance_id: seanceId, exercice: exo.exercice,
    series_prevues: 3, reps_mini: 8, reps_max: 12, repos_sec: 90, groupe_id: ''
  };
  await fetch(SCRIPT_URL, {method: 'POST', headers: {'Content-Type': 'text/plain'}, body: JSON.stringify(body)});
  chargerProgrammeCoach();
}

async function cdAjouterSeance() {
  const nom = prompt('Nom de la nouvelle séance (ex: Push, Pull, Jambes...)');
  if (!nom) return;
  cdProgOpen[nom] = true;   // ouvrir la nouvelle séance après rechargement (voir le +Ajouter)
  await cdAjouterExercice(nom);
}

async function cdSupprimerLigne(rowIndex) {
  if (!confirm('Supprimer cet exercice du programme ?')) return;
  await fetch(SCRIPT_URL, {
    method: 'POST', headers: {'Content-Type': 'text/plain'},
    body: JSON.stringify({action: 'supprimerProgrammeLigne', row_index: rowIndex, athlete_id: _progAthleteId()})
  });
  chargerProgrammeCoach();
}

// ==================== CHAT COACH <-> ATHLETE ==================== [NOYAU]
let commentairesAthleteActuel = [];

function formatChatDate(d) {
  if (!d) return '';
  // Déjà au format dd/MM/yyyy (éventuellement avec heure) -> on garde
  if (typeof d === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(d)) return d;
  // Format ISO (2026-07-01T08:52:00.000Z) ou autre -> on convertit
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  const p = n => String(n).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

function parseChatDate(d) {
  if (!d) return 0;
  if (typeof d === 'string') {
    const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
  }
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

function renderBullesChat(commentaires, elId, isCoach) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (commentaires.length === 0) {
    const isAthleteView = !isCoach;
    el.innerHTML = isAthleteView
      ? `<div style="text-align:center;padding:28px 16px;">
           <div style="font-size:28px;margin-bottom:10px;">💬</div>
           <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">Écris à ton coach</div>
           <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">Une question, une douleur, un feedback ?<br>Ton coach te répondra ici.</div>
         </div>`
      : '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px;">Aucun message pour le moment.</div>';
    return;
  }
  commentaires = [...commentaires].sort((a, b) => parseChatDate(a.date) - parseChatDate(b.date));
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.gap = '10px';
  // Avatar de l'interlocuteur (« eux ») : initiales + couleur selon le côté
  const themNom = isCoach ? (coachAthleteCourant && coachAthleteCourant.nom ? coachAthleteCourant.nom : 'Athlète') : 'Coach';
  const themInit = themNom.trim().slice(0, 2).toUpperCase();
  const themCol = isCoach ? 'var(--good)' : 'var(--accent)';
  const dayLabel = ts => {
    const d = new Date(ts); if (isNaN(d.getTime())) return '';
    const t = new Date(); const y = new Date(); y.setDate(t.getDate() - 1);
    const sameDay = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
    if (sameDay(d, t)) return "Aujourd'hui";
    if (sameDay(d, y)) return 'Hier';
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  };
  const heure = ts => { const d = new Date(ts); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  let lastDay = '';
  el.innerHTML = commentaires.map(c => {
    const ts = parseChatDate(c.date);
    const isMine = isCoach ? (c.auteur !== 'athlete') : (c.auteur === 'athlete');
    const bg = isMine ? 'var(--accent)' : 'var(--surface2)';
    const color = isMine ? '#fff' : 'var(--text)';
    const radius = isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
    const deleteBtn = (isCoach && isMine)
      ? `<button onclick="supprimerCommentaireCoach('${c.id}')" title="Supprimer" style="background:none;border:none;cursor:pointer;font-size:12px;opacity:0.5;padding:0 0 0 4px;"><svg class="ico"><use href="#i-trash"/></svg></button>` : '';
    const lu = (isCoach && !isMine && !estLu(c, 'muscu_lu_coach')) ? '<span style="font-size:9px;color:#f59f00;"> · non lu</span>' : '';
    const meLabel = isMine ? ' · toi' : '';
    const avatar = isMine ? '' : `<div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;background:color-mix(in srgb, ${themCol} 20%, transparent);color:${themCol};">${escapeHtml(themInit)}</div>`;
    const bubble = `<div style="display:flex;flex-direction:column;align-items:${isMine?'flex-end':'flex-start'};min-width:0;">
        <div style="background:${bg};color:${color};padding:8px 12px;border-radius:${radius};font-size:13.5px;white-space:pre-wrap;line-height:1.4;">${escapeHtml(c.message)}</div>
        <div style="font-size:9.5px;color:var(--text-muted);margin-top:3px;display:flex;align-items:center;gap:2px;">${heure(ts)}${meLabel}${lu}${deleteBtn}</div>
      </div>`;
    const row = `<div style="display:flex;gap:8px;align-items:flex-end;max-width:85%;${isMine?'align-self:flex-end;flex-direction:row-reverse;':'align-self:flex-start;'}">${avatar}${bubble}</div>`;
    const dl = dayLabel(ts);
    let sep = '';
    if (dl && dl !== lastDay) { sep = `<span style="align-self:center;font-size:10px;font-weight:700;color:var(--text-muted);background:var(--surface2);padding:3px 11px;border-radius:20px;">${dl}</span>`; lastDay = dl; }
    return sep + row;
  }).join('');
  el.scrollTop = el.scrollHeight;
}

// Suivi local des messages lus (persiste même si le marquage serveur échoue)
function getLusLocaux(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]').map(String)); }
  catch(e) { return new Set(); }
}
function ajouterLusLocaux(key, ids) {
  const set = getLusLocaux(key);
  ids.forEach(id => set.add(String(id)));
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch(e) {}
}
function estLu(c, key) {
  return c.lu === true || c.lu === 'TRUE' || getLusLocaux(key).has(String(c.id));
}

function majBadgeConseilsCoach(forceZero) {
  const badge = document.getElementById('badge-conseils-coach');
  if (!badge) return;
  if (forceZero === 0) { badge.style.display = 'none'; return; }
  const nonLus = commentairesAthleteActuel.filter(c => c.auteur === 'athlete' && !estLu(c, 'muscu_lu_coach')).length;
  badge.textContent = nonLus;
  badge.style.display = nonLus > 0 ? 'block' : 'none';
}

// Ouvre la conversation côté coach et marque les messages de l'athlète comme lus
function renderConversationAlertes() {
  const el = document.getElementById('cd-conv-alertes');
  if (!el) return;
  const a = coachAthleteCourant;
  // Liste COMPLÈTE (non filtrée) = alertes backend + alertes de synthèse, puis on répartit traité / à traiter
  const toutes = (a && a.alertes ? a.alertes.slice() : [])
    .concat(construireSynthAlertes(coachAthleteData));
  if (!toutes.length) {
    el.innerHTML = '<div style="display:flex;align-items:center;gap:9px;color:var(--good);font-size:13px;font-weight:700;">✅ Aucune alerte cette semaine</div>';
    return;
  }
  const traitees = toutes.filter(al => alerteEstTraitee(a.athlete_id, al));
  const aTraiter = toutes.filter(al => !alerteEstTraitee(a.athlete_id, al));
  const row = (al, done) => `
    <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border);">
      <span style="width:26px;height:26px;border-radius:8px;background:${done?'var(--good-a)':'var(--warn-a)'};display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">${done?'✅':'⚠'}</span>
      <div style="flex:1;min-width:0;font-size:12.5px;font-weight:600;">${al.message || al.msg || 'Alerte'}</div>
      <span style="font-size:10.5px;font-weight:800;color:${done?'var(--good)':'var(--warn)'};white-space:nowrap;">${done?'Traitée':'À traiter'}</span>
    </div>`;
  el.innerHTML =
    `<div style="display:flex;gap:9px;margin-bottom:4px;">
       <div class="v2-pstat" style="background:var(--good-a);padding:9px 11px;"><div class="pn" style="color:var(--good);font-size:18px;">${traitees.length}</div><div class="pk">traitée${traitees.length>1?'s':''}</div></div>
       <div class="v2-pstat" style="background:var(--warn-a);padding:9px 11px;"><div class="pn" style="color:var(--warn);font-size:18px;">${aTraiter.length}</div><div class="pk">à traiter</div></div>
     </div>
     ${aTraiter.map(al => row(al, false)).join('')}
     ${traitees.map(al => row(al, true)).join('')}`;
}

function ouvrirConversationCoach() {
  switchCoachDetailTab('conseils');
  renderConversationAlertes();
  const nonLus = commentairesAthleteActuel.filter(c => c.auteur === 'athlete' && !estLu(c, 'muscu_lu_coach')).map(c => c.id);
  if (nonLus.length > 0) {
    ajouterLusLocaux('muscu_lu_coach', nonLus);
    fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'marquerCommentairesLus', ids: nonLus })
    });
    commentairesAthleteActuel.forEach(c => { if (nonLus.includes(c.id)) c.lu = true; });
  }
  majBadgeConseilsCoach(0);
}

async function chargerCommentairesCoach(athlete_id) {
  const el = document.getElementById('cd-commentaires-liste');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCommentaires&athlete_id=${encodeURIComponent(athlete_id)}`);
    const data = await res.json();
    const commentaires = data.commentaires || [];
    commentairesAthleteActuel = commentaires;
    renderBullesChat(commentaires, 'cd-commentaires-liste', true);
    majBadgeConseilsCoach();
    renderAlertesCoach();
  } catch(e) {
    if (el) el.innerHTML = '<div class="error-msg">Erreur de chargement</div>';
  }
}

function dejaConseille(sujet) {
  const cible = ('À propos de : ' + sujet).toLowerCase();
  return commentairesAthleteActuel.some(c => String(c.message).toLowerCase().includes(cible));
}

// Construit les alertes de synthèse (volume/progression/récup/régularité) d'un athlète.
// Source UNIQUE utilisée par l'Aperçu ET par la Conversation. La régularité est
// masquée si l'athlète est en vacances. Ne filtre PAS les traitées (le fait l'appelant).
function construireSynthAlertes(data) {
  const out = [];
  if (!data || !coachAthleteCourant) return out;
  // Mode vacances : aucune alerte de synthèse (reprend seul à la fin).
  if (estEnPause(data && data.pause)) return out;
  const m = computeMarqueursCoach(data, coachAthleteCourant);
  if (m.volColor === '#e5484d' || m.volColor === 'var(--bad)') out.push({ type: 'synth-volume', msg: `Volume insuffisant — ${m.volLabel}`, color: '#e5484d' });
  else if (m.volColor === '#f59f00' || m.volColor === 'var(--warn)') out.push({ type: 'synth-volume', msg: `Volume faible — ${m.volLabel}`, color: '#f59f00' });
  if (m.progColor === '#e5484d') out.push({ type: 'synth-progression', msg: `Progression en baisse — ${m.progLabel}`, color: '#e5484d' });
  if (m.recupColor === '#e5484d') out.push({ type: 'synth-recup', msg: `Fatigue élevée — ${m.recupLabel}`, color: '#e5484d' });
  else if (m.recupColor === '#f59f00') out.push({ type: 'synth-recup', msg: `Récupération modérée — ${m.recupLabel}`, color: '#f59f00' });
  if (m.regColor === '#e5484d') out.push({ type: 'synth-regularite', msg: `Régularité insuffisante — ${m.regLabel}`, color: '#e5484d' });
  const enPause = estEnPause(data.pause);
  return out.filter(s => !(enPause && s.type === 'synth-regularite'));
}

function renderAlertesCoach(data) {
  const el = document.getElementById('cd-alertes');
  if (!el || !coachAthleteCourant) return;
  const couleurSeverite = { haute: '#e5484d', moyenne: '#f5a623', basse: '#a3a3a3' };
  const alertes = (coachAthleteCourant.alertes || []).filter(al => !alerteEstTraitee(coachAthleteCourant.athlete_id, al));

  const d = data || coachAthleteData;
  // Alertes de synthèse non encore traitées cette semaine
  let synthAlertes = construireSynthAlertes(d).filter(s => !alerteEstTraitee(coachAthleteCourant.athlete_id, { type: s.type }));

  const alertesHtml = alertes.map((al, idx) => {
    const c = couleurSeverite[al.severite] || '#a3a3a3';
    const sujetRaw = sujetAlerte(al);
    const sujet = sujetRaw.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const fait = dejaConseille(sujetRaw);
    const explicationId = `alerte-explication-${idx}`;
    return `<div style="padding:8px 10px;background:${c}1a;border-radius:8px;margin-top:6px">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="font-size:14px">⚠️</span>
        <span style="font-size:13px;font-weight:600;color:${c};flex:1">${al.message}${al.recurrence_semaines > 1 ? ` <span style="font-size:11px;color:var(--text-muted);font-weight:400">(🔁 depuis ${al.recurrence_semaines} semaines)</span>` : ''}</span>
      </div>
      <div id="${explicationId}" style="display:none;font-size:11px;color:var(--text-muted);margin-top:6px;padding:6px 8px;background:var(--surface2);border-radius:6px">${explicationAlerte(al)}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="btn-sm btn-outline" onclick="toggleExplicationAlerte('${explicationId}')">ℹ️ Pourquoi ?</button>
        ${fait
          ? `<span style="font-size:12px;color:#00c96e;font-weight:700;align-self:center">✅ Déjà conseillé</span>
             <button class="btn-sm btn-outline" onclick="repondreAlerte('${sujet}')">${ic('pencil')} Autre conseil</button>`
          : `<button class="btn-sm btn-outline" onclick="repondreAlerte('${sujet}')">${ic('pencil')} Répondre à l'athlète</button>`}
        <button class="btn-sm btn-outline" onclick="traiterAlerteDepuisDetail(${idx})">✓ Traité</button>
      </div>
    </div>`;
  }).join('');

  const synthHtml = synthAlertes.map(s => {
    const sujet = s.msg.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
    <div style="padding:8px 10px;background:${s.color}1a;border-radius:8px;margin-top:6px">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="font-size:14px">📊</span>
        <span style="font-size:13px;font-weight:600;color:${s.color};flex:1">${s.msg}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        <button class="btn-sm btn-outline" onclick="repondreAlerte('${sujet}')">${ic('pencil')} Répondre à l'athlète</button>
        <button class="btn-sm btn-outline" onclick="traiterSyntheseAlerteCoach('${s.type}')">✓ Traité</button>
      </div>
    </div>`;
  }).join('');

  const tout = alertesHtml + synthHtml;
  el.innerHTML = tout || '<div style="font-size:13px;color:#00c96e;font-weight:700;margin-top:6px">✅ Rien à signaler</div>';
}

function toggleExplicationAlerte(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function explicationAlerte(al) {
  if (al.type === 'irregularite') return "Déclenchée quand aucune séance n'a été enregistrée depuis 7 jours ou plus.";
  if (al.type === 'fatigue') return "Déclenchée quand le RPE moyen des 7 derniers jours dépasse 8,5 ET que la charge moyenne (comparée exercice par exercice) a baissé de plus de 5% par rapport aux 3 semaines précédentes.";
  if (al.type === 'stagnation') return "Déclenchée quand un exercice n'a montré aucune progression (charge ou reps) sur un nombre de séances dépendant du palier d'expérience de l'athlète : 3 séances en débutant, 4 en intermédiaire, 6 en avancé, 8 en expert.";
  return "Seuil de détection non documenté.";
}

function traiterAlerteDepuisDetail(idx) {
  if (!coachAthleteCourant) return;
  const alertes = (coachAthleteCourant.alertes || []).filter(al => !alerteEstTraitee(coachAthleteCourant.athlete_id, al));
  const al = alertes[idx];
  if (!al) return;
  marquerAlerteTraitee(coachAthleteCourant.athlete_id, al); // met à jour l'accueil
  renderAlertesCoach(); // met à jour le détail
  renderConversationAlertes(); // met à jour le bloc traitées/à traiter
}

// Marque une alerte de synthèse (volume/progression/récup) comme traitée pour la semaine
function traiterSyntheseAlerteCoach(type) {
  if (!coachAthleteCourant) return;
  marquerAlerteTraitee(coachAthleteCourant.athlete_id, { type: type });
  renderAlertesCoach(coachAthleteData); // recalcule et masque celle traitée
  renderConversationAlertes();          // la fait apparaître en « traitée »
}

function sujetAlerte(al) {
  if (al.type === 'fatigue') return 'fatigue élevée';
  if (al.type === 'irregularite') return 'manque de régularité';
  if (al.type === 'stagnation') {
    const exo = String(al.message).split(' : ')[0];
    return exo ? ('stagnation sur ' + exo) : 'stagnation';
  }
  return al.type || 'point à surveiller';
}

function repondreAlerte(contexte) {
  switchCoachDetailTab('conseils');
  const input = document.getElementById('cd-comment-input');
  const prefixe = `À propos de : ${contexte}\n\nMon conseil : `;
  input.value = prefixe;
  input.focus();
  // Placer le curseur à la fin
  input.setSelectionRange(input.value.length, input.value.length);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function envoyerCommentaireCoach() {
  const input = document.getElementById('cd-comment-input');
  const message = input.value.trim();
  if (!message) { showToast('⚠️ Écris un message', '#ff4444'); return; }
  if (!coachAthleteCourant || !coach) return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveCommentaire',
        coach_id: coach.coach_id,
        coach_nom: coach.nom,
        auteur: 'coach',
        auteur_nom: coach.nom,
        athlete_id: coachAthleteCourant.athlete_id,
        message: message
      })
    });
    input.value = '';
    showToast('✅ Message envoyé !');
    setTimeout(() => chargerCommentairesCoach(coachAthleteCourant.athlete_id), 800);
  } catch(e) {
    showToast('❌ Erreur envoi', '#ff4444');
  }
}

async function envoyerMessageAthleteCoach() {
  const input = document.getElementById('athlete-chat-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message) { showToast('⚠️ Écris un message', '#ff4444'); return; }
  if (!athlete) return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveCommentaire',
        auteur: 'athlete',
        auteur_nom: athlete.prenom || athlete.nom || 'Athlète',
        athlete_id: athlete.athlete_id,
        message: message
      })
    });
    input.value = '';
    showToast('✅ Message envoyé !');
    // Affichage immédiat (optimiste) dans la conversation de l'athlète
    messagesCoach.push({ id: 'tmp-' + Date.now(), date: formatChatDate(new Date()), message: message, auteur: 'athlete', lu: false });
    renderBullesChat(messagesCoach, 'conseils-content', false);
    // Puis resynchronisation avec le serveur
    setTimeout(async () => { await chargerMessagesCoach(); renderBullesChat(messagesCoach, 'conseils-content', false); }, 800);
  } catch(e) {
    showToast('❌ Erreur envoi', '#ff4444');
  }
}

async function supprimerCommentaireCoach(id) {
  if (!confirm('Supprimer ce conseil ? L\'athlète ne le verra plus.')) return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'supprimerCommentaire', id: id })
    });
    showToast('🗑️ Conseil supprimé');
    setTimeout(() => chargerCommentairesCoach(coachAthleteCourant.athlete_id), 800);
  } catch(e) {
    showToast('❌ Erreur suppression', '#ff4444');
  }
}

// Côté athlète : conseils du coach (onglet dédié + badge)
let messagesCoach = [];

async function chargerMessagesCoach() {
  if (!athlete) return;
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCommentaires&athlete_id=${encodeURIComponent(athlete.athlete_id)}`);
    const data = await res.json();
    messagesCoach = data.commentaires || [];
  } catch(e) {
    messagesCoach = [];
  }
  majBadgeConseils();
}

function majBadgeConseils() {
  const badge = document.getElementById('badge-conseils');
  if (!badge) return;
  const nonLus = messagesCoach.filter(c => c.auteur !== 'athlete' && !estLu(c, 'muscu_lu_athlete')).length;
  if (nonLus > 0) {
    badge.textContent = nonLus;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function afficherOngletConseils() {
  renderBullesChat(messagesCoach, 'conseils-content', false);

  // Marquer les messages du coach comme lus (local + serveur)
  const nonLusCoach = messagesCoach.filter(c => c.auteur !== 'athlete' && !estLu(c, 'muscu_lu_athlete')).map(c => c.id);
  if (nonLusCoach.length > 0) {
    ajouterLusLocaux('muscu_lu_athlete', nonLusCoach);
    fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'marquerCommentairesLus', ids: nonLusCoach })
    });
    messagesCoach.forEach(c => { if (nonLusCoach.includes(c.id)) c.lu = true; });
    majBadgeConseils();
  }
}

// Icône de sport pour les en-têtes (haltère muscu, ballon foot…). Extensible :
// il suffit d'ajouter un couple sport → id d'icône SVG pour un nouveau sport.
function _sportIcoId(sport) {
  var map = { muscu: 'i-dumbbell', foot: 'i-ball', football: 'i-ball' };
  return map[String(sport || '').toLowerCase()] || 'i-ball'; // défaut : sports collectifs
}
function _setSportIco(useElId, sport) {
  var u = document.getElementById(useElId);
  if (u) u.setAttribute('href', '#' + _sportIcoId(sport));
}

// ==================== APP (athlète) ==================== [MIXTE]
async function ouvrirApp() {
  document.getElementById('view-login').classList.remove('active');
  // Phase 3 : un athlète d'un sport collectif voit SA propre page joueur (3 onglets, lecture seule).
  if (athlete && athlete.sport && athlete.sport !== 'muscu') {
    document.getElementById('tabs-bar').style.display = 'none';
    document.body.classList.remove('has-bottom-nav');
    const st = localStorage.getItem('muscu_theme');
    if (st === 'light') document.body.classList.add('light-mode');
    ouvrirDetailJoueurFoot(athlete.athlete_id, 'athlete');
    _consommerNotifPending();
    return;
  }
  document.getElementById('view-app').classList.add('active');
  document.getElementById('tabs-bar').style.display = 'flex';
  document.body.classList.add('has-bottom-nav');
  document.getElementById('btn-logout').style.display = 'block';
  document.getElementById('btn-reglages-hdr').style.display = 'block';
  // Restore saved theme
  const savedTheme = localStorage.getItem('muscu_theme');
  if (savedTheme === 'light') document.body.classList.add('light-mode');
  syncThemeUI();
  _setSportIco('brand-ico-use', athlete && athlete.sport);   // icône du header selon le sport
  document.getElementById('header-nom').textContent = 'Accueil';
  document.getElementById('inp-date').value = _todayLocalStr();
  document.getElementById('inp-date-poids').value = _todayLocalStr();
  document.getElementById('main-container').classList.add('no-pad');
  document.body.classList.add('on-accueil');

  if (athlete.objectif) {
    majObjectifCard(athlete.objectif);
    document.getElementById('sel-objectif').value = athlete.objectif;
  }

  if (exercicesData.length === 0) await chargerExercices();
  const _re1=document.getElementById('rech-exo'); if(_re1)_re1.value=''; remplirListeExosLibres('');
  chargerAppData(); // Un seul appel pour tout
  chargerMessagesCoach(); // Messages du coach
  _consommerNotifPending();
}

function switchAuthMode(mode) {
  document.getElementById('auth-login').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('auth-signup').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authtab-login').classList.toggle('auth-seg-active', mode === 'login');
  document.getElementById('authtab-signup').classList.toggle('auth-seg-active', mode === 'signup');
  if (mode === 'signup') {
    const sel = document.getElementById('reg-sport');
    if (sel && !sel.options.length) {
      sel.innerHTML = Object.keys(SPORTS).map(function(cle) {
        return `<option value="${cle}">${SPORTS[cle].nom}</option>`;
      }).join('');
      sel.value = 'muscu';
    }
    majChampsSportInscription();
  }
}

// Inscription athlète adaptative : n'affiche les champs propres à un sport que
// s'il est sélectionné. Aujourd'hui : "années de pratique" = muscu uniquement.
function majChampsSportInscription() {
  const sel = document.getElementById('reg-sport');
  const sport = sel ? sel.value : 'muscu';
  const anneesWrap = document.getElementById('reg-annees-wrap');
  if (anneesWrap) anneesWrap.style.display = (sport === 'muscu') ? '' : 'none';
}

function ouvrirConfidentialite(ev) { if (ev) ev.preventDefault(); document.getElementById('modal-confidentialite').style.display = 'flex'; }
function fermerConfidentialite() { document.getElementById('modal-confidentialite').style.display = 'none'; }

function switchCoachAuthMode(mode) {
  document.getElementById('coach-auth-login').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('coach-auth-signup').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('coachtab-login').classList.toggle('auth-seg-active', mode === 'login');
  document.getElementById('coachtab-signup').classList.toggle('auth-seg-active', mode === 'signup');
  // Remplit le sélecteur de sport de l'inscription coach (depuis le registre SPORTS).
  if (mode === 'signup') {
    const sel = document.getElementById('reg-coach-sport');
    if (sel && !sel.options.length) {
      sel.innerHTML = Object.keys(SPORTS).map(function(cle) {
        return `<option value="${cle}">${SPORTS[cle].nom}</option>`;
      }).join('');
      sel.value = 'muscu';
    }
    majRoleSelonSport();
  }
}

// Le rôle « prépa » n'existe pas en muscu (le coach y fait déjà la prépa).
// On masque l'option quand le sport est la muscu et on retombe sur « coach ».
function majRoleSelonSport() {
  var sp = document.getElementById('reg-coach-sport');
  var rl = document.getElementById('reg-coach-role');
  if (!sp || !rl) return;
  var estMuscu = (sp.value === 'muscu');
  var prepaOpt = rl.querySelector('option[value="prepa"]');
  if (prepaOpt) prepaOpt.style.display = estMuscu ? 'none' : '';
  if (estMuscu && rl.value === 'prepa') rl.value = 'coach';
}

async function sInscrireCoach() {
  const nom = document.getElementById('reg-coach-nom').value.trim();
  const login = document.getElementById('reg-coach-login').value.trim();
  const password = document.getElementById('reg-coach-password').value;
  const sportSel = document.getElementById('reg-coach-sport');
  const sport = sportSel ? sportSel.value : 'muscu';
  const roleSel = document.getElementById('reg-coach-role');
  // Pas de prépa en muscu (le coach y fait déjà la prépa) → on force « coach ».
  const role = (sport === 'muscu') ? 'coach' : (roleSel ? roleSel.value : 'coach');
  const errEl = document.getElementById('reg-coach-error');
  errEl.textContent = '';
  if (!nom || !login) { errEl.textContent = 'Remplis tous les champs.'; return; }
  if (!password || password.length < 6) { errEl.textContent = 'Mot de passe : 6 caractères minimum.'; return; }
  if (!document.getElementById('reg-coach-consent').checked) { errEl.textContent = 'Tu dois accepter la politique de confidentialité.'; return; }
  errEl.textContent = 'Création...';
  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'registerCoach', nom, login, password, sport, role })
    });
    const data = await res.json();
    if (data.success) {
      coach = data.coach;
      localStorage.setItem('muscu_coach', JSON.stringify(coach));
      localStorage.removeItem('muscu_coach_vue');
      ouvrirEspaceCoach();
    } else { errEl.textContent = data.error || data.message || 'Cet identifiant coach est déjà utilisé.'; }
  } catch(e) { errEl.textContent = 'Erreur. Réessaie.'; }
}

// ── Données de démo (14 joueurs foot, symptômes variés) — depuis Réglages coach ──
async function genererDemoFoot() {
  if (!coach) { showToast('Connecte-toi en coach'); return; }
  var info = document.getElementById('demo-foot-info');
  if (info) { info.style.display = 'block'; info.style.color = 'var(--text-muted)'; info.textContent = '⏳ Génération…'; }
  try {
    var r = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'seedDemoFoot', coach_id: coach.coach_id }) });
    var j = await r.json();
    if (j && j.success) {
      if (info) {
        info.style.color = 'var(--good)';
        var _creds = '';
        if (j.logins && j.logins.length) {
          var _l0 = j.logins[0], _l1 = j.logins[j.logins.length - 1];
          _creds = '<div style="margin-top:6px;color:var(--text);font-weight:700;">🔑 Connexion joueurs : logins <b>' + _l0 + '</b>→<b>' + _l1 + '</b> · mot de passe <b>' + (j.password || '') + '</b></div>';
        }
        // On n'affiche l'auto-test que s'il ÉCHOUE (sinon bruit inutile).
        var _diag = '';
        if (j.login_test && !j.login_test.ok) {
          _diag = '<div style="margin-top:6px;color:var(--danger);font-weight:700;">⚠️ Auto-test connexion ÉCHEC — login ' + (j.login_test.login||'?') + ', hash stocké len=' + (j.login_test.storedLen!=null?j.login_test.storedLen:'?') + (j.login_test.error?(' err:'+j.login_test.error):'') + '</div>';
        }
        info.innerHTML = '✅ ' + j.joueurs + ' joueurs créés (' + j.charges + ' charges, ' + j.blessures + ' blessures). Pense à mettre ton sport sur « Foot ».' + _creds + _diag;
      }
      showToast('👥 ' + j.joueurs + ' joueurs de démo créés');
      if (typeof ouvrirEspaceCoach === 'function') ouvrirEspaceCoach();
    } else if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ ' + ((j && j.error) || 'échec'); }
  } catch (e) { if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ Erreur réseau'; } }
}
async function supprimerDemoFoot() {
  if (!coach) return;
  var info = document.getElementById('demo-foot-info');
  if (info) { info.style.display = 'block'; info.style.color = 'var(--text-muted)'; info.textContent = '⏳ Suppression…'; }
  try {
    var r = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'clearDemoFoot', coach_id: coach.coach_id }) });
    var j = await r.json();
    if (j && j.success) {
      if (info) {
        if (j.restants && j.restants > 0) { info.style.color = 'var(--warn)'; info.textContent = '⚠️ ' + j.supprimes + ' supprimés, ' + j.restants + ' restants (données liées ?).'; }
        else { info.style.color = 'var(--good)'; info.textContent = '🗑️ ' + j.supprimes + ' joueurs de démo supprimés.'; }
      }
      showToast('Démos supprimés');
      if (typeof ouvrirEspaceCoach === 'function') ouvrirEspaceCoach();
    } else if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ ' + ((j && j.error) || 'échec'); }
  } catch (e) { if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ Erreur réseau'; } }
}

const TAB_LABELS = { accueil: 'Accueil', objectif: 'Objectif', seance: 'Séance', historique: 'Progression', conseils: 'Conversation', reglages: 'Réglages' };
function switchTab(tab) {
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['accueil','historique','seance','objectif','conseils'][i] === tab);
  });
  const hdr = document.getElementById('header-nom');
  if (hdr && TAB_LABELS[tab]) hdr.textContent = TAB_LABELS[tab];
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  // Dashboard prend toute la largeur sans padding
  const container = document.getElementById('main-container');
  if (tab === 'accueil') {
    container.classList.add('no-pad');
    document.body.classList.add('on-accueil');
    chargerDashboard();
  } else {
    container.classList.remove('no-pad');
    document.body.classList.remove('on-accueil');
  }
  if (tab === 'historique') {
    if (dernierAppData) chargerHistorique();
    else chargerAppData().then(() => chargerHistorique());
  }
  if (tab === 'conseils') {
    afficherOngletConseils();
  }
  if (tab === 'reglages') {
    try { majUiPause(); } catch (_) {}
    try { majUiPush(); } catch (_) {}
    try { majUiGoogleHealth(); } catch (_) {}
  }

}

function scrollVersTitre(el, extra) {
  if (!el) return;
  extra = extra == null ? 8 : extra;
  const hdr = document.querySelector('header');
  const hdrH = hdr ? hdr.offsetHeight : 0;
  const top = window.scrollY + el.getBoundingClientRect().top - hdrH - extra;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

// Depuis le dashboard athlète : ouvre l'Historique et défile jusqu'au volume par muscle
function allerVersVolumeAthlete() {
  switchTab('historique');
  setTimeout(() => {
    const el = document.getElementById('hist-volume-content');
    const card = el && el.closest('.card');
    const sec = card && card.previousElementSibling;
    (sec || card || el) && scrollVersTitre(sec || card || el);
  }, 200);
}

function allerVersRecords() {
  switchTab('historique');
  setTimeout(() => {
    const sec = document.getElementById('dash-records-sec');
    if (sec && sec.style.display !== 'none') scrollVersTitre(sec);
    else { const card = document.getElementById('dash-records-card'); if (card) scrollVersTitre(card); }
  }, 200);
}

function allerVersCardioHist() {
  switchTab('historique');
  setTimeout(() => {
    const sec = document.getElementById('hist-cardio-sec');
    if (sec && sec.style.display !== 'none') scrollVersTitre(sec);
    else { const card = document.getElementById('hist-cardio-card'); if (card) scrollVersTitre(card); }
  }, 200);
}

function switchSubTab(sub) {
  document.querySelectorAll('.sub-tab').forEach((b, i) => {
    b.classList.toggle('active', ['saisie','programme'][i] === sub);
  });
  document.getElementById('subtab-saisie').style.display = sub === 'saisie' ? 'block' : 'none';
  document.getElementById('subtab-programme').style.display = sub === 'programme' ? 'block' : 'none';
  if (sub === 'programme') {
    if (dernierAppData) afficherProgrammeComplet();
    else chargerAppData().then(() => afficherProgrammeComplet());
  }
}

// ==================== BROUILLON DE SÉANCE (anti-perte de saisie) ====================
// Sauvegarde en continu la séance muscu en cours dans localStorage. Sans ça, un
// rafraîchissement, un changement d'onglet, ou la mise en veille de l'app (l'OS
// mobile recharge la page en tâche de fond → toutes les variables JS repartent à
// zéro) fait perdre les séries déjà saisies mais pas encore validées.
var _brouillonRestaure = false;
// Verrou anti-doublon : passe à true dès que la séance est envoyée (récap affiché).
// Empêche visibilitychange/pagehide de ré-enregistrer un brouillon pour des séries
// DÉJÀ enregistrées (sinon bandeau « Séance récupérée » fantôme → revalidation → doublon).
// Remis à false au démarrage d'une nouvelle séance.
var _seanceEnvoyee = false;

function _brouillonKey() {
  return athlete ? 'muscu_brouillon_' + athlete.athlete_id : null;
}

// Écrit l'état courant de la saisie. Si aucune série n'est saisie, purge le
// brouillon (évite de laisser traîner un vieux brouillon après tout effacé).
function _saveBrouillon() {
  try {
    if (_seanceEnvoyee) return;   // séance déjà envoyée → ne pas recréer de brouillon
    var key = _brouillonKey();
    if (!key) return;
    var totalSeries = seance.reduce(function(a, e) { return a + (e.series ? e.series.length : 0); }, 0);
    if (totalSeries === 0) { localStorage.removeItem(key); return; }
    var di = document.getElementById('inp-date');
    var ss = document.getElementById('sel-seance-id');
    localStorage.setItem(key, JSON.stringify({
      v: 1,
      date:              di ? di.value : '',
      seanceId:          ss ? ss.value : '',
      seance:            seance,
      serieNum:          serieNum,
      programmeSeance:   programmeSeance,
      indexExoProgramme: indexExoProgramme,
      lastPerfData:      lastPerfData,
      exoEnCoursNom:     exoEnCours ? exoEnCours.exerciceNom : null,
      ts:                Date.now()
    }));
  } catch (e) {}
}

function _effacerBrouillon() {
  try { var key = _brouillonKey(); if (key) localStorage.removeItem(key); } catch (e) {}
}

// Restaure un brouillon au chargement (appelé une seule fois, après _appliquerAppData
// pour disposer de exercicesData / programme / perfs). Réhydrate les variables et
// réaffiche la liste des exercices avec les séries déjà faites.
function _restaurerBrouillon() {
  if (_brouillonRestaure) return;
  var key = _brouillonKey();
  if (!key) return;
  var raw;
  try { raw = localStorage.getItem(key); } catch (e) { return; }
  if (!raw) return;
  var b;
  try { b = JSON.parse(raw); } catch (e) { _effacerBrouillon(); return; }
  if (!b || !Array.isArray(b.seance)) { _effacerBrouillon(); return; }
  var totalSeries = b.seance.reduce(function(a, e) { return a + (e.series ? e.series.length : 0); }, 0);
  if (totalSeries === 0) { _effacerBrouillon(); return; }

  // Auto-nettoyage : si une séance du MÊME type est déjà enregistrée à cette date
  // (le brouillon correspond à une séance déjà validée — typiquement un vieux
  // brouillon d'avant le correctif), on l'efface en silence, sans bandeau trompeur.
  try {
    var bd = String(b.date || ''), frDate = bd;
    if (bd.indexOf('-') !== -1) { var p = bd.split('-'); frDate = p[2] + '/' + p[1] + '/' + p[0]; }
    var ds = (dernierAppData && dernierAppData.historique && dernierAppData.historique.dates_seances) || {};
    if (frDate && ds[frDate] && String(ds[frDate]) === String(b.seanceId || '')) {
      _brouillonRestaure = true; _effacerBrouillon(); return;
    }
  } catch (e) {}

  _brouillonRestaure = true;

  seance            = b.seance;
  serieNum          = b.serieNum || 1;
  programmeSeance   = b.programmeSeance || [];
  indexExoProgramme = b.indexExoProgramme || 0;
  lastPerfData      = b.lastPerfData || {};
  exoEnCours        = null;

  var di = document.getElementById('inp-date');      if (di && b.date) di.value = b.date;
  var ss = document.getElementById('sel-seance-id'); if (ss && b.seanceId) ss.value = b.seanceId;

  var cardListe = document.getElementById('card-liste-seance');
  if (cardListe) cardListe.style.display = 'block';
  var cardExo = document.getElementById('card-exo-actuel');   if (cardExo)  cardExo.style.display  = 'none';
  var cardHP  = document.getElementById('card-hors-programme'); if (cardHP)  cardHP.style.display   = 'none';
  try { afficherListeSeance(); } catch (e) {}
  try { majProgressionSeance(); } catch (e) {}
  var bv = document.getElementById('btn-valider');
  if (bv) bv.style.display = 'block';

  _afficherBandeauBrouillon(totalSeries, b.ts);
}

function _afficherBandeauBrouillon(totalSeries, ts) {
  var old = document.getElementById('brouillon-banner'); if (old) old.remove();
  var host = document.getElementById('subtab-saisie');
  if (!host) return;
  var quand = '';
  try {
    var d = new Date(ts);
    quand = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })
          + ' ' + String(d.getHours()).padStart(2, '0') + 'h' + String(d.getMinutes()).padStart(2, '0');
  } catch (e) {}
  var el = document.createElement('div');
  el.id = 'brouillon-banner';
  el.style.cssText = 'display:flex;align-items:center;gap:10px;background:var(--accent-a08);border:1px solid var(--accent-dim);border-radius:12px;padding:11px 13px;margin-bottom:12px;';
  el.innerHTML =
      '<span style="font-size:18px;line-height:1">↩️</span>'
    + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:800;color:var(--text)">Séance récupérée</div>'
      + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' + totalSeries + ' série' + (totalSeries > 1 ? 's' : '') + ' non enregistrée' + (totalSeries > 1 ? 's' : '') + (quand ? ' · ' + quand : '') + '</div>'
    + '</div>'
    + '<button onclick="_abandonnerBrouillon()" style="flex-shrink:0;padding:7px 11px;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);font-size:12px;font-weight:700;cursor:pointer">Abandonner</button>';
  host.insertBefore(el, host.firstChild);
}

function _abandonnerBrouillon() {
  if (!confirm('Abandonner cette séance récupérée ? Les séries non enregistrées seront définitivement perdues.')) return;
  _seanceEnvoyee = false;
  _effacerBrouillon();
  seance = []; exoEnCours = null; serieNum = 1; indexExoProgramme = 0; programmeSeance = [];
  var b = document.getElementById('brouillon-banner'); if (b) b.remove();
  var cardListe = document.getElementById('card-liste-seance');   if (cardListe) cardListe.style.display = 'none';
  var cardExo   = document.getElementById('card-exo-actuel');     if (cardExo)   cardExo.style.display   = 'none';
  var cardHP    = document.getElementById('card-hors-programme'); if (cardHP)    cardHP.style.display    = 'none';
  var bv = document.getElementById('btn-valider'); if (bv) bv.style.display = 'none';
  try { majProgressionSeance(); } catch (e) {}
  showToast('Séance abandonnée', 'var(--text-muted)');
}

// Filet de sécurité : au moindre passage en arrière-plan (changement d'onglet,
// bascule vers une autre appli, fermeture), on fige l'état. Couvre les cas où le
// navigateur tue la page sans laisser le temps de sauver autrement.
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') _saveBrouillon();
});
window.addEventListener('pagehide', function () { _saveBrouillon(); });

// ==================== SÉANCE GUIDÉE ====================
async function demarrerSeance() {
  const seanceId = document.getElementById('sel-seance-id').value;
  if (!seanceId) return;

  if (seance.length > 0) {
    const ok = confirm(`Tu as déjà ${seance.length} série${seance.length > 1 ? 's' : ''} enregistrée${seance.length > 1 ? 's' : ''} dans cette séance.\n\nSi tu continues, tout sera perdu.\n\nAbandonner la séance en cours ?`);
    if (!ok) return;
  }

  seance = []; exoEnCours = null; serieNum = 1; indexExoProgramme = 0;
  _seanceEnvoyee = false;
  _effacerBrouillon();
  { const _b=document.getElementById('brouillon-banner'); if(_b)_b.remove(); }
  document.getElementById('btn-valider').style.display = 'none';
  document.getElementById('card-exo-actuel').style.display = 'none';
  document.getElementById('card-hors-programme').style.display = 'none';
  { const _r=document.getElementById('rech-exo'); if(_r)_r.value=''; }

  const listeEl = document.getElementById('liste-exercices-seance');
  listeEl.innerHTML = '<div class="loader">Chargement...</div>';
  document.getElementById('card-liste-seance').style.display = 'block';

  // Utiliser le programme déjà chargé + charger seulement les perfs
  const progSource = dernierAppData ? dernierAppData.programme || [] : [];
  programmeSeance = progSource.filter(p => p.seance_id === seanceId);

  const resPerf = await fetch(`${SCRIPT_URL}?action=getLastPerf&athlete_id=${athlete.athlete_id}&seance_id=${encodeURIComponent(seanceId)}`);
  const dataPerf = await resPerf.json();
  lastPerfData = dataPerf.perfs || {};

  scrollVersProchain = true;
  afficherListeSeance();
  setTimeout(() => {
    const sid = document.getElementById('sel-seance-id').value;
    if (sid === 'Libre' || programmeSeance.length === 0) {
      const c = document.getElementById('card-hors-programme');
      if (c) scrollVersTitre(c);
    }
  }, 150);
}

function majProgressionSeance() {
  const el = document.getElementById('seance-progress');
  if (!el) return;
  const seanceId = document.getElementById('sel-seance-id').value;
  if (!seanceId) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const estLibre = seanceId === 'Libre' || programmeSeance.length === 0;
  document.getElementById('seance-progress-titre').textContent = estLibre ? 'Séance libre' : seanceId;
  const titreListe = document.getElementById('titre-liste-seance');
  if (titreListe) titreListe.textContent = estLibre ? 'Séance libre' : 'Programme · ' + seanceId;

  // En mode libre : masquer le bouton "Autre exercice" et ouvrir directement le sélecteur
  const btnAutre = document.querySelector('button[onclick="toggleExoHorsProgramme()"]');
  const cardHors = document.getElementById('card-hors-programme');
  if (estLibre) {
    if (btnAutre) btnAutre.style.display = 'none';
    if (cardHors) { cardHors.style.display = 'block'; filtrerExosLibres(); }
  } else {
    if (btnAutre) btnAutre.style.display = '';
    if (cardHors) cardHors.style.display = 'none';
  }

  const exosLibres = seance.filter(e => !programmeSeance.some(p => p.exercice === e.exerciceNom));
  const totalExos = programmeSeance.length + exosLibres.length;
  const faitsProg = programmeSeance.filter(p => {
    const e = seance.find(s => s.exerciceNom === p.exercice);
    return e && e.series.length > 0;
  }).length;
  const faitsLibres = exosLibres.filter(e => e.series.length > 0).length;
  const faits = faitsProg + faitsLibres;
  const totalSeries = seance.reduce((a, e) => a + e.series.length, 0);

  document.getElementById('seance-progress-series').textContent = totalSeries;
  const fini = totalExos > 0 && faits >= totalExos;
  document.getElementById('seance-progress-detail').textContent =
    `${faits} / ${totalExos} exercice${totalExos > 1 ? 's' : ''}${fini ? '  ✅ Tout est fait !' : ''}`;
  const pct = totalExos > 0 ? Math.round(faits / totalExos * 100) : 0;
  document.getElementById('seance-progress-bar').style.width = pct + '%';
}

function peuplerSeancesProgramme() {
  const sel = document.getElementById('sel-seance-id');
  if (!sel) return;
  const valeurAvant = sel.value;
  const programme = dernierAppData ? (dernierAppData.programme || []) : [];
  // Séances distinctes du programme, dans l'ordre d'apparition
  const seances = [];
  programme.forEach(p => { if (p.seance_id && !seances.includes(p.seance_id)) seances.push(p.seance_id); });
  sel.innerHTML = '<option value="">— Choisir —</option>' +
    seances.map(s => `<option value="${s}">${s}</option>`).join('') +
    '<option value="Libre">Libre</option>';
  // Conserver la sélection en cours si toujours valide
  if (valeurAvant && (seances.includes(valeurAvant) || valeurAvant === 'Libre')) sel.value = valeurAvant;
}

// ===== Superset / biset guidé (alternance exercice par exercice) =====
let enSuperset = false;
let supersetGroupe = [];
let supersetIdx = 0;
let supersetTour = 1;
let supersetTotalTours = 1;

function demarrerSuperset(groupeId) {
  supersetGroupe = programmeSeance.filter(p => p.groupe_id === groupeId);
  if (supersetGroupe.length < 2) {
    enSuperset = false;
    const p = supersetGroupe[0];
    if (p) selectionnerExoDepuisProgramme(p.exercice, p.reps_mini, p.reps_max);
    return;
  }
  enSuperset = true;
  supersetIdx = 0;
  supersetTour = 1;
  supersetTotalTours = Number(supersetGroupe[0].series_prevues) || 1;
  chargerExoSuperset();
}

function chargerExoSuperset() {
  const p = supersetGroupe[supersetIdx];
  selectionnerExoDepuisProgramme(p.exercice, p.reps_mini, p.reps_max);
  majBanniereSuperset();
}

function majBanniereSuperset() {
  const el = document.getElementById('superset-banner');
  if (!el) return;
  if (!enSuperset) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const couleur = couleurGroupe(supersetGroupe[0].groupe_id);
  const noms = supersetGroupe.map((p, i) => i === supersetIdx
    ? `<strong style="color:${couleur}">${p.exercice}</strong>`
    : `<span style="color:var(--text-muted)">${p.exercice}</span>`).join(' → ');
  el.innerHTML = `<div style="font-size:13px;font-weight:800;color:${couleur}">${ic('link')} Superset · Tour ${supersetTour}/${supersetTotalTours}</div><div style="font-size:11px;margin-top:3px">${noms}</div>`;
}

function avancerSuperset(reposVal) {
  supersetIdx++;
  if (supersetIdx < supersetGroupe.length) {
    // Exercice suivant du même tour : on enchaîne, sans repos
    chargerExoSuperset();
    showToast('➡️ ' + supersetGroupe[supersetIdx].exercice);
    setTimeout(() => { const c = document.getElementById('card-exo-actuel'); if (c) scrollVersTitre(c); }, 50);
  } else {
    // Tour terminé
    supersetIdx = 0;
    supersetTour++;
    if (supersetTour > supersetTotalTours) {
      enSuperset = false;
      const b = document.getElementById('superset-banner'); if (b) b.style.display = 'none';
      scrollVersProchain = true;
      retourListeSeance();
      showToast('✅ Superset terminé !');
    } else {
      chargerExoSuperset(); // premier exo du tour suivant
      setTimeout(() => { const c = document.getElementById('card-exo-actuel'); if (c) scrollVersTitre(c); }, 50);
      if (reposVal > 0) startTimer(reposVal, `Tour ${supersetTour - 1} terminé · repos`);
      else showToast('Tour ' + supersetTour);
    }
  }
}

let scrollVersProchain = false;
function afficherListeSeance() {
  const listeEl = document.getElementById('liste-exercices-seance');
  if (programmeSeance.length === 0) {
    afficherListeExosLibres();
    majProgressionSeance(); // maj des titres (corrige "Programme · Upper" qui restait en passant sur Libre)
    return;
  }

  // Index du prochain exercice à faire (premier sans série enregistrée)
  const prochainIdx = programmeSeance.findIndex(p => {
    const e = seance.find(s => s.exerciceNom === p.exercice);
    return !(e && e.series.length > 0);
  });
  let prochainEl = null;

  // Stocker le programme dans un tableau global indexé pour éviter les problèmes d'apostrophes
  listeEl.innerHTML = '';
  programmeSeance.forEach((p, i) => {
    const isNext = i === prochainIdx;
    const perf = getPerf(p.exercice);
    const exoData = exercicesData.find(e => e.exercice === p.exercice);
    const incrementRaw = exoData ? exoData.increment_kg : "2.5";
    const increment = parseFloat(String(incrementRaw).replace(',','.').split('/')[0].trim()) || 2.5;
    const dejaDone = seance.find(e => e.exerciceNom === p.exercice && e.series.length > 0);
    const seriesFaites = dejaDone ? dejaDone.series.length : 0;
    const borderColor = dejaDone ? "var(--success)" : isNext ? "var(--accent)" : "var(--border)";

    let perfHtml = "";
    let suggHtml = "";
    let cible = p.reps_mini;

    if (perf) {
      // Prendre le meilleur des 2 dernières séances comme référence
      const bestReps = perf.prev_max_reps !== null 
        ? Math.max(perf.max_reps, perf.prev_max_reps) 
        : perf.max_reps;
      const bestCharge = perf.prev_charge !== null
        ? Math.max(perf.last_charge, perf.prev_charge)
        : perf.last_charge;
      const isDiffSeance = perf.max_reps < bestReps || perf.last_charge < bestCharge;

      cible = bestReps < p.reps_max ? bestReps + 1 : p.reps_max;

      perfHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:8px 12px;background:var(--accent-a08);border:1px solid var(--accent-dim);border-radius:10px">
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${ic('target')} Cible</span>
          <span style="font-size:15px;font-weight:800;color:var(--accent)">${bestCharge}kg × ${cible} reps</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">Dernière fois : <strong style="color:${isDiffSeance ? 'var(--danger)' : 'var(--text)'}">${perf.last_charge}kg × ${perf.max_reps}</strong>${isDiffSeance ? ` · meilleure réf ${bestCharge}kg × ${bestReps}` : ''}</div>
      `;

      const niveau = getNiveauExperience(athlete.annees_pratique);
      const deuxSeancesAuCap = perf.prev_max_reps !== null && perf.prev_max_reps >= p.reps_max;
      const surcharge = niveau === 'debutant'
        ? bestReps >= p.reps_max
        : bestReps >= p.reps_max && deuxSeancesAuCap;
      if (surcharge) {
        if (niveau === 'avance' || niveau === 'expert') {
          suggHtml = `<div class="prog-suggestion" style="margin-top:6px"><svg class="ico"><use href="#i-dumbbell"/></svg>+1 rep ou -30s repos</div>`;
        } else {
          const nc = Math.round((bestCharge + increment) * 4) / 4;
          suggHtml = `<div class="prog-suggestion" style="margin-top:6px"><svg class="ico"><use href="#i-dumbbell"/></svg>Surcharge : ${nc}kg (+${increment}kg)</div>`;
        }
      }
    } else {
      perfHtml = `<div style="font-size:12px;color:var(--text-muted);margin-top:4px">Premier essai</div>`;
    }

    const partenaires = p.groupe_id ? programmeSeance.filter(o => o !== p && o.groupe_id === p.groupe_id).map(o => o.exercice) : [];
    const groupeStyle = p.groupe_id ? `border-left:3px solid ${couleurGroupe(p.groupe_id)};` : '';

    const statutPill = dejaDone
      ? `<span style="font-size:11px;font-weight:700;color:var(--success);background:rgba(0,201,110,0.12);border-radius:20px;padding:3px 10px;white-space:nowrap">${seriesFaites} série${seriesFaites>1?"s":""}</span>`
      : isNext
        ? `<span style="font-size:11px;font-weight:800;color:var(--on-accent);background:var(--accent);border-radius:20px;padding:3px 10px;white-space:nowrap">À faire</span>`
        : `<span style="font-size:11px;font-weight:600;color:var(--text-muted);background:var(--surface2);border-radius:20px;padding:3px 10px;white-space:nowrap">${p.series_prevues} séries</span>`;

    const div = document.createElement('div');
    div.style.cssText = `background:var(--surface);border:${isNext ? '2px' : '1px'} solid ${borderColor};${groupeStyle}border-radius:var(--radius);padding:14px;margin-bottom:${p.groupe_id ? '2px' : '10px'};cursor:pointer`;
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div style="font-size:15px;font-weight:800;flex:1;min-width:0">${p.exercice}</div>
        ${statutPill}
        ${dejaDone ? `<button class="btn-sm btn-danger-sm reset-exo" title="Effacer les séries faites" style="padding:4px 8px;line-height:1"><svg class="ico"><use href="#i-trash"/></svg></button>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Objectif : ${p.series_prevues} séries · ${p.reps_mini}-${p.reps_max} reps</div>
      ${perfHtml}${suggHtml}
    `;
    const estGroupe = p.groupe_id && programmeSeance.filter(o => o.groupe_id === p.groupe_id).length >= 2;
    div.addEventListener('click', () => estGroupe
      ? demarrerSuperset(p.groupe_id)
      : selectionnerExoDepuisProgramme(p.exercice, p.reps_mini, p.reps_max));
    const rb = div.querySelector('.reset-exo');
    if (rb) rb.addEventListener('click', (ev) => { ev.stopPropagation(); resetExoSeance(p.exercice); });
    listeEl.appendChild(div);
    if (isNext) prochainEl = div;
    if (p.groupe_id) {
      const tag = document.createElement('div');
      tag.style.cssText = `font-size:11px;color:${couleurGroupe(p.groupe_id)};margin:0 0 10px 4px`;
      tag.textContent = partenaires.length > 0 ? `Superset ${p.groupe_id} · alterne avec ${partenaires.join(', ')}` : `Superset ${p.groupe_id}`;
      listeEl.appendChild(tag);
    }
  });

  // Exercices ajoutés en plus du programme (via "Autre exercice")
  const exosLibres = seance.filter(e => !programmeSeance.some(p => p.exercice === e.exerciceNom));
  exosLibres.forEach(e => ajouterCarteExoLibre(listeEl, e));
  majProgressionSeance();

  // Après avoir terminé un exercice, on amène l'athlète au prochain à faire
  if (scrollVersProchain && prochainEl) {
    setTimeout(() => prochainEl.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }
  scrollVersProchain = false;
}

function ajouterCarteExoLibre(listeEl, e) {
  const seriesFaites = e.series.length;
  const perf = getPerf(e.exerciceNom);
  const div = document.createElement('div');
  div.style.cssText = `background:var(--surface);border:1px solid ${seriesFaites > 0 ? 'var(--success)' : 'var(--border)'};border-radius:var(--radius);padding:14px;margin-bottom:10px;cursor:pointer;position:relative`;
  div.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div style="font-size:15px;font-weight:800;flex:1;min-width:0">${e.exerciceNom}</div>
      ${seriesFaites > 0 ? `<span style="font-size:11px;font-weight:700;color:var(--success);background:rgba(0,201,110,0.12);border-radius:20px;padding:3px 10px;white-space:nowrap">${seriesFaites} série${seriesFaites>1?"s":""}</span>` : `<span style="font-size:11px;font-weight:600;color:var(--text-muted);background:var(--surface2);border-radius:20px;padding:3px 10px;white-space:nowrap">Hors prog.</span>`}
      <button class="btn-sm btn-danger-sm" title="Retirer cet exercice" style="padding:4px 8px;line-height:1"><svg class="ico"><use href="#i-trash"/></svg></button>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${e.muscle}</div>
    ${perf ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Dernière fois : <strong style="color:var(--text)">${perf.last_charge}kg × ${perf.max_reps}</strong></div>` : '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Premier essai</div>'}
  `;
  div.querySelector('.btn-danger-sm').addEventListener('click', (ev) => {
    ev.stopPropagation();
    supprimerExoLibre(e.exerciceNom);
  });
  div.addEventListener('click', () => selectionnerExoLibre(e.exerciceNom));
  listeEl.appendChild(div);
}

function supprimerExoLibre(exerciceNom) {
  const exo = seance.find(e => e.exerciceNom === exerciceNom);
  if (exo && exo.series.length > 0) {
    if (!confirm(`${exerciceNom} a déjà des séries enregistrées. Le retirer effacera ces séries. Continuer ?`)) return;
  }
  seance = seance.filter(e => e.exerciceNom !== exerciceNom);
  afficherListeSeance();
  const total = seance.reduce((a,e)=>a+e.series.length,0);
  document.getElementById('btn-valider').style.display = total > 0 ? 'block' : 'none';
  _saveBrouillon();
}

// Efface les séries faites d'un exercice du programme (ex. pour corriger une erreur, ou le 2e exo d'un superset)
function resetExoSeance(exerciceNom) {
  const exo = seance.find(e => e.exerciceNom === exerciceNom);
  if (!exo || exo.series.length === 0) return;
  if (!confirm(`Effacer les ${exo.series.length} série(s) enregistrée(s) pour ${exerciceNom} ?`)) return;
  seance = seance.filter(e => e.exerciceNom !== exerciceNom);
  afficherListeSeance();
  const total = seance.reduce((a,e)=>a+e.series.length,0);
  document.getElementById('btn-valider').style.display = total > 0 ? 'block' : 'none';
  _saveBrouillon();
}

function afficherListeExosLibres() {
  const listeEl = document.getElementById('liste-exercices-seance');
  listeEl.innerHTML = '';
  if (seance.length === 0) {
    listeEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px">Ajoute un exercice avec le bouton « Autre exercice » ci-dessus</div>';
    return;
  }
  seance.forEach(e => ajouterCarteExoLibre(listeEl, e));
}

function selectionnerExoLibre(exerciceNom) {
  const exo = seance.find(e => e.exerciceNom === exerciceNom);
  if (!exo) return;
  exoEnCours = exo;
  serieNum = exo.series.length + 1;

  document.getElementById('card-liste-seance').style.display = 'none';
  document.getElementById('card-exo-actuel').style.display = 'block';
  document.getElementById('card-hors-programme').style.display = 'none';

  document.getElementById('exo-actuel-nom').textContent = exo.exerciceNom;
  document.getElementById('exo-actuel-detail').textContent = exo.muscle + ' · Hors programme';
  document.getElementById('exo-actuel-cible').innerHTML = '';
  const perf = getPerf(exo.exerciceNom);
  if (perf) {
    document.getElementById('exo-actuel-perf').innerHTML = `Dernière fois : <strong>${perf.last_charge}kg × ${perf.max_reps} reps</strong>`;
    document.getElementById('inp-charge').value = perf.last_charge;
    document.getElementById('inp-reps').value = perf.max_reps;

    // Suggestion surcharge pour exercice hors programme
    const exoDataHP = exercicesData.find(e => e.exercice === exo.exerciceNom);
    const incrementHP = parseFloat(String(exoDataHP ? exoDataHP.increment_kg : '2.5').replace(',','.').split('/')[0].trim()) || 2.5;
    const stratHP = athlete ? athlete.strategie_progression : 'Progression linéaire';
    // Pseudo-programme : on considère les reps actuelles comme cible
    const pseudoProg = { reps_max: perf.max_reps, reps_mini: Math.max(1, perf.max_reps - 2) };
    const dernRpeHP = exoEnCours.series.length > 0 ? exoEnCours.series[exoEnCours.series.length - 1].rpe : null;
    const suggHP = calculerSurcharge(stratHP, perf, pseudoProg, perf.last_charge, incrementHP, dernRpeHP);
    document.getElementById('exo-actuel-suggestion').innerHTML = suggHP
      ? `<div class="prog-suggestion" style="margin-top:6px">${suggHP}</div>` : '';
  } else {
    document.getElementById('exo-actuel-perf').innerHTML = '<span style="color:var(--text-muted)">Premier essai</span>';
    document.getElementById('inp-charge').value = '';
    document.getElementById('inp-reps').value = '';
    document.getElementById('exo-actuel-suggestion').innerHTML = '';
  }

  majSeriesActuel();
  setTimeout(() => { const c = document.getElementById('card-exo-actuel'); if (c) scrollVersTitre(c); }, 50);
}

function retourListeSeance() {
  enSuperset = false;
  const sb = document.getElementById('superset-banner');
  if (sb) sb.style.display = 'none';
  document.getElementById('card-exo-actuel').style.display = 'none';
  document.getElementById('card-liste-seance').style.display = 'block';
  afficherListeSeance();
  setTimeout(() => { const c = document.getElementById('card-liste-seance'); if (c) scrollVersTitre(c); }, 50);
}

function toggleExoHorsProgramme(forceOpen) {
  const card = document.getElementById('card-hors-programme');
  const isOpen = card.style.display !== 'none';
  const willOpen = forceOpen || !isOpen;
  card.style.display = willOpen ? 'block' : 'none';
  if (willOpen) {
    // Scroll vers le haut de la liste
    const listeCard = document.getElementById('card-liste-seance');
    if (listeCard) scrollVersTitre(listeCard);
    const _re1=document.getElementById('rech-exo'); if(_re1)_re1.value=''; remplirListeExosLibres('');
  }
}

// Recherche d'exercice (remplace le double menu muscle→exercice)
function _norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function remplirListeExosLibres(filtre) {
  const el = document.getElementById('liste-exos-libres');
  if (!el) return;
  const f = _norm(filtre);
  const dejaNoms = seance.map(e => e.exerciceNom);
  const items = exercicesData
    .filter(e => !f || _norm(e.exercice).includes(f) || _norm(e.muscle).includes(f))
    .sort((a, b) => String(a.muscle).localeCompare(String(b.muscle)) || String(a.exercice).localeCompare(String(b.exercice)));
  if (items.length === 0) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:10px;text-align:center">Aucun exercice trouvé</div>'; return; }
  el.innerHTML = items.slice(0, 60).map(e => {
    const deja = dejaNoms.includes(e.exercice);
    const id = (e.exercice_id != null ? e.exercice_id : '') + '|' + e.exercice + '|' + (e.muscle || '');
    return `<button type="button" onclick="choisirExoDirect(this.dataset.v)" data-v="${id.replace(/"/g, '&quot;')}" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:11px 12px;margin-bottom:6px;cursor:pointer;">
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.exercice}</div>
        <div style="font-size:11px;color:var(--text-muted)">${e.muscle || ''}</div>
      </div>
      ${deja ? '<span style="font-size:10px;font-weight:700;color:var(--good)">déjà ajouté</span>' : '<span style="color:var(--accent);font-size:20px;font-weight:700">+</span>'}
    </button>`;
  }).join('');
}
function filtrerExosLibres() {
  const inp = document.getElementById('rech-exo');
  remplirListeExosLibres(inp ? inp.value : '');
}
function choisirExoDirect(val) {
  const parts = String(val).split('|');
  const exoId = parts[0], exoNom = parts[1], muscle = parts[2] || '';
  const dejaPresent = seance.find(e => e.exerciceNom === exoNom);
  if (!dejaPresent) seance.push({ muscle, exerciceId: exoId, exerciceNom: exoNom, series: [] });
  document.getElementById('card-hors-programme').style.display = 'none';
  const inp = document.getElementById('rech-exo'); if (inp) inp.value = '';
  afficherListeSeance();
  setTimeout(() => { const l = document.getElementById('liste-exercices-seance'); const last = l && l.lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
  showToast(dejaPresent ? exoNom + ' est déjà dans la séance' : '✅ ' + exoNom + ' ajouté');
}

// ==================== SAISIE SÉRIE ====================
function getNumSemaine(date) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// ===== Saisie rapide : steppers + chips =====
function stepValue(id, delta) {
  const el = document.getElementById(id);
  let v = parseFloat(el.value) || 0;
  v = Math.max(0, Math.round((v + delta) * 100) / 100);
  el.value = v;
}
function pickChip(grp, el, val) {
  document.querySelectorAll('#' + grp + '-chips .saisie-chip').forEach(c => c.classList.remove('on'));
  if (el) el.classList.add('on');
  const h = document.getElementById(grp === 'rpe' ? 'sel-rpe' : 'sel-repos');
  if (h) h.value = val;
}
function setChipByVal(grp, val) {
  let found = false;
  document.querySelectorAll('#' + grp + '-chips .saisie-chip').forEach(c => {
    const on = String(c.textContent).replace('s', '') === String(val);
    c.classList.toggle('on', on);
    if (on) found = true;
  });
  const h = document.getElementById(grp === 'rpe' ? 'sel-rpe' : 'sel-repos');
  if (h) h.value = found ? String(val) : (grp === 'rpe' ? '' : '120');
}
function resetRpeChip() {
  document.querySelectorAll('#rpe-chips .saisie-chip').forEach(c => c.classList.remove('on'));
  const h = document.getElementById('sel-rpe'); if (h) h.value = '';
}
function repeterDerniereSerie() {
  if (!exoEnCours || !exoEnCours.series.length) { showToast('Aucune série à répéter'); return; }
  const s = exoEnCours.series[exoEnCours.series.length - 1];
  document.getElementById('inp-charge').value = s.charge;
  document.getElementById('inp-reps').value = s.reps;
  setChipByVal('rpe', s.rpe);
  setChipByVal('repos', s.repos);
  ajouterSerie();
}
function dupliquerSerie(index) {
  if (!exoEnCours) return;
  const s = exoEnCours.series[index];
  if (!s) return;
  document.getElementById('inp-charge').value = s.charge;
  document.getElementById('inp-reps').value = s.reps;
  setChipByVal('rpe', s.rpe);
  setChipByVal('repos', s.repos);
  ajouterSerie();
}

function toggleGene() {
  const f = document.getElementById('gene-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
async function signalerGene() {
  const input = document.getElementById('gene-input');
  const txt = (input.value || '').trim();
  if (!txt) { showToast('Décris la gêne', '#ff4444'); return; }
  if (!athlete) return;
  const exo = exoEnCours ? exoEnCours.exerciceNom : '';
  const message = '🚩 Gêne/douleur' + (exo ? ' — ' + exo : '') + ' : ' + txt;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveCommentaire', auteur: 'athlete', auteur_nom: (athlete.prenom || athlete.nom || 'Athlète'), athlete_id: athlete.athlete_id, message: message })
    });
    input.value = '';
    document.getElementById('gene-form').style.display = 'none';
    showToast('Signalé au coach ✓');
  } catch (e) { showToast('Erreur envoi', '#ff4444'); }
}

function ajouterSerie() {
  const date = document.getElementById('inp-date').value;
  const seanceId = document.getElementById('sel-seance-id').value;
  const charge = document.getElementById('inp-charge').value;
  const reps = document.getElementById('inp-reps').value;
  const rpe = document.getElementById('sel-rpe').value;
  const repos = document.getElementById('sel-repos').value;

  if (!date || !seanceId || !charge || !reps || !rpe) {
    showToast('⚠️ Remplis tous les champs !', '#ff4444'); return;
  }
  if (!exoEnCours) { showToast('⚠️ Choisis un exercice', '#ff4444'); return; }

  const chargeNum = parseFloat(charge);
  const volume = chargeNum > 0 ? chargeNum * parseInt(reps) : parseInt(reps);
  exoEnCours.series.push({
    date, seanceId, semaine: getNumSemaine(date),
    muscle: exoEnCours.muscle, exerciceId: exoEnCours.exerciceId, exerciceNom: exoEnCours.exerciceNom,
    serie: serieNum, charge: parseFloat(charge), reps: parseInt(reps),
    rpe: parseInt(rpe), repos: parseInt(repos), volume
  });

  serieNum++;
  majSeriesActuel();
  resetRpeChip();
  document.getElementById('btn-valider').style.display = 'block';
  _saveBrouillon();
  const reposVal = parseInt(repos);
  if (enSuperset) {
    // Mode superset : on enchaîne l'exercice suivant ; repos seulement à la fin du tour
    avancerSuperset(reposVal);
  } else if (reposVal > 0) {
    startTimer(reposVal, `Série ${serieNum-1} · ${charge}kg × ${reps} reps`);
  } else {
    showToast(`✅ Série ${serieNum-1} ajoutée !`);
  }
}

function majSeriesActuel() {
  const list = document.getElementById('series-list-actuel');
  const total = exoEnCours.series.length;
  document.getElementById('badge-series-actuel').textContent = `${total} série${total>1?'s':''}`;
  list.innerHTML = exoEnCours.series.map((s, i) => `
    <div class="serie-item">
      <span class="serie-num">S${s.serie}</span>
      <div class="serie-data">${s.charge}kg × ${s.reps} reps
        <div class="serie-sub">RPE ${s.rpe} · ${s.repos}s · Vol ${s.volume}</div>
      </div>
      <button class="btn-sm" onclick="dupliquerSerie(${i})" title="Dupliquer" style="background:var(--surface2);border:1px solid var(--border);color:var(--text-muted);padding:6px 9px;margin-right:4px">⧉</button>
      <button class="btn-sm btn-danger-sm" onclick="supprimerSerie(${i})">✕</button>
    </div>
  `).join('');
  // Recalcule la suggestion RPE après chaque série saisie
  if (exoEnCours && exoEnCours.series.length > 0) {
    const dernSerie = exoEnCours.series[exoEnCours.series.length - 1];
    const perf = getPerf(exoEnCours.exerciceNom);
    if (perf) {
      const strat = athlete ? athlete.strategie_progression : 'Progression linéaire';
      const exoData = exercicesData ? exercicesData.find(e => e.exercice === exoEnCours.exerciceNom) : null;
      const incr = exoData ? (parseFloat(String(exoData.increment_kg).replace(',','.').split('/')[0].trim()) || 2.5) : 2.5;
      const progEl = exoEnCours._progData;
      const pseudo = progEl
        ? { reps_max: progEl.reps_max, reps_mini: progEl.reps_mini }
        : { reps_max: perf.max_reps, reps_mini: Math.max(1, perf.max_reps - 2) };
      const best = perf.prev_charge !== null ? Math.max(perf.last_charge, perf.prev_charge || 0) : perf.last_charge;
      const sugg = calculerSurcharge(strat, perf, pseudo, best, incr, dernSerie.rpe);
      const suggEl = document.getElementById('exo-actuel-suggestion');
      if (suggEl) suggEl.innerHTML = sugg ? `<div class="prog-suggestion" style="margin-top:6px">${sugg}</div>` : '';
    }
  }
  majProgressionSeance();
}

function supprimerSerie(index) {
  exoEnCours.series.splice(index, 1);
  serieNum = exoEnCours.series.length + 1;
  majSeriesActuel();
  const total = seance.reduce((a,e)=>a+e.series.length,0);
  document.getElementById('btn-valider').style.display = total > 0 ? 'block' : 'none';
  _saveBrouillon();
}

// ==================== VALIDATION ====================
// ── État bien-être courant ──────────────────────────────────────────────────
// ── Mapping bien-être : 5 = très positif, 1 = très négatif (échelle uniforme) ──
// Chaque marqueur : { label (UI), val (BDD 1–5) }
// Fatigue et Douleur sont inversées : moins = mieux → score élevé
const WELLNESS_CONFIG = {
  sommeil:  { label: 'Qualité du sommeil',        douleurConditional: false },
  energie:  { label: "Niveau d'énergie",           douleurConditional: false },
  fatigue:  { label: 'Fatigue musculaire',          douleurConditional: false }, // inversé dans le HTML
  douleur:  { label: 'Douleur',                    douleurConditional: true  }, // inversé + zone conditionnelle
  ressenti: { label: 'Ressenti de la séance',      douleurConditional: false }
};
// Valeur "sans douleur" = 5 (Aucune). Zone s'affiche quand douleur < 5.
const WELLNESS_NO_PAIN_VAL = '1';

const wellnessState = { sommeil: null, energie: null, fatigue: null, douleur: null, zone: null, ressenti: null };

function ouvrirWellnessModal() {
  Object.keys(wellnessState).forEach(k => wellnessState[k] = null);
  document.querySelectorAll('.wq-chip').forEach(c => c.classList.remove('selected'));
  const noteInp = document.getElementById('wq-note'); if (noteInp) noteInp.value = '';
  document.getElementById('wq-zone-block').style.display = 'none';
  document.getElementById('wellness-overlay').style.display = 'block';
  const modal = document.getElementById('wellness-modal');
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
}

function fermerWellnessModal() {
  document.getElementById('wellness-overlay').style.display = 'none';
  document.getElementById('wellness-modal').style.display = 'none';
  // Si l'utilisateur annule le questionnaire (pas de validation en cours), on ré-affiche le bouton du récap
  if (!_validationEnCours) {
    const total = seance.reduce((a, e) => a + e.series.length, 0);
    const bv = document.getElementById('btn-valider');
    if (bv && total > 0) { bv.style.display = 'block'; bv.disabled = false; }
  }
}

function selectWQ(question, btn) {
  const container = document.getElementById('wq-' + question);
  container.querySelectorAll('.wq-chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  wellnessState[question] = Number(btn.dataset.val); // toujours numérique en BDD
  if (question === 'douleur') {
    const hasPain = btn.dataset.val !== WELLNESS_NO_PAIN_VAL;
    document.getElementById('wq-zone-block').style.display = hasPain ? 'block' : 'none';
    if (!hasPain) {
      wellnessState.zone = null;
      document.querySelectorAll('#wq-zone .wq-chip').forEach(c => c.classList.remove('selected'));
    }
  }
}

async function _envoyerSeance() {
  const btn = document.getElementById('btn-valider');
  if (btn) { btn.textContent = '⏳ Envoi...'; btn.disabled = true; }
  const lignes = _construireLignesSeance();

  // La séance n'est JAMAIS perdue : en cas d'échec/incertitude → file d'attente + resync auto.
  function _miseEnFile(msg, couleur) {
    enregistrerSeanceOffline(lignes, null);
    afficherRecap();
    showToast(msg, couleur || '#f59f00');
  }

  try {
    // Requête SIMPLE (text/plain → pas de préflight) et LISIBLE (mode cors par défaut) :
    // on lit la vraie réponse du serveur au lieu de deviner (fini le no-cors opaque).
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'saveSeance', data: lignes })
    });
    let j = null;
    try { j = await res.json(); } catch (_) { j = null; }
    const ok = res.ok && j && !j.erreur && !j.error;
    if (ok) {
      afficherRecap();
      showToast('🎉 Séance enregistrée !');
    } else {
      // Le serveur a répondu mais a refusé l'écriture → on met en file plutôt que de perdre.
      _miseEnFile('⚠️ Enregistrement refusé côté serveur — mis en file, resync auto', '#f59f00');
    }
  } catch (e) {
    // Réseau instable / requête non aboutie → file d'attente (aucune perte).
    _miseEnFile('📴 Réseau instable : séance mise en file, elle se synchronisera');
  }
}

// Normalise une date en dd/MM/yyyy (le format stocké côté serveur)
function _normDateDDMM(s) {
  if (!s) return '';
  s = String(s);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[3] + '/' + iso[2] + '/' + iso[1];
  const fr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (fr) return fr[1] + '/' + fr[2] + '/' + fr[3];
  return s;
}
// Vérifie que la séance vient d'être écrite côté serveur.
// Retourne true (confirmée), false (absente après plusieurs essais), null (vérif impossible).
// Réessaie : le POST no-cors se termine avant l'écriture réelle → on laisse le temps au serveur.
async function _verifierSeanceEnregistree(dateEnvoyee) {
  if (!dateEnvoyee) return null;
  const cible = _normDateDDMM(dateEnvoyee);
  for (let essai = 0; essai < 3; essai++) {
    await new Promise(r => setTimeout(r, essai === 0 ? 900 : 1300));
    try {
      const res = await fetch(`${SCRIPT_URL}?action=getAppData&athlete_id=${encodeURIComponent(athlete.athlete_id)}&nocache=${Date.now()}`);
      const d = await res.json();
      const dates = (d.historique && d.historique.dates_seances) ? d.historique.dates_seances : {};
      if (dates[cible]) return true;
      const der = (d.recent && d.recent.derniere_seance) ? d.recent.derniere_seance
                : (d.dashboard && d.dashboard.derniere_seance) ? d.dashboard.derniere_seance : null;
      if (der && _normDateDDMM(der.date) === cible) return true;
    } catch(e) {
      return null; // réseau/parse KO : on ne peut pas conclure
    }
  }
  return false;
}

async function _envoyerWellness(seanceId, dateSeance) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveBienEtre',
        athlete_id: athlete.athlete_id,
        date:       dateSeance,
        seance_id:  seanceId,
        sommeil:    wellnessState.sommeil,
        energie:    wellnessState.energie,
        fatigue:    wellnessState.fatigue,
        douleur:    wellnessState.douleur,
        zone:       wellnessState.zone,
        ressenti:   wellnessState.ressenti,
        note:       (document.getElementById('wq-note') ? document.getElementById('wq-note').value.trim() : '')
      })
    });
  } catch(e) { /* non bloquant */ }
}

let _validationEnCours = false;
// Masque + désactive immédiatement le bouton de validation (anti-reclic)
function _bloquerBoutonsValidation() {
  const bv = document.getElementById('btn-valider');
  if (bv) { bv.disabled = true; bv.style.display = 'none'; }
  const bw = document.getElementById('btn-wellness-valider');
  if (bw) { bw.disabled = true; bw.textContent = '⏳ Enregistrement...'; }
}

// ===== File d'attente hors-ligne (séances) =====
const OFFLINE_SEANCES_KEY = 'novalyz_offline_seances';
function _lireQueueOffline() { try { return JSON.parse(localStorage.getItem(OFFLINE_SEANCES_KEY) || '[]'); } catch (e) { return []; } }
function _ecrireQueueOffline(q) { try { localStorage.setItem(OFFLINE_SEANCES_KEY, JSON.stringify(q)); } catch (e) {} }
function _construireLignesSeance() {
  const lignes = [];
  seance.forEach(exo => exo.series.forEach(s => {
    lignes.push([s.date, s.semaine, s.seanceId, athlete.nom, athlete.athlete_id,
      s.exerciceNom, s.muscle, s.exerciceId, s.serie, s.charge, s.reps, s.rpe, s.repos, s.volume]);
  }));
  return lignes;
}
function _wellnessPayload(seanceId, dateSeance) {
  return { action: 'saveBienEtre', athlete_id: athlete.athlete_id, date: dateSeance, seance_id: seanceId,
    sommeil: wellnessState.sommeil, energie: wellnessState.energie, fatigue: wellnessState.fatigue,
    douleur: wellnessState.douleur, zone: wellnessState.zone, ressenti: wellnessState.ressenti,
    note: (document.getElementById('wq-note') ? document.getElementById('wq-note').value.trim() : '') };
}
function enregistrerSeanceOffline(lignes, wellness) {
  const q = _lireQueueOffline();
  q.push({ lignes: lignes, wellness: wellness, ts: Date.now() });
  _ecrireQueueOffline(q);
}
async function flushSeancesOffline() {
  if (!navigator.onLine) return;
  let q = _lireQueueOffline();
  if (!q.length) return;
  const restantes = [];
  for (const item of q) {
    try {
      // Réponse LISIBLE : on ne retire de la file QUE si le serveur confirme l'écriture.
      const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSeance', data: item.lignes }) });
      let j = null; try { j = await res.json(); } catch (_) { j = null; }
      const ok = res.ok && j && !j.erreur && !j.error;
      if (!ok) { restantes.push(item); continue; }   // pas confirmé → on garde pour réessayer
      if (item.wellness) {
        try { await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item.wellness) }); } catch (_) { /* bien-être non bloquant */ }
      }
    } catch (e) { restantes.push(item); }
  }
  _ecrireQueueOffline(restantes);
  const envoyees = q.length - restantes.length;
  if (envoyees > 0) showToast(`☁️ ${envoyees} séance${envoyees > 1 ? 's' : ''} synchronisée${envoyees > 1 ? 's' : ''} !`);
}
window.addEventListener('online', () => { flushSeancesOffline(); });
// Traite une validation hors-ligne : met en file + affiche le récap. Renvoie true si géré hors-ligne.
function _gererValidationHorsLigne(avecWellness) {
  if (navigator.onLine) return false;
  const lignes = _construireLignesSeance();
  const fs = seance[0] && seance[0].series[0];
  const wellness = (avecWellness && fs) ? _wellnessPayload(fs.seanceId, fs.date) : null;
  enregistrerSeanceOffline(lignes, wellness);
  afficherRecap();
  showToast('📴 Hors-ligne : séance enregistrée, elle se synchronisera au retour du réseau');
  return true;
}

async function validerSeanceAvecWellness() {
  if (_validationEnCours) return;          // anti double-soumission
  _validationEnCours = true;
  _bloquerBoutonsValidation();
  fermerWellnessModal();
  if (_gererValidationHorsLigne(true)) return;   // hors-ligne : mis en file
  const firstSerie = seance[0]?.series[0];
  if (firstSerie) await _envoyerWellness(firstSerie.seanceId, firstSerie.date);
  await _envoyerSeance();
}

async function validerSeanceSansWellness() {
  if (_validationEnCours) return;          // anti double-soumission
  _validationEnCours = true;
  _bloquerBoutonsValidation();
  fermerWellnessModal();
  if (_gererValidationHorsLigne(false)) return;  // hors-ligne : mis en file
  await _envoyerSeance();
}

function validerSeance() {
  if (_validationEnCours) return;
  const totalSeries = seance.reduce((a,e)=>a+e.series.length,0);
  if (totalSeries === 0) { showToast('Aucune série !', '#ff4444'); return; }
  const bv = document.getElementById('btn-valider'); if (bv) bv.style.display = 'none';
  _confirmerFinSeance();
}

function _confirmerFinSeance() {
  const totalSeries = seance.reduce((a,e) => a + e.series.length, 0);
  const totalExos   = seance.length;
  const totalVol    = seance.reduce((a,e) => a + e.series.reduce((b,s) => b + s.volume, 0), 0);
  var old = document.getElementById('_confirm-fin-seance');
  if (old) old.remove();
  var ov = document.createElement('div');
  ov.id = '_confirm-fin-seance';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,20,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML =
    '<div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -8px 30px rgba(7,11,20,.18);">'
    + '<div style="width:40px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;"></div>'
    + '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:16px;">Terminer la séance ?</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px;">'
      + '<div style="background:var(--surface2);border-radius:10px;padding:10px 4px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:900;color:var(--accent);font-variant-numeric:tabular-nums;">' + totalExos + '</div>'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">exercices</div></div>'
      + '<div style="background:var(--surface2);border-radius:10px;padding:10px 4px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:900;color:var(--accent);font-variant-numeric:tabular-nums;">' + totalSeries + '</div>'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">séries</div></div>'
      + '<div style="background:var(--surface2);border-radius:10px;padding:10px 4px;text-align:center;">'
        + '<div style="font-size:18px;font-weight:900;color:var(--accent);font-variant-numeric:tabular-nums;">' + totalVol + ' kg</div>'
        + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">volume</div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
      + '<button onclick="_annulerFinSeance()" style="padding:13px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;">↩ Continuer</button>'
      + '<button onclick="_validerFinSeance()" style="padding:13px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✅ Terminer</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);
}

function _annulerFinSeance() {
  var ov = document.getElementById('_confirm-fin-seance');
  if (ov) ov.remove();
  const bv = document.getElementById('btn-valider');
  if (bv) { bv.style.display = 'block'; bv.disabled = false; }
}

function _validerFinSeance() {
  var ov = document.getElementById('_confirm-fin-seance');
  if (ov) ov.remove();
  ouvrirWellnessModal();
}

function afficherRecap() {
  // La séance est désormais enregistrée (ou mise en file hors-ligne, elle-même
  // persistée) : le brouillon n'a plus de raison d'être, et on verrouille toute
  // ré-écriture (sinon visibilitychange/pagehide recréerait un brouillon fantôme).
  _seanceEnvoyee = true;
  _effacerBrouillon();
  { const _b = document.getElementById('brouillon-banner'); if (_b) _b.remove(); }
  const saisieBlock = document.getElementById('saisie-block');
  saisieBlock.style.display = 'none';
  document.getElementById('recap-block').style.display = 'block';

  const dateVal = document.getElementById('inp-date').value;
  const seanceType = document.getElementById('sel-seance-id').value;
  const totalSeries = seance.reduce((a,e)=>a+e.series.length,0);
  const totalVol = seance.reduce((a,e)=>a+e.series.reduce((b,s)=>b+s.volume,0),0);
  document.getElementById('recap-seance-info').innerHTML =
    `<span style="color:var(--accent);font-weight:700">${seanceType}</span> · ${formatDateDisplay(dateVal)} · ${totalSeries} séries · Vol: ${totalVol}`;

  const recap = document.getElementById('recap-content');
  recap.innerHTML = '';
  seance.forEach(exo => {
    const div = document.createElement('div');
    div.className = 'recap-exo';
    div.innerHTML = `<div class="recap-exo-name">${exo.muscle} — ${exo.exerciceNom}</div>`;
    const progExo = programmeSeance.find(pr => pr.exercice === exo.exerciceNom);
    const perfExo = getPerf(exo.exerciceNom);
    exo.series.forEach(s => {
      const p = document.createElement('div');
      p.className = 'recap-serie';
      let couleur = 'var(--text-muted)';
      if (progExo && perfExo) {
        const cible = perfExo.max_reps < progExo.reps_max ? perfExo.max_reps + 1 : progExo.reps_max;
        if (s.reps >= cible) couleur = 'var(--success)';
        else if (s.reps < perfExo.max_reps) couleur = 'var(--danger)';
      }
      p.style.color = couleur;
      p.textContent = `S${s.serie} · ${s.charge}kg × ${s.reps} reps · RPE ${s.rpe} · Vol ${s.volume}`;
      div.appendChild(p);
    });
    recap.appendChild(div);
  });

  // Détection des records battus pendant cette séance
  const recordsBattus = [];
  seance.forEach(exo => {
    const perfExo = getPerf(exo.exerciceNom);
    const maxChargeSession = Math.max(...exo.series.map(s => s.charge));
    if (maxChargeSession > 0 && (!perfExo || maxChargeSession > perfExo.last_charge)) {
      recordsBattus.push({ nom: exo.exerciceNom, charge: maxChargeSession });
    }
  });
  if (recordsBattus.length > 0) {
    const recBlock = document.createElement('div');
    recBlock.style.cssText = 'background:linear-gradient(135deg,rgba(47,123,255,.15),rgba(0,201,110,.12));border:1px solid rgba(0,201,110,.3);border-radius:12px;padding:14px 16px;margin-bottom:12px;text-align:center;animation:pop-in .3s cubic-bezier(.2,.8,.2,1)';
    recBlock.innerHTML = `
      <div style="font-size:24px;margin-bottom:6px;">🏆</div>
      <div style="font-size:14px;font-weight:800;color:var(--good);margin-bottom:6px;">Record${recordsBattus.length > 1 ? 's' : ''} personnel${recordsBattus.length > 1 ? 's' : ''} !</div>
      ${recordsBattus.map(r => `<div style="font-size:13px;font-weight:700;color:var(--text);">${r.nom} — <span style="color:var(--good)">${r.charge}kg</span></div>`).join('')}`;
    recap.insertBefore(recBlock, recap.firstChild);
  }

  afficherProgrammeVsRealise(seanceType);
  window.scrollTo(0,0);
}

async function afficherProgrammeVsRealise(seanceType) {
  if (!seanceType || programmeSeance.length === 0) return;
  document.getElementById('recap-programme-block').style.display = 'block';
  const el = document.getElementById('recap-programme-content');
  el.innerHTML = programmeSeance.map(p => {
    const exoRealise = seance.find(e => e.exerciceNom === p.exercice);
    const seriesFaites = exoRealise ? exoRealise.series.length : 0;
    const repsMoy = exoRealise && seriesFaites > 0
      ? Math.round(exoRealise.series.reduce((a,s)=>a+s.reps,0)/seriesFaites) : 0;
    const seriesOk = seriesFaites >= p.series_prevues;
    const repsOk = repsMoy >= p.reps_mini;
    const nonFait = seriesFaites === 0;
    let statut, couleur;
    if (nonFait) { statut = '⚪ Non fait'; couleur = 'var(--text-muted)'; }
    else if (seriesOk && repsOk) { statut = '✅ Objectif atteint'; couleur = 'var(--success)'; }
    else { statut = '🔴 Insuffisant'; couleur = 'var(--danger)'; }
    return `
      <div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:6px;border-left:3px solid ${couleur}">
        <div style="font-size:13px;font-weight:700">${p.exercice}</div>
        <div style="font-size:12px;color:var(--text-muted)">Prévu: ${p.series_prevues} séries · ${p.reps_mini}-${p.reps_max} reps</div>
        <div style="font-size:12px">Réalisé: <strong>${seriesFaites} séries · ~${repsMoy} reps</strong></div>
        <div style="font-size:12px;color:${couleur};font-weight:700">${statut}</div>
      </div>`;
  }).join('');
}

async function nouvelleSeance() {
  // Note désormais saisie dans le questionnaire bien-être — champ récap retiré (null-safe)
  const noteEl = document.getElementById('inp-note');
  const note = noteEl ? noteEl.value.trim() : '';
  if (note) {
    const dateVal = document.getElementById('inp-date').value;
    const seanceType = document.getElementById('sel-seance-id').value;
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveNote',
          date: dateVal,
          athlete_id: athlete.athlete_id,
          athlete: athlete.nom,
          seance_id: seanceType,
          note: note
        })
      });
    } catch(e) { console.error('Erreur sauvegarde note', e); }
    if (noteEl) noteEl.value = '';
  }

  seance = []; exoEnCours = null; serieNum = 1; indexExoProgramme = 0;
  programmeSeance = []; lastPerfData = {};
  _seanceEnvoyee = false;
  _effacerBrouillon();
  { const _b = document.getElementById('brouillon-banner'); if (_b) _b.remove(); }
  _validationEnCours = false;   // prêt pour une nouvelle validation
  document.getElementById('recap-block').style.display = 'none';
  document.getElementById('card-liste-seance').style.display = 'none';
  document.getElementById('card-exo-actuel').style.display = 'none';
  document.getElementById('card-hors-programme').style.display = 'none';
  document.getElementById('sel-seance-id').value = '';
  const sb = document.getElementById('saisie-block');
  sb.style.display = 'block'; sb.style.visibility = 'visible';
  sb.style.height = 'auto'; sb.style.overflow = 'visible';
  document.getElementById('card-exo-actuel').style.display = 'none';
  const btnValider = document.getElementById('btn-valider');
  btnValider.style.display = 'none';
  btnValider.disabled = false;
  btnValider.textContent = '✅ Valider la séance';
  document.getElementById('sel-seance-id').value = '';
  document.getElementById('inp-date').value = _todayLocalStr();
  majProgressionSeance();
  window.scrollTo(0,0);
}

// ==================== PROGRAMME COMPLET ====================
function afficherProgrammeComplet() {
  const el = document.getElementById('programme-complet-content');
  if (!athlete) return;
  
  // Utiliser les données déjà chargées
  const prog = dernierAppData ? dernierAppData.programme || [] : [];

  if (prog.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aucun programme défini</div>';
    return;
  }

  // Grouper par séance
  const parSeance = {};
  prog.forEach(p => {
    if (!parSeance[p.seance_id]) parSeance[p.seance_id] = [];
    parSeance[p.seance_id].push(p);
  });

  el.innerHTML = Object.entries(parSeance).map(([seanceId, exercices]) => `
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">${seanceId}</div>
      ${exercices.map(p => `
        <div class="prog-item" style="margin-bottom:8px">
          <div style="font-size:14px;font-weight:700">${p.exercice}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${p.series_prevues} séries · Rep min ${p.reps_mini} · Rep max ${p.reps_max}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ==================== OBJECTIF ====================
function objIconFor(obj) {
  const o = (obj || '').toLowerCase();
  if (o.includes('masse') && o.includes('sèche')) return '♻️';
  if (o.includes('masse')) return '📈';
  if (o.includes('sèche')) return '🔥';
  if (o.includes('maintien')) return '⚖️';
  if (o.includes('force')) return '🏋️';
  return '🎯';
}
function majObjectifCard(obj) {
  const nomEl = document.getElementById('obj-actuel-nom');
  const icoEl = document.getElementById('obj-icon');
  if (nomEl) nomEl.textContent = obj || 'Non défini';
  if (icoEl) icoEl.textContent = objIconFor(obj);
}
function toggleObjectifEdit(on) {
  const v = document.getElementById('obj-card-view');
  const e = document.getElementById('obj-card-edit');
  if (v) v.style.display = on ? 'none' : 'flex';
  if (e) e.style.display = on ? 'block' : 'none';
}
async function sauvegarderObjectif() {
  const obj = document.getElementById('sel-objectif').value;
  await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action:'saveObjectif', athlete_id:athlete.athlete_id, objectif:obj}) });
  athlete.objectif = obj;
  localStorage.setItem('muscu_athlete', JSON.stringify(athlete));
  majObjectifCard(obj);
  toggleObjectifEdit(false);
  showToast('✅ Objectif sauvegardé !');
}

async function sauvegarderPoids() {
  const poids = document.getElementById('inp-poids').value;
  const date = document.getElementById('inp-date-poids').value;
  if (!poids || !date) { showToast('⚠️ Remplis poids et date', '#ff4444'); return; }
  await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action:'savePoids', athlete_id:athlete.athlete_id, athlete:athlete.nom, poids, date}) });
  showToast('✅ Poids enregistré !');
  document.getElementById('inp-poids').value = '';
  // petit délai avant de relire (laisse le serveur propager l'écriture)
  setTimeout(chargerPoids, 600);
}

async function chargerPoids() {
  const el = document.getElementById('hist-poids');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getPoids&athlete_id=${athlete.athlete_id}&nocache=${Date.now()}`);
    const data = await res.json();
    if (data.poids && data.poids.length > 0) {
      el.innerHTML = data.poids.map(p => `
        <div class="poids-item">
          <span>${p.date}</span>
          <span class="poids-val">${p.poids} kg</span>
        </div>`).join('');
      // rafraîchit aussi le graphique d'évolution du poids (dashboard)
      try { afficherGraphiquePoids(data.poids); } catch(_) {}
    } else { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Aucune pesée enregistrée</div>'; }
  } catch(e) { el.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Erreur</div>'; }
}

// ==================== HISTORIQUE ====================
let calDate = new Date();
let seancesDates = {};
let seancesDatesCardio = {};   // jours avec séance cardio (clés DD/MM/YYYY) → régularité globale
let cardioParJour = {};        // détail cardio agrégé par jour (clé DD/MM/YYYY) → agenda
let progressionData = {};
let tendancesData = null;
let dernierAppData = null;

async function chargerHistorique() {
  if (!dernierAppData) return;
  
  seancesDates = dernierAppData.historique.dates_seances || {};
  progressionData = dernierAppData.historique.progression_par_exo || {};
  tendancesData = dernierAppData.historique.tendances || null;

  renderCalendrier();
  afficherVolumeMuscle(dernierAppData.historique.volume_semaine || []);
  renderBilanBalance(dernierAppData.historique.volume_semaine || []);
  afficherTendances(4);
  renderCorrelationBienEtre(dernierAppData.bien_etre, dernierAppData.historique.volume_par_jour || {});

  const exercices = dernierAppData.historique.exercices || [];
  const sel = document.getElementById('sel-hist-exercice');
  if (sel) {
    sel.innerHTML = '<option value="">— Choisir un exercice —</option>';
    exercices.forEach(e => {
      const o = document.createElement('option');
      o.value = e; o.textContent = e; sel.appendChild(o);
    });
  }
}

// Couleur + abréviation lisible d'un type de séance (agenda Option D)
function seanceTypeInfo(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('upper'))  return { abbr: 'UPPER', col: '#9b7bff' };
  if (n.includes('lower'))  return { abbr: 'LOWER', col: '#00b8c4' };
  if (n.includes('push'))   return { abbr: 'PUSH',  col: '#f59f00' };
  if (n.includes('pull'))   return { abbr: 'PULL',  col: '#00c96e' };
  if (n.includes('full'))   return { abbr: 'FULL',  col: '#ec5aa8' };
  if (n.includes('pec'))    return { abbr: 'PEC',   col: '#9b7bff' };
  if (n.includes('dos'))    return { abbr: 'DOS',   col: '#00b8c4' };
  if (n.includes('jambe'))  return { abbr: 'JAMBE', col: '#00b8c4' };
  if (n.includes('bras'))   return { abbr: 'BRAS',  col: '#f59f00' };
  if (n.includes('libre'))  return { abbr: 'LIBRE', col: 'var(--accent)' };
  return { abbr: (name || '').substring(0, 5).toUpperCase(), col: 'var(--accent)' };
}

let calSelectedEl = null;
function selectCalDay(dateStr, name, el) {
  if (calSelectedEl) calSelectedEl.style.boxShadow = '';
  calSelectedEl = el;
  el.style.boxShadow = '0 0 0 2px var(--accent)';
  renderCalDetail(dateStr, name);
}

function renderCalDetail(dateStr, name) {
  const el = document.getElementById('cal-detail');
  if (!el) return;
  const chip = (v, l) => nvStat(v, l, { size:'sm', tile:true });

  // ── Bloc muscu ──
  let muscuBlock = '';
  if (name) {
    const det = seancesDetailMap[dateStr];
    let stats;
    if (det) {
      const tonnageT = det.tonnage ? (Math.round(det.tonnage / 100) / 10) + 't' : '—';
      stats = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:9px;">
        ${chip(det.nbExos, 'exos')}${chip(det.nbSeries, 'séries')}${chip(tonnageT, 'tonnage')}${chip(det.rpeMoy != null ? det.rpeMoy : '—', 'RPE')}
      </div>`;
    } else {
      stats = `<div style="margin-top:8px;font-size:11px;color:var(--text-muted);">Détail indisponible pour ce jour.</div>`;
    }
    muscuBlock = `<div style="background:var(--surface2);border-radius:12px;padding:11px 12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-size:13px;font-weight:800;color:var(--text);">${dateStr}</div>
        <span style="font-size:10px;font-weight:800;color:#fff;background:var(--good);border-radius:20px;padding:3px 10px;">${name}</span>
      </div>${stats}
      ${det ? `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:9px;">
        <button onclick="_modifierSeanceMuscu('${dateStr}','${String(name||'').replace(/'/g,"\\'")}')" style="background:var(--surface);border:1px solid var(--border);color:var(--accent);font-size:11px;font-weight:700;cursor:pointer;padding:5px 11px;border-radius:8px;">${ic('pencil')} Modifier</button>
        <button onclick="_supprimerSeanceMuscu('${dateStr}','${String(name||'').replace(/'/g,"\\'")}')" style="background:none;border:1px solid var(--border);color:var(--danger);font-size:11px;font-weight:700;cursor:pointer;padding:5px 11px;border-radius:8px;">${ic('trash')} Supprimer</button>
      </div>` : ''}</div>`;
  }

  // ── Bloc cardio ──
  let cardioBlock = '';
  const cj = cardioParJour[dateStr];
  if (cj) {
    const typeChips = Object.keys(cj.types).map(function(t) {
      const clr = (typeof _CH_CLR !== 'undefined' && _CH_CLR[t]) || '#6366f1';
      const bg  = (typeof _CH_BG !== 'undefined' && _CH_BG[t]) || 'rgba(99,102,241,.14)';
      const ico = (typeof _CH_ICO !== 'undefined' && _CH_ICO[t]) || '⚡';
      const lbl = (typeof _CARDIO_TYPE_LABELS !== 'undefined' && _CARDIO_TYPE_LABELS[t]) || t;
      return `<span style="font-size:10px;font-weight:700;border-radius:20px;padding:2px 8px;color:${clr};background:${bg};">${ico} ${lbl}</span>`;
    }).join('');
    const cStats = [
      cj.km   ? chip(Math.round(cj.km * 10) / 10, 'km')   : '',
      cj.min  ? chip(Math.round(cj.min), 'min')           : '',
      cj.kcal ? chip(Math.round(cj.kcal), 'kcal')         : '',
      cj.pas  ? chip(Math.round(cj.pas).toLocaleString('fr-FR'), 'pas') : '',
    ].filter(Boolean);
    const cols = cStats.length || 1;
    cardioBlock = `<div style="background:var(--surface2);border-radius:12px;padding:11px 12px;${muscuBlock ? 'margin-top:8px;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-size:13px;font-weight:800;color:var(--text);">${name ? 'Cardio' : dateStr}</div>
        <span style="font-size:10px;font-weight:800;color:#fff;background:var(--bad);border-radius:20px;padding:3px 10px;">${cj.n} séance${cj.n > 1 ? 's' : ''}</span>
      </div>
      ${typeChips ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:9px;">${typeChips}</div>` : ''}
      ${cStats.length ? `<div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;margin-top:9px;">${cStats.join('')}</div>` : ''}
    </div>`;
  }

  el.innerHTML = muscuBlock + cardioBlock;
}

// Suppression d'une séance muscu (depuis le détail de l'agenda). Une séance =
// toutes les séries d'un type (seance_id) à une date donnée.
function _supprimerSeanceMuscu(dateStr, seanceId) {
  if (!athlete) return;
  if (!confirm('Supprimer la séance « ' + seanceId + ' » du ' + dateStr + ' ?\n\nToutes les séries de cette séance seront définitivement effacées.')) return;
  _confirmSupprimerSeanceMuscu(dateStr, seanceId);
}
async function _confirmSupprimerSeanceMuscu(dateStr, seanceId) {
  showToast('Suppression…', 'var(--text-muted)');
  try {
    const r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteSeance', athlete_id: athlete.athlete_id, date: dateStr, seance_id: seanceId })
    });
    const res = await r.json();
    if (res && res.success) {
      showToast('Séance supprimée', 'var(--good)');
      const cd = document.getElementById('cal-detail'); if (cd) cd.innerHTML = '';
      chargerAppData();
    } else {
      showToast('Erreur : ' + ((res && res.error) || 'inconnue'), 'var(--bad)');
    }
  } catch (e) { showToast('Erreur réseau', 'var(--bad)'); }
}

// ===== Éditeur de séance muscu (modifier / supprimer série par série) =====
var _editSeanceCtx = null;

function _editSerieRow(exoName, muscle, exoId, s) {
  function inp(cls, val, step) {
    return '<input type="number" class="' + cls + '" value="' + (val != null ? val : '') + '" step="' + (step || '1') + '" style="width:100%;box-sizing:border-box;padding:7px 6px;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:var(--fs-base);text-align:center;font-family:var(--font);">';
  }
  return '<div class="es-row" data-exo="' + escapeHtml(exoName) + '" data-muscle="' + escapeHtml(muscle || '') + '" data-exoid="' + escapeHtml(exoId || '') + '" style="display:grid;grid-template-columns:18px 1fr 1fr 1fr 1fr 26px;gap:6px;align-items:center;margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-xs);font-weight:800;color:var(--accent);">S</span>'
    + inp('es-charge', s.charge, '0.5') + inp('es-reps', s.reps, '1') + inp('es-rpe', s.rpe, '0.5') + inp('es-repos', s.repos, '5')
    + '<button onclick="this.closest(\'.es-row\').remove()" title="Supprimer cette série" style="background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;padding:0;line-height:1;">✕</button>'
    + '</div>';
}

function _modifierSeanceMuscu(dateStr, seanceId) {
  var det = seancesDetailMap[dateStr];
  if (!det || !det.exos || !det.exos.length) { showToast('Détail de la séance indisponible', 'var(--warn)'); return; }
  _editSeanceCtx = { dateStr: dateStr, seanceId: seanceId };
  var old = document.getElementById('edit-seance-overlay'); if (old) old.remove();

  var body = det.exos.map(function(ex) {
    var rows = (ex.series || []).map(function(s) { return _editSerieRow(ex.exo || '', ex.muscle, ex.exercice_id, s); }).join('');
    return '<div class="es-exo" style="margin-bottom:14px;">'
      + nvLabel(escapeHtml(ex.exo || ''), { style: 'margin-bottom:6px;' })
      + rows + '</div>';
  }).join('');

  var ov = document.createElement('div');
  ov.id = 'edit-seance-overlay';
  ov.className = 'nv-sheet-overlay';
  ov.innerHTML =
    '<div class="nv-sheet" style="max-height:88vh;overflow-y:auto;">'
    + '<div class="nv-sheet-handle"></div>'
    + '<div class="nv-sheet-title">Modifier la séance</div>'
    + '<div class="nv-sheet-sub">' + escapeHtml(seanceId) + ' · ' + escapeHtml(dateStr) + '</div>'
    + '<div style="display:grid;grid-template-columns:18px 1fr 1fr 1fr 1fr 26px;gap:6px;font-size:var(--fs-2xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:6px;text-align:center;"><span></span><span>Charge</span><span>Reps</span><span>RPE</span><span>Repos</span><span></span></div>'
    + '<div id="edit-seance-body">' + body + '</div>'
    + '<div style="font-size:var(--fs-2xs);color:var(--text-subtle);margin:2px 0 6px;">Supprime toutes les séries pour effacer la séance.</div>'
    + '<div class="nv-sheet-actions"><button class="btn btn-neutral" onclick="_fermerModifSeance()">Annuler</button><button class="btn btn-accent" onclick="_sauvegarderModifSeance()">✅ Enregistrer</button></div>'
    + '</div>';
  ov.addEventListener('click', function (e) { if (e.target === ov) _fermerModifSeance(); });
  document.body.appendChild(ov);
}

function _fermerModifSeance() {
  var ov = document.getElementById('edit-seance-overlay'); if (ov) ov.remove();
  _editSeanceCtx = null;
}

async function _sauvegarderModifSeance() {
  if (!_editSeanceCtx || !athlete) return;
  var dateStr = _editSeanceCtx.dateStr, seanceId = _editSeanceCtx.seanceId;
  var iso = dateStr.indexOf('/') !== -1 ? dateStr.split('/').reverse().join('-') : dateStr;
  var rows = [], serieParExo = {};
  document.querySelectorAll('#edit-seance-body .es-row').forEach(function (row) {
    var exo = row.getAttribute('data-exo') || '';
    var muscle = row.getAttribute('data-muscle') || '';
    var exoId = row.getAttribute('data-exoid') || '';
    var gv = function (sel) { var el = row.querySelector(sel); return el ? el.value : ''; };
    var charge = parseFloat(gv('.es-charge')) || 0;
    var reps = parseInt(gv('.es-reps')) || 0;
    var rpe = gv('.es-rpe') !== '' ? parseFloat(gv('.es-rpe')) : null;
    var repos = parseInt(gv('.es-repos')) || 0;
    if (!reps) return;   // série sans reps → ignorée
    serieParExo[exo] = (serieParExo[exo] || 0) + 1;
    var volume = charge > 0 ? charge * reps : reps;
    rows.push([iso, getNumSemaine(iso), seanceId, athlete.nom, athlete.athlete_id, exo, muscle, exoId, serieParExo[exo], charge, reps, rpe, repos, volume]);
  });
  if (rows.length === 0 && !confirm('Aucune série : cela supprimera toute la séance. Continuer ?')) return;

  showToast(rows.length ? 'Enregistrement…' : 'Suppression…', 'var(--text-muted)');
  try {
    var r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateSeance', athlete_id: athlete.athlete_id, date: iso, seance_id: seanceId, data: rows })
    });
    var res = await r.json();
    if (res && res.success) {
      showToast(rows.length ? 'Séance modifiée' : 'Séance supprimée', 'var(--good)');
      _fermerModifSeance();
      var cd = document.getElementById('cal-detail'); if (cd) cd.innerHTML = '';
      chargerAppData();
    } else {
      showToast('Erreur : ' + ((res && res.error) || 'inconnue'), 'var(--bad)');
    }
  } catch (e) { showToast('Erreur réseau', 'var(--bad)'); }
}

// Détail des séances par date (pour l'agenda) — chargé depuis getSeancesDetail
let seancesDetailMap = {};
async function chargerSeancesDetail() {
  if (!athlete) return;
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getSeancesDetail&athlete_id=${athlete.athlete_id}`);
    const data = await res.json();
    const map = {};
    (data.seances || []).forEach(s => {
      let nbSeries = 0, rpeSum = 0, rpeN = 0, tonnage = 0;
      (s.exos || []).forEach(ex => (ex.series || []).forEach(se => {
        nbSeries++;
        if (se.rpe != null) { rpeSum += se.rpe; rpeN++; }
        if (se.charge != null && se.reps != null) tonnage += se.charge * se.reps;
      }));
      map[s.date] = { seance_id: s.seance_id, nbExos: (s.exos || []).length, nbSeries, rpeMoy: rpeN ? Math.round(rpeSum / rpeN * 10) / 10 : null, tonnage, exos: s.exos || [] };
    });
    seancesDetailMap = map;
  } catch (e) { /* non bloquant */ }
}

function renderCalendrier() {
  const mois = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const annee = calDate.getFullYear();
  const moisIdx = calDate.getMonth();
  document.getElementById('cal-titre').textContent = `${mois[moisIdx]} ${annee}`;

  const today = new Date();
  const premierJour = new Date(annee, moisIdx, 1);
  const dernierJour = new Date(annee, moisIdx + 1, 0);
  
  // Lundi = 0
  let debutOffset = premierJour.getDay() - 1;
  if (debutOffset < 0) debutOffset = 6;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Cases vides avant
  const prevDernier = new Date(annee, moisIdx, 0).getDate();
  for (let i = debutOffset - 1; i >= 0; i--) {
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--border);';
    d.textContent = prevDernier - i;
    grid.appendChild(d);
  }

  // Réinitialiser le panneau détail à chaque rendu
  const detReset = document.getElementById('cal-detail'); if (detReset) detReset.innerHTML = '';
  calSelectedEl = null;

  // Jours du mois
  for (let j = 1; j <= dernierJour.getDate(); j++) {
    const d = document.createElement('div');
    const dateStr = `${String(j).padStart(2,'0')}/${String(moisIdx+1).padStart(2,'0')}/${annee}`;
    const isToday = j === today.getDate() && moisIdx === today.getMonth() && annee === today.getFullYear();
    const hasSeance = seancesDates[dateStr];        // muscu
    const hasCardio = !!seancesDatesCardio[dateStr]; // cardio
    const isFutur = new Date(annee, moisIdx, j) > today;

    if (hasSeance || hasCardio) {
      // Pastille : vert = muscu · rouge = cardio · dégradé vert/rouge = les deux
      let pillBg, pillTxt;
      if (hasSeance && hasCardio)      { pillBg = 'linear-gradient(90deg,var(--good) 0 50%,var(--bad) 50% 100%)'; pillTxt = 'M+C'; }
      else if (hasSeance)              { pillBg = 'var(--good)'; pillTxt = seanceTypeInfo(hasSeance).abbr; }
      else                             { pillBg = 'var(--bad)';  pillTxt = 'CARDIO'; }
      d.style.cssText = `border-radius:9px;text-align:center;padding:3px 1px 4px;cursor:pointer;background:var(--surface2);${isToday ? 'outline:2px solid var(--accent);outline-offset:-2px;' : ''}`;
      d.title = [hasSeance || '', hasCardio ? 'Cardio' : ''].filter(Boolean).join(' + ');
      d.innerHTML = `<div style="font-size:11px;font-weight:700;color:var(--text);line-height:1.1;">${j}</div><div style="font-size:8.5px;font-weight:800;color:#fff;background:${pillBg};border-radius:5px;padding:1px 0;margin:2px 3px 0;line-height:1.4;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pillTxt}</div>`;
      d.addEventListener('click', () => selectCalDay(dateStr, hasSeance || '', d));
    } else if (isToday) {
      d.style.cssText = 'background:var(--accent);border-radius:9px;text-align:center;padding:5px 2px;font-size:11px;color:var(--on-accent);font-weight:700;';
      d.textContent = j;
    } else if (isFutur) {
      d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--border);';
      d.textContent = j;
    } else {
      d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--text);';
      d.textContent = j;
    }
    grid.appendChild(d);
  }

  // Cases vides après
  const total = debutOffset + dernierJour.getDate();
  const reste = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= reste; i++) {
    const d = document.createElement('div');
    d.style.cssText = 'text-align:center;padding:5px 2px;font-size:11px;color:var(--border);';
    d.textContent = i;
    grid.appendChild(d);
  }
}

function calNaviguer(direction) {
  calDate.setMonth(calDate.getMonth() + direction);
  renderCalendrier();
}

function calc1RM(charge, reps) {
  if (!charge || !reps) return null;
  return Math.round(charge * (1 + reps / 30) * 10) / 10;
}

// ===== Dashboard data-viz : records perso + heatmap d'activité =====
// Sparkline poids (SVG inline) — data.poids est trié du plus récent au plus ancien
function renderPoidsSpark(poids) {
  const el = document.getElementById('dash-poids-spark');
  if (!el) return;
  const pts = (poids || []).map(p => parseFloat(p.poids)).filter(v => !isNaN(v)).reverse();
  if (pts.length < 2) { el.innerHTML = ''; return; }
  const W = 190, H = 60, min = Math.min(...pts), max = Math.max(...pts), span = (max - min) || 1;
  const x = i => (i / (pts.length - 1)) * W;
  const y = v => H - 6 - ((v - min) / span) * (H - 14);
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' L');
  const lastX = x(pts.length - 1).toFixed(1), lastY = y(pts[pts.length - 1]).toFixed(1);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="60" preserveAspectRatio="none">
    <defs><linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".26"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    <path d="M${line} L${lastX},${H} L0,${H} Z" fill="url(#wgrad)"/>
    <path d="M${line}" fill="none" stroke="var(--accent-strong)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX}" cy="${lastY}" r="3.4" fill="var(--accent-strong)" stroke="var(--surface)" stroke-width="2"/>
  </svg>`;
}

// Barres de volume par muscle (accueil athlète & aperçu coach) — réutilise VOLUME_CIBLE
function renderDashVolumeBars(volumes, targetId) {
  const el = document.getElementById(targetId || 'dash-muscle-content');
  if (!el) return;
  if (!volumes || volumes.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune donnée cette semaine — enregistre une séance !</div>';
    return;
  }
  const niveauKey = getNiveauKey(athlete ? athlete.strategie_progression : null);
  const rows = volumes.slice().sort((a,b) => (b.faites||0)-(a.faites||0)).map(v => {
    const cible = VOLUME_CIBLE[v.muscle] ? VOLUME_CIBLE[v.muscle][niveauKey] : [10,14];
    const optimal = cible[1], faites = v.faites || 0;
    const pct = optimal > 0 ? Math.min(100, Math.round(faites/optimal*100)) : 0;
    const col = faites >= optimal ? 'var(--good)' : faites > 0 ? 'var(--warn)' : 'var(--v2-bad)';
    return `<div class="v2-vrow"><div class="vn">${v.muscle}</div><div class="v2-vtrack"><div class="v2-vfill" style="width:${Math.max(pct,4)}%;background:${col};"></div></div><div class="vv">${faites}/${optimal}</div></div>`;
  }).join('');
  el.innerHTML = rows + `<div class="v2-legend"><span><span class="v2-dot" style="background:var(--good)"></span>Optimal</span><span><span class="v2-dot" style="background:var(--warn)"></span>Sous la cible</span><span><span class="v2-dot" style="background:var(--v2-bad)"></span>En retard</span></div>`;
}

function renderDashboardRecords(hist) {
  const card = document.getElementById('dash-records-card');
  const el = document.getElementById('dash-records');
  const sec = document.getElementById('dash-records-sec');
  if (!card || !el) return;
  const records = calculerRecords(hist);
  if (records.length === 0) { card.style.display = 'none'; if (sec) sec.style.display = 'none'; return; }
  card.style.display = ''; if (sec) sec.style.display = 'flex';
  el.innerHTML = records.slice(0, 5).map((r, i, arr) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < arr.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
      <div style="width:22px;height:22px;border-radius:50%;background:var(--accent-a12);color:var(--accent);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.exo}</div>
        <div style="font-size:11px;color:var(--text-muted);">${r.reps} reps · ${r.date}</div>
      </div>
      <div style="font-size:16px;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;flex-shrink:0;">${r.charge}<span style="font-size:10px;color:var(--text-muted);font-weight:600;">kg</span></div>
    </div>`).join('');
}

// Record = meilleure charge réellement soulevée (à charge égale, le plus de reps). Pas le 1RM.
function calculerRecords(hist) {
  const prog = (hist && hist.progression_par_exo) || {};
  const records = [];
  Object.keys(prog).forEach(exo => {
    let best = null;
    (prog[exo] || []).forEach(p => {
      if (!p || !(p.charge > 0)) return; // ignore poids de corps / charge nulle
      if (!best || p.charge > best.charge || (p.charge === best.charge && p.reps > best.reps)) {
        best = { charge: p.charge, reps: p.reps, date: p.date };
      }
    });
    if (best) records.push(Object.assign({ exo }, best));
  });
  records.sort((a, b) => b.charge - a.charge || b.reps - a.reps);
  return records;
}

function renderDashboardActivite(hist) {
  const card = document.getElementById('dash-activite-card');
  const el = document.getElementById('dash-activite');
  if (!card || !el) return;
  const dates = (hist && hist.dates_seances) || {};
  const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const trained = new Set();
  Object.keys(dates).forEach(k => {
    const parts = String(k).split('/');
    if (parts.length === 3) trained.add(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
  });
  const secA = document.getElementById('dash-activite-sec');
  if (trained.size === 0) { card.style.display = 'none'; if (secA) secA.style.display = 'none'; return; }
  card.style.display = ''; if (secA) secA.style.display = 'flex';
  // Intensité par tonnage du jour (volume_par_jour est déjà en ISO yyyy-mm-dd)
  const volMap = (hist && hist.volume_par_jour) || {};
  let maxVol = 0; Object.keys(volMap).forEach(k => { if (volMap[k] > maxVol) maxVol = volMap[k]; });
  const niveau = iso => {
    if (volMap[iso] != null && maxVol > 0) {
      const r = volMap[iso] / maxVol;
      return r > 0.75 ? '1' : r > 0.5 ? '0.72' : r > 0.25 ? '0.5' : '0.32';
    }
    return trained.has(iso) ? '0.6' : null; // séance sans tonnage connu
  };
  const WEEKS = 12;
  const MOIS = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
  const JOURS = ['Lun', '', 'Mer', '', 'Ven', '', ''];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(today); start.setDate(today.getDate() - dow - (WEEKS - 1) * 7);
  let cols = '', moisRow = '', prevMois = -1;
  for (let w = 0; w < WEEKS; w++) {
    const firstDay = new Date(start); firstDay.setDate(start.getDate() + w * 7);
    const mo = firstDay.getMonth();
    moisRow += `<div style="width:13px;font-size:9px;color:var(--text-muted);white-space:nowrap;overflow:visible;font-weight:600;">${mo !== prevMois ? MOIS[mo] : ''}</div>`;
    prevMois = mo;
    let cells = '';
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start); cur.setDate(start.getDate() + w * 7 + d);
      const iso = isoLocal(cur);
      let bg = 'var(--surface2)', op = '1';
      if (cur > today) { bg = 'transparent'; }
      else { const lv = niveau(iso); if (lv) { bg = 'var(--accent)'; op = lv; } }
      const vt = volMap[iso] != null ? ' · ' + Math.round(volMap[iso]) + ' kg soulevés' : '';
      cells += `<div title="${iso}${vt}" style="width:13px;height:13px;border-radius:3px;background:${bg};opacity:${op};"></div>`;
    }
    cols += `<div style="display:grid;grid-template-rows:repeat(7,13px);gap:3px;">${cells}</div>`;
  }
  const joursCol = JOURS.map(j => `<div style="height:13px;line-height:13px;font-size:9px;color:var(--text-muted);text-align:right;">${j}</div>`).join('');
  const hasVol = maxVol > 0;
  const swatch = o => `<div style="width:11px;height:11px;border-radius:3px;background:var(--accent);opacity:${o};"></div>`;
  const legende = hasVol
    ? `<span>Faible</span>${swatch('0.32')}${swatch('0.5')}${swatch('0.72')}${swatch('1')}<span>Intense</span>`
    : `<div style="width:11px;height:11px;border-radius:3px;background:var(--surface2);"></div><span>Repos</span><div style="width:11px;height:11px;border-radius:3px;background:var(--accent);margin-left:6px;"></div><span>Séance</span>`;
  el.innerHTML = `
    <div style="display:flex;gap:6px;">
      <div style="display:grid;grid-template-rows:repeat(7,13px);gap:3px;padding-top:16px;flex-shrink:0;">${joursCol}</div>
      <div style="overflow-x:auto;padding-bottom:2px;">
        <div style="display:flex;gap:3px;margin-bottom:3px;height:13px;">${moisRow}</div>
        <div style="display:flex;gap:3px;">${cols}</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:10px;color:var(--text-muted);">${legende}</div>`;
}

// Résout une couleur CSS (var(--x) ou hex) en rgba pour le canvas
function _cssColor(c) {
  c = (c || '').trim();
  if (c.startsWith('var(')) {
    const name = c.slice(4, -1).trim();
    c = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2f7bff';
  }
  return c || '#2f7bff';
}
function _hexA(hex, a) {
  hex = _cssColor(hex);
  if (hex[0] !== '#') return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function drawLineChart(canvasId, values, color, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values || values.length === 0) return;
  opts = opts || {};
  color = _cssColor(color);
  const muted = _cssColor('var(--text-muted)');
  const gridC = _cssColor('var(--border)');
  const unit = opts.unit || '';
  const xLabels = opts.xLabels || null;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const padL = 40, padR = 12, padTop = 14, padBot = xLabels ? 20 : 12;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const plotW = w - padL - padR, plotH = h - padTop - padBot;
  const baseY = padTop + plotH;
  const toX = i => padL + (values.length === 1 ? plotW / 2 : i * plotW / (values.length - 1));
  const toY = v => padTop + (1 - (v - min) / range) * plotH;
  ctx.font = '10px Inter, "Helvetica Neue", sans-serif';
  // Grille horizontale + valeurs Y (max / milieu / min)
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  [max, (max + min) / 2, min].forEach(val => {
    const y = toY(val);
    ctx.strokeStyle = gridC; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = muted; ctx.fillText(Math.round(val) + unit, padL - 6, y);
  });
  const pts = values.map((v, i) => ({ x: toX(i), y: toY(v) }));
  if (values.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  } else {
    const trace = () => {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        ctx.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
      }
    };
    const grad = ctx.createLinearGradient(0, padTop, 0, baseY);
    grad.addColorStop(0, _hexA(color, 0.30));
    grad.addColorStop(1, _hexA(color, 0));
    trace();
    ctx.lineTo(pts[pts.length - 1].x, baseY); ctx.lineTo(pts[0].x, baseY); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    trace();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
    const last = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(last.x, last.y, 7, 0, Math.PI * 2); ctx.fillStyle = _hexA(color, 0.22); ctx.fill();
    ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(last.x, last.y, 4, 0, Math.PI * 2); ctx.strokeStyle = _cssColor('var(--surface)'); ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Dates aux extrémités (axe X)
  if (xLabels && xLabels.length) {
    ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left'; ctx.fillText(xLabels[0], padL, h - 5);
    if (xLabels.length > 1) { ctx.textAlign = 'right'; ctx.fillText(xLabels[xLabels.length - 1], w - padR, h - 5); }
  }
}

function compterSemaines(perfs) {
  const semSet = new Set();
  perfs.forEach(p => {
    const d = p.date ? new Date(p.date.split('/').reverse().join('-')) : null;
    if (!d || isNaN(d)) return;
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const lundi = new Date(d); lundi.setDate(d.getDate() - day);
    semSet.add(lundi.toISOString().slice(0, 10));
  });
  return semSet.size;
}

function renderProg12Semaines(perfs) {
  // Regroupe les perfs par semaine ISO, prend le max charge de chaque semaine
  const semMap = {};
  perfs.forEach(p => {
    const d = p.date ? new Date(p.date.split('/').reverse().join('-')) : null;
    if (!d || isNaN(d)) return;
    // Clé semaine : lundi de la semaine
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0=lundi
    const lundi = new Date(d); lundi.setDate(d.getDate() - day);
    const key = lundi.toISOString().slice(0, 10);
    if (!semMap[key] || p.charge > semMap[key].charge)
      semMap[key] = { key, charge: p.charge, reps: p.reps, date: p.date };
  });

  const semaines = Object.values(semMap).sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  if (semaines.length < 1) return ''; // pas assez de données

  const n = semaines.length;
  const label = n < 12 ? `Progression · ${n} semaine${n > 1 ? 's' : ''}` : 'Progression · 12 semaines';
  const first = semaines[0], last = semaines[n - 1];
  const diff = last.charge - first.charge;
  const diffPct = first.charge > 0 ? Math.round(diff / first.charge * 100) : 0;
  const col = diff > 0 ? 'var(--good)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const signe = diff > 0 ? '+' : '';

  // SVG inline — si 1 seule semaine, pas de courbe mais on affiche quand même les tiles
  if (n === 1) {
    return `<div style="margin-bottom:14px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px;">Progression · 1 semaine</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center;">
          <div style="font-size:15px;font-weight:800;color:var(--accent);">${semaines[0].charge}<span style="font-size:9px;color:var(--text-muted);font-weight:600;">kg</span></div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-top:3px;">Charge max</div>
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center;">
          <div style="font-size:15px;font-weight:800;">${semaines[0].reps}<span style="font-size:9px;color:var(--text-muted);font-weight:600;">reps</span></div>
          <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-top:3px;">Reps max</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);">La courbe apparaîtra dès la 2ème semaine d'entraînement.</div>
    </div>`;
  }

  const W = 320, H = 120;
  const PAD = { top: 18, right: 40, bottom: 8, left: 36 };
  const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;
  const vals = semaines.map(s => s.charge);
  const minV = Math.min(...vals) - 2.5, maxV = Math.max(...vals) + 2.5;
  const xp = i => PAD.left + (i / (n - 1)) * iW;
  const yp = v => PAD.top + (1 - (v - minV) / (maxV - minV)) * iH;

  // 3 guides horizontaux avec valeur + "kg"
  const guides = [minV + 2.5, (minV + maxV) / 2, maxV - 2.5].map(v => Math.round(v * 2) / 2);
  const guidesSVG = guides.map(v => {
    const y = yp(v);
    return `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="rgba(128,128,180,.12)" stroke-width="1" stroke-dasharray="3,3"/>
            <text x="${PAD.left - 5}" y="${y + 3.5}" text-anchor="end" fill="rgba(136,136,170,.75)" font-size="8.5" font-weight="600">${v}kg</text>`;
  }).join('');

  // Aire
  const pts = semaines.map((s, i) => `${xp(i)},${yp(s.charge)}`).join(' ');
  const areaPts = `${xp(0)},${PAD.top + iH} ${pts} ${xp(n - 1)},${PAD.top + iH}`;

  // Ligne
  const linePath = semaines.map((s, i) => `${i === 0 ? 'M' : 'L'}${xp(i)},${yp(s.charge)}`).join(' ');

  // Dots + étiquettes valeur sur premier, dernier et points de changement
  const dots = semaines.map((s, i) => {
    const isFirst = i === 0;
    const isLast  = i === n - 1;
    const changed = i > 0 && s.charge !== semaines[i - 1].charge;
    const showVal = isFirst || isLast || changed;
    const r = (isFirst || isLast) ? 5 : 3;
    const stroke = (isFirst || isLast) ? `stroke="var(--surface2)" stroke-width="2"` : '';
    const cx = xp(i), cy = yp(s.charge);
    // Étiquette : au-dessus sauf si très haut → en dessous
    const lblY = cy < PAD.top + 14 ? cy + 14 : cy - 8;
    const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
    const lbl = showVal
      ? `<text x="${cx}" y="${lblY}" text-anchor="${anchor}" fill="var(--accent)" font-size="9" font-weight="800">${s.charge}kg</text>`
      : '';
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--accent)" ${stroke}/>${lbl}`;
  }).join('');

  // Labels X : vraie date de la séance, max 5 labels
  const step = Math.max(1, Math.ceil(n / 5));
  const xLabels = semaines.map((s, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    // s.date est au format jj/mm/aaaa
    const parts = s.date ? s.date.split('/') : null;
    const lbl = parts ? `${parts[0]}/${parts[1]}` : '';
    return `<text x="${xp(i)}" y="${H + 13}" text-anchor="${i === 0 ? 'start' : i === n-1 ? 'end' : 'middle'}" fill="rgba(136,136,170,.75)" font-size="8.5" font-weight="600">${lbl}</text>`;
  }).join('');

  // Badge progression moyenne
  const avgPerSem = n > 1 ? Math.round((diff / (n - 1)) * 10) / 10 : 0;
  const badgeCol = diff > 0 ? '#00c96e' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';
  const badgeBg  = diff > 0 ? 'rgba(0,201,110,.1)' : diff < 0 ? 'rgba(229,72,77,.1)' : 'var(--surface2)';
  const arrow    = diff > 0 ? '↗' : diff < 0 ? '↘' : '→';

  return `
  <div style="margin-bottom:14px;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px;">${label}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-bottom:12px;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center;">
        <div style="font-size:15px;font-weight:800;">${first.charge}<span style="font-size:9px;color:var(--text-muted);font-weight:600;">kg</span></div>
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-top:3px;">Départ</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center;">
        <div style="font-size:15px;font-weight:800;color:var(--accent);">${last.charge}<span style="font-size:9px;color:var(--text-muted);font-weight:600;">kg</span></div>
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-top:3px;">Actuel</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 6px;text-align:center;">
        <div style="font-size:15px;font-weight:800;color:${col};">${signe}${diff}<span style="font-size:9px;font-weight:600;">kg</span></div>
        <div style="font-size:9px;color:${col};font-weight:700;margin-top:3px;">${signe}${diffPct}%</div>
      </div>
    </div>
    <div style="position:relative;width:100%;padding-bottom:24px;">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;overflow:visible;" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g12" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity=".18"/>
            <stop offset="100%" stop-color="var(--accent)" stop-opacity=".01"/>
          </linearGradient>
        </defs>
        ${guidesSVG}
        <polygon points="${areaPts}" fill="url(#g12)"/>
        <path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        ${xLabels}
        <!-- Légende -->
        <circle cx="${PAD.left + 4}" cy="${PAD.top - 8}" r="3.5" fill="var(--accent)"/>
        <text x="${PAD.left + 10}" y="${PAD.top - 4}" fill="rgba(136,136,170,.85)" font-size="8.5" font-weight="600">Charge max / semaine</text>
      </svg>
    </div>
    <div style="display:inline-flex;align-items:center;gap:5px;background:${badgeBg};border:1px solid ${badgeCol}33;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;color:${badgeCol};">
      ${arrow} ${diff !== 0 ? `${signe}${avgPerSem} kg/semaine en moyenne` : 'Charge stable sur la période'}
    </div>
  </div>`;
}

function afficherProgressionExo() {
  const exo = document.getElementById('sel-hist-exercice').value;
  const el = document.getElementById('hist-progression-content');
  if (!exo || !progressionData[exo]) { el.innerHTML = ''; return; }

  const perfs = progressionData[exo];
  if (perfs.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune donnée</div>';
    return;
  }

  // Calculer progression globale
  const first = perfs[perfs.length - 1];
  const last = perfs[0];
  const diffCharge = last.charge - first.charge;
  const diffReps = last.reps - first.reps;
  const progGlobale = diffCharge > 0 ? `+${diffCharge}kg` : diffReps > 0 ? `+${diffReps} reps` : 'Stable';
  const progCouleur = diffCharge > 0 || diffReps > 0 ? '#00c96e' : 'var(--text-muted)';

  const rm1Last = calc1RM(last.charge, last.reps);
  const rm1First = calc1RM(first.charge, first.reps);
  const rm1Diff = (rm1Last !== null && rm1First !== null) ? Math.round((rm1Last - rm1First) * 10) / 10 : null;

  const aSemaines12 = compterSemaines(perfs) >= 2;
  el.innerHTML = renderProg12Semaines(perfs) + `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:8px;">
      <span style="font-size:12px;color:var(--text-muted);">Progression totale</span>
      <span style="font-size:13px;font-weight:700;color:${progCouleur};">${progGlobale}</span>
    </div>
    ${rm1Last !== null ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:8px;background:var(--surface2);border-radius:8px;">
      <span style="font-size:12px;color:var(--text-muted);">1RM estimé (Epley)</span>
      <span style="font-size:13px;font-weight:700;color:var(--accent);">${rm1Last}kg ${rm1Diff !== null && rm1Diff !== 0 ? `<span style="color:${rm1Diff > 0 ? '#00c96e' : 'var(--danger)'};font-size:11px;">(${rm1Diff > 0 ? '+' : ''}${rm1Diff}kg)</span>` : ''}</span>
    </div>` : ''}
    ${aSemaines12 ? '' : `<div style="display:flex;gap:6px;margin-bottom:8px;">
      <button id="pce-charge" onclick="dessinerProgChartExo('charge')" style="background:var(--accent);color:var(--on-accent);border:none;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">Charge</button>
      <button id="pce-1rm" onclick="dessinerProgChartExo('1rm')" style="background:var(--surface2);color:var(--text-muted);border:none;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:700;cursor:pointer;">1RM est.</button>
    </div>
    <canvas id="chart-1rm-athlete" style="width:100%;height:108px;display:block;margin-bottom:10px"></canvas>`}
    <table style="width:100%;font-size:12px;border-collapse:collapse;">
      <tr style="color:var(--text-muted);font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border);">
        <td style="padding:5px 0;">Date</td>
        <td style="padding:5px 0;text-align:center;">Séance</td>
        <td style="padding:5px 0;text-align:center;">Charge</td>
        <td style="padding:5px 0;text-align:center;">Reps</td>
        <td style="padding:5px 0;text-align:center;">1RM est.</td>
        <td style="padding:5px 0;text-align:center;">Évol.</td>
      </tr>
      ${perfs.map((p, i) => {
        const prev = perfs[i+1];
        let evol = '—';
        let evolColor = 'var(--text-muted)';
        if (prev) {
          if (p.charge > prev.charge) { evol = '↑'; evolColor = '#00c96e'; }
          else if (p.charge < prev.charge) { evol = '↓'; evolColor = 'var(--danger)'; }
          else if (p.reps > prev.reps) { evol = '↑'; evolColor = '#c8f000'; }
          else if (p.reps < prev.reps) { evol = '↓'; evolColor = 'var(--danger)'; }
          else { evol = '='; evolColor = 'var(--text-muted)'; }
        }
        const isLast = i === 0;
        const rm1 = calc1RM(p.charge, p.reps);
        return `<tr style="border-bottom:1px solid var(--surface2);${isLast ? 'font-weight:700;' : ''}">
          <td style="padding:6px 0;color:var(--text);">${p.date}</td>
          <td style="padding:6px 0;text-align:center;color:var(--text-muted);font-size:11px;">${p.seance.substring(0,8)}</td>
          <td style="padding:6px 0;text-align:center;color:${isLast ? 'var(--accent)' : 'var(--text)'};">${p.charge}kg</td>
          <td style="padding:6px 0;text-align:center;color:${isLast ? 'var(--accent)' : 'var(--text)'};">${p.reps}</td>
          <td style="padding:6px 0;text-align:center;color:var(--text-muted);font-size:11px;">${rm1 !== null ? rm1 + 'kg' : '—'}</td>
          <td style="padding:6px 0;text-align:center;color:${evolColor};font-size:16px;font-weight:700;">${evol}</td>
        </tr>`;
      }).join('')}
    </table>`;
  progExoChrono = perfs.slice().reverse();
  dessinerProgChartExo('charge');
  setTimeout(() => {
    const card = el.closest('.card');
    const sec = card && card.previousElementSibling;
    scrollVersTitre(sec || card || el);
  }, 50);
}

// Trace le graphique de progression selon le mode choisi (charge réelle ou 1RM estimé)
let progExoChrono = null;
function dessinerProgChartExo(mode) {
  if (!progExoChrono || !progExoChrono.length) return;
  const c = progExoChrono;
  const vals = c.map(p => mode === '1rm' ? calc1RM(p.charge, p.reps) : p.charge).filter(v => v !== null && v !== undefined);
  drawLineChart('chart-1rm-athlete', vals, 'var(--accent)', { unit: 'kg', xLabels: [c[0] && c[0].date, c[c.length - 1] && c[c.length - 1].date] });
  [['pce-charge', 'charge'], ['pce-1rm', '1rm']].forEach(([id, mo]) => {
    const btn = document.getElementById(id);
    if (btn) { const on = mo === mode; btn.style.background = on ? 'var(--accent)' : 'var(--surface2)'; btn.style.color = on ? 'var(--on-accent)' : 'var(--text-muted)'; }
  });
}

// Volume cible par muscle selon niveau
const VOLUME_CIBLE = {
  'Pectoraux':   { debutant: [8,12],  intermediaire: [12,16], experimente: [16,20] },
  'Dos':         { debutant: [8,12],  intermediaire: [14,18], experimente: [18,22] },
  'Epaule':      { debutant: [8,12],  intermediaire: [12,16], experimente: [16,20] },
  'Biceps':      { debutant: [6,10],  intermediaire: [10,14], experimente: [14,20] },
  'Triceps':     { debutant: [6,10],  intermediaire: [10,14], experimente: [12,18] },
  'Quadriceps':  { debutant: [8,12],  intermediaire: [12,16], experimente: [16,20] },
  'Ischio':      { debutant: [6,10],  intermediaire: [10,14], experimente: [12,18] },
  'Fessier':     { debutant: [8,12],  intermediaire: [12,16], experimente: [14,20] },
  'Mollets':     { debutant: [8,12],  intermediaire: [12,16], experimente: [16,20] },
  'Abdominaux':  { debutant: [6,10],  intermediaire: [10,14], experimente: [14,20] },
  'Jambe':       { debutant: [8,12],  intermediaire: [12,16], experimente: [16,20] },
  'Aducteur':    { debutant: [6,10],  intermediaire: [10,14], experimente: [12,18] },
};

function getNiveauKey(strategie) {
  if (!strategie) return 'intermediaire';
  if (strategie.includes('linéaire')) return 'debutant';
  if (strategie.includes('avancée')) return 'experimente';
  return 'intermediaire';
}

function afficherTendances(semaines) {
  const el = document.getElementById('hist-tendances-content');
  if (!el) return;

  // Update buttons
  document.getElementById('btn-tend-4').style.background = semaines === 4 ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('btn-tend-4').style.color = semaines === 4 ? '#000' : 'var(--text-muted)';
  document.getElementById('btn-tend-8').style.background = semaines === 8 ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('btn-tend-8').style.color = semaines === 8 ? '#000' : 'var(--text-muted)';

  if (!tendancesData) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Pas assez de données</div>';
    return;
  }

  const t = semaines === 4 ? tendancesData.s4 : tendancesData.s8;
  if (!t) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Pas assez de données sur cette période</div>';
    return;
  }

  const statutColor = t.statut === 'positif' ? '#00c96e' : t.statut === 'plateau' ? '#f59f00' : 'var(--danger)';
  const statutLabel = t.statut === 'positif' ? '🟢 Adaptation positive' : t.statut === 'plateau' ? '⚠️ Plateau' : '🔴 Régression';
  const statutDesc = t.statut === 'positif' ? 'Volume et charges en progression' : t.statut === 'plateau' ? 'Charges stables depuis plusieurs semaines' : 'Charges en baisse ou RPE en forte hausse';

  const ligne = (label, valDebut, valFin, unite, up) => {
    const diff = valFin - valDebut;
    const pct = valDebut > 0 ? Math.round(diff/valDebut*100) : 0;
    const couleur = up === null ? 'var(--text-muted)' : (up ? '#00c96e' : 'var(--danger)');
    const signe = pct > 0 ? '+' : '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--surface2);">
        <div>
          <div style="font-size:12px;font-weight:700;">${label}</div>
          <div style="font-size:11px;color:var(--text-muted);">${valDebut}${unite} → ${valFin}${unite}</div>
        </div>
        <span style="background:${couleur}1a;color:${couleur};border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;">${signe}${pct}%</span>
      </div>`;
  };

  el.innerHTML = `
    ${ligne('Volume hebdo', t.volume_debut, t.volume_fin, ' séries', t.volume_fin >= t.volume_debut)}
    ${ligne('RPE moyen', t.rpe_debut, t.rpe_fin, '', null)}
    ${ligne('Charge moyenne S1', t.charge_debut, t.charge_fin, 'kg', t.charge_fin >= t.charge_debut)}
    <div style="background:${statutColor}1a;border-radius:8px;padding:10px 12px;margin-top:10px;display:flex;align-items:center;gap:10px;">
      <div>
        <div style="font-size:12px;font-weight:700;color:${statutColor};">${statutLabel}</div>
        <div style="font-size:11px;color:${statutColor};opacity:0.8;margin-top:2px;">${statutDesc}</div>
      </div>
    </div>
  `;
}

// Rendu unifié « Volume par muscle » (Option A) — utilisé côté athlète ET coach.
// volumes: [{muscle, faites}], targetId: conteneur, niveauKey: 'debutant'|'intermediaire'|'experimente',
// muscleRetard: {muscle, series_faites, series_min, series_optimale} ou null (bandeau).
function renderVolumeOptionA(volumes, targetId, niveauKey, muscleRetard) {
  const el = document.getElementById(targetId);
  if (!el) return;
  if (!volumes || volumes.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune donnée cette semaine</div>';
    return;
  }
  const niveauLabel = niveauKey === 'debutant' ? 'Débutant' : niveauKey === 'experimente' ? 'Expérimenté' : 'Intermédiaire';
  const rowsVol = volumes.slice().sort((a,b)=>(b.faites||0)-(a.faites||0)).map(v => {
    const cible = VOLUME_CIBLE[v.muscle] ? VOLUME_CIBLE[v.muscle][niveauKey] : [10, 14];
    return { muscle: v.muscle, optimal: cible[1], faites: v.faites || 0 };
  });
  const scaleMax = Math.max(1, ...rowsVol.map(r => Math.max(r.optimal, r.faites)));
  let banner = '';
  if (muscleRetard && muscleRetard.muscle) {
    banner = `<div style="background:rgba(245,159,0,0.12);border:1px solid rgba(245,159,0,0.35);border-radius:8px;padding:8px 11px;margin-bottom:10px;display:flex;align-items:center;gap:8px;"><span style="font-size:14px;">⚠️</span><div><div style="font-size:11px;font-weight:700;color:var(--warn);">${muscleRetard.muscle} en retard <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-left:4px;">Historique global</span></div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${muscleRetard.series_faites} séries / ${muscleRetard.series_min} min · objectif ${muscleRetard.series_optimale} séries</div></div></div>`;
  }
  el.innerHTML = banner
    + `<div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;">Niveau : <strong style="color:var(--accent)">${niveauLabel}</strong></div>`
    + rowsVol.map(r => {
        const wf = Math.min(100, r.faites / scaleMax * 100);
        const wo = Math.min(100, r.optimal / scaleMax * 100);
        const couleur = r.faites >= r.optimal ? 'var(--good)' : r.faites > 0 ? 'var(--warn)' : 'var(--v2-bad)';
        return `<div class="v2-vrow"><div class="vn">${r.muscle}</div><div class="v2-vtrack" style="position:relative;overflow:visible;"><div class="v2-vfill" style="width:${Math.max(wf,2)}%;background:${couleur};"></div><div style="position:absolute;top:-3px;left:${wo}%;width:2px;height:calc(100% + 6px);background:var(--text);opacity:.5;border-radius:2px;" title="Objectif ${r.optimal}"></div></div><div class="vv" style="color:${couleur}">${r.faites}/${r.optimal}</div></div>`;
      }).join('')
    + `<div class="v2-legend"><span><span class="v2-dot" style="background:var(--good)"></span>Optimal</span><span><span class="v2-dot" style="background:var(--warn)"></span>Sous la cible</span><span><span class="v2-dot" style="background:var(--v2-bad)"></span>En retard</span><span><span style="display:inline-block;width:2px;height:11px;background:var(--text);opacity:.5;border-radius:2px;"></span>Objectif</span></div>`;
}

function afficherVolumeMuscle(volumes) {
  const mr = (dernierAppData && dernierAppData.global) ? dernierAppData.global.muscle_retard : null;
  renderVolumeOptionA(volumes, 'hist-volume-content', getNiveauKey(athlete ? athlete.strategie_progression : null), mr);
}

// ==================== BALANCE MUSCULAIRE AGONISTE/ANTAGONISTE ====================
const PAIRES_AGONISTE = [
  { a: 'Pectoraux', b: 'Dos',       label: 'Poussée / Tirage (haut)' },
  { a: 'Biceps',    b: 'Triceps',   label: 'Biceps / Triceps' },
  { a: 'Quadriceps',b: 'Ischio',    label: 'Quad / Ischio-jambiers' },
];

function renderBilanBalance(volumes, targetId) {
  const el = document.getElementById(targetId || 'hist-balance-content');
  if (!el) return;
  if (!volumes || volumes.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune donnée cette semaine</div>';
    return;
  }
  const map = {};
  volumes.forEach(v => { map[v.muscle] = v.faites || 0; });

  const rows = PAIRES_AGONISTE.map(p => {
    const va = map[p.a] || 0, vb = map[p.b] || 0;
    if (va === 0 && vb === 0) return null;
    const total = va + vb;
    const ratioA = total > 0 ? va / total : 0.5; // proportion de A dans la paire
    const pctA = Math.round(ratioA * 100);
    // Idéal ≈ 50%. On tolère 40-60% (vert), 30-70% (orange), hors = rouge
    const ecart = Math.abs(ratioA - 0.5);
    const col = ecart <= 0.10 ? 'var(--good)' : ecart <= 0.20 ? 'var(--warn)' : 'var(--danger)';
    const msg = ecart <= 0.10 ? 'Équilibré'
              : ecart <= 0.20 ? (ratioA > 0.5 ? p.a + ' dominant' : p.b + ' dominant')
              : (ratioA > 0.5 ? '⚠️ ' + p.a + ' trop dominant' : '⚠️ ' + p.b + ' trop dominant');
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:12px;font-weight:700;color:var(--text);">${p.label}</div>
          <span style="font-size:10px;font-weight:700;color:${col};background:${col}1a;border-radius:5px;padding:2px 7px;">${msg}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="font-size:10px;color:var(--text-muted);min-width:68px;text-align:right;">${p.a} ${va}s</div>
          <div style="flex:1;height:10px;border-radius:5px;background:var(--surface2);overflow:hidden;position:relative;">
            <div style="position:absolute;left:0;top:0;height:100%;width:${pctA}%;background:var(--accent);border-radius:5px 0 0 5px;transition:width .4s;"></div>
            <div style="position:absolute;left:50%;top:-2px;width:2px;height:calc(100%+4px);background:var(--text);opacity:.35;border-radius:2px;"></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);min-width:68px;">${p.b} ${vb}s</div>
        </div>
        <div style="display:flex;justify-content:space-between;padding:0 74px;margin-top:2px;">
          <span style="font-size:9px;color:var(--text-muted);">${pctA}%</span>
          <span style="font-size:9px;color:var(--text-muted);">${100-pctA}%</span>
        </div>
      </div>`;
  }).filter(Boolean);

  if (rows.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Travaille les deux membres d\'une paire cette semaine pour voir la balance.</div>';
    return;
  }
  el.innerHTML = '<div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;">Idéal : barre centrée à 50% entre chaque paire agoniste/antagoniste. Séries de la semaine.</div>'
    + rows.join('');
}

// ==================== CORRÉLATION BIEN-ÊTRE × PERFORMANCE ====================
function renderCorrelationBienEtre(bienEtreArr, volumeParJour) {
  const sec  = document.getElementById('hist-corr-sec');
  const card = document.getElementById('hist-corr-card');
  const el   = document.getElementById('hist-corr-content');
  if (!el) return;

  const be = Array.isArray(bienEtreArr) ? bienEtreArr : [];
  const vpj = volumeParJour || {};
  if (be.length < 5 || Object.keys(vpj).length < 5) {
    if (sec) sec.style.display = 'none';
    if (card) card.style.display = 'none';
    return;
  }

  // Pour chaque entrée bien-être, on cherche le tonnage du jour même OU du lendemain
  const DIMS = [
    { key: 'sommeil',  label: 'Sommeil',        badLabel: 'mauvais (≤2)',   goodLabel: 'bon (≥4)',   bad: v => v <= 2, good: v => v >= 4 },
    { key: 'energie',  label: 'Énergie',         badLabel: 'faible (≤2)',    goodLabel: 'élevée (≥4)', bad: v => v <= 2, good: v => v >= 4 },
    { key: 'fatigue',  label: 'Fatigue musculaire', badLabel: 'élevée (≥4)', goodLabel: 'faible (≤2)', bad: v => v >= 4, good: v => v <= 2 },
  ];

  // entry.date arrive en JJ/MM/AAAA (fmtFR côté backend), mais vpj est indexé en
  // AAAA-MM-JJ. On normalise en ISO AVANT tout calcul : new Date('16/08/2026') est
  // une date invalide en JS → toISOString() lève "Invalid time value" et faisait
  // planter tout le chargement dès qu'il y avait ≥5 questionnaires bien-être.
  const toISO = d => {
    const s = String(d || '');
    if (s.indexOf('/') !== -1) { const p = s.split('/'); return p.length === 3 ? p[2] + '-' + p[1].padStart(2,'0') + '-' + p[0].padStart(2,'0') : s.slice(0,10); }
    return s.slice(0, 10);
  };
  const addDay = d => {
    const n = new Date(toISO(d) + 'T00:00:00');
    if (isNaN(n.getTime())) return '';
    n.setDate(n.getDate() + 1);
    return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0') + '-' + String(n.getDate()).padStart(2,'0');
  };

  const rows = DIMS.map(dim => {
    const badVols = [], goodVols = [];
    be.forEach(entry => {
      const val = Number(entry[dim.key]);
      if (!val) return;
      // Cherche tonnage du jour même OU du lendemain (séance après le questionnaire)
      const dSame = toISO(entry.date);
      const dNext = addDay(entry.date);
      const vol = (dNext && vpj[dNext] != null) ? Number(vpj[dNext]) : (vpj[dSame] != null ? Number(vpj[dSame]) : null);
      if (vol == null) return;
      if (dim.bad(val))  badVols.push(vol);
      if (dim.good(val)) goodVols.push(vol);
    });
    if (badVols.length < 2 || goodVols.length < 2) return null;
    const avgBad  = Math.round(badVols.reduce((a,b)=>a+b,0) / badVols.length);
    const avgGood = Math.round(goodVols.reduce((a,b)=>a+b,0) / goodVols.length);
    if (avgGood === 0) return null;
    const diff = Math.round((avgGood - avgBad) / avgGood * 100);
    if (Math.abs(diff) < 5) return null; // écart non significatif
    const col = diff > 0 ? 'var(--good)' : 'var(--danger)';
    const signe = diff > 0 ? '+' : '';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--surface2);">
        <div>
          <div style="font-size:12px;font-weight:700;">${dim.label}</div>
          <div style="font-size:11px;color:var(--text-muted);">${dim.badLabel} → ${avgBad} kg · ${dim.goodLabel} → ${avgGood} kg</div>
        </div>
        <span style="font-size:12px;font-weight:800;color:${col};background:${col}1a;border-radius:6px;padding:3px 9px;flex-shrink:0;">${signe}${diff}%</span>
      </div>`;
  }).filter(Boolean);

  if (rows.length === 0) {
    if (sec) sec.style.display = 'none';
    if (card) card.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = '';
  if (card) card.style.display = '';
  el.innerHTML = '<div style="font-size:10px;color:var(--text-muted);margin-bottom:10px;">Impact de ton état du jour sur le tonnage de la séance suivante (kg déplacés au total).</div>'
    + rows.join('');
}

// ==================== UTILS ====================
async function chargerExercices() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=exercices`);
    const data = await res.json();
    exercicesData = data.exercices || [];
  } catch(e) { exercicesData = []; }
}

function formatDateDisplay(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function selectionnerExoDepuisProgramme(exerciceNom, repsMini, repsMax) {
  document.getElementById('card-liste-seance').style.display = 'none';
  document.getElementById('card-exo-actuel').style.display = 'block';

  const exoData = exercicesData.find(e => e.exercice === exerciceNom);
  const muscle = exoData ? exoData.muscle : '';
  const exoId = exoData ? exoData.exercice_id : exerciceNom;
  const incrementRaw2 = exoData ? exoData.increment_kg : "2.5";
  const increment2 = parseFloat(String(incrementRaw2).replace(',','.').split('/')[0].trim()) || 2.5;
  const perf = getPerf(exerciceNom);

  // Récupérer l'exo si déjà commencé - on continue d'ajouter des séries
  const exoExistant = seance.find(e => e.exerciceNom === exerciceNom);
  if (exoExistant) {
    exoEnCours = exoExistant;
  } else {
    exoEnCours = { muscle, exerciceId: exoId, exerciceNom, series: [] };
    seance.push(exoEnCours);
  }
  exoEnCours._progData = { reps_max: repsMax, reps_mini: repsMini };
  serieNum = exoEnCours.series.length + 1;

  // Mettre à jour l'affichage
  document.getElementById('exo-actuel-nom').textContent = exerciceNom;
  const pProg = programmeSeance.find(p => p.exercice === exerciceNom);
  const partenairesActuel = pProg && pProg.groupe_id ? programmeSeance.filter(o => o !== pProg && o.groupe_id === pProg.groupe_id).map(o => o.exercice) : [];
  document.getElementById('exo-actuel-detail').innerHTML = `${muscle} · ${repsMini}-${repsMax} reps${partenairesActuel.length > 0 ? ` <span style="color:${couleurGroupe(pProg.groupe_id)}">· Superset, alterne avec ${partenairesActuel.join(', ')}</span>` : ''}`;
  document.getElementById('card-exo-actuel').style.display = 'block';
  document.getElementById('card-hors-programme').style.display = 'none';

  if (perf) {
    // Meilleur des 2 dernières séances
    const bestReps = perf.prev_max_reps !== null ? Math.max(perf.max_reps, perf.prev_max_reps) : perf.max_reps;
    const bestCharge = perf.prev_charge !== null ? Math.max(perf.last_charge, perf.prev_charge) : perf.last_charge;
    const isDiff = perf.max_reps < bestReps || perf.last_charge < bestCharge;
    const cible = bestReps < repsMax ? bestReps + 1 : repsMax;

    document.getElementById('exo-actuel-perf').innerHTML =
      `Dernière fois : <strong style="color:${isDiff ? 'var(--danger)' : 'var(--text)'}">${perf.last_charge}kg × ${perf.max_reps} reps</strong>
       ${isDiff ? `<br><span style="color:var(--text-muted);font-size:11px">Meilleure réf : ${bestCharge}kg × ${bestReps} reps</span>` : ''}`;
    document.getElementById('exo-actuel-cible').innerHTML = `${ic('target')} Cible : ${bestCharge}kg × ${cible} reps`;
    document.getElementById('inp-charge').value = bestCharge;
    document.getElementById('inp-reps').value = cible;
  } else {
    document.getElementById('exo-actuel-perf').innerHTML = '<span style="color:var(--text-muted)">Premier essai</span>';
    document.getElementById('exo-actuel-cible').innerHTML = `${ic('target')} Objectif : ${repsMini}-${repsMax} reps`;
    document.getElementById('inp-charge').value = '';
    document.getElementById('inp-reps').value = repsMini;
  }

  if (perf) {
    const stratProg = athlete ? athlete.strategie_progression : 'Progression linéaire';
    const pseudoProgP = { reps_max: repsMax, reps_mini: repsMini };
    const bestChargeP = perf.prev_charge !== null ? Math.max(perf.last_charge, perf.prev_charge) : perf.last_charge;
    const dernRpeProg = exoEnCours && exoEnCours.series.length > 0 ? exoEnCours.series[exoEnCours.series.length - 1].rpe : null;
    const suggProg = calculerSurcharge(stratProg, perf, pseudoProgP, bestChargeP, increment2, dernRpeProg);
    document.getElementById('exo-actuel-suggestion').innerHTML = suggProg
      ? `<div class="prog-suggestion" style="margin-top:6px">${suggProg}</div>` : '';
  } else {
    document.getElementById('exo-actuel-suggestion').innerHTML = '';
  }
  majSeriesActuel();
  setTimeout(() => { const c = document.getElementById('card-exo-actuel'); if (c) scrollVersTitre(c); }, 50);
  showToast('✅ ' + exerciceNom + ' sélectionné');
}

// ==================== CHARGEMENT PRINCIPAL ====================

// Applique un snapshot getAppData à l'UI (cache local OU réseau).
// Exécute un rendu de façon isolée : si un bloc du tableau de bord plante (donnée
// mal formée, etc.), on log l'erreur et on continue les autres blocs — un seul
// widget cassé ne doit plus jamais bloquer tout le chargement de l'app.
function _safe(label, fn) {
  try { fn(); } catch (e) { console.error('Rendu « ' + label + ' » a échoué :', e); }
}

function _appliquerAppData(data) {
  // Stocker les données globalement
  dernierAppData = data;
    _safe('seances-programme', () => peuplerSeancesProgramme());
    seancesDates = data.historique.dates_seances || {};
    progressionData = data.historique.progression_par_exo || {};
    tendancesData = data.historique.tendances || null;

    // Data-viz dashboard : records perso + heatmap d'activité
    _safe('records', () => renderDashboardRecords(data.historique));
    _safe('activite', () => renderDashboardActivite(data.historique));

    // Nouveaux blocs Accueil : Contexte + État du jour + Analyse moteur + Alertes
    _safe('contexte', () => renderCarteContexte(data.contexte, athlete && athlete.athlete_id, 'dash-contexte', 'athlete', data.pause));
    _safe('etat-du-jour', () => renderEtatDuJour(data));
    _safe('analyse-accueil', () => renderAnalyseAccueilAthlete(data));
    _safe('alertes', () => renderAlertes(data));
    _safe('pause', () => majUiPause());
    _safe('push', () => majUiPush());

    // Objectif : bloc Récompenses (paliers + cagnotte auto)
    _safe('recompenses', () => renderRecompenses(data));

    // Jours de cardio (clés DD/MM/YYYY) → heatmap de régularité (muscu + cardio) + agenda coloré
    _safe('cardio-agg', () => {
      seancesDatesCardio = {};
      cardioParJour = {};
      var _cardioHist = (data.cardio && data.cardio.history) || [];
      _cardioHist.forEach(function(s) {
        var iso = s && s.date ? String(s.date) : '';
        if (iso.length < 10) return;
        var key = iso.slice(8,10) + '/' + iso.slice(5,7) + '/' + iso.slice(0,4);
        seancesDatesCardio[key] = true;
        var agg = cardioParJour[key] || (cardioParJour[key] = { n: 0, km: 0, min: 0, kcal: 0, pas: 0, types: {} });
        agg.n++; agg.km += s.distance || 0; agg.min += s.duree || 0; agg.kcal += s.calories || 0; agg.pas += s.pas || 0;
        var t = s.type_cardio || 'autre'; agg.types[t] = (agg.types[t] || 0) + 1;
      });
    });

    // Accueil : heatmap de régularité + streak (renvoie vers l'agenda Séance)
    _safe('heatmap-accueil', () => renderHeatmapAccueil());

    // Détail des séances par date (pour le clic sur l'agenda)
    _safe('seances-detail', () => chargerSeancesDetail());

    // Graphique poids
    _safe('graph-poids', () => afficherGraphiquePoids(data.poids || []));

    // Objectif + régularité
    _safe('objectif', () => {
      majObjectifCard(athlete.objectif);
      const selObj = document.getElementById('sel-objectif');
      if (selObj && athlete.objectif) selObj.value = athlete.objectif;

      const regEl = document.getElementById('regularite-content');
      if (regEl) {
        const faites2 = data.dashboard.regularite.seances_semaine != null ? data.dashboard.regularite.seances_semaine : (data.dashboard.regularite.seances_j7 || 0);
        const prevues2 = data.dashboard.regularite.seances_prevues || 0;
        const manque2 = Math.max(0, prevues2 - faites2);
        const pct2 = prevues2 > 0 ? Math.min(100, Math.round(faites2/prevues2*100)) : 0;
        const col2 = manque2 > 0 ? '#ff9500' : '#00a854';
        regEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:24px;font-weight:800;color:var(--text);">${faites2}<span style="font-size:13px;color:var(--text-muted);font-weight:400;"> / ${prevues2}</span></div>
            <div style="font-size:13px;font-weight:700;color:${col2};">${manque2 > 0 ? '⚠️ '+manque2+' manquante'+(manque2>1?'s':'') : '✅ Objectif atteint !'}</div>
          </div>
          <div style="background:var(--surface2);border-radius:20px;height:7px;">
            <div style="background:var(--accent);height:100%;width:${pct2}%;border-radius:20px;"></div>
          </div>`;
      }
    });

    // Mettre à jour le poids depuis Poids_historique
    _safe('poids', () => {
      if (data.poids && data.poids.length > 0) {
        const poidsEl = document.getElementById('hist-poids');
        if (poidsEl) {
          poidsEl.innerHTML = data.poids.map(p =>
            `<div class="poids-item"><span>${p.date}</span><span class="poids-val">${p.poids} kg</span></div>`
          ).join('');
        }
        // Dashboard poids (bloc retiré de l'Accueil — calcul rendu null-safe)
        const dpoidsEl = document.getElementById('dash-poids');
        if (dpoidsEl) dpoidsEl.textContent = data.poids[0].poids;
        if (data.poids.length > 1) {
          const diff = (data.poids[0].poids - data.poids[1].poids).toFixed(1);
          const sign = diff > 0 ? '▲' : '▼';
          const col = diff > 0 ? 'var(--warn)' : 'var(--good)';
          const evoEl = document.getElementById('dash-poids-evolution');
          if (evoEl) evoEl.innerHTML = `<span style="color:${col}">${sign} ${Math.abs(diff)} kg</span> <span style="color:var(--text-muted);font-weight:600;">· ${data.poids.length} mesures</span>`;
        }
        renderPoidsSpark(data.poids);
      } else if (athlete.poids) {
        const dpoidsEl2 = document.getElementById('dash-poids');
        if (dpoidsEl2) dpoidsEl2.textContent = athlete.poids;
      }
    });
    // Nom dans le hero
    const heroName = document.getElementById('dash-hero-name');
    if (heroName && athlete && athlete.nom) heroName.textContent = athlete.nom;

    // Rendre le calendrier
    _safe('calendrier', () => renderCalendrier());

    // Volume par muscle
    _safe('volume-muscle', () => afficherVolumeMuscle(data.historique.volume_semaine || []));
    _safe('bilan-balance', () => renderBilanBalance(data.historique.volume_semaine || []));

    // Tendances
    _safe('tendances', () => afficherTendances(4));
    _safe('correlation', () => renderCorrelationBienEtre(data.bien_etre, data.historique.volume_par_jour || {}));

    // Exercices dropdown historique
    _safe('exercices-dropdown', () => {
      const exercices = data.historique.exercices || [];
      const sel = document.getElementById('sel-hist-exercice');
      if (sel) {
        sel.innerHTML = '<option value="">— Choisir un exercice —</option>';
        exercices.forEach(e => {
          const o = document.createElement('option');
          o.value = e; o.textContent = e; sel.appendChild(o);
        });
      }
    });

    // =========================================================================
    // DASHBOARD — lecture directe des 3 moteurs (bloc isolé : un plantage ici
    // ne doit pas empêcher le rendu du cardio ni la récupération de brouillon)
    // =========================================================================
    _safe('dashboard', () => {
    const dash       = data.dashboard;
    const recent     = data.recent     || {};   // Charge récente
    const globalEng  = data.global     || {};   // Historique global
    const comparison = data.comparison || {};   // Évolution

    const j7  = recent.j7  || {};
    const j28 = recent.j28 || {};
    const cmp7  = comparison.j7_vs_j7prec  || {};
    const cmp28 = comparison.j28_vs_j28prec || {};

    // ── Régularité : séances de la SEMAINE EN COURS (depuis lundi) → l'anneau se remet à zéro chaque lundi ──
    const faites = (dash.regularite && dash.regularite.seances_semaine != null)
      ? dash.regularite.seances_semaine
      : (j7.seances != null ? j7.seances : 0);
    const prevues = dash.regularite ? (dash.regularite.seances_prevues || 0) : 0;
    const pct = prevues > 0 ? Math.min(100, Math.round(faites / prevues * 100)) : 0;
    document.getElementById('dash-seances-faites').textContent = faites;
    document.getElementById('dash-seances-prevues').textContent = prevues;
    const _ringC = 163.4;
    const _ring = document.getElementById('dash-ring-semaine');
    if (_ring) {
      _ring.style.strokeDashoffset = (_ringC * (1 - pct / 100)).toFixed(1);
      _ring.style.stroke = pct >= 100 ? 'var(--good)' : 'var(--accent)';
    }
    const manque = Math.max(0, prevues - faites);
    const msgEl = document.getElementById('dash-semaine-msg');
    msgEl.textContent = manque > 0 ? `${manque} séance${manque>1?'s':''} manquante${manque>1?'s':''}` : 'Objectif atteint';
    msgEl.style.color = manque > 0 ? 'var(--warn)' : 'var(--good)';

    // ── Volume par muscle — barres (volume_semaine = calendrier, conservé pour affichage) ──
    renderDashVolumeBars(data.historique.volume_semaine || []);

    // Historique global : muscle en retard — bandeau au-dessus des barres
    if (globalEng.muscle_retard) {
      const mr = globalEng.muscle_retard;
      const muscleEl = document.getElementById('dash-muscle-content');
      if (muscleEl) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:rgba(245,159,0,0.12);border:1px solid rgba(245,159,0,0.35);border-radius:8px;padding:8px 11px;margin-bottom:10px;display:flex;align-items:center;gap:8px;';
        banner.innerHTML = `<span style="font-size:14px;">⚠️</span><div><div style="font-size:11px;font-weight:700;color:var(--warn);">${mr.muscle} en retard <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-left:4px;">Historique global</span></div><div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${mr.series_faites} séries / ${mr.series_min} min · objectif ${mr.series_optimale} séries</div></div>`;
        muscleEl.prepend(banner);
      }
    }

    // ── Évolution : Progression des charges (j7 vs j7prec) ───────────
    const progEl = document.getElementById('dash-prog-content');
    const chargeDetails = cmp7.charge_details || (dash.progression ? dash.progression.details : null) || [];
    const enProg   = chargeDetails.filter(d => d.up).length;
    const enBaisse = chargeDetails.filter(d => d.down && !d.up).length;
    drawerData = chargeDetails;
    if (chargeDetails.length > 0) {
      const lignesUp   = chargeDetails.filter(d => d.up).map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(0,201,110,0.1);border-radius:6px;margin-bottom:4px;">
          <span style="font-size:11px;color:#00c96e;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;display:inline-block;">${d.exercice}</span>
          <span style="font-size:11px;color:#00c96e;white-space:nowrap;">${d.variation}</span>
        </div>`).join('');
      const lignesDown = chargeDetails.filter(d => d.down && !d.up).map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:rgba(255,68,68,0.1);border-radius:6px;margin-bottom:4px;">
          <span style="font-size:11px;color:var(--danger);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;display:inline-block;">${d.exercice}</span>
          <span style="font-size:11px;color:var(--danger);white-space:nowrap;">${d.variation}</span>
        </div>`).join('');
      progEl.innerHTML = `
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;opacity:.7;">Évolution · 7j vs 7j précédents</div>
        <div class="v2-pgrid" style="margin-bottom:${(enProg||enBaisse)?'12px':'0'};">
          <div class="v2-pstat" style="background:var(--good-a);"><div class="pn" style="color:var(--good);">${enProg}</div><div class="pk">exercices<br>en hausse</div></div>
          <div class="v2-pstat" style="background:var(--bad-a);"><div class="pn" style="color:var(--v2-bad);">${enBaisse}</div><div class="pk">exercices<br>en baisse</div></div>
        </div>
        ${enProg   > 0 ? `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">En progression</div>${lignesUp}` : ''}
        ${enBaisse > 0 ? `<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin:8px 0 4px;">En baisse</div>${lignesDown}` : ''}
        ${enProg === 0 && enBaisse === 0 ? '<div style="color:var(--text-muted);font-size:13px;">Charges stables · 7 derniers jours</div>' : ''}`;
    } else {
      progEl.innerHTML = `
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;opacity:.7;">Évolution · 7j vs 7j précédents</div>
        <div style="color:var(--text-muted);font-size:13px;">Pas encore assez de séances pour comparer — il faut au moins une séance dans les 7j précédents.</div>`;
    }

    // ── Charge récente + Évolution : KPI row ───────────────────────────
    const recupEl = document.getElementById('dash-recup-content');
    const kpisEl  = document.getElementById('dash-kpis');

    // Récupération : statut depuis Charge récente (RPE 7j)
    const rpe7      = j7.rpe_moyen != null ? j7.rpe_moyen : null;
    const rpeColor  = rpe7 == null ? '#aaa' : rpe7 > 8.5 ? '#e5484d' : rpe7 > 7.5 ? '#f59f00' : '#00c96e';
    const recupStatut = rpe7 == null ? null : rpe7 > 8.5 ? 'eleve' : rpe7 > 7.5 ? 'modere' : 'optimal';
    const recupEmoji  = recupStatut === 'eleve' ? '🥵' : recupStatut === 'modere' ? '😮‍💨' : '💪';
    const recupLabel  = recupStatut === 'eleve' ? 'Fatigue élevée' : recupStatut === 'modere' ? 'Fatigue modérée' : 'Bien récupéré';
    const recupDesc   = recupStatut === 'eleve' ? 'Repos conseillé, réduis l\'intensité.' : recupStatut === 'modere' ? 'Surveille ta récup, garde une marge.' : 'Charge et RPE maîtrisés, tu peux pousser.';
    const recupColor  = recupStatut === 'eleve' ? 'var(--v2-bad)' : recupStatut === 'modere' ? 'var(--warn)' : 'var(--good)';

    // Tonnage 7j depuis Charge récente + évolution depuis Évolution
    const tonnageJ7   = j7.tonnage != null ? j7.tonnage : null;
    const tonnageEvol = cmp7.tonnage ? cmp7.tonnage.evol_pct : null;
    const tonnageColor = tonnageEvol == null ? '#aaa' : tonnageEvol >= 0 ? '#00c96e' : '#f59f00';

    // Records 30j depuis Historique global
    const records30 = globalEng.records_30j != null ? globalEng.records_30j : (dash.records_mois || 0);

    // ACWR depuis Charge récente (via dashboard.acwr)
    const acwrVal   = dash.acwr != null ? dash.acwr : null;

    if (kpisEl) {
      kpisEl.style.display = 'grid';
      kpisEl.style.gridTemplateColumns = '1fr 1fr 1fr';
      // ACWR retiré (peu lisible en muscu ; à réactiver pour un module Hyrox)
      kpisEl.innerHTML = `
        <div class="v2-kpi">
          <div class="kv" style="color:${rpeColor};">${rpe7 != null ? rpe7 : '—'}</div>
          <div class="kk">RPE · 7j</div>
        </div>
        <div class="v2-kpi">
          <div class="kv" style="color:${tonnageColor};">${tonnageJ7 != null ? tonnageJ7 + 't' : '—'}</div>
          <div class="kk">Tonnage · 7j${tonnageEvol != null ? ' <span style="font-size:10px;opacity:.7">' + (tonnageEvol > 0 ? '▲+' : '▼') + tonnageEvol + '%</span>' : ''}</div>
        </div>
        <div class="v2-kpi" style="cursor:pointer;transition:opacity .15s" onclick="allerVersRecords()" onmouseenter="this.style.opacity='.72'" onmouseleave="this.style.opacity='1'" title="Voir les records personnels">
          <div class="kv" style="color:#00c96e;">⚡ ${records30 > 0 ? records30 : '—'}</div>
          <div class="kk">Records · 30j <span style="font-size:9px;opacity:.6">↗</span></div>
        </div>`;
    }

    // Monotonie et Strain depuis Charge récente
    const monotonie7 = j7.monotonie;
    const strain7    = j7.strain;
    const monotonieStr = monotonie7 != null ? monotonie7.toFixed(2) : null;
    const strainStr    = strain7    != null ? Math.round(strain7)   : null;
    const monotonieColor = monotonie7 == null ? 'var(--text-subtle)' : monotonie7 > 2 ? 'var(--danger)' : monotonie7 > 1.5 ? 'var(--warn)' : 'var(--good)';
    const monotonieLabel = monotonie7 == null ? '—' : monotonie7 > 2 ? 'Charge monotone' : monotonie7 > 1.5 ? 'Modérée' : 'Variée';

    if (recupStatut) {
      recupEl.innerHTML = `
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;opacity:.7;">Charge récente · RPE moyen 7j glissants</div>
        <div style="display:flex;align-items:center;gap:13px;margin-bottom:12px;">
          <div style="width:50px;height:50px;border-radius:14px;background:${recupColor}22;display:flex;align-items:center;justify-content:center;font-size:23px;flex-shrink:0;">${recupEmoji}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:16px;font-weight:800;color:${recupColor};">${recupLabel}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${recupDesc}</div>
          </div>
        </div>
        ${(monotonieStr || strainStr) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;border-top:1px solid var(--border);padding-top:10px;">
          <div style="text-align:center;">
            <div style="font-size:17px;font-weight:800;color:${monotonieColor};">${monotonieStr || '—'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Variabilité · 7j</div>
            ${monotonie7 != null ? `<div style="font-size:9px;color:${monotonieColor};margin-top:1px;">${monotonieLabel}</div>` : ''}
          </div>
          <div style="text-align:center;">
            <div style="font-size:17px;font-weight:800;color:var(--text);">${strainStr != null ? strainStr.toLocaleString('fr') : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Charge accumulée · 7j</div>
          </div>
        </div>` : ''}`;
    } else {
      recupEl.innerHTML = `<div style="color:var(--text-muted);font-size:13px;">Pas encore assez de données — continue à t'entraîner !</div>`;
    }

    // ── Évolution : Tendance mensuelle (j28 vs j28prec) ─────────────
    const cmp28Sec  = document.getElementById('dash-cmp28-sec');
    const cmp28Card = document.getElementById('dash-cmp28-card');
    const cmp28El   = document.getElementById('dash-cmp28-content');
    if (cmp28El && (cmp28.tonnage || cmp28.seances || cmp28.charge)) {
      cmp28Sec.style.display  = '';
      cmp28Card.style.display = '';
      const t28   = cmp28.tonnage  || {};
      const s28   = cmp28.seances  || {};
      const c28   = cmp28.charge   || {};
      const rpe28 = cmp28.rpe      || {};
      const fmtEvol = (v) => v == null ? '—' : (v > 0 ? '▲ +'+v+'%' : v < 0 ? '▼ '+v+'%' : '→ stable');
      const colEvol = (v) => v == null ? 'var(--text-muted)' : v >= 5 ? 'var(--good)' : v <= -10 ? 'var(--bad)' : 'var(--warn)';
      cmp28El.innerHTML = `
        <div style="font-size:9px;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;opacity:.7;">Évolution · 28j vs 28j précédents</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
            <div style="font-size:14px;font-weight:800;color:${colEvol(t28.evol_pct)};">${fmtEvol(t28.evol_pct)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Tonnage · 28j</div>
            ${t28.courant != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${t28.courant}t vs ${t28.precedent}t</div>` : ''}
          </div>
          <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
            <div style="font-size:14px;font-weight:800;color:${colEvol(c28.evol_pct)};">${c28.evol_pct != null ? (c28.evol_pct > 0 ? '▲ +'+c28.evol_pct+'%' : c28.evol_pct < 0 ? '▼ '+c28.evol_pct+'%' : '→ stable') : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Charges · 28j</div>
          </div>
          <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
            <div style="font-size:14px;font-weight:800;color:${colEvol(s28.evol_pct)};">${fmtEvol(s28.evol_pct)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">Séances · 28j</div>
            ${s28.courant != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${s28.courant} vs ${s28.precedent}</div>` : ''}
          </div>
          <div style="background:var(--surface2);border-radius:10px;padding:10px 11px;">
            <div style="font-size:14px;font-weight:800;color:${rpe28.diff != null ? (rpe28.diff > 0.5 ? 'var(--bad)' : rpe28.diff < -0.5 ? 'var(--good)' : 'var(--text)') : 'var(--text-muted)'};">${rpe28.courant != null ? rpe28.courant : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px;">RPE moyen · 28j</div>
            ${rpe28.diff != null ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${rpe28.diff > 0 ? '+' : ''}${rpe28.diff} vs préc.</div>` : ''}
          </div>
        </div>`;
    }

    // ── Historique global : Stats carrière ────────────────────────────────────────
    const globalCardEl = document.getElementById('dash-global-card');
    const globalSecEl  = document.getElementById('dash-global-sec');
    if (globalEng.total_seances > 0 && globalCardEl) {
      globalSecEl.style.display = '';
      globalCardEl.style.display = '';
      const tonnageTotalT = globalEng.tonnage_total_kg ? (Math.round(globalEng.tonnage_total_kg / 100) / 10) + 't' : '—';
      document.getElementById('dash-global-content').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="dash-stat">
            <div class="dash-stat-num" style="color:var(--accent);">${globalEng.total_seances}</div>
            <div class="dash-stat-label">séances</div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat-num" style="color:var(--accent);">${globalEng.total_series || '—'}</div>
            <div class="dash-stat-label">séries totales</div>
          </div>
          <div class="dash-stat">
            <div class="dash-stat-num" style="color:var(--accent);">${tonnageTotalT}</div>
            <div class="dash-stat-label">tonnage total</div>
          </div>
        </div>`;
    }

    // Dernière séance
    const lastEl = document.getElementById('dash-last-seance');
    if (dash.derniere_seance) {
      const d = dash.derniere_seance;
      lastEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div>
            <div style="font-size:15px;font-weight:800;color:var(--accent);">${d.seance_id}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${d.date}</div>
          </div>
          <span class="dash-badge" style="background:#e8f8f0;border:1px solid #00c96e;color:#007a41;">✅ Complète</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <div class="dash-stat"><div class="dash-stat-num">${d.nb_exercices}</div><div class="dash-stat-label">exos</div></div>
          <div class="dash-stat"><div class="dash-stat-num">${d.nb_series}</div><div class="dash-stat-label">séries</div></div>
          <div class="dash-stat"><div class="dash-stat-num">${d.rpe_moyen}</div><div class="dash-stat-label">RPE moy.</div></div>
        </div>`;
    } else {
      lastEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Aucune séance enregistrée</div>';
    }

    // Prochaine séance — CTA v2
    const nextEl = document.getElementById('dash-next-seance');
    if (dash.prochaine_seance) {
      const n = dash.prochaine_seance;
      nextEl.innerHTML = `
        <div class="dc-inner" onclick="demarrerDepuisDashboard('${n}')" style="cursor:pointer;">
          <div class="dc-ico"><svg class="ico ico-btn"><use href="#i-dumbbell"/></svg></div>
          <div class="dc-txt"><div class="dc-k">Prochaine séance</div><div class="dc-v">${n}</div></div>
          <button class="dc-btn" onclick="event.stopPropagation();demarrerDepuisDashboard('${n}')">Démarrer</button>
        </div>`;
    } else {
      nextEl.innerHTML = '<div class="dc-inner" style="background:var(--good);"><div class="dc-ico">✅</div><div class="dc-txt"><div class="dc-v">Toutes les séances faites !</div></div></div>';
    }
    }); // fin _safe('dashboard')

    // ── Cardio — résumé multi-fenêtre ─────────────────────────────────────────
    _safe('dash-cardio', () => renderDashCardio(data.cardio));

    // ── Cardio — historique détaillé (onglet Progression) ────────────────────
    _pasQuotidiens = (data && data.pas_quotidiens) || [];
    _safe('cardio-historique', () => renderCardioHistorique(data.cardio && data.cardio.history));
    // Synchro auto de la montre à la connexion (message visible, ≥ 1×/24h), si connectée.
    _safe('gh-autosync', () => autoSyncGoogleHealth());

    // Récupération d'une séance muscu laissée en cours (anti-perte de saisie).
    // Une seule fois par chargement de page (garde interne _brouillonRestaure).
    try { _restaurerBrouillon(); } catch (e) {}
}

function _showLoader() { var el = document.getElementById('nv-loader-bar'); if (el) el.style.display = 'block'; }
function _hideLoader() { var el = document.getElementById('nv-loader-bar'); if (el) el.style.display = 'none'; }

async function chargerAppData() {
  if (!athlete) return;
  _showLoader();
  const _cacheKey = 'nv_cache_' + athlete.athlete_id;

  // Stale-while-revalidate : affiche les données en cache immédiatement →
  // pas d'écran blanc pendant le cold start Apps Script.
  // Si le cache est ancien (pas de history cardio), on saute l'affichage intermédiaire.
  try {
    const _hit = localStorage.getItem(_cacheKey);
    if (_hit) {
      const _parsed = JSON.parse(_hit);
      if (_parsed.cardio && _parsed.cardio.history !== undefined) _appliquerAppData(_parsed);
    }
  } catch (_) {}

  const ctrl = new AbortController();
  const tSlow = setTimeout(() => showToast('Serveur en démarrage (~15 s)…', 'var(--warn)'), 8000);
  const tKill = setTimeout(() => ctrl.abort(), 90000);
  try {
    // Ajouter nocache si l'ancienne réponse localStorage n'avait pas cardio.history
    let _fetchUrl = `${SCRIPT_URL}?action=getAppData&athlete_id=${athlete.athlete_id}`;
    try { const _old = JSON.parse(localStorage.getItem(_cacheKey) || '{}'); if (!_old.cardio || _old.cardio.history === undefined) _fetchUrl += '&nocache=1'; } catch(_) {}
    const res = await fetch(_fetchUrl, { signal: ctrl.signal });
    clearTimeout(tSlow); clearTimeout(tKill);
    const data = await res.json();
    // Réponse d'erreur du serveur (ex. 500 { erreur:... }, ou payload sans historique) :
    // on affiche le VRAI message et on ne met SURTOUT pas cette erreur en cache
    // (sinon on servirait une réponse cassée aux chargements suivants).
    if (!res.ok || (data && data.erreur) || !data || !data.historique) {
      const msg = (data && data.erreur) ? String(data.erreur) : ('Réponse serveur invalide (HTTP ' + res.status + ')');
      console.error('getAppData a renvoyé une erreur:', res.status, data);
      showToast('Erreur serveur : ' + msg + ' — réessaie dans un instant', 'var(--danger)');
      return;
    }
    try { localStorage.setItem(_cacheKey, JSON.stringify(data)); } catch (_) {}
    // On isole l'AFFICHAGE de la partie réseau : si une donnée fait planter le rendu,
    // on veut le vrai message JS (et savoir que c'est côté affichage), pas le toast
    // générique "Erreur de connexion" qui laisse croire à un problème réseau.
    try {
      _appliquerAppData(data);
    } catch (errAff) {
      console.error("Erreur d'affichage des données:", errAff);
      showToast("Erreur d'affichage : " + (errAff && errAff.message ? errAff.message : errAff), 'var(--danger)');
    }
  } catch(e) {
    clearTimeout(tSlow); clearTimeout(tKill);
    if (e.name === 'AbortError') {
      showToast('Serveur trop lent (90 s dépassés). Rafraîchis dans quelques secondes.', 'var(--danger)');
    } else {
      showToast('Erreur de connexion. Réessaie dans quelques secondes.', 'var(--danger)');
    }
    console.error('chargerAppData error:', e);
  } finally {
    _hideLoader();
  }
}

// Garder chargerDashboard pour le refresh de l'onglet accueil
async function chargerDashboard() {
  chargerAppData();
}



function demarrerDepuisDashboard(seanceId) {
  switchTab('seance');
  document.getElementById('sel-seance-id').value = seanceId;
  demarrerSeance();
}

// ==================== RÉGULARITÉ ====================

// ==================== TIMER ====================
let timerInterval = null;
let timerRemaining = 0;
const CIRCUMFERENCE = 188.5; // 2 * PI * 30

function startTimer(seconds, serieInfo) {
  if (timerInterval) clearInterval(timerInterval);
  timerRemaining = seconds;
  
  const overlay = document.getElementById('timer-overlay');
  const display = document.getElementById('timer-display');
  const circle = document.getElementById('timer-circle');
  const info = document.getElementById('timer-serie-info');
  
  if (seconds === 0) return;
  
  overlay.classList.add('active');
  info.textContent = serieInfo;
  
  function update() {
    display.textContent = timerRemaining;
    const progress = timerRemaining / seconds;
    circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      // Vibration
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      // Son
      playBeep();
      overlay.classList.remove('active');
      showToast('✅ Repos terminé, allons-y !');
    }
    timerRemaining--;
  }
  
  update();
  timerInterval = setInterval(update, 1000);
}

function skipTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById('timer-overlay').classList.remove('active');
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3, 0.6].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    });
  } catch(e) {}
}

// ==================== SURCHARGE PROGRESSIVE ====================
function calculerSurcharge(strategie, perf, programme, bestCharge, increment, lastRpe) {
  if (!perf || !programme) return null;

  const repsMax = programme.reps_max;
  const repsMini = programme.reps_mini;
  const lastReps = perf.max_reps;
  const prevReps = perf.prev_max_reps;
  const prev2Reps = perf.prev2_max_reps !== undefined ? perf.prev2_max_reps : null;
  const nouvelleCharge = Math.round((bestCharge + increment) * 4) / 4;

  // Auto-régulation RPE : si RPE ≥ 9, bloquer la surcharge (trop proche de l'échec)
  const rpe = lastRpe != null ? Number(lastRpe) : null;
  const rpeBloque = rpe !== null && rpe >= 9;
  const rpeFacile  = rpe !== null && rpe <= 7;

  if (rpeBloque) {
    return `<svg class="ico"><use href="#i-alert"/></svg><span style="color:var(--warn)">RPE ${rpe} — Consolide cette charge avant de progresser</span>`;
  }

  if (strategie === 'Progression linéaire') {
    if (lastReps >= repsMax) {
      const msg = rpeFacile
        ? `<svg class="ico"><use href="#i-dumbbell"/></svg>Débutant — RPE ${rpe} (facile) · Surcharge : <strong>${nouvelleCharge}kg</strong> (+${increment}kg)`
        : `<svg class="ico"><use href="#i-dumbbell"/></svg>Débutant — Surcharge : <strong>${nouvelleCharge}kg</strong> (+${increment}kg) → repart à ${repsMini} reps`;
      return msg;
    }

  } else if (strategie === 'Double progression') {
    const deuxFoisAuMax = lastReps >= repsMax && prevReps !== null && prevReps >= repsMax;
    const troisFoisAuMax = deuxFoisAuMax && prev2Reps !== null && prev2Reps >= repsMax;

    if (troisFoisAuMax) {
      return `<svg class="ico"><use href="#i-dumbbell"/></svg>Intermédiaire — 3x au max ! Surcharge : <strong>${nouvelleCharge}kg</strong> (+${increment}kg) → repart à ${repsMini} reps`;
    } else if (deuxFoisAuMax) {
      return `<svg class="ico"><use href="#i-trending"/></svg>Intermédiaire — 2x au max → <strong>+1 rep</strong> la prochaine fois (${lastReps + 1} reps)`;
    }

  } else if (strategie === 'Progression avancée') {
    const auMax = lastReps >= repsMax && prevReps !== null && prevReps >= repsMax;
    if (auMax) {
      return `<svg class="ico"><use href="#i-dumbbell"/></svg>Expérimenté — Choix : <strong>+1 rep</strong> (${lastReps + 1} reps) ou <strong>-30s repos</strong>`;
    }
  }

  return null;
}

// ==================== DRAWER ====================
let drawerData = [];

function ouvrirDrawer() {
  if (drawerData.length === 0) {
    const el = document.getElementById('drawer-liste');
    if (el) el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px 0;text-align:center;">Pas encore de données cette semaine</div>';
    ['tous','up','down','stable'].forEach(t => {
      const btn = document.getElementById('fd-'+t);
      if (btn) { btn.style.background = t === 'tous' ? 'var(--accent)' : 'var(--surface2)'; btn.style.color = t === 'tous' ? '#000' : 'var(--text-muted)'; btn.style.fontWeight = t === 'tous' ? '700' : '400'; }
    });
  } else {
    filtrerDrawer('tous');
  }
  document.getElementById('drawer-progression').style.bottom = '0';
  document.getElementById('drawer-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function fermerDrawer() {
  document.getElementById('drawer-progression').style.bottom = '-100%';
  document.getElementById('drawer-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function allerProgressionExo(exo) {
  fermerDrawer();
  switchTab('historique');
  setTimeout(() => {
    const sel = document.getElementById('sel-hist-exercice');
    if (!sel) return;
    const opt = Array.from(sel.options).find(o => o.value === exo);
    if (opt) { sel.value = exo; afficherProgressionExo(); }
  }, 300);
}

function filtrerDrawer(type) {
  ['tous','up','down','stable'].forEach(t => {
    const btn = document.getElementById('fd-'+t);
    if (!btn) return;
    btn.style.background = t === type ? 'var(--accent)' : 'var(--surface2)';
    btn.style.color = t === type ? '#000' : 'var(--text-muted)';
    btn.style.fontWeight = t === type ? '700' : '400';
  });

  const filtered = type === 'tous' ? drawerData
    : type === 'up' ? drawerData.filter(d => d.up)
    : type === 'down' ? drawerData.filter(d => d.down && !d.up)
    : drawerData.filter(d => !d.up && !d.down);

  const el = document.getElementById('drawer-liste');
  if (filtered.length === 0) {
    el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:16px 0;text-align:center;">Aucun exercice dans cette catégorie</div>';
    return;
  }

  el.innerHTML = filtered.map(d => {
    const couleur = d.up ? '#00c96e' : d.down ? 'var(--danger)' : 'var(--text-muted)';
    const bg = d.up ? 'rgba(0,201,110,0.1)' : d.down ? 'rgba(255,68,68,0.1)' : 'var(--surface2)';
    const fleche = d.up ? '↑' : d.down ? '↓' : '=';
    const exoEsc = d.exercice.replace(/'/g, "\\'");
    return `
      <div onclick="allerProgressionExo('${exoEsc}')" style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--surface2);cursor:pointer;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;font-weight:700;color:${couleur};">${fleche}</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">${d.exercice}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;font-weight:700;color:${couleur};background:${bg};padding:3px 10px;border-radius:20px;white-space:nowrap;">${d.variation}</span>
          <span style="font-size:11px;color:var(--accent);">→</span>
        </div>
      </div>`;
  }).join('');
}

// ==================== EXPORT PDF BILAN ====================
function ouvrirModalBilanPDF() {
  const now = new Date();
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);
  const debut3m = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const hist = coachAthleteData && coachAthleteData.historique;
  const datesSeances = hist ? Object.keys(hist.dates_seances || {}) : [];
  let premiereDateStr = '—';
  if (datesSeances.length) {
    const sorted = datesSeances.map(s => { const p = s.split('/'); return new Date(p[2], p[1]-1, p[0]); }).sort((a,b)=>a-b);
    premiereDateStr = fmt(sorted[0]);
  }
  const lm = document.getElementById('pdf-label-mois');
  const l3 = document.getElementById('pdf-label-3mois');
  const lt = document.getElementById('pdf-label-tout');
  if (lm) lm.textContent = fmt(debutMois) + ' → ' + fmt(now);
  if (l3) l3.textContent = fmt(debut3m) + ' → ' + fmt(now);
  if (lt) lt.textContent = 'Depuis ' + premiereDateStr;
  const modal = document.getElementById('modal-bilan-pdf');
  if (modal) { modal.style.display = 'flex'; }
}

function fermerModalBilanPDF() {
  const modal = document.getElementById('modal-bilan-pdf');
  if (modal) modal.style.display = 'none';
}

function lancerExportBilanPDF() {
  const sel = document.querySelector('input[name="pdf-periode"]:checked');
  const periode = sel ? sel.value : 'mois';
  fermerModalBilanPDF();
  exporterBilanPDF(periode);
}

async function exporterBilanPDF(periode) {
  periode = periode || 'mois';
  const athleteId = coachAthleteCourant ? coachAthleteCourant.athlete_id : null;
  if (!athleteId) { showToast('⚠️ Athlète non sélectionné', '#ff4444'); return; }
  showToast('Génération du bilan…', '#3b82f6');
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getBilanPDF&athlete_id=${encodeURIComponent(athleteId)}&periode=${encodeURIComponent(periode)}`);
    const bilan = await res.json();
    if (bilan.error) { showToast('⚠️ ' + bilan.error, '#ff4444'); return; }
    _rendreBilanPDF(bilan);
  } catch(err) {
    showToast('⚠️ Erreur lors du chargement du bilan', '#ff4444');
    console.error(err);
  }
}

function _rendreBilanPDF(bilan) {
  const nomAthlete = coachAthleteCourant ? (coachAthleteCourant.prenom || coachAthleteCourant.nom || 'Athlète') : 'Athlète';
  const nomCoach = coach ? (coach.nom || 'Coach') : 'Coach';
  const strat = coachAthleteCourant ? (coachAthleteCourant.strategie_progression || '') : '';
  const niveauRaw = coachAthleteCourant ? (coachAthleteCourant.niveau || '') : '';
  const objectif = coachAthleteCourant ? (coachAthleteCourant.objectif || '') : '';
  const maintenant = new Date();
  const fmtDate = (dt) => dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  const today = fmtDate(maintenant);
  const moisLabel = bilan.periode_label || bilan.periode || '';

  // ── KPIs depuis backend ──
  const totalSeances   = bilan.seances || 0;
  const totalSeriesFmt = bilan.series  || '—';
  const tonnageMoisFmt = bilan.tonnage_kg > 0 ? Math.round(bilan.tonnage_kg).toLocaleString('fr-FR') + ' kg' : '—';
  const tonnageSeance  = bilan.tonnage_par_seance > 0 ? bilan.tonnage_par_seance.toLocaleString('fr-FR') + ' kg' : '—';
  const seancesParSem  = bilan.seances_par_semaine != null ? bilan.seances_par_semaine : '—';
  const streakFmt      = bilan.streak != null && bilan.streak > 0 ? bilan.streak + ' sem.' : '—';
  const nbSemaines     = bilan.nb_semaines || 1;

  // ── Régularité — dots mois courant (calculé côté client à partir des dates renvoyées) ──
  const datesSeancesAll  = bilan.dates_seances || [];
  const datesRecordsMois = new Set(bilan.dates_records_mois || []);
  const debutMois   = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  const joursInMonth = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0).getDate();
  const premierJour  = debutMois.getDay() === 0 ? 6 : debutMois.getDay() - 1;
  const seancesCeMois = new Set(datesSeancesAll.filter(ds => {
    const p = ds.split('/'); if (p.length < 3) return false;
    const dt = new Date(+p[2], +p[1]-1, +p[0]);
    return dt.getMonth() === maintenant.getMonth() && dt.getFullYear() === maintenant.getFullYear();
  }));
  let dotsHTML = '';
  for (let i = 0; i < premierJour; i++) dotsHTML += `<div class="dot"></div>`;
  for (let day = 1; day <= joursInMonth; day++) {
    const str = String(day).padStart(2,'0') + '/' + String(maintenant.getMonth()+1).padStart(2,'0') + '/' + maintenant.getFullYear();
    const isSea = seancesCeMois.has(str);
    const isRec = isSea && datesRecordsMois.has(str);
    dotsHTML += `<div class="dot${isRec ? ' hi' : isSea ? ' on' : ''}"></div>`;
  }
  const assiduite    = joursInMonth ? Math.round((seancesCeMois.size / joursInMonth) * 100) : 0;
  const nbRecordsMois = datesRecordsMois.size;

  // ── Progression / Régression depuis backend ──
  const lignesUp = [], lignesDn = [], lignesStable = [];
  (bilan.progression || []).forEach(p => {
    if (p.evol === 'up') {
      const pct = p.debut_charge ? Math.round((p.diff_kg / p.debut_charge) * 100) : 0;
      lignesUp.push(`<tr><td><div class="en">${p.exo}</div></td><td class="r" style="color:#475569;font-weight:600">${p.debut_charge} kg</td><td class="r" style="color:#fff;font-weight:800">${p.fin_charge} kg</td><td class="r"><span class="pill up">+${p.diff_kg} kg</span><span class="pct">+${pct}%</span></td><td class="r" style="color:#475569;font-size:11px">×${p.nb_seances}</td></tr>`);
    } else if (p.evol === 'reps_up') {
      lignesUp.push(`<tr><td><div class="en">${p.exo}</div></td><td class="r" style="color:#475569;font-weight:600">${p.debut_charge} kg×${p.debut_reps}</td><td class="r" style="color:#fff;font-weight:800">${p.fin_charge} kg×${p.fin_reps}</td><td class="r"><span class="pill rp">+${p.diff_reps} reps</span></td><td class="r" style="color:#475569;font-size:11px">×${p.nb_seances}</td></tr>`);
    } else if (p.evol === 'down') {
      const pct = p.debut_charge ? Math.round((Math.abs(p.diff_kg) / p.debut_charge) * 100) : 0;
      lignesDn.push(`<tr><td><div class="en">${p.exo}</div></td><td class="r" style="color:#475569;font-weight:600">${p.debut_charge} kg</td><td class="r" style="color:#f43f5e;font-weight:800">${p.fin_charge} kg</td><td class="r"><span class="pill dn">−${Math.abs(p.diff_kg)} kg</span><span class="pct">−${pct}%</span></td><td class="r" style="color:#475569;font-size:11px">×${p.nb_seances}</td></tr>`);
    } else {
      lignesStable.push(p.exo);
    }
  });
  const separateur = lignesDn.length ? `<tr><td colspan="5" style="padding:3px 10px"><div style="height:1px;background:rgba(244,63,94,.25)"></div></td></tr>` : '';
  const progRows = lignesUp.join('') + separateur + lignesDn.join('');

  // ── RPE depuis backend — liste compacte ──
  const rpeArr = bilan.rpe_par_exercice || [];
  const rpeRows = rpeArr.map((r, i) => {
    const col = r.rpe >= 9 ? '#f43f5e' : r.rpe >= 7.5 ? '#f59e0b' : '#10b981';
    const lbl = r.rpe >= 9 ? 'Intense' : r.rpe >= 7.5 ? 'Élevé' : 'Facile';
    const lblBg = r.rpe >= 9 ? 'rgba(244,63,94,.12)' : r.rpe >= 7.5 ? 'rgba(245,158,11,.12)' : 'rgba(16,185,129,.12)';
    const pct = Math.round((r.rpe / 10) * 100);
    return `<div class="rpe-row"><span class="rpe-rank">${i+1}</span><span class="rpe-exo-name">${r.exo}</span><div class="rpe-bar-bg"><div class="rpe-bar-fill" style="width:${pct}%;background:${col}"></div></div><span class="rpe-val" style="color:${col}">${r.rpe.toFixed(1)}</span><span class="rpe-lbl-inline" style="color:${col};background:${lblBg}">${lbl}</span></div>`;
  }).join('');
  const rpeMoyen = bilan.rpe_moyen;
  const rpeGlobalRow = rpeMoyen ? `<div class="rpe-row rpe-global-row"><span class="rpe-global-val">${rpeMoyen}</span><span class="rpe-global-lbl">RPE global moyen</span></div>` : '';

  // ── Volume par muscle depuis backend ──
  const MINI_VOL = nbSemaines * 10;
  const volArr = bilan.volume_par_muscle || [];
  const maxVol = volArr.length ? volArr[0].series : 1;
  const volCards = volArr.length ? volArr.map(v => {
    const pct = Math.min(100, Math.round((v.series / Math.max(maxVol, MINI_VOL)) * 100));
    const isLow = v.series < MINI_VOL;
    const barCol = isLow ? '#f59e0b' : '#3b82f6';
    const badge = isLow ? `<span class="vol-badge vol-low">↑ Faible</span>` : `<span class="vol-badge vol-ok">✓ Optimal</span>`;
    const perSem = nbSemaines > 1 ? ` · ${(v.series/nbSemaines).toFixed(1)}/sem.` : '';
    return `<div class="vol-card${isLow ? ' warn-card' : ''}"><div><div class="vol-muscle-name">${v.muscle}</div></div><div class="vol-bar-col"><div class="vol-bar-bg"><div class="vol-bar" style="width:${pct}%;background:${barCol}"></div></div><div class="vol-nums"><span class="vol-ser">${v.series} sér. total${perSem}</span></div></div>${badge}</div>`;
  }).join('') : '<div style="color:#475569;font-style:italic;font-size:11px">Aucune donnée de volume pour cette période</div>';

  // ── Points d'attention ──
  // Muscles : seulement si < 60% du minimum ET muscle identifié, limité à 6
  const seuilAlerte = MINI_VOL * 0.6;
  const musclesFaibles = volArr
    .filter(v => v.muscle !== 'Non renseigné' && v.series < seuilAlerte)
    .slice(0, 6)
    .map(v => `<span class="chip r">${v.muscle} — ${v.series} sér.</span>`).join('');
  // Exercices stables : seulement si ≥ 5 séances (vraie stagnation, pas juste peu de data), limité à 8
  const exosStables = lignesStable
    .filter(e => (bilan.progression || []).find(p => p.exo === e && p.nb_seances >= 5))
    .slice(0, 8)
    .map(e => `<span class="chip w">${e}</span>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bilan Novalyz — ${nomAthlete} — ${moisLabel}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;font-size:13px}
.bilan{max-width:820px;margin:0 auto;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.08)}
/* Header */
.hd{padding:28px 40px 22px;background:linear-gradient(135deg,#eff6ff 0%,#f0f9ff 60%,#f8fafc 100%);border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;position:relative;overflow:hidden}
.hd::before{content:'';position:absolute;top:-60px;right:-60px;width:260px;height:260px;background:radial-gradient(circle,rgba(37,99,235,.07) 0%,transparent 65%);pointer-events:none}
.hd-eyebrow{font-size:9px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#2563eb;margin-bottom:10px}
.hd-name{font-size:30px;font-weight:800;color:#0f172a;letter-spacing:-.02em;line-height:1}
.hd-meta{font-size:11px;color:#94a3b8;margin-top:9px;display:flex;gap:14px}
.hd-badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:10px;font-weight:700;border-radius:20px;padding:4px 12px}
.hd-strat{margin-top:8px;display:inline-block;background:#f5f3ff;border:1px solid #ddd6fe;color:#7c3aed;font-size:10px;font-weight:700;border-radius:20px;padding:4px 10px}
.hd-right{text-align:right;flex-shrink:0}
.hd-cl{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#94a3b8;margin-bottom:4px}
.hd-coach{font-size:14px;font-weight:700;color:#0f172a}
.hd-date{font-size:10px;color:#94a3b8;margin-top:4px}
/* Body */
.body{padding:26px 40px 34px}
.block{margin-bottom:24px}
.sec{font-size:8px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.sec::before{content:'';width:3px;height:13px;border-radius:2px;background:linear-gradient(180deg,#2563eb,#0891b2);flex-shrink:0}
/* KPIs */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.kpi-n{font-size:22px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.kpi-n.a{color:#2563eb}.kpi-n.g{color:#059669}.kpi-n.p{color:#0891b2}.kpi-n.v{color:#7c3aed}
.kpi-l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-top:6px}
.kpi-s{font-size:9px;color:#94a3b8;margin-top:2px}
.kpi-delta{font-size:9px;font-weight:700;margin-top:5px;border-radius:10px;padding:2px 7px;display:inline-block}
.kpi-up{background:#dcfce7;color:#16a34a}
.kpi-dn{background:#fee2e2;color:#dc2626}
/* Calendrier régularité */
.cal-wrap{display:flex;gap:24px;align-items:flex-start}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;flex:1}
.cal-hd{font-size:7px;font-weight:700;text-align:center;color:#94a3b8;padding-bottom:3px;letter-spacing:.06em}
.cal-day{height:20px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:#cbd5e1;background:#f8fafc;border:1px solid #e2e8f0;position:relative}
.cal-day.empty{background:transparent;border-color:transparent}
.cal-day.seance{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8;font-weight:800}
.cal-day.record{background:#dcfce7;border-color:#86efac;color:#15803d;font-weight:800}
.cal-day.record::after{content:'★';font-size:5px;position:absolute;top:1px;right:2px;color:#16a34a}
.cal-header{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px}
.cal-legend{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap}
.cleg{display:flex;align-items:center;gap:5px;font-size:9px;color:#64748b;font-weight:600}
.cleg-dot{width:10px;height:10px;border-radius:2px;background:#f1f5f9;border:1px solid #e2e8f0}
.cleg-dot.seance{background:#dbeafe;border-color:#93c5fd}
.cleg-dot.record{background:#dcfce7;border-color:#86efac}
.rleg{display:flex;align-items:center;gap:4px;font-size:9px;color:#64748b;font-weight:600}
.rleg-sq{width:9px;height:9px;border-radius:2px}
.cal-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex-shrink:0;width:160px}
.rs-n{font-size:20px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
.rs-l{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#94a3b8;margin-top:2px}
/* Chart */
.chart-bg{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px 10px}
/* Table */
table{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
thead th{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;padding:0 8px 9px;text-align:left;border-bottom:1px solid #e2e8f0}
thead th.r{text-align:right}
tbody tr{border-bottom:1px solid #f1f5f9}
tbody tr:last-child{border-bottom:none}
tbody td{padding:8px;vertical-align:middle;color:#64748b}
tbody td.r{text-align:right}
.en{font-weight:600;color:#0f172a;font-size:12px}
.pill{display:inline-flex;align-items:center;font-size:10px;font-weight:800;border-radius:20px;padding:2px 8px}
.pill.up{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
.pill.dn{background:#fee2e2;color:#dc2626;border:1px solid #fecaca}
.pill.rp{background:#dbeafe;color:#2563eb;border:1px solid #bfdbfe}
.pct{font-size:9px;color:#94a3b8;margin-left:4px}
/* Volume */
.vol-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.vol-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px}
.vol-card.warn-card{border-color:#fde68a;background:#fffbeb}
.vol-muscle-name{font-size:12px;font-weight:700;color:#0f172a;width:100px;flex-shrink:0}
.vol-bar-col{flex:1}
.vol-bar-bg{height:5px;background:#e2e8f0;border-radius:3px;overflow:hidden}
.vol-bar{height:100%;border-radius:3px}
.vol-nums{margin-top:4px}
.vol-ser{font-size:10px;font-weight:700;color:#334155;font-variant-numeric:tabular-nums}
.vol-badge{flex-shrink:0;font-size:9px;font-weight:700;border-radius:20px;padding:3px 8px}
.vol-ok{background:#dcfce7;color:#16a34a}
.vol-low{background:#fef3c7;color:#d97706}
/* RPE liste compacte */
.rpe-list{display:flex;flex-direction:column;gap:4px}
.rpe-row{display:flex;align-items:center;gap:10px;padding:7px 12px;border-radius:7px;background:#f8fafc;border:1px solid #e2e8f0}
.rpe-rank{font-size:9px;font-weight:700;color:#94a3b8;width:14px;flex-shrink:0;text-align:right}
.rpe-exo-name{font-size:11px;font-weight:600;color:#334155;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rpe-bar-bg{width:80px;height:4px;background:#e2e8f0;border-radius:2px;flex-shrink:0}
.rpe-bar-fill{height:100%;border-radius:2px}
.rpe-val{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;width:28px;text-align:right;flex-shrink:0}
.rpe-lbl-inline{font-size:9px;font-weight:700;border-radius:12px;padding:2px 7px;flex-shrink:0;width:46px;text-align:center}
.rpe-global-row{background:#eff6ff;border-color:#bfdbfe;margin-top:6px}
.rpe-global-val{font-size:18px;font-weight:800;color:#1d4ed8;font-variant-numeric:tabular-nums}
.rpe-global-lbl{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#64748b;margin-left:8px;flex:1}
/* Points d'attention */
.reco-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.reco-card{border-radius:10px;border:1px solid;padding:14px 16px}
.reco-card.danger{border-color:#fecaca;background:#fff5f5}
.reco-card.warn{border-color:#fde68a;background:#fffbeb}
.reco-ttl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}
.reco-card.danger .reco-ttl{color:#dc2626}
.reco-card.warn .reco-ttl{color:#d97706}
.reco-chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{font-size:10px;font-weight:600;border-radius:20px;padding:3px 9px}
.chip.r{background:#fee2e2;color:#dc2626;border:1px solid #fecaca}
.chip.w{background:#fef3c7;color:#d97706;border:1px solid #fde68a}
/* Footer */
.footer{padding:13px 40px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc}
.ft-brand{font-size:12px;font-weight:800;color:#2563eb}
.ft-note{font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}button{display:none!important}}
</style>
</head><body>
<div class="bilan">
<div class="hd">
  <div>
    <div class="hd-eyebrow">Novalyz · Bilan mensuel</div>
    <div class="hd-name">${nomAthlete}</div>
    <div class="hd-meta"><span>${niveauRaw}</span>${objectif ? `<span>${objectif}</span>` : ''}</div>
    <div class="hd-badge">📅 ${moisLabel.charAt(0).toUpperCase()+moisLabel.slice(1)}</div>
    ${strat ? `<div class="hd-strat">${strat}</div>` : ''}
  </div>
  <div class="hd-right">
    <div class="hd-cl">Coach</div>
    <div class="hd-coach">${nomCoach}</div>
    <div class="hd-date">Généré le ${today}</div>
  </div>
</div>
<div class="body">

<div class="block">
  <div class="sec">Carrière du mois</div>
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-n a">${totalSeances}</div><div class="kpi-l">Séances</div><div class="kpi-s">${seancesParSem} / semaine</div>${bilan.delta && bilan.delta.seances !== 0 ? `<div class="kpi-delta ${bilan.delta.seances > 0 ? 'kpi-up' : 'kpi-dn'}">${bilan.delta.seances > 0 ? '▲' : '▼'} ${Math.abs(bilan.delta.seances)} séance${Math.abs(bilan.delta.seances) > 1 ? 's' : ''} vs préc.</div>` : ''}</div>
    <div class="kpi"><div class="kpi-n">${totalSeriesFmt}</div><div class="kpi-l">Séries totales</div>${bilan.delta && bilan.delta.series_pct != null && bilan.delta.series_pct !== 0 ? `<div class="kpi-delta ${bilan.delta.series_pct > 0 ? 'kpi-up' : 'kpi-dn'}">${bilan.delta.series_pct > 0 ? '▲' : '▼'} ${Math.abs(bilan.delta.series_pct)}% vs préc.</div>` : ''}</div>
    <div class="kpi"><div class="kpi-n p" style="font-size:17px">${tonnageMoisFmt}</div><div class="kpi-l">Tonnage période</div><div class="kpi-s">${tonnageSeance} / séance</div>${bilan.delta && bilan.delta.tonnage_pct != null && bilan.delta.tonnage_pct !== 0 ? `<div class="kpi-delta ${bilan.delta.tonnage_pct > 0 ? 'kpi-up' : 'kpi-dn'}">${bilan.delta.tonnage_pct > 0 ? '▲' : '▼'} ${Math.abs(bilan.delta.tonnage_pct)}% vs préc.</div>` : ''}</div>
    <div class="kpi"><div class="kpi-n g">${streakFmt}</div><div class="kpi-l">Streak</div></div>
  </div>
</div>

<div class="block">
  <div class="sec">Charge hebdomadaire (tonnage)</div>
  <canvas id="chartTonnage" width="740" height="140" style="width:100%;height:140px;display:block;border-radius:6px"></canvas>
</div>

<div class="block">
  <div class="sec">Régularité du mois</div>
  <div class="cal-wrap">
    <div style="flex:1">
      <div class="cal-header">
        ${['L','M','M','J','V','S','D'].map(j => `<div class="cal-hd">${j}</div>`).join('')}
      </div>
      <div class="cal-grid">
        ${(function(){
          let cells = '';
          for (let i = 0; i < premierJour; i++) cells += `<div class="cal-day"></div>`;
          for (let day = 1; day <= joursInMonth; day++) {
            const str = String(day).padStart(2,'0') + '/' + String(maintenant.getMonth()+1).padStart(2,'0') + '/' + maintenant.getFullYear();
            const isSea = seancesCeMois.has(str);
            const isRec = isSea && datesRecordsMois.has(str);
            const cls = isRec ? 'cal-day record' : isSea ? 'cal-day seance' : 'cal-day';
            cells += `<div class="${cls}">${isRec ? '★' : isSea ? '' : ''}<span style="font-size:7px;opacity:.5">${day}</span></div>`;
          }
          return cells;
        })()}
      </div>
      <div class="cal-legend">
        <div class="cleg"><div class="cleg-dot seance"></div>Séance</div>
        <div class="cleg"><div class="cleg-dot record"></div>Record ★</div>
        <div class="cleg"><div class="cleg-dot"></div>Repos</div>
      </div>
    </div>
    <div class="reg-stats">
      <div><div class="rs-n" style="color:#2563eb">${seancesCeMois.size}</div><div class="rs-l">Séances</div></div>
      <div><div class="rs-n">${assiduite}<span style="font-size:12px">%</span></div><div class="rs-l">Assiduité</div></div>
      <div><div class="rs-n" style="color:#059669">${nbRecordsMois}</div><div class="rs-l">Records battus</div></div>
      <div><div class="rs-n">${seancesParSem}</div><div class="rs-l">/ Semaine</div></div>
    </div>
  </div>
</div>

${progRows ? `<div class="block">
  <div class="sec">Progression &amp; régression du mois — tous les exercices</div>
  <table>
    <thead><tr><th>Exercice</th><th class="r">Début</th><th class="r">Fin</th><th class="r">Évolution</th><th class="r">Séances</th></tr></thead>
    <tbody>${progRows}</tbody>
  </table>
</div>` : ''}

${rpeRows ? `<div class="block">
  <div class="sec">RPE moyen par exercice</div>
  <div class="rpe-list">${rpeRows}${rpeGlobalRow}</div>
</div>` : ''}

${volCards ? `<div class="block">
  <div class="sec">Volume mensuel par groupe musculaire</div>
  <div class="vol-grid">${volCards}</div>
</div>` : ''}

${(musclesFaibles || exosStables) ? `<div class="block">
  <div class="sec">Points d'attention</div>
  <div class="reco-grid">
    ${musclesFaibles ? `<div class="reco-card danger"><div class="reco-ttl">⚠ Muscles sous-travaillés</div><div class="reco-chips">${musclesFaibles}</div></div>` : ''}
    ${exosStables ? `<div class="reco-card warn"><div class="reco-ttl">→ Exercices stables</div><div class="reco-chips">${exosStables}</div></div>` : ''}
  </div>
</div>` : ''}

</div>
<div class="footer">
  <div class="ft-brand">Novalyz</div>
  <div class="ft-note">Rapport confidentiel · Coach ${nomCoach} · ${moisLabel}</div>
</div>
</div>
<div style="position:fixed;bottom:24px;right:24px;display:flex;gap:12px;z-index:9999;">
  <button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">🖨️ Imprimer</button>
  <button onclick="telechargerPDF()" style="background:#10b981;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">⬇️ Télécharger PDF</button>
</div>
<script>
(function drawTonnageChart() {
  const data = ${JSON.stringify(bilan.tonnage_par_semaine || [])};
  if (!data.length) return;
  const canvas = document.getElementById('chartTonnage');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 20, right: 16, bottom: 36, left: 58 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxT = Math.max(...data.map(d => d.tonnage));
  const barW = Math.max(4, Math.floor(cW / data.length * 0.6));
  const gap   = cW / data.length;

  ctx.clearRect(0, 0, W, H);

  // Grille
  const steps = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= steps; i++) {
    const y = PAD.top + cH - (i / steps) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + cW, y); ctx.stroke();
    const v = Math.round(maxT * i / steps);
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    ctx.font = '10px -apple-system,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v >= 1000 ? (v/1000).toFixed(1)+'k' : v, PAD.left - 6, y + 3);
  }

  // Barres + labels semaine
  data.forEach(function(d, i) {
    const x = PAD.left + i * gap + gap / 2;
    const barH = maxT > 0 ? (d.tonnage / maxT) * cH : 0;
    const y = PAD.top + cH - barH;

    // Gradient bleu
    const grad = ctx.createLinearGradient(0, y, 0, PAD.top + cH);
    grad.addColorStop(0, '#3b82f6');
    grad.addColorStop(1, 'rgba(59,130,246,0.3)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - barW/2, y, barW, barH, [3,3,0,0])
                  : ctx.rect(x - barW/2, y, barW, barH);
    ctx.fill();

    // Label date lundi (ex: 09/06)
    ctx.fillStyle = 'rgba(15,23,42,0.45)';
    ctx.font = '9px -apple-system,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label || d.semaine, x, PAD.top + cH + 14);
  });
})();

function telechargerPDF() {
  const blob = new Blob([document.documentElement.outerHTML], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bilan-novalyz.html';
  a.click();
  URL.revokeObjectURL(a.href);
}
<\/script>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('⚠️ Autorise les pop-ups pour exporter', '#f59f00'); return; }
  w.document.write(html);
  w.document.close();
  w.focus();
}

// ==================== GRAPHIQUE POIDS ====================
let toutesLesPesees = [];

function afficherGraphiquePoids(poids) {
  toutesLesPesees = poids || [];
  filtrerGraphPoids('1m');
}

function filtrerGraphPoids(periode) {
  dessinerGraphPoids(toutesLesPesees, periode, { btn:'gp-', svg:'graph-poids-svg', actuel:'graph-poids-actuel', evol:'graph-poids-evol' });
}

let cdToutesLesPesees = [];
function afficherGraphiquePoidsCoach(poids) {
  cdToutesLesPesees = poids || [];
  cdFiltrerGraphPoids('1m');
}
function cdFiltrerGraphPoids(periode) {
  dessinerGraphPoids(cdToutesLesPesees, periode, { btn:'cd-gp-', svg:'cd-graph-poids-svg', actuel:'cd-graph-poids-actuel', evol:'cd-graph-poids-evol' });
}

function dessinerGraphPoids(pesees, periode, ids) {
  ['1m','3m','all'].forEach(p => {
    const btn = document.getElementById(ids.btn+p);
    if (!btn) return;
    btn.style.background = p === periode ? 'var(--accent)' : 'var(--surface2)';
    btn.style.color = p === periode ? 'var(--on-accent)' : 'var(--text-muted)';
    btn.style.fontWeight = p === periode ? '800' : '600';
  });

  const maintenant = new Date();
  let filtered = pesees.filter(p => {
    const parts = p.date.split('/');
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (periode === '1m') return d >= new Date(maintenant.getTime() - 30*24*3600*1000);
    if (periode === '3m') return d >= new Date(maintenant.getTime() - 90*24*3600*1000);
    return true;
  }).reverse(); // ordre chronologique

  if (filtered.length === 0) {
    document.getElementById(ids.svg).innerHTML = '<text x="160" y="50" text-anchor="middle" font-size="12" fill="var(--text-muted)">Aucune donnée sur cette période</text>';
    document.getElementById(ids.actuel).textContent = '—';
    document.getElementById(ids.evol).innerHTML = '';
    return;
  }

  // Poids actuel et évolution
  const dernier = filtered[filtered.length - 1];
  const premier = filtered[0];
  document.getElementById(ids.actuel).textContent = dernier.poids;
  if (filtered.length > 1) {
    const diff = (dernier.poids - premier.poids).toFixed(1);
    const sign = diff > 0 ? '▲' : '▼';
    const col = diff > 0 ? '#ff9500' : '#00a854';
    document.getElementById(ids.evol).innerHTML = `<span style="color:${col}">${sign} ${Math.abs(diff)}kg</span>`;
  } else {
    document.getElementById(ids.evol).innerHTML = '';
  }

  if (filtered.length < 2) {
    document.getElementById(ids.svg).innerHTML = `<text x="160" y="50" text-anchor="middle" font-size="12" fill="var(--text-muted)">Besoin d'au moins 2 pesées</text>`;
    return;
  }

  // Calcul du graphique
  const poids_vals = filtered.map(p => Number(p.poids));
  const rawMin = Math.min(...poids_vals), rawMax = Math.max(...poids_vals);
  const marge = Math.max(0.4, (rawMax - rawMin) * 0.15);
  const minP = rawMin - marge, maxP = rawMax + marge;
  const W = 320, H = 118, padL = 30, padR = 12, padT = 12, padB = 22;
  const gW = W - padL - padR;
  const gH = H - padT - padB;

  const toX = i => padL + (filtered.length === 1 ? gW/2 : (i / (filtered.length - 1)) * gW);
  const toY = v => padT + gH - ((v - minP) / (maxP - minP)) * gH;
  const uid = ids.svg;

  // Grille + libellés Y (min / milieu / max réels)
  let svg = `<defs><linearGradient id="grad-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
  const gridVals = [rawMax, (rawMax+rawMin)/2, rawMin];
  gridVals.forEach(v => {
    const y = toY(v);
    svg += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="2 3"/>`;
    svg += `<text x="${padL-6}" y="${(y+3).toFixed(1)}" font-size="9" fill="var(--text-muted)" text-anchor="end" style="font-variant-numeric:tabular-nums">${v.toFixed(1)}</text>`;
  });

  // Zone remplie
  const lastX = toX(filtered.length-1);
  const lastY = toY(Number(filtered[filtered.length-1].poids));
  const linePath = filtered.map((p,i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)} ${toY(Number(p.poids)).toFixed(1)}`).join(' ');
  svg += `<path d="${linePath} L ${lastX.toFixed(1)} ${H-padB} L ${padL} ${H-padB} Z" fill="url(#grad-${uid})"/>`;

  // Courbe
  svg += `<path d="${linePath}" fill="none" stroke="var(--accent-strong)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Points (seulement le dernier mis en valeur)
  filtered.forEach((p, i) => {
    const x = toX(i), y = toY(Number(p.poids));
    const isLast = i === filtered.length - 1;
    if (isLast) {
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="var(--accent-strong)" stroke="var(--surface)" stroke-width="2.5"/>`;
    } else if (filtered.length <= 12) {
      svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="var(--surface)" stroke="var(--accent-strong)" stroke-width="1.6"/>`;
    }
  });

  // Labels X (max 5)
  const step = Math.max(1, Math.floor(filtered.length / 4));
  filtered.forEach((p, i) => {
    if (i % step === 0 || i === filtered.length - 1) {
      const parts = p.date.split('/');
      const label = `${parts[0]}/${parts[1]}`;
      const isLast = i === filtered.length - 1;
      const col = isLast ? 'var(--accent-strong)' : 'var(--text-muted)';
      const anchor = i === 0 ? 'start' : isLast ? 'end' : 'middle';
      svg += `<text x="${toX(i).toFixed(1)}" y="${H-4}" font-size="9" fill="${col}" text-anchor="${anchor}" style="font-variant-numeric:tabular-nums;font-weight:${isLast?'700':'400'}">${label}</text>`;
    }
  });

  document.getElementById(ids.svg).setAttribute('viewBox', `0 0 ${W} ${H}`);
  document.getElementById(ids.svg).innerHTML = svg;
}


function terminerExercice() {
  if (!exoEnCours || exoEnCours.series.length === 0) {
    showToast('⚠️ Ajoute au moins une série !', '#ff4444'); return;
  }
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  document.getElementById('timer-overlay').classList.remove('active');
  document.getElementById('card-hors-programme').style.display = 'none';
  const nomFini = exoEnCours.exerciceNom;
  scrollVersProchain = true;
  retourListeSeance();
  showToast(`✅ ${nomFini} terminé !`);
}

// =====================================================================
// BLOC « ÉTAT DU JOUR » — synthèse du dernier questionnaire bien-être
// Barème stocké : sommeil/energie/ressenti → 5 = positif ;
//                 fatigue/douleur           → 5 = négatif (barème naturel).
// On ramène tout sur une échelle « positive » (5 = au top) pour le score.
// =====================================================================
const WQ_DIMS = [
  { key: 'sommeil',  label: 'Sommeil',  invert: false },
  { key: 'energie',  label: 'Énergie',  invert: false },
  { key: 'fatigue',  label: 'Fatigue',  invert: true  },
  { key: 'douleur',  label: 'Douleur',  invert: true  },
  { key: 'ressenti', label: 'Ressenti', invert: false }
];

// Réponses textuelles indexées par la note brute 1..5 (barème du questionnaire)
const WQ_ANSWERS = {
  sommeil:  ['—', 'Très mauvais', 'Mauvais', 'Moyen', 'Bon', 'Excellent'],
  energie:  ['—', 'Très faible', 'Faible', 'Normal', 'Élevé', 'Très élevé'],
  fatigue:  ['—', 'Aucune', 'Faible', 'Modérée', 'Importante', 'Très importante'],
  douleur:  ['—', 'Aucune', 'Légère', 'Modérée', 'Forte', 'Très forte'],
  ressenti: ['—', 'Très difficile', 'Difficile', 'Normale', 'Facile', 'Très facile']
};

function wqPositif(dim, val) {
  // Retourne une note 1..5 où 5 = positif, ou null si absent
  if (val == null || val === '' || isNaN(Number(val))) return null;
  const n = Number(val);
  return dim.invert ? (6 - n) : n;
}

function wqColor(pos) {
  if (pos >= 4)  return 'var(--good)';
  if (pos >= 3)  return 'var(--warn)';
  return 'var(--danger)';
}

/* =============================================================================
 * CONTEXTE DE PERFORMANCE — UI (Phase 4)  [NOYAU/UI]
 * -----------------------------------------------------------------------------
 * Rend visible l'état posé par le coach (carte + tag sur les analyses) et
 * permet de le poser via une modale (saveContexte / cloreContexte).
 * La LOGIQUE reste dans NovalyzContexte ; ici uniquement l'affichage.
 * ========================================================================== */
var ETATS_UI = {
  saison_normale:  { emoji: '',   couleur: 'var(--text-muted)', duree: null },
  deload:          { emoji: '📉', couleur: 'var(--warn)',       duree: 7  },
  retour_vacances: { emoji: '🌴', couleur: 'var(--accent)',     duree: 14 },
  retour_blessure: { emoji: '🩹', couleur: 'var(--violet)',     duree: 21 },
  intensification: { emoji: '🔥', couleur: 'var(--danger)',     duree: 14 }
};
function _ctxLibelle(cle) {
  var E = (typeof NovalyzContexte !== 'undefined' && NovalyzContexte.ETATS) ? NovalyzContexte.ETATS : {};
  return (E[cle] && E[cle].libelle) || cle;
}
function _ctxUI(cle) { return ETATS_UI[cle] || ETATS_UI.saison_normale; }
function _ctxActif(contexte) { return !!(contexte && contexte.etat && contexte.etat !== 'saison_normale'); }

// Carte « Contexte de performance ». Le CHOIX de l'état est réservé au coach /
// préparateur : le joueur voit son contexte (posé par le coach) mais ne l'édite pas.
// `source` route le rechargement après écriture : 'foot' | 'muscu' | 'athlete'.
// Éditable si : vue coach muscu ('muscu') OU vue foot en mode coach.
function carteContexteHTML(contexte, athlete_id, source) {
  var actif = _ctxActif(contexte);
  var cle = actif ? contexte.etat : 'saison_normale';
  var ui = _ctxUI(cle);
  var col = actif ? ui.couleur : 'var(--text-muted)';
  var titre = (actif && ui.emoji ? ui.emoji + ' ' : '') + escapeHtml(_ctxLibelle(cle));
  var sous = actif
    ? escapeHtml((contexte.date_debut || '') + (contexte.date_fin ? ' → ' + contexte.date_fin : '') + (contexte.jours_restants != null ? ' · ' + contexte.jours_restants + 'j restants' : ''))
    : 'Aucun ajustement — analyses standard.';
  var aid = String(athlete_id || '');
  var src = source || 'muscu';
  var editable = (src === 'muscu') || (src === 'foot' && typeof cdMode !== 'undefined' && cdMode === 'coach');
  var boutons = editable
    ? '<div style="display:flex;gap:8px;margin-top:12px;">'
      + '<button onclick="ouvrirModaleContexte(\'' + aid + '\',\'' + src + '\')" style="flex:1;background:var(--accent);border:none;color:var(--on-accent);border-radius:9px;padding:9px;font-size:12.5px;font-weight:800;cursor:pointer;">' + (actif ? 'Changer l\'état' : 'Poser un état') + '</button>'
      + (actif ? '<button onclick="terminerContexte(\'' + aid + '\',\'' + src + '\')" style="border:1px solid var(--border);background:var(--surface2);color:var(--text);border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:700;cursor:pointer;">Terminer</button>' : '')
      + '</div>'
    : '';
  return '<div class="dash-card" style="padding:14px;margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px;">Contexte de performance</div>'
    + '<div style="display:flex;align-items:center;gap:9px;">'
    + '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';flex-shrink:0;"></span>'
    + '<div style="min-width:0;"><div style="font-size:15px;font-weight:800;">' + titre + '</div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + sous + '</div></div>'
    + '</div>' + boutons + '</div>';
}

// Carte « En vacances » : reflète la pause (mode vacances) posée dans Réglages.
// La pause et le contexte de performance sont deux mécanismes distincts ; côté
// Accueil on montre en priorité la pause active pour que l'athlète voie bien
// que ses dates sont prises en compte (sinon la carte contexte affiche
// « Saison normale », ce qui donne l'impression que rien n'a été enregistré).
function carteVacancesHTML(pause) {
  var col = '#63b3ed';
  var jours = null;
  if (pause && pause.fin) {
    var f = _dateISOtoLocal(pause.fin);
    if (f) { var t = new Date(); t.setHours(0,0,0,0); jours = Math.max(0, Math.round((f - t) / 86400000)); }
  }
  var frDeb = pause && pause.debut ? String(pause.debut).split('-').reverse().join('/') : '';
  var frFin = pause && pause.fin ? String(pause.fin).split('-').reverse().join('/') : '';
  var sous = (frDeb ? frDeb : '') + (frFin ? (frDeb ? ' → ' : "jusqu'au ") + frFin : '')
           + (jours != null ? ' · ' + jours + 'j restants' : '');
  return '<div class="dash-card" style="padding:14px;margin-bottom:12px;">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px;">Contexte de performance</div>'
    + '<div style="display:flex;align-items:center;gap:9px;">'
    + '<span style="width:10px;height:10px;border-radius:50%;background:' + col + ';flex-shrink:0;"></span>'
    + '<div style="min-width:0;"><div style="font-size:15px;font-weight:800;">🏝️ En vacances</div>'
    + '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(sous || 'Alertes en pause — reprise automatique à la fin.') + '</div></div>'
    + '</div></div>';
}

// Rendu dans un conteneur. `source` = vue d'origine (pour le rechargement).
// Si l'athlète est en pause (mode vacances), on affiche la carte vacances.
function renderCarteContexte(contexte, athlete_id, containerId, source, pause) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (pause && estEnPause(pause)) { el.innerHTML = carteVacancesHTML(pause); return; }
  el.innerHTML = carteContexteHTML(contexte, athlete_id, source);
}

// --- Modale de saisie (coach) --------------------------------------------
var _ctxCible = { athlete_id: null, source: null, choix: null };
function _ctxDetecterSource() {
  var ov = document.getElementById('detail-joueur-overlay');
  if (ov && ov.style.display && ov.style.display !== 'none') return 'foot';
  return 'muscu';
}
function ouvrirModaleContexte(athlete_id, source) {
  _ctxCible = { athlete_id: String(athlete_id || ''), source: source || _ctxDetecterSource(), choix: null };
  var chips = '';
  var E = (typeof NovalyzContexte !== 'undefined' && NovalyzContexte.ETATS) ? NovalyzContexte.ETATS : {};
  for (var cle in E) {
    if (!Object.prototype.hasOwnProperty.call(E, cle) || cle === 'saison_normale') continue;
    var ui = _ctxUI(cle);
    chips += '<button type="button" data-ctx="' + cle + '" onclick="_ctxChoisir(\'' + cle + '\')" style="flex:0 0 auto;font-size:12.5px;font-weight:700;padding:9px 13px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);color:var(--text-muted);cursor:pointer;">' + (ui.emoji ? ui.emoji + ' ' : '') + escapeHtml(_ctxLibelle(cle)) + '</button>';
  }
  document.getElementById('ctx-modale-chips').innerHTML = chips;
  document.getElementById('ctx-modale-debut').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ctx-modale-fin').value = '';
  document.getElementById('ctx-modale-note').value = '';
  document.getElementById('ctx-modale-hint').textContent = 'Choisis un état : la date de fin se pré-remplit.';
  document.getElementById('modal-contexte').style.display = 'flex';
}
function _ctxChoisir(cle) {
  _ctxCible.choix = cle;
  var nodes = document.querySelectorAll('#ctx-modale-chips [data-ctx]');
  for (var i = 0; i < nodes.length; i++) {
    var on = nodes[i].getAttribute('data-ctx') === cle;
    nodes[i].style.background = on ? 'var(--accent-a14)' : 'var(--surface2)';
    nodes[i].style.borderColor = on ? 'var(--accent-dim)' : 'var(--border)';
    nodes[i].style.color = on ? 'var(--accent)' : 'var(--text-muted)';
  }
  var ui = _ctxUI(cle);
  if (ui.duree) { var d = new Date(); d.setDate(d.getDate() + ui.duree); document.getElementById('ctx-modale-fin').value = d.toISOString().slice(0, 10); }
  document.getElementById('ctx-modale-hint').innerHTML = 'État : <b style="color:var(--text)">' + escapeHtml(_ctxLibelle(cle)) + '</b> · durée par défaut ' + (ui.duree || '—') + ' j.';
}
function fermerModaleContexte() { var m = document.getElementById('modal-contexte'); if (m) m.style.display = 'none'; }
async function poserContexte() {
  if (!_ctxCible.choix) { document.getElementById('ctx-modale-hint').textContent = 'Choisis d\'abord un état.'; return; }
  await _ctxEnvoyer({
    action: 'saveContexte', athlete_id: _ctxCible.athlete_id, etat: _ctxCible.choix,
    date_debut: document.getElementById('ctx-modale-debut').value,
    date_fin: document.getElementById('ctx-modale-fin').value,
    note: document.getElementById('ctx-modale-note').value, source: 'coach'
  }, _ctxCible.athlete_id, _ctxCible.source);
}
async function terminerContexte(athlete_id, source) {
  if (!confirm('Terminer l\'état de contexte en cours ?')) return;
  await _ctxEnvoyer({ action: 'cloreContexte', athlete_id: String(athlete_id || '') }, athlete_id, source || _ctxDetecterSource());
}
async function _ctxEnvoyer(body, aid, source) {
  // text/plain → pas de préflight CORS ET réponse lisible : on ATTEND la
  // confirmation d'écriture (+ vidage du cache serveur) avant de recharger.
  // Évite la course « écrit sur le Sheet mais l'UI montre encore l'ancien état ».
  try {
    var r = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    await r.json();
  } catch (e) {}
  fermerModaleContexte();
  if (typeof showToast === 'function') showToast('Contexte mis à jour');
  _ctxRecharger(aid, source);
}
function _ctxRecharger(athlete_id, source) {
  if (source === 'foot') {
    // Préserve le mode courant (coach édite / joueur consulte sa page).
    if (typeof ouvrirDetailJoueurFoot === 'function') ouvrirDetailJoueurFoot(athlete_id, (typeof cdMode !== 'undefined' ? cdMode : 'coach'));
  } else if (source === 'athlete') {
    if (typeof chargerAppData === 'function') chargerAppData();
  } else if (typeof ouvrirDetailAthleteCoach === 'function' && typeof coachAthleteCourant !== 'undefined' && coachAthleteCourant) {
    ouvrirDetailAthleteCoach(coachAthleteCourant, null);
  }
}

function renderEtatDuJour(data, ids) {
  ids = ids || { sec: 'dash-etat-sec', card: 'dash-etat-card', cont: 'dash-etat-content' };
  const sec  = document.getElementById(ids.sec);
  const card = document.getElementById(ids.card);
  const cont = document.getElementById(ids.cont);
  if (!card || !cont) return;

  const be = (data && Array.isArray(data.bien_etre)) ? data.bien_etre : [];
  if (be.length === 0) { sec.style.display = 'none'; card.style.display = 'none'; return; }

  const dernier = be[0];

  // Score général du dernier questionnaire (moyenne des dimensions renseignées)
  const positifs = WQ_DIMS.map(d => ({ d, pos: wqPositif(d, dernier[d.key]) }));
  const renseignes = positifs.filter(p => p.pos != null);
  if (renseignes.length === 0) { sec.style.display = 'none'; card.style.display = 'none'; return; }

  const moy = renseignes.reduce((a, p) => a + p.pos, 0) / renseignes.length;
  const score100 = Math.round((moy - 1) / 4 * 100);

  // Libellé + couleur du score
  let label, col;
  if      (moy >= 4.2) { label = 'Excellente forme'; col = 'var(--good)'; }
  else if (moy >= 3.4) { label = 'Bonne forme';      col = 'var(--good)'; }
  else if (moy >= 2.6) { label = 'Forme correcte';   col = 'var(--warn)'; }
  else if (moy >= 1.8) { label = 'Vigilance';        col = 'var(--warn)'; }
  else                 { label = 'Récup conseillée'; col = 'var(--danger)'; }

  // Tendance vs moyenne des questionnaires précédents (jusqu'à 3)
  let trendHtml = '';
  const precs = be.slice(1, 4).map(q => {
    const ps = WQ_DIMS.map(d => wqPositif(d, q[d.key])).filter(v => v != null);
    return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
  }).filter(v => v != null);
  if (precs.length) {
    const moyPrec = precs.reduce((a, b) => a + b, 0) / precs.length;
    const delta = moy - moyPrec;
    if (delta > 0.25)      trendHtml = `<span style="color:var(--good);font-weight:700;">↗ en hausse</span>`;
    else if (delta < -0.25) trendHtml = `<span style="color:var(--danger);font-weight:700;">↘ en baisse</span>`;
    else                    trendHtml = `<span style="color:var(--text-muted);font-weight:700;">→ stable</span>`;
  }

  // Point faible dominant (plus basse note positive)
  const faible = renseignes.slice().sort((a, b) => a.pos - b.pos)[0];
  const phrasesFaible = {
    sommeil:  'sommeil dégradé',
    energie:  'énergie basse',
    fatigue:  'fatigue musculaire marquée',
    douleur:  'douleur présente' + (dernier.zone ? ' (' + dernier.zone + ')' : ''),
    ressenti: 'dernière séance ressentie difficile'
  };
  let synthese;
  if (moy >= 3.4)      synthese = 'Bonne disponibilité — prêt à performer.';
  else if (moy >= 2.6) synthese = 'Forme correcte — surveille : ' + phrasesFaible[faible.d.key] + '.';
  else                 synthese = 'Point de vigilance : ' + phrasesFaible[faible.d.key] + '. Privilégie la récup ou allège les charges.';

  // Segments : 5 dimensions du ressenti en points colorés (pas de piège de longueur)
  const segments = WQ_DIMS.map(d => {
    const raw = (dernier[d.key] == null || dernier[d.key] === '' || isNaN(Number(dernier[d.key]))) ? null : Number(dernier[d.key]);
    let c = 'var(--border)';
    if (raw != null) {
      const bon = d.invert ? raw <= 2 : raw >= 4;
      const moyen = raw === 3;
      c = bon ? 'var(--good)' : moyen ? 'var(--warn)' : 'var(--danger)';
    }
    const txt = raw != null ? (WQ_ANSWERS[d.key] ? WQ_ANSWERS[d.key][raw] : raw) : '—';
    return `
      <div style="flex:1;text-align:center;min-width:0;">
        <div style="height:6px;border-radius:20px;margin-bottom:6px;background:${c};"></div>
        <div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);font-weight:700;">${d.label}</div>
        <div style="font-size:10px;font-weight:800;margin-top:2px;color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${txt}</div>
      </div>`;
  }).join('');

  // Perf réelle de la dernière séance (RPE / exercices / séries) — propres à la séance
  const ds = (data && data.recent && data.recent.derniere_seance) ? data.recent.derniere_seance : null;
  const nomSeance = (ds && ds.seance_id && String(ds.seance_id).trim() && String(ds.seance_id).toLowerCase() !== 'null') ? String(ds.seance_id).trim() : '';
  const dateSeance = ds && ds.date ? ds.date : '';
  const sousTitre = (nomSeance ? 'Séance ' + escapeHtml(nomSeance) : 'Dernière séance') + (dateSeance ? ' · ' + dateSeance : '');
  const perfChip = (v, k) => `<div style="flex:1;background:var(--surface2);border-radius:10px;padding:7px 4px;text-align:center;"><div style="font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;">${v}</div><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--text-muted);margin-top:1px;">${k}</div></div>`;
  let perfHtml = '';
  if (ds) {
    const rpe = (ds.rpe_moyen != null && ds.rpe_moyen !== 'N/A') ? ds.rpe_moyen : '—';
    // Tonnage réel de la séance (somme charge×reps, calculé côté serveur). Fallback séries si absent.
    const tonn = (ds.tonnage_t != null) ? ds.tonnage_t + ' t' : null;
    perfHtml = `<div style="display:flex;gap:7px;margin-top:11px;">
      ${perfChip(rpe, 'RPE moyen')}
      ${tonn != null ? perfChip(tonn, 'Tonnage') : perfChip(ds.nb_series != null ? ds.nb_series : '—', 'Séries')}
      ${perfChip(ds.nb_exercices != null ? ds.nb_exercices : '—', 'Exercices')}
    </div>`;
  }

  cont.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="min-width:0;">
        <div style="font-size:15px;font-weight:800;color:${col};">${label}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${sousTitre}${trendHtml ? ' · ' + trendHtml : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-size:30px;font-weight:800;color:${col};line-height:1;">${score100}<span style="font-size:13px;color:var(--text-muted);font-weight:600;">/100</span></div>
      </div>
    </div>
    ${perfHtml}
    <div style="display:flex;gap:5px;margin-top:13px;">${segments}</div>
    <div style="margin-top:12px;padding:10px 12px;background:var(--surface2);border-radius:10px;font-size:12.5px;color:var(--text);line-height:1.45;">${synthese}</div>`;

  sec.style.display = '';
  card.style.display = '';
}

// Version coach du bloc « Bilan de la dernière séance » (mêmes calculs, cibles cd-*)
function renderEtatDuJourCoach(data) {
  renderEtatDuJour(data, { sec: 'cd-etat-sec', card: 'cd-etat-card', cont: 'cd-etat-content' });
}

// Carte « Analyse » (moteur Novalyz) — interprétation en lecture seule, côté coach
// Couleur / icône d'une analyse du moteur (partagé)
function analyseCouleur(t) { return t === 'critical' ? 'var(--danger)' : t === 'warning' ? 'var(--warn)' : t === 'success' ? 'var(--good)' : 'var(--accent)'; }
function analyseIcone(t) { return t === 'critical' ? '🔴' : t === 'warning' ? '🟠' : t === 'success' ? '✅' : '💡'; }

// Rendu partagé : liste d'analyses du moteur dans un conteneur (athlète ET coach)
function renderAnalysesListe(data, ids, opts) {
  opts = opts || {};
  const sec = document.getElementById(ids.sec);
  const card = document.getElementById(ids.card);
  const cont = document.getElementById(ids.cont);
  if (!card || !cont) return 0;
  let analyses = [];
  try { if (typeof NovalyzEngine !== 'undefined') analyses = NovalyzEngine.analyser(data) || []; } catch (e) { analyses = []; }
  if (opts.max) analyses = analyses.slice(0, opts.max);
  if (!analyses.length) { if (sec) sec.style.display = 'none'; card.style.display = 'none'; return 0; }
  // Bandeau contexte : le « pourquoi ». Présent si une analyse porte un état actif.
  let _etatAna = null;
  for (let _k = 0; _k < analyses.length; _k++) { if (analyses[_k].contexte && analyses[_k].contexte !== 'saison_normale') { _etatAna = analyses[_k].contexte; break; } }
  const _bandeauCtx = _etatAna
    ? `<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:9px;margin-bottom:10px;background:var(--surface2);border:1px solid var(--border);font-size:12px;font-weight:700;color:var(--text-muted);"><span>🧠</span> Analyses ajustées pour : <b style="color:var(--text);">${escapeHtml(_ctxLibelle(_etatAna))}</b></div>`
    : '';
  cont.innerHTML = _bandeauCtx + analyses.map((a, i) => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:10px 4px;${i < analyses.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
      <div style="flex:0 0 4px;align-self:stretch;background:${analyseCouleur(a.type)};border-radius:2px;min-height:36px;"></div>
      <div style="min-width:0;">
        <div style="font-size:13px;font-weight:800;color:${analyseCouleur(a.type)};">${analyseIcone(a.type)} ${escapeHtml(a.titre)}</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.45;margin-top:2px;">${escapeHtml(a.description)}</div>
        ${opts.hideCategorie ? '' : `<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;opacity:.7;">${escapeHtml(a.categorie)}</div>`}
      </div>
    </div>`).join('');
  if (sec) sec.style.display = '';
  card.style.display = '';
  return analyses.length;
}

function renderAnalyseCoach(data) {
  renderAnalysesListe(data, { sec: 'cd-analyse-sec', card: 'cd-analyse-card', cont: 'cd-analyse-content' });
}

// Accueil athlète : conseils du moteur (2 max, sans la catégorie)
function renderAnalyseAccueilAthlete(data) {
  renderAnalysesListe(data, { sec: 'dash-analyse-sec', card: 'dash-analyse-card', cont: 'dash-analyse-content' }, { max: 2, hideCategorie: true });
}

// =====================================================================
// BLOC « ALERTES » — stagnation / absence / fatigue (masqué si aucune)
// =====================================================================
// ===== Mode vacances / pause =====
function _dateISOtoLocal(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function estEnPause(pause) {
  if (!pause) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = _dateISOtoLocal(pause.debut), f = _dateISOtoLocal(pause.fin);
  if (d && today < d) return false;
  if (f && today > f) return false;
  return !!(d || f);
}
// Remplit l'écran Réglages avec la pause actuelle (depuis les données chargées)
function majUiPause() {
  const p = (dernierAppData && dernierAppData.pause) ? dernierAppData.pause : null;
  const inpD = document.getElementById('pause-debut');
  const inpF = document.getElementById('pause-fin');
  const stat = document.getElementById('pause-statut');
  if (!inpD || !inpF || !stat) return;
  inpD.value = p && p.debut ? p.debut : '';
  inpF.value = p && p.fin ? p.fin : '';
  if (estEnPause(p)) {
    stat.style.display = 'block';
    stat.textContent = '🏝️ Pause active' + (p.fin ? ' jusqu\'au ' + p.fin.split('-').reverse().join('/') : '');
  } else {
    stat.style.display = 'none';
  }
}
async function enregistrerPause() {
  if (!athlete) return;
  const debut = document.getElementById('pause-debut').value;
  const fin   = document.getElementById('pause-fin').value;
  if (!debut && !fin) { showToast('⚠️ Choisis au moins une date', '#f59f00'); return; }
  if (debut && fin && fin < debut) { showToast('⚠️ La fin est avant le début', '#f59f00'); return; }
  try {
    await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setPauseAthlete', athlete_id: athlete.athlete_id, debut: debut, fin: fin }) });
    if (dernierAppData) dernierAppData.pause = { debut: debut, fin: fin };
    majUiPause();
    showToast('🏝️ Mode vacances activé');
  } catch (e) { showToast('❌ Erreur', '#ff4444'); }
}
async function annulerPause() {
  if (!athlete) return;
  try {
    await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setPauseAthlete', athlete_id: athlete.athlete_id, debut: '', fin: '' }) });
    if (dernierAppData) dernierAppData.pause = null;
    majUiPause();
    showToast('Pause annulée');
  } catch (e) { showToast('❌ Erreur', '#ff4444'); }
}

// ===== Notifications push (Étape A : messages) =============================
// Clé publique VAPID (l'app server est identifié côté backend par la clé privée,
// stockée dans les secrets Supabase). Publique = pas secrète.
const NOVALYZ_VAPID_PUBLIC = 'BIzG073IKmX56aYIpl1JPg-od65mAxCYhQ5r7SkgH0h02UAPBFw8Vi9_mmcAXnIJ7Xo3KS77HUr4ALXo6DU38LA';

function _urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// true si le navigateur peut faire du push (et, sur iOS, seulement en PWA installée)
function _pushSupporte() {
  return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}
function _estIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent); }
function _estInstalle() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Met à jour la carte Réglages > Notifications selon l'état réel de l'abonnement.
async function majUiPush() {
  const card = document.getElementById('push-card');
  const stat = document.getElementById('push-statut');
  const bOn  = document.getElementById('push-btn-on');
  const bOff = document.getElementById('push-btn-off');
  const hint = document.getElementById('push-hint');
  if (!card) return;
  card.style.display = 'block';

  if (!_pushSupporte()) {
    if (bOn) bOn.style.display = 'none';
    if (bOff) bOff.style.display = 'none';
    if (stat) { stat.style.display = 'block'; stat.style.color = 'var(--text-muted)'; stat.textContent = 'Non disponible sur ce navigateur.'; }
    if (hint) hint.textContent = '';
    return;
  }
  // iOS : le push n'existe que si l'app est ajoutée à l'écran d'accueil.
  if (_estIOS() && !_estInstalle()) {
    if (bOn) bOn.style.display = 'none';
    if (bOff) bOff.style.display = 'none';
    if (stat) { stat.style.display = 'none'; }
    if (hint) hint.innerHTML = '📲 Sur iPhone, ajoute d\'abord l\'app à ton écran d\'accueil (bouton Partager → « Sur l\'écran d\'accueil »), puis rouvre-la depuis l\'icône pour activer les notifications.';
    return;
  }

  let sub = null;
  try {
    const reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
  } catch (_) {}
  const actif = !!sub && Notification.permission === 'granted';
  const bTest = document.getElementById('push-btn-test');

  if (actif) {
    if (bOn) bOn.style.display = 'none';
    if (bOff) bOff.style.display = 'inline-block';
    if (bTest) bTest.style.display = 'block';
    if (stat) { stat.style.display = 'block'; stat.style.color = 'var(--good)'; stat.textContent = '🔔 Notifications activées'; }
    if (hint) hint.textContent = '';
  } else {
    if (bOn) { bOn.style.display = 'inline-block'; bOn.textContent = 'Activer les notifications'; }
    if (bOff) bOff.style.display = 'none';
    // Le test interroge le serveur par compte : on le laisse accessible même
    // si l'abonnement local semble inactif (utile pour diagnostiquer).
    if (bTest) bTest.style.display = 'block';
    if (stat) stat.style.display = 'none';
    if (hint) hint.textContent = (Notification.permission === 'denied')
      ? 'Les notifications sont bloquées dans les réglages de ton navigateur. Autorise-les pour Novalyz puis reviens ici.'
      : '';
  }
}

async function activerNotifications() {
  if (!athlete) { showToast('Connecte-toi d\'abord'); return; }
  if (!_pushSupporte()) { showToast('Non disponible sur ce navigateur'); return; }
  if (_estIOS() && !_estInstalle()) { majUiPush(); return; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { showToast('⚠️ Autorisation refusée', '#f59f00'); majUiPush(); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(NOVALYZ_VAPID_PUBLIC),
      });
    }
    const raw = sub.toJSON();
    const resp = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'savePushSub', athlete_id: athlete.athlete_id,
        endpoint: sub.endpoint, p256dh: raw.keys && raw.keys.p256dh, auth: raw.keys && raw.keys.auth,
        user_agent: navigator.userAgent,
      }),
    });
    let ok = false;
    try { const j = await resp.json(); ok = !!j.success; if (!ok && j.error) console.warn('savePushSub:', j.error); } catch (_) {}
    if (!ok) { showToast('❌ Enregistrement serveur échoué', '#ff4444'); majUiPush(); return; }
    showToast('🔔 Notifications activées');
    majUiPush();
  } catch (e) {
    showToast('❌ Impossible d\'activer', '#ff4444');
    majUiPush();
  }
}

async function desactiverNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch (_) {}
      await fetch(SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deletePushSub', endpoint }),
      });
    }
    showToast('Notifications désactivées');
    majUiPush();
  } catch (e) { showToast('❌ Erreur', '#ff4444'); majUiPush(); }
}

// Diagnostic : demande au serveur d'envoyer une notif de test à CE compte et
// affiche précisément où ça casse (secrets ? abonnement ? service push ?).
async function testerNotifications() {
  if (!athlete) return;
  const diag = document.getElementById('push-diag');
  if (diag) { diag.style.display = 'block'; diag.style.color = 'var(--text-muted)'; diag.textContent = '⏳ Test en cours…'; }
  try {
    const resp = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'testPush', athlete_id: athlete.athlete_id }),
    });
    const j = await resp.json();
    let txt, col = 'var(--danger)';
    if (j && j.erreur) { txt = '❌ Erreur serveur : ' + j.erreur; }
    else if (!j || !j.vapid) { txt = '❌ Clés VAPID absentes côté serveur (secrets Supabase à configurer).'; }
    else if (!j.subsFound) { txt = '❌ Aucun abonnement enregistré pour ce compte. Appuie sur « Activer les notifications ».'; }
    else if (j.sent > 0) { txt = '✅ Notif envoyée (' + j.sent + '/' + j.subsFound + '). Elle doit apparaître dans quelques secondes.'; col = 'var(--good)'; }
    else {
      const e = (j.results && j.results[0]) || {};
      txt = '❌ Envoi refusé par le service push' + (e.code ? ' (code ' + e.code + ')' : '') + (e.msg ? ' : ' + e.msg : '') + '.';
    }
    if (diag) { diag.style.color = col; diag.textContent = txt; }
  } catch (e) {
    if (diag) { diag.style.color = 'var(--danger)'; diag.textContent = '❌ Erreur réseau pendant le test.'; }
  }
}

// Cible d'ouverture demandée par une notif reçue avant que l'app soit prête
// (clic sur notif app fermée). Consommée à la fin de la connexion athlète.
var _notifPending = null;

// Ouvre la conversation à la suite d'un clic sur une notif de message.
function _ouvrirConversationNotif() {
  // Joueur foot : overlay ouvert → onglet Conversation (index 3).
  var ov = document.getElementById('detail-joueur-overlay');
  if (ov && ov.style.display && ov.style.display !== 'none' && typeof switchDetailJoueurTab === 'function') {
    switchDetailJoueurTab(3);
    return;
  }
  // Athlète muscu : onglet Conversation.
  if (typeof switchTab === 'function' && document.getElementById('tab-conseils')) {
    switchTab('conseils');
  }
}

function _gererNotifTarget(target) {
  if (!target) return;
  if (target === 'conversation') _ouvrirConversationNotif();
}

// Consomme la cible en attente, mais seulement une fois l'athlète connecté
// (sinon on garde _notifPending et la connexion la rejouera).
function _consommerNotifPending() {
  if (!_notifPending) return;
  if (typeof athlete === 'undefined' || !athlete) return;
  var t = _notifPending; _notifPending = null;
  setTimeout(function () { _gererNotifTarget(t); }, 500);
}

// Lit (et vide) la cible déposée par le SW dans le cache 'novalyz-notif'.
// Appelée au démarrage, au retour au premier plan, et sur ping du SW.
function _checkNotifCache() {
  try {
    if (!('caches' in window)) return;
    caches.open('novalyz-notif').then(function (c) {
      c.match('pending-target').then(function (r) {
        if (!r) return;
        r.text().then(function (t) {
          try { c.delete('pending-target'); } catch (e) {}
          if (t) {
            _notifPending = t;
            if (typeof showToast === 'function') showToast('🔔 Ouverture : ' + t);  // diag (temporaire)
            _consommerNotifPending();
          }
        });
      });
    }).catch(function () {});
  } catch (e) {}
}

// ===== Montre connectée — Google Health (Fitbit via compte Google) =========
// Étape A : connexion OAuth. La clé publique (Client ID) n'est pas secrète.
const GOOGLE_CLIENT_ID = '1045768686321-ln365kpvvdiqel2ssscfj096cfjcge6b.apps.googleusercontent.com';
// Scopes de LECTURE : activités/fitness + mesures de santé (fréquence cardiaque).
const GOOGLE_HEALTH_SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly';

// URI de redirection = dossier courant de l'app (retire un éventuel index.html).
// Doit correspondre EXACTEMENT à l'URI enregistré dans la console Google.
function _ghRedirectUri() { return location.origin + location.pathname.replace(/[^/]*$/, ''); }

function connecterGoogleHealth() {
  if (!athlete) { showToast('Connecte-toi d\'abord'); return; }
  var state = Math.random().toString(36).slice(2) + '.' + Date.now();
  localStorage.setItem('gh_oauth_state', state);
  localStorage.setItem('gh_oauth_athlete', athlete.athlete_id || '');
  var url = 'https://accounts.google.com/o/oauth2/v2/auth'
    + '?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(_ghRedirectUri())
    + '&response_type=code'
    + '&scope=' + encodeURIComponent(GOOGLE_HEALTH_SCOPE)
    + '&access_type=offline'      // pour obtenir un refresh_token
    + '&prompt=consent'
    + '&include_granted_scopes=true'
    + '&state=' + encodeURIComponent(state);
  window.location.href = url;
}

// Traite le retour de Google (?code=…&state=…) au démarrage de l'app.
async function _traiterRetourGoogleHealth() {
  var params;
  try { params = new URLSearchParams(location.search); } catch (e) { return; }
  var code = params.get('code');
  var state = params.get('state');
  var err = params.get('error');
  if (!code && !err) return;              // pas un retour Google
  var savedState = localStorage.getItem('gh_oauth_state');
  var aid = localStorage.getItem('gh_oauth_athlete') || (athlete && athlete.athlete_id) || '';
  if (history.replaceState) history.replaceState(null, '', location.pathname);  // nettoie l'URL
  if (err) { showToast('❌ Autorisation refusée', '#ff4444'); return; }
  if (!savedState || state !== savedState) { showToast('❌ Autorisation invalide (sécurité)', '#ff4444'); return; }
  localStorage.removeItem('gh_oauth_state');
  try {
    var resp = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthCallback', code: code, redirect_uri: _ghRedirectUri(), athlete_id: aid }),
    });
    var j = await resp.json();
    if (j && j.success) showToast('⌚ Montre connectée !');
    else showToast('❌ Connexion échouée' + (j && j.error ? ' : ' + j.error : ''), '#ff4444');
  } catch (e) { showToast('❌ Erreur réseau', '#ff4444'); }
  try { majUiGoogleHealth(); } catch (e) {}
}

async function majUiGoogleHealth() {
  var card = document.getElementById('gh-card');
  if (!card || !athlete) return;
  var stat = document.getElementById('gh-statut');
  var bOn = document.getElementById('gh-btn-on');
  var bOff = document.getElementById('gh-btn-off');
  try {
    var resp = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthStatus', athlete_id: athlete.athlete_id }),
    });
    var j = await resp.json();
    var bSync = document.getElementById('gh-btn-sync');
    if (j && j.connected) {
      if (bOn) bOn.style.display = 'none';
      if (bOff) bOff.style.display = 'inline-block';
      if (bSync) bSync.style.display = 'block';
      if (stat) { stat.style.display = 'block'; stat.style.color = 'var(--good)'; stat.textContent = '⌚ Montre connectée'; }
    } else {
      if (bOn) bOn.style.display = 'inline-block';
      if (bOff) bOff.style.display = 'none';
      if (bSync) bSync.style.display = 'none';
      if (stat) stat.style.display = 'none';
    }
  } catch (e) {}
}

// Importe les activités de la montre dans le bloc cardio, puis recharge.
async function synchroniserGoogleHealth() {
  if (!athlete) return;
  var info = document.getElementById('gh-sync-info');
  var btn = document.getElementById('gh-btn-sync');
  if (info) { info.style.display = 'block'; info.style.color = 'var(--text-muted)'; info.textContent = '⏳ Synchronisation en cours…'; }
  if (btn) btn.disabled = true;
  try {
    var resp = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthSync', athlete_id: athlete.athlete_id }),
    });
    var j = await resp.json();
    if (j && j.success) {
      var n = j.imported || 0;
      var ns = j.stepsImported || 0;
      var msg = '✅ ' + n + ' activité' + (n > 1 ? 's' : '') + ' + ' + ns + ' jour' + (ns > 1 ? 's' : '') + ' de pas importé' + (ns > 1 ? 's' : '') + '.';
      if (j.stepsError) msg += ' ⚠️ pas : ' + j.stepsError;
      if (info) { info.style.color = j.stepsError ? 'var(--warn)' : 'var(--good)'; info.textContent = msg; }
      showToast('⌚ ' + n + ' activité' + (n > 1 ? 's' : '') + ' · ' + ns + ' j de pas');
      try { if (typeof chargerAppData === 'function') chargerAppData(); } catch (e) {}
    } else {
      if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ Échec' + (j && j.error ? ' : ' + j.error : '') + '.'; }
    }
  } catch (e) {
    if (info) { info.style.color = 'var(--danger)'; info.textContent = '❌ Erreur réseau pendant la synchronisation.'; }
  }
  if (btn) btn.disabled = false;
}

async function deconnecterGoogleHealth() {
  if (!athlete) return;
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthDisconnect', athlete_id: athlete.athlete_id }),
    });
    showToast('Montre déconnectée');
  } catch (e) { showToast('❌ Erreur', '#ff4444'); }
  majUiGoogleHealth();
}

// Synchro automatique à la connexion (au plus 1×/6h par athlète, donc ≥ 1×/24h),
// AVEC un retour visible (toast). Si la montre n'est pas connectée : rien.
async function autoSyncGoogleHealth() {
  if (!athlete) return;
  var key = 'gh_last_autosync_' + athlete.athlete_id;
  var last = +(localStorage.getItem(key) || 0);
  if (Date.now() - last < 6 * 3600 * 1000) return;   // déjà synchronisé récemment
  try {
    // 1) La montre est-elle connectée ? (sinon on ne consomme pas le délai)
    var sr = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthStatus', athlete_id: athlete.athlete_id }),
    });
    var sj = await sr.json();
    if (!sj || !sj.connected) return;
    // 2) Montre connectée → on synchronise avec un message visible.
    localStorage.setItem(key, String(Date.now()));
    if (typeof showToast === 'function') showToast('⌚ Synchronisation de la montre…', 'var(--text-muted)');
    var r = await fetch(SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'googleHealthSync', athlete_id: athlete.athlete_id }),
    });
    var j = await r.json();
    if (j && j.success) {
      var n = j.imported || 0, ns = j.stepsImported || 0;
      if (n > 0 || ns > 0) {
        if (typeof showToast === 'function') showToast('⌚ Montre synchronisée · ' + n + ' act. · ' + ns + ' j de pas', 'var(--good)');
        if (typeof chargerAppData === 'function') chargerAppData();
      } else {
        if (typeof showToast === 'function') showToast('⌚ Montre déjà à jour', 'var(--good)');
      }
    } else if (typeof showToast === 'function') {
      showToast('⌚ Synchro montre indisponible', 'var(--warn)');
    }
  } catch (e) {}
}

function renderAlertes(data) {
  const sec  = document.getElementById('dash-alertes-sec');
  const card = document.getElementById('dash-alertes-card');
  const cont = document.getElementById('dash-alertes-content');
  if (!card || !cont) return;

  // Mode vacances : aucune alerte (reprend seul à la fin de la période).
  if (estEnPause(data && data.pause)) {
    if (sec) sec.style.display = 'none';
    card.style.display = 'none';
    return;
  }

  const alertes = [];
  const dash = (data && data.dashboard) || {};

  // 1) Absence — aucune séance sur 7 jours glissants (masquée en mode vacances)
  const reg = dash.regularite || {};
  const j7 = reg.seances_j7 != null ? reg.seances_j7 : (reg.seances_semaine || 0);
  if (Number(j7) === 0 && !estEnPause(data && data.pause)) {
    alertes.push({ col: 'var(--danger)', titre: 'Absence prolongée', txt: 'Aucune séance enregistrée sur les 7 derniers jours.' });
  }

  // 2) Fatigue / douleur — d'après le dernier questionnaire (barème naturel : 4-5 = élevé)
  const be = (data && Array.isArray(data.bien_etre)) ? data.bien_etre : [];
  if (be.length) {
    const d = be[0];
    if (Number(d.fatigue) >= 4) {
      alertes.push({ col: 'var(--warn)', titre: 'Fatigue élevée', txt: 'Fatigue musculaire importante déclarée au dernier questionnaire.' });
    }
    if (Number(d.douleur) >= 3) {
      alertes.push({ col: 'var(--warn)', titre: 'Douleur signalée', txt: 'Douleur déclarée' + (d.zone ? ' · zone : ' + d.zone : '') + '. Adapte la charge si besoin.' });
    }
  }

  // 3) Stagnation — plusieurs exercices en régression
  const prog = dash.progression || {};
  const enBaisse = Number(prog.en_baisse || 0);
  const enHausse = Number(prog.en_progression || 0);
  if (enBaisse >= 3 && enBaisse >= enHausse) {
    alertes.push({ col: 'var(--warn)', titre: 'Stagnation', txt: enBaisse + ' exercices en baisse cette semaine. Pense à varier ou récupérer.' });
  }

  if (alertes.length === 0) { sec.style.display = 'none'; card.style.display = 'none'; return; }

  cont.innerHTML = alertes.map((a, i) => `
    <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 4px;${i < alertes.length - 1 ? 'border-bottom:1px solid var(--border);' : ''}">
      <div style="flex:0 0 4px;align-self:stretch;background:${a.col};border-radius:2px;min-height:34px;"></div>
      <div style="min-width:0;">
        <div style="font-size:13px;font-weight:800;color:${a.col};">${a.titre}</div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.4;margin-top:2px;">${a.txt}</div>
      </div>
    </div>`).join('');

  sec.style.display = '';
  card.style.display = '';
}

// =====================================================================
// BLOC « RÉCOMPENSES » (onglet Objectif) — paliers + cagnotte, calcul auto
// =====================================================================
function renderRecompenses(data) {
  const cont = document.getElementById('recompense-content');
  if (!cont) return;
  const g = (data && data.global) || {};
  const totalSeances = Number(g.total_seances || 0);
  const records = Number(g.records_30j || 0);

  // Cagnotte de points (auto) : séances ×10 + records ×50
  const pts = totalSeances * 10 + records * 50;

  // Paliers de séances
  const paliers = [10, 25, 50, 100, 200, 365];
  let prev = 0, next = paliers[0];
  for (let i = 0; i < paliers.length; i++) {
    if (totalSeances < paliers[i]) { next = paliers[i]; prev = i > 0 ? paliers[i - 1] : 0; break; }
    prev = paliers[i]; next = paliers[i + 1] || paliers[i];
  }
  const atteint = totalSeances >= paliers[paliers.length - 1];
  const restant = Math.max(0, next - totalSeances);
  const pctPalier = atteint ? 100 : Math.round((totalSeances - prev) / (next - prev) * 100);

  cont.style.textAlign = 'left';
  cont.style.padding = '0';
  cont.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
      <div>
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;">Ta cagnotte</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent);line-height:1.1;">${pts}<span style="font-size:13px;color:var(--text-muted);font-weight:600;"> pts</span></div>
      </div>
      <div style="font-size:34px;">🎁</div>
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:14px;">${totalSeances} séances ×10 · ${records} records (30j) ×50</div>

    <div style="border-top:1px solid var(--border);padding-top:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <span style="font-size:13px;font-weight:700;color:var(--text);">🏅 Prochain palier</span>
        <span style="font-size:12px;color:var(--text-muted);font-weight:700;">${atteint ? 'Max atteint !' : restant + ' séance' + (restant > 1 ? 's' : '')}</span>
      </div>
      <div style="background:var(--surface2);border-radius:20px;height:8px;overflow:hidden;">
        <div style="height:100%;width:${pctPalier}%;background:var(--accent);border-radius:20px;transition:width .3s;"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:5px;">${totalSeances} / ${atteint ? totalSeances : next} séances</div>
    </div>

    <div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px;display:flex;align-items:center;gap:10px;">
      <div style="font-size:20px;">👑</div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.4;">Récompense personnalisée du coach — <span style="font-weight:700;">bientôt</span>.</div>
    </div>`;
}

// =====================================================================
// ACCUEIL — Heatmap de régularité (12 sem.) + streak. Cliquable → agenda Séance.
// =====================================================================
function renderHeatmapAccueil() {
  const cont = document.getElementById('dash-heatmap-content');
  if (!cont) return;
  const fmt = dt => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
  const today = new Date(); today.setHours(0,0,0,0);
  let dow = today.getDay() - 1; if (dow < 0) dow = 6;
  const monday = new Date(today); monday.setDate(today.getDate() - dow);
  const WEEKS = 12;
  const start = new Date(monday); start.setDate(monday.getDate() - (WEEKS - 1) * 7);
  const weekHas = new Array(WEEKS).fill(false);
  let cols = '';
  for (let w = 0; w < WEEKS; w++) {
    let col = '<div style="display:flex;flex-direction:column;gap:3px;">';
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      const key = fmt(dt);
      const futur = dt > today;
      const hasM = !futur && !!seancesDates[key];
      const hasC = !futur && !!seancesDatesCardio[key];
      const has  = hasM || hasC;
      if (has) weekHas[w] = true;
      // Vert = muscu · rouge = cardio · dégradé = les deux (même code que l'agenda)
      const bg = futur ? 'transparent'
        : (hasM && hasC) ? 'linear-gradient(135deg,var(--good) 0 50%,var(--bad) 50% 100%)'
        : hasM ? 'var(--good)'
        : hasC ? 'var(--bad)'
        : 'var(--surface2)';
      const lbl = has ? ' · ' + [hasM ? 'muscu' : '', hasC ? 'cardio' : ''].filter(Boolean).join(' + ') : '';
      col += `<div style="width:13px;height:13px;border-radius:3px;background:${bg};" title="${key}${lbl}"></div>`;
    }
    col += '</div>'; cols += col;
  }
  let streak = 0, wi = WEEKS - 1;
  if (!weekHas[wi]) wi--; // semaine en cours pas encore commencée : on ne casse pas le streak
  for (; wi >= 0; wi--) { if (weekHas[wi]) streak++; else break; }
  cont.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <span style="font-size:22px;">🔥</span>
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--text);">${streak} semaine${streak > 1 ? 's' : ''}</div>
        <div style="font-size:11px;color:var(--text-muted);">de régularité d'affilée</div>
      </div>
    </div>
    <div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:2px;">${cols}</div>
    <div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);"><span style="width:10px;height:10px;border-radius:3px;background:var(--good);"></span>Muscu</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);"><span style="width:10px;height:10px;border-radius:3px;background:var(--bad);"></span>Cardio</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-muted);"><span style="width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,var(--good) 0 50%,var(--bad) 50% 100%);"></span>Les deux</span>
    </div>`;
}

// Depuis l'Accueil : ouvre l'onglet Séance et défile jusqu'à l'agenda
function allerVersAgendaSeance() {
  switchTab('seance');
  setTimeout(() => {
    const el = document.getElementById('cal-grid');
    const card = el && el.closest('.card');
    if (card) scrollVersTitre(card);
  }, 200);
}

// Header coach (vue athlète) : masquer au scroll vers le bas, réafficher au scroll vers le haut
(function initCdHeaderAutoHide() {
  let last = 0, ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const hdr = document.getElementById('cd-header');
      if (hdr && document.body.classList.contains('coach-active') && document.body.classList.contains('athlete-selected')) {
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        if (y > last && y > 70) hdr.style.transform = 'translateY(-110%)';
        else hdr.style.transform = 'translateY(0)';
        last = y;
      }
      ticking = false;
    });
  }, { passive: true });
})();

function toggleTheme() {
  const light = !document.body.classList.contains('light-mode');
  document.body.classList.toggle('light-mode', light);
  localStorage.setItem('muscu_theme', light ? 'light' : 'dark');
  syncThemeUI();
}

// Met à jour tous les indicateurs de thème (bouton coach header + toggle dans Réglages)
function syncThemeUI() {
  const light = document.body.classList.contains('light-mode');
  const bc = document.getElementById('btn-theme-coach');
  if (bc) bc.innerHTML = ic(light ? 'moon' : 'sun');
  const lbl = document.getElementById('reglages-theme-label');
  if (lbl) lbl.textContent = light ? 'Clair' : 'Sombre';
  const lblC = document.getElementById('reglages-theme-label-coach');
  if (lblC) lblC.textContent = light ? 'Clair' : 'Sombre';
  const ico = document.getElementById('reglages-theme-ico');
  if (ico) ico.innerHTML = ic(light ? 'sun' : 'moon');
}

function showToast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = color || 'var(--success)';
  t.style.color = color ? '#fff' : '#000';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// =============================================================================
// CARDIO — Switcher, formulaire dynamique, sauvegarde, dashboard
// =============================================================================

var _modeSeance = 'muscu';

function switchModeSeance(mode) {
  _modeSeance = mode;
  var isCardio = mode === 'cardio';
  var saisiEl  = document.getElementById('saisie-block');
  var cardioEl = document.getElementById('cardio-block');
  var recapEl  = document.getElementById('recap-block');
  var btnM = document.getElementById('btn-mode-muscu');
  var btnC = document.getElementById('btn-mode-cardio');
  if (saisiEl) saisiEl.style.display = isCardio ? 'none' : '';
  if (cardioEl) cardioEl.style.display = isCardio ? 'block' : 'none';
  if (recapEl)  recapEl.style.display  = 'none';
  if (btnM) { btnM.className = isCardio ? 'btn btn-outline' : 'btn btn-accent'; }
  if (btnC) { btnC.className = isCardio ? 'btn btn-accent'  : 'btn btn-outline'; }
  var btnVal = document.getElementById('btn-valider');
  if (btnVal) btnVal.style.display = 'none';
  if (isCardio) {
    var di = document.getElementById('cardio-date');
    var t = new Date();
    var todayStr = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0');
    if (di && (!di.value || di.value < todayStr)) {
      di.value = todayStr;
    }
    renderCardioFields();
    setTimeout(() => { if (cardioEl) scrollVersTitre(cardioEl); }, 50);
  }
}

var _CARDIO_SPEC = {
  footing: [
    { id: 'vitesse_moy', label: 'Vitesse moy. (km/h)', placeholder: '10', step: '0.1', calc: true },
    { id: 'fc_moy',      label: 'FC moy. (bpm)',        placeholder: '145', optional: true }
  ],
  velo: [
    { id: 'puissance_moy', label: 'Puissance moy. (W)', placeholder: '180', optional: true, calc: true },
    { id: 'cadence',       label: 'Cadence (rpm)',       placeholder: '85' },
    { id: 'vitesse_moy',   label: 'Vitesse moy. (km/h)', placeholder: '28', step: '0.1', calc: true },
    { id: 'fc_moy',        label: 'FC moy. (bpm)',       placeholder: '140', optional: true }
  ],
  marche_normale: [
    { id: 'vitesse_moy', label: 'Vitesse (km/h)', placeholder: '5', step: '0.1', calc: true },
    { id: 'fc_moy',      label: 'FC moy. (bpm)',  placeholder: '110', optional: true }
  ],
  marche_inclinee: [
    { id: 'inclinaison', label: 'Inclinaison (%)', placeholder: '10', max: '30', calc: true },
    { id: 'vitesse_moy', label: 'Vitesse (km/h)',  placeholder: '6',  step: '0.1', calc: true },
    { id: 'fc_moy',      label: 'FC moy. (bpm)',   placeholder: '130', optional: true }
  ],
  natation: [
    { id: 'fc_moy', label: 'FC moy. (bpm)', placeholder: '140', optional: true }
  ],
  autre: [
    { id: 'fc_moy', label: 'FC moy. (bpm)', placeholder: '135', optional: true }
  ]
};

var _FC_HINT = ' <span style="font-size:9px;color:var(--text-muted);font-weight:500;">📡 optionnel</span>';

function renderCardioFields() {
  var typeEl = document.getElementById('cardio-type');
  var el = document.getElementById('cardio-fields-content');
  if (!el || !typeEl) return;
  var type = typeEl.value;
  var spec = _CARDIO_SPEC[type] || [];
  var specHtml = spec.map(function(f) {
    var fid = 'cardio-' + f.id;
    var attrs = 'type="number" id="' + fid + '" placeholder="' + f.placeholder + '" inputmode="' + (f.step ? 'decimal' : 'numeric') + '"';
    if (f.step) attrs += ' step="' + f.step + '"';
    if (f.max)  attrs += ' max="' + f.max + '"';
    if (f.calc) attrs += ' oninput="calcAutoCardio()"';
    var lbl = f.label + (f.optional ? _FC_HINT : '');
    return '<div><label>' + lbl + '</label><input ' + attrs + '></div>';
  }).join('');
  // Champ poids si absent du profil (nécessaire pour les calculs calories/distance)
  var poidsConnu = athlete && parseFloat(athlete.poids) > 0;
  var poidsHtml = poidsConnu ? '' :
    '<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:10px 12px;margin-top:14px;margin-bottom:2px;">'
    + '<div style="font-size:11px;color:var(--warn);font-weight:700;margin-bottom:6px;">⚠️ Poids non renseigné dans ton profil</div>'
    + '<label style="font-size:12px;">Ton poids (kg) <span style="font-size:10px;color:var(--text-muted);font-weight:400;">— utilisé pour estimer les calories</span></label>'
    + '<input type="number" id="cardio-poids-saisie" placeholder="ex: 62" inputmode="decimal" step="0.5" min="30" max="200" oninput="calcAutoCardio()" style="margin-top:6px;">'
    + '</div>';
  el.innerHTML = poidsHtml + `
    <div class="row2" style="margin-top:14px;">
      <div>
        <label>Durée (min)</label>
        <input type="number" id="cardio-duree" placeholder="45" min="1" inputmode="numeric" oninput="calcAutoCardio()">
      </div>
      <div>
        <label>Distance (km) <span id="cardio-dist-hint" style="font-size:9px;color:var(--accent);font-weight:600;"></span></label>
        <input type="number" id="cardio-distance" placeholder="auto" step="0.1" min="0" inputmode="decimal" data-auto="" oninput="this.dataset.auto='0';document.getElementById('cardio-dist-hint').textContent='';calcAutoCardio()">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px;">${specHtml}</div>
    <div class="row2" style="margin-top:8px;">
      <div>
        <label>Calories (kcal) <span id="cardio-cal-hint" style="font-size:9px;color:var(--accent);font-weight:600;"></span></label>
        <input type="number" id="cardio-calories" placeholder="auto" inputmode="numeric" data-auto="" oninput="this.dataset.auto='0';document.getElementById('cardio-cal-hint').textContent='';calcAutoCardio()">
      </div>
      ${(type === 'marche_normale' || type === 'marche_inclinee') ? '<div><label>Pas <span style="font-size:9px;color:var(--accent);font-weight:600;" id="cardio-pas-hint"></span></label><div id="cardio-pas-preview" style="padding:10px 12px;border-radius:10px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text-muted);font-size:13px;line-height:1.3;">— entrer la distance</div></div>' : '<div></div>'}
    </div>
    <div style="margin-top:14px;">
      <label>RPE (intensité ressentie)</label>
      <div class="chip-row" id="cardio-rpe-chips">
        ${[6,7,8,9,10].map(function(v){ return '<button type="button" class="saisie-chip" onclick="pickCardioRpe(this,\''+v+'\')">' + v + '</button>'; }).join('')}
      </div>
      <input type="hidden" id="cardio-rpe" value="">
    </div>`;
}

function calcAutoCardio() {
  var type    = (document.getElementById('cardio-type')         || {}).value || 'footing';
  var duree   = parseFloat((document.getElementById('cardio-duree')         || {}).value) || 0;
  var vitesse = parseFloat((document.getElementById('cardio-vitesse_moy')   || {}).value) || 0;
  var inclin  = parseFloat((document.getElementById('cardio-inclinaison')   || {}).value) || 0;
  var puiss   = parseFloat((document.getElementById('cardio-puissance_moy') || {}).value) || 0;
  var distEl  = document.getElementById('cardio-distance');
  var calEl   = document.getElementById('cardio-calories');

  // Distance auto : vitesse × durée (h) — ne dépend pas du poids
  if (distEl && distEl.dataset.auto !== '0' && duree > 0 && vitesse > 0) {
    distEl.value = Math.round(vitesse * duree / 60 * 10) / 10;
    distEl.dataset.auto = '1';
    var dh = document.getElementById('cardio-dist-hint');
    if (dh) dh.textContent = '✦ calculé';
  }
  var dist = parseFloat((distEl || {}).value) || 0;

  // Prévisualisation des pas (marche seulement) — ne dépend pas du poids
  var pasPrev = document.getElementById('cardio-pas-preview');
  if (pasPrev) {
    var taille = parseFloat((athlete || {}).taille) || 0;
    var distPas = dist;
    var pasRef = false;
    if (distPas === 0 && duree > 0 && (type === 'marche_normale' || type === 'marche_inclinee')) {
      distPas = Math.round(4.5 * duree / 60 * 10) / 10; // vitesse référence 4.5 km/h
      pasRef = true;
    }
    if (distPas > 0 && taille > 0) {
      var pas = Math.round(distPas * 100000 / (taille * 0.413));
      pasPrev.textContent = pas.toLocaleString('fr-FR') + ' pas';
      pasPrev.style.color = pasRef ? 'var(--text-muted)' : 'var(--accent)';
      var ph = document.getElementById('cardio-pas-hint');
      if (ph) ph.textContent = pasRef ? '~ réf. 4.5 km/h' : '✦ estimé';
    } else {
      pasPrev.textContent = '— durée requise';
      pasPrev.style.color = 'var(--text-muted)';
    }
  }

  // Calories auto — dépend du poids
  var poidsEl = document.getElementById('cardio-poids-saisie');
  var poids   = parseFloat((poidsEl && poidsEl.value) || (athlete && athlete.poids) || 0);
  if (!poids) return;

  var calAuto = 0;
  if (type === 'footing' && poids && dist) {
    calAuto = Math.round(poids * dist * 1.04);
  } else if (type === 'marche_normale' && poids && duree) {
    calAuto = Math.round(3.5 * poids * (duree / 60));
  } else if (type === 'marche_inclinee' && poids && duree) {
    calAuto = Math.round((3.5 + 0.35 * inclin) * poids * (duree / 60));
  } else if (type === 'velo') {
    if (puiss && duree) calAuto = Math.round(puiss * (duree / 60) * 0.86);
    else if (poids && dist) calAuto = Math.round(poids * dist * 0.5);
  } else if (type === 'natation' && poids && duree) {
    calAuto = Math.round(8 * poids * (duree / 60));
  } else if (poids && dist) {
    calAuto = Math.round(poids * dist * 0.8);
  }

  if (calEl && calEl.dataset.auto !== '0' && calAuto > 0) {
    calEl.value = calAuto;
    calEl.dataset.auto = '1';
    var ch = document.getElementById('cardio-cal-hint');
    if (ch) ch.textContent = '✦ estimé';
  }
}

function pickCardioRpe(btn, val) {
  document.getElementById('cardio-rpe').value = val;
  document.querySelectorAll('#cardio-rpe-chips .saisie-chip').forEach(function(b){ b.classList.remove('on'); });
  btn.classList.add('on');
}

async function sauvegarderCardio() {
  if (!athlete) return;
  var date  = (document.getElementById('cardio-date') || {}).value;
  var duree = (document.getElementById('cardio-duree') || {}).value;
  var type  = (document.getElementById('cardio-type') || {}).value;
  if (!date)  { showToast('Choisis une date', 'var(--warn)'); return; }
  if (!duree) { showToast('Durée obligatoire', 'var(--warn)'); return; }

  var btnSave = document.getElementById('btn-save-cardio');
  if (btnSave) { btnSave.disabled = true; btnSave.textContent = '⏳ Envoi en cours…'; }

  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var pasCalc = (function(){
    if(!(type==='marche_normale'||type==='marche_inclinee')) return '';
    var h=parseFloat((athlete||{}).taille)||0; if(!h) return '';
    var d=parseFloat(gv('cardio-distance'))||0;
    if(d===0){var dur=parseFloat(gv('cardio-duree'))||0; if(dur>0) d=Math.round(4.5*dur/60*10)/10;}
    return d>0?Math.round(d*100000/(h*0.413)):'';
  })();
  var body = {
    action:      'saveCardio',
    athlete_id:  athlete.athlete_id,
    date:        date,
    type_cardio: type,
    duree:       gv('cardio-duree'),
    distance:    gv('cardio-distance'),
    vitesse_moy: gv('cardio-vitesse_moy'),
    inclinaison: gv('cardio-inclinaison'),
    puissance_moy: gv('cardio-puissance_moy'),
    cadence:     gv('cardio-cadence'),
    pas:         pasCalc,
    calories:    gv('cardio-calories'),
    fc_moy:      gv('cardio-fc_moy'),
    rpe:         gv('cardio-rpe')
  };
  // Lire les valeurs avant d'envoyer (pour le récap)
  var dist    = parseFloat(gv('cardio-distance'))  || 0;
  var cal     = parseFloat(gv('cardio-calories'))  || 0;
  var rpe     = parseFloat(gv('cardio-rpe'))       || 0;
  var fc      = parseFloat(gv('cardio-fc_moy'))    || 0;
  var charge  = (rpe && parseFloat(duree)) ? Math.round(rpe * parseFloat(duree)) : 0;
  try {
    var r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    var res = await r.json();
    if (res && res.error) throw new Error(res.error);
  } catch (err) {
    showToast('Erreur : ' + (err.message || 'réseau'), 'var(--bad)');
    if (btnSave) { btnSave.disabled = false; btnSave.textContent = '✅ Enregistrer la séance'; }
    return;
  }
  // Récap
  var typeLabel = _CARDIO_TYPE_LABELS[type] || type;
  var stats = [];
  if (parseFloat(duree)) stats.push({ n: duree + ' min', k: 'Durée' });
  if (dist)     stats.push({ n: dist + ' km',   k: 'Distance' });
  if (pasCalc)  stats.push({ n: Number(pasCalc).toLocaleString('fr-FR') + ' pas', k: 'Pas' });
  if (cal)      stats.push({ n: cal + ' kcal',  k: 'Calories' });
  if (charge)   stats.push({ n: charge + ' UA', k: 'Charge interne' });
  if (fc)       stats.push({ n: fc + ' bpm',    k: 'FC moy.' });
  var statsHtml = stats.map(function(s) {
    return '<div class="dash-stat"><div class="dash-stat-num" style="color:var(--accent);">' + s.n + '</div><div class="dash-stat-label">' + s.k + '</div></div>';
  }).join('');
  var cardioEl = document.getElementById('cardio-block');
  if (cardioEl) cardioEl.innerHTML = `
    <div class="card">
      <div class="card-title" style="color:var(--good);">✅ Séance enregistrée !</div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">${escapeHtml(typeLabel)} · ${body.date}</div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(stats.length,3)},1fr);gap:8px;margin-bottom:14px;">${statsHtml}</div>
      <button class="btn btn-accent" onclick="nouvelleSeanceCardio()">+ Nouvelle séance cardio</button>
    </div>`;
  chargerAppData();
}

function nouvelleSeanceCardio() {
  var cardioEl = document.getElementById('cardio-block');
  if (!cardioEl) return;
  // Remet le formulaire en place (même HTML qu'à l'origine dans index.html)
  cardioEl.innerHTML = `
    <div class="card">
      <div class="card-title">Séance cardio</div>
      <div class="row2">
        <div><label>Date</label><input type="date" id="cardio-date"></div>
        <div><label>Type</label>
          <select id="cardio-type" onchange="renderCardioFields()">
            <option value="footing">Footing</option>
            <option value="velo">Vélo</option>
            <option value="marche_normale">Marche</option>
            <option value="marche_inclinee">Marche inclinée</option>
            <option value="natation">Natation</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>
      <div id="cardio-fields-content"></div>
      <button id="btn-save-cardio" class="btn btn-accent" onclick="sauvegarderCardio()" style="margin-top:14px;padding:14px;">✅ Enregistrer la séance</button>
    </div>`;
  var di = document.getElementById('cardio-date');
  if (di) { var t = new Date(); di.value = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0') + '-' + String(t.getDate()).padStart(2,'0'); }
  renderCardioFields();
}

var _CARDIO_TYPE_LABELS = {
  footing: 'Footing', velo: 'Vélo',
  marche_normale: 'Marche', marche_inclinee: 'Marche inclinée',
  natation: 'Natation',
  rameur: 'Rameur', hiit: 'HIIT', elliptique: 'Elliptique', boxe: 'Boxe',
  autre: 'Autre'
};

var _dashCardioPeriod  = 30;
var _dashCardioWindows = null;

function renderDashCardio(cardioData) {
  var secEl  = document.getElementById('dash-cardio-sec');
  var cardEl = document.getElementById('dash-cardio-card');
  if (!secEl || !cardEl) return;
  if (!cardioData || !cardioData.windows) { secEl.style.display = 'none'; cardEl.style.display = 'none'; return; }
  var w = cardioData.windows;
  var hasData = (w[7] && w[7].sessions > 0) || (w[30] && w[30].sessions > 0);
  if (!hasData) { secEl.style.display = 'none'; cardEl.style.display = 'none'; return; }
  _dashCardioWindows = w;
  // Sélectionner la fenêtre la plus pertinente par défaut
  _dashCardioPeriod = (w[7] && w[7].sessions > 0) ? 7 : 30;
  secEl.style.display  = '';
  cardEl.style.display = '';
  _renderDashCardioContent();
}

function _setDashCardioPeriod(days) {
  _dashCardioPeriod = days;
  _renderDashCardioContent();
}

function _renderDashCardioContent() {
  var contEl = document.getElementById('dash-cardio-content');
  if (!contEl || !_dashCardioWindows) return;
  var w  = _dashCardioWindows;
  var wd = w[_dashCardioPeriod] || { sessions: 0, duree: 0, distance: 0, calories: 0, par_type: {} };
  var PERIODS = [[7,'7j'],[30,'1 mois'],[90,'3 mois'],[180,'6 mois']];

  // Sélecteur de période
  var periodOpts = PERIODS.map(function(p) {
    return '<option value="' + p[0] + '"' + (p[0] === _dashCardioPeriod ? ' selected' : '') + '>' + p[1] + '</option>';
  }).join('');
  var chips = '<div style="display:flex;align-items:center;gap:8px;">'
    + '<span style="font-size:11px;font-weight:700;color:var(--text-muted);white-space:nowrap;">Période :</span>'
    + '<select onchange="_setDashCardioPeriod(+this.value)" style="padding:5px 28px 5px 10px;border-radius:8px;font-size:12px;font-weight:700;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url(\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2210%22 height=%226%22><path d=%22M0 0l5 6 5-6z%22 fill=%22%234A5980%22/></svg>\');background-repeat:no-repeat;background-position:right 8px center;">'
    + periodOpts + '</select>'
    + '</div>';

  var body = '';
  if (wd.sessions === 0) {
    body = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:10px 0;">Aucune séance sur cette période</div>';
  } else {
    var tiles = [
      { v: wd.sessions,    u: 'séances' },
      { v: wd.distance ? wd.distance + ' km'   : '—', u: 'distance' },
      { v: wd.duree    ? wd.duree    + ' min'  : '—', u: 'durée' },
      { v: wd.calories ? wd.calories + ' kcal' : '—', u: 'calories' }
    ];
    body = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:' + (wd.pas ? '7px' : '10px') + ';">';
    tiles.forEach(function(t) {
      body += '<div style="background:var(--surface2);border-radius:10px;padding:8px 4px;text-align:center;">'
        + '<div style="font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1.15;">' + t.v + '</div>'
        + '<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">' + t.u + '</div>'
        + '</div>';
    });
    body += '</div>';
    if (wd.pas) {
      body += '<div style="background:var(--surface2);border-radius:10px;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
        + '<span style="font-size:10px;color:var(--text-muted);font-weight:700;">👣 Pas totaux (marche)</span>'
        + '<span style="font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;">' + wd.pas.toLocaleString('fr-FR') + '</span>'
        + '</div>';
    }
    if (wd.par_type && Object.keys(wd.par_type).length) {
      body += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      Object.keys(wd.par_type).forEach(function(t) {
        var clr = _CH_CLR[t] || '#6366f1';
        var bg  = _CH_BG[t]  || 'rgba(99,102,241,.14)';
        var ico = _CH_ICO[t] || '⚡';
        var lbl = _CARDIO_TYPE_LABELS[t] || t;
        body += '<span style="display:inline-flex;align-items:center;gap:4px;background:' + bg + ';color:' + clr + ';border-radius:20px;padding:3px 9px;font-size:11px;font-weight:700;">'
          + ico + ' ' + escapeHtml(lbl) + ' <span style="opacity:.65;">×' + wd.par_type[t] + '</span></span>';
      });
      body += '</div>';
    }
  }

  var lien = '<div style="margin-top:10px;text-align:right;">'
    + '<button onclick="switchTab(\'historique\')" style="background:none;border:none;font-size:11px;font-weight:700;color:var(--accent);cursor:pointer;padding:0;">Historique complet →</button>'
    + '</div>';

  contEl.innerHTML = '<div style="margin-bottom:10px;">' + chips + '</div>' + body + lien;
}

// =============================================================================
// CARDIO — Historique détaillé (onglet Progression)
// =============================================================================

var _cardioSessions = [];
var _pasQuotidiens  = [];   // pas ambiants par jour (montre) : [{date, pas}]
var _cardioPeriod   = 7;
var _cardioSubTab   = 'recentes';
var _cardioChartMetric = 'km';   // métrique de la courbe « Par semaine »

// Config des métriques de la courbe hebdo (déroulante)
// cap = légende explicite (total vs moyenne) affichée sous la courbe.
var _CARDIO_CHART_METRICS = {
  km:  { label: 'Distance', cap: 'Distance totale / sem.',  unit: 'km',   dec: 1, get: function(w){ return w.km; } },
  min: { label: 'Durée',    cap: 'Durée totale / sem.',     unit: 'min',  dec: 0, get: function(w){ return w.min; } },
  kcal:{ label: 'Calories', cap: 'Calories totales / sem.', unit: 'kcal', dec: 0, get: function(w){ return w.kcal; } },
  pas: { label: 'Pas',      cap: 'Pas totaux / sem.',       unit: 'pas',  dec: 0, get: function(w){ return w.pas; } },
  vit: { label: 'Vitesse',  cap: 'Vitesse moyenne / sem.',  unit: 'km/h', dec: 1, get: function(w){ return w.vit; } }
};
function _setCardioChartMetric(v) { _cardioChartMetric = v; _renderCardioHist(); }
var _cardioWeekAct = null; // activité sélectionnée dans « Par semaine » (type_cardio)
function _setCardioWeekAct(v) { _cardioWeekAct = v; _renderCardioHist(); }

// Courbe lissée (Catmull-Rom → Bézier) à partir de points {x,y}
function _cardioSmoothPath(pts) {
  if (pts.length < 2) return '';
  var d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1);
  for (var i = 0; i < pts.length - 1; i++) {
    var p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];
    var c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    var c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += 'C' + c1x.toFixed(1) + ',' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ',' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ',' + p2.y.toFixed(1);
  }
  return d;
}

var _CH_ICO = { footing: '🏃', velo: '🚴', marche_normale: '🚶', marche_inclinee: '🥾', natation: '🏊', rameur: '🚣', hiit: '🔥', elliptique: '🌀', boxe: '🥊', autre: '⚡' };
var _CH_CLR = { footing: '#6366f1', velo: '#0ea5e9', marche_normale: '#22d3ee', marche_inclinee: '#10b981', natation: '#8b5cf6', rameur: '#14b8a6', hiit: '#ef4444', elliptique: '#a855f7', boxe: '#f97316', autre: '#f59e0b' };
var _CH_BG  = { footing: 'rgba(99,102,241,.14)', velo: 'rgba(14,165,233,.14)', marche_normale: 'rgba(34,211,238,.14)', marche_inclinee: 'rgba(16,185,129,.14)', natation: 'rgba(139,92,246,.14)', rameur: 'rgba(20,184,166,.14)', hiit: 'rgba(239,68,68,.14)', elliptique: 'rgba(168,85,247,.14)', boxe: 'rgba(249,115,22,.14)', autre: 'rgba(245,158,11,.14)' };

function renderCardioHistorique(sessions) {
  var secEl  = document.getElementById('hist-cardio-sec');
  var cardEl = document.getElementById('hist-cardio-card');
  if (!secEl || !cardEl) return;
  if (!sessions || sessions.length === 0) {
    secEl.style.display  = 'none';
    cardEl.style.display = 'none';
    return;
  }
  _cardioSessions = sessions;
  _cardioPeriod   = 7;
  _cardioSubTab   = 'recentes';
  secEl.style.display  = '';
  cardEl.style.display = '';
  _renderCardioHist();
}

function _filterCardioSessions(days) {
  var cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  var cutStr = cutoff.getFullYear() + '-' + String(cutoff.getMonth()+1).padStart(2,'0') + '-' + String(cutoff.getDate()).padStart(2,'0');
  return _cardioSessions.filter(function(s) { return s.date >= cutStr; });
}

function _setCardioPeriod(days) {
  _cardioPeriod = days;
  _renderCardioHist();
}

function _setCardioSubTab(tab) {
  _cardioSubTab = tab;
  var BASE = 'flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:11.5px;font-weight:700;border:none;cursor:pointer;transition:background .12s,color .12s;';
  ['recentes', 'semaine', 'activite', 'pas'].forEach(function(t) {
    var pan = document.getElementById('ch-panel-' + t);
    var btn = document.getElementById('ch-stab-' + t);
    var on  = (t === tab);
    if (pan) pan.style.display = on ? '' : 'none';
    if (btn) btn.style.cssText = BASE + (on ? 'background:var(--surface);color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,.10);' : 'background:transparent;color:var(--text-muted);');
  });
}

// Lundi (ISO) de la semaine d'une date yyyy-mm-dd → clé de regroupement hebdo
function _cardioMondayISO(iso) {
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  var day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _renderCardioHist() {
  var contEl = document.getElementById('hist-cardio-content');
  if (!contEl) return;
  // Toujours lire les pas quotidiens depuis les dernières données chargées
  // (indépendant du chemin de navigation qui a déclenché le rendu).
  if (typeof dernierAppData !== 'undefined' && dernierAppData && Array.isArray(dernierAppData.pas_quotidiens)) {
    _pasQuotidiens = dernierAppData.pas_quotidiens;
  }
  var filtered = _filterCardioSessions(_cardioPeriod);
  var PERIOD_MAP = [[7,'7 j'],[30,'1 mois'],[90,'3 mois']];
  var MOIS = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];

  // ── Sélecteur de période — texte souligné (léger) ────────────
  var chips = '<div style="display:flex;gap:20px;">'
    + PERIOD_MAP.map(function(p) {
        var on = (p[0] === _cardioPeriod);
        return '<button onclick="_setCardioPeriod(' + p[0] + ')" style="background:none;border:none;padding:5px 0 7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;position:relative;'
          + (on ? 'color:var(--accent);border-bottom:2px solid var(--accent);' : 'color:var(--text-muted);border-bottom:2px solid transparent;')
          + '">' + p[1] + '</button>';
      }).join('')
    + '</div>';

  // ── Agrégats KPI ──────────────────────────────────────────────
  var totalKm = 0, totalKcal = 0, totalDuree = 0, totalPas = 0, vitSum = 0, vitN = 0;
  filtered.forEach(function(s) {
    totalKm    += s.distance    || 0;
    totalKcal  += s.calories    || 0;
    totalDuree += s.duree       || 0;
    totalPas   += s.pas         || 0;
    if (s.vitesse_moy) { vitSum += s.vitesse_moy; vitN++; }
  });
  var avgVitG = vitN ? Math.round(vitSum / vitN * 10) / 10 : null;

  function kpiTile(val, unit, label, clr) {
    var show = val !== null && val !== undefined && val !== 0;
    return '<div style="background:var(--surface2);border-radius:12px;padding:11px 4px 8px;text-align:center;border-top:3px solid ' + clr + ';">'
      + '<div style="font-size:17px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;color:' + (show ? clr : 'var(--text-muted)') + ';">'
        + (show ? val : '—') + '</div>'
      + (unit && show ? '<div style="font-size:8px;font-weight:700;color:' + clr + ';opacity:.75;margin-top:2px;">' + unit + '</div>' : '<div style="margin-top:2px;height:11px;"></div>')
      + '<div style="font-size:9px;color:var(--text-muted);margin-top:4px;">' + escapeHtml(label) + '</div>'
      + '</div>';
  }
  var pasTotKpi = Math.round(totalPas) || null;
  var kpis = kpiTile(filtered.length || null, null,    'séances',  'var(--accent)')
    + kpiTile(Math.round(totalKm * 10) / 10 || null, 'km',   'distance', '#0ea5e9')
    + kpiTile(Math.round(totalDuree)   || null, 'min',  'durée',    '#10b981')
    + kpiTile(Math.round(totalKcal)    || null, 'kcal', 'calories', 'var(--warn)');
  var kpisRow2 = pasTotKpi ? '<div style="background:var(--surface2);border-radius:12px;padding:7px 12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">'
    + '<span style="font-size:10px;color:var(--text-muted);font-weight:700;">👣 Pas totaux (marche)</span>'
    + '<span style="font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;">' + pasTotKpi.toLocaleString('fr-FR') + '</span>'
    + '</div>' : '';

  // ── Toggle sous-onglets ───────────────────────────────────────
  var BASE_BTN = 'flex:1;text-align:center;padding:8px 4px;border-radius:9px;font-size:11.5px;font-weight:700;border:none;cursor:pointer;transition:background .12s,color .12s;';
  function stabBtn(id, label) {
    var on = (_cardioSubTab === id);
    return '<button id="ch-stab-' + id + '" onclick="_setCardioSubTab(\'' + id + '\')" style="' + BASE_BTN
      + (on ? 'background:var(--surface);color:var(--accent);box-shadow:0 1px 4px rgba(0,0,0,.10);' : 'background:transparent;color:var(--text-muted);')
      + '">' + label + '</button>';
  }
  // Onglet « Pas » seulement si de la marche avec pas est enregistrée (cumul marche + marche inclinée)
  var _MARCHE_TYPES = { marche_normale: 1, marche_inclinee: 1 };
  var hasPasData = (_pasQuotidiens && _pasQuotidiens.length > 0)
    || _cardioSessions.some(function(s) { return _MARCHE_TYPES[s.type_cardio] && (s.pas || 0) > 0; });
  if (_cardioSubTab === 'pas' && !hasPasData) _cardioSubTab = 'recentes';
  var btns = stabBtn('recentes', hasPasData ? 'Récentes' : 'Séances récentes') + stabBtn('semaine', 'Par semaine') + stabBtn('activite', 'Par activité')
    + (hasPasData ? stabBtn('pas', 'Pas') : '');

  // ── Panel « Par semaine » — PAR ACTIVITÉ (on ne mélange pas les sports) ──
  var todayMonday = _cardioMondayISO(new Date().toISOString().slice(0, 10));
  function _cardioWeekLabel(mondayIso) {
    var d = new Date(mondayIso + 'T00:00:00');
    var e = new Date(d); e.setDate(e.getDate() + 6);
    var m1 = d.getMonth(), m2 = e.getMonth();
    return (m1 === m2)
      ? d.getDate() + ' – ' + e.getDate() + ' ' + MOIS[m2]
      : d.getDate() + ' ' + MOIS[m1] + ' – ' + e.getDate() + ' ' + MOIS[m2];
  }
  function _pctDelta(cur, prev) { return (prev && prev > 0) ? Math.round((cur - prev) / prev * 100) : null; }

  var semaineHtml = '';
  // Activités présentes sur la période + activité sélectionnée (défaut = la plus pratiquée)
  var actCounts = {};
  filtered.forEach(function(s) { var t = s.type_cardio || 'autre'; actCounts[t] = (actCounts[t] || 0) + 1; });
  var ACT_ORDER = ['footing','velo','marche_normale','marche_inclinee','natation','rameur','hiit','elliptique','boxe','autre'];
  var actTypes = Object.keys(actCounts).sort(function(a, b) { var ia=ACT_ORDER.indexOf(a), ib=ACT_ORDER.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });

  if (!actTypes.length) {
    semaineHtml = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0;">Aucune séance sur cette période</div>';
  } else {
    var actSel = (_cardioWeekAct && actCounts[_cardioWeekAct]) ? _cardioWeekAct
      : actTypes.reduce(function(best, t) { return actCounts[t] > (actCounts[best] || 0) ? t : best; }, actTypes[0]);
    var actColor = _CH_CLR[actSel] || '#6366f1';

    // Agrégation hebdo pour CETTE activité uniquement
    var weeksMap = {};
    filtered.forEach(function(s) {
      if (!s.date || (s.type_cardio || 'autre') !== actSel) return;
      var wk = _cardioMondayISO(s.date);
      if (!weeksMap[wk]) weeksMap[wk] = { key: wk, km: 0, min: 0, kcal: 0, pas: 0, n: 0, vitSum: 0, vitN: 0 };
      var w = weeksMap[wk];
      w.km += s.distance || 0; w.min += s.duree || 0; w.kcal += s.calories || 0; w.pas += s.pas || 0; w.n++;
      if (s.vitesse_moy) { w.vitSum += s.vitesse_moy; w.vitN++; }
    });
    var weeks = Object.keys(weeksMap).map(function(k) { return weeksMap[k]; }).sort(function(a, b) { return a.key < b.key ? 1 : -1; });
    weeks.forEach(function(w) { w.vit = w.vitN ? Math.round(w.vitSum / w.vitN * 10) / 10 : 0; });
    weeks.forEach(function(w, i) {
      var prev = weeks[i + 1];
      w.d_km = prev ? _pctDelta(w.km, prev.km) : null;
      w.d_min = prev ? _pctDelta(w.min, prev.min) : null;
      w.d_kcal = prev ? _pctDelta(w.kcal, prev.kcal) : null;
      w.d_pas = prev ? _pctDelta(w.pas, prev.pas) : null;
      w.isFirst = !prev;
    });

    // ── Header compact : 2 petites déroulantes (activité colorée + métrique) ──
    var actOpts = actTypes.map(function(t) {
      return '<option value="' + t + '"' + (t === actSel ? ' selected' : '') + '>' + (_CH_ICO[t] || '⚡') + ' ' + (_CARDIO_TYPE_LABELS[t] || t) + '</option>';
    }).join('');
    var CHEV = "background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%229%22 height=%225%22><path d=%22M0 0l4.5 5 4.5-5z%22 fill=%22%23FFFFFF%22/></svg>');background-repeat:no-repeat;background-position:right 7px center;";
    var CHEV_D = "background-image:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%229%22 height=%225%22><path d=%22M0 0l4.5 5 4.5-5z%22 fill=%22%234A5980%22/></svg>');background-repeat:no-repeat;background-position:right 7px center;";
    var actSelectHtml = '<select onchange="_setCardioWeekAct(this.value)" style="appearance:none;-webkit-appearance:none;padding:6px 22px 6px 9px;border-radius:8px;font-size:11.5px;font-weight:700;border:none;color:#fff;cursor:pointer;font-family:inherit;background-color:' + actColor + ';' + CHEV + '">' + actOpts + '</select>';
    var metOpts = Object.keys(_CARDIO_CHART_METRICS).map(function(k) {
      return '<option value="' + k + '"' + (k === _cardioChartMetric ? ' selected' : '') + '>' + _CARDIO_CHART_METRICS[k].label + '</option>';
    }).join('');
    var metSelectHtml = '<select onchange="_setCardioChartMetric(this.value)" style="appearance:none;-webkit-appearance:none;padding:6px 22px 6px 9px;border-radius:8px;font-size:11.5px;font-weight:700;border:1px solid var(--border);background-color:var(--surface2);color:var(--text);cursor:pointer;font-family:inherit;' + CHEV_D + '">' + metOpts + '</select>';
    var selRow = '<div style="display:flex;gap:8px;margin-bottom:10px;">' + actSelectHtml + metSelectHtml + '</div>';

    var mConf = _CARDIO_CHART_METRICS[_cardioChartMetric] || _CARDIO_CHART_METRICS.km;
    var chartWeeks = weeks.slice().reverse().slice(-14); // ancien → récent
    var vals = chartWeeks.map(function(w) { return mConf.get(w) || 0; });
    var allZero = vals.every(function(v) { return !v; });

    var head;
    if (chartWeeks.length < 2) {
      head = selRow + '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:14px 0;background:var(--surface2);border-radius:10px;margin-bottom:14px;">Choisis une période plus longue (1 mois / 3 mois) pour voir la courbe.</div>';
    } else if (allZero) {
      head = selRow + '<div style="text-align:center;color:var(--text-muted);font-size:11px;padding:14px 0;background:var(--surface2);border-radius:10px;margin-bottom:14px;">« ' + mConf.label + ' » non suivi pour ' + (_CARDIO_TYPE_LABELS[actSel] || actSel).toLowerCase() + '.</div>';
    } else {
      var W = 320, H = 56, padL = 26, padR = 6, padT = 8, padB = 14, n = chartWeeks.length;
      var mxA = Math.max.apply(null, vals), mnA = Math.min.apply(null, vals);
      var mn = mnA, mx = mxA, sp = (mx - mn) || 1; mn -= sp * 0.18; mx += sp * 0.18; sp = mx - mn;
      var X = function(i) { return padL + i * (W - padL - padR) / (n - 1); };
      var Y = function(v) { return H - padB - (v - mn) / sp * (H - padT - padB); };
      var pts = vals.map(function(v, i) { return { x: X(i), y: Y(v) }; });
      var line = _cardioSmoothPath(pts);
      var area = line + 'L' + pts[n - 1].x.toFixed(1) + ',' + (H - padB) + 'L' + pts[0].x.toFixed(1) + ',' + (H - padB) + 'Z';
      var fmtY = function(v) { return mConf.dec ? v.toFixed(mConf.dec) : (v >= 1000 ? Math.round(v / 100) / 10 + 'k' : Math.round(v)); };
      var yAxis = '<text x="' + (padL - 4) + '" y="' + (padT + 3) + '" text-anchor="end" font-size="7" fill="var(--text-muted)" font-weight="700">' + fmtY(mxA) + '</text>'
        + '<text x="' + (padL - 4) + '" y="' + (H - padB) + '" text-anchor="end" font-size="7" fill="var(--text-muted)" font-weight="700">' + fmtY(mnA) + '</text>';
      var xlabels = chartWeeks.map(function(w, i) {
        if (i % 2 !== 0 && i !== n - 1) return '';
        var d = new Date(w.key + 'T00:00:00');
        return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="7" fill="var(--text-muted)" font-weight="700">' + d.getDate() + '/' + (d.getMonth() + 1) + '</text>';
      }).join('');
      var lp = pts[n - 1];
      var gid = 'cch_' + actSel + '_' + _cardioChartMetric;
      var curVal = vals[n - 1], prevVal = vals[n - 2];
      var dp = (prevVal > 0) ? Math.round((curVal - prevVal) / prevVal * 100) : null;
      var dpHtml = '';
      if (dp !== null) {
        var up = dp > 0, flat = dp === 0;
        dpHtml = '<span style="font-size:10.5px;font-weight:800;margin-left:5px;color:' + (flat ? 'var(--text-muted)' : (up ? 'var(--good)' : 'var(--danger)')) + ';">' + (flat ? '→ ' : (up ? '↑ +' : '↓ ')) + dp + '%</span>';
      }
      var curTxt = mConf.dec ? curVal.toFixed(mConf.dec) : Math.round(curVal).toLocaleString('fr-FR');
      head = selRow
        + '<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:1px;"><span style="font-size:19px;font-weight:900;line-height:1;color:' + actColor + ';font-variant-numeric:tabular-nums;">' + curTxt + '</span>'
          + '<span style="font-size:10.5px;font-weight:700;color:var(--text-muted);">' + mConf.unit + '</span>' + dpHtml + '</div>'
        + '<div style="font-size:9px;color:var(--text-muted);font-weight:600;margin-bottom:5px;">cette semaine · vs semaine précédente</div>'
        + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;overflow:visible;">'
          + '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + actColor + '" stop-opacity="0.18"/><stop offset="1" stop-color="' + actColor + '" stop-opacity="0"/></linearGradient></defs>'
          + '<line x1="' + padL + '" y1="' + (H - padB) + '" x2="' + (W - padR) + '" y2="' + (H - padB) + '" stroke="var(--border)" stroke-width="1"/>'
          + '<path d="' + area + '" fill="url(#' + gid + ')"/>'
          + '<path d="' + line + '" fill="none" stroke="' + actColor + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
          + yAxis + '<circle cx="' + lp.x.toFixed(1) + '" cy="' + lp.y.toFixed(1) + '" r="2.8" fill="' + actColor + '" stroke="var(--surface)" stroke-width="1.3"/>' + xlabels
        + '</svg>'
        + '<div style="font-size:9px;color:var(--text-muted);text-align:center;margin:2px 0 14px;font-weight:600;">' + (_CARDIO_TYPE_LABELS[actSel] || actSel) + ' · ' + mConf.cap + '</div>';
    }

    // Lignes hebdo (activité seule) : valeur + delta par métrique
    function wkM(v, u, l, d) {
      var deltaHtml;
      if (d === null || d === undefined) {
        deltaHtml = '<div style="height:12px;margin-top:2px;font-size:9px;color:var(--text-muted);opacity:.6;">–</div>';
      } else {
        var up = d > 0, flat = d === 0;
        var clr = flat ? 'var(--text-muted)' : (up ? 'var(--good)' : 'var(--danger)');
        var arr = flat ? '→' : (up ? '↑' : '↓');
        deltaHtml = '<div style="font-size:9.5px;font-weight:800;color:' + clr + ';margin-top:2px;white-space:nowrap;font-variant-numeric:tabular-nums;">' + arr + ' ' + (up ? '+' : '') + d + '%</div>';
      }
      return '<div style="text-align:center;"><div style="font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;">' + v
        + '<span style="font-size:9px;font-weight:600;color:var(--text-muted);">' + (u ? ' ' + u : '') + '</span></div>'
        + '<div style="font-size:9px;color:var(--text-muted);margin-top:3px;">' + l + '</div>'
        + deltaHtml + '</div>';
    }
    var rows = '';
    weeks.slice(0, 12).forEach(function(w) {
      var cur = (w.key === todayMonday);
      var tag = cur
        ? '<span style="font-size:9px;font-weight:800;color:var(--accent);background:var(--accent-a14);border-radius:20px;padding:2px 7px;margin-left:6px;">EN COURS</span>'
        : (w.isFirst ? '<span style="font-size:9px;font-weight:700;color:var(--text-muted);background:var(--surface2);border-radius:20px;padding:2px 7px;margin-left:6px;">réf.</span>' : '');
      rows += '<div style="border:1px solid ' + (cur ? 'var(--accent)' : 'var(--border)') + ';border-radius:12px;padding:11px 12px;margin-bottom:9px;'
        + (cur ? 'background:var(--accent-a05,rgba(26,95,255,.05));' : 'background:var(--surface);') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">'
          + '<div style="font-size:13px;font-weight:800;">' + _cardioWeekLabel(w.key) + tag + '</div>'
          + '<div style="font-size:10px;color:var(--text-muted);font-weight:600;white-space:nowrap;">' + w.n + ' séance' + (w.n > 1 ? 's' : '') + '</div>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">'
          + wkM(Math.round(w.km * 10) / 10, 'km', 'distance', w.d_km)
          + wkM(Math.round(w.min), 'min', 'durée', w.d_min)
          + wkM(Math.round(w.kcal), 'kcal', 'calories', w.d_kcal)
          + wkM(w.pas ? Math.round(w.pas).toLocaleString('fr-FR') : '—', '', 'pas', w.d_pas)
        + '</div>'
        + '</div>';
    });
    if (weeks.length > 12) rows += '<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:6px 0;">+ ' + (weeks.length - 12) + ' semaines plus anciennes</div>';
    semaineHtml = head + rows;
  }

  // ── Panel « Par activité » ────────────────────────────────────
  var byType = {};
  filtered.forEach(function(s) {
    var t = s.type_cardio || 'autre';
    if (!byType[t]) byType[t] = [];
    byType[t].push(s);
  });

  var activHtml = '';
  if (!filtered.length) {
    activHtml = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0;">Aucune séance sur cette période</div>';
  } else {
    var _ACT_ORD = ['footing','velo','marche_normale','marche_inclinee','natation','rameur','hiit','elliptique','boxe','autre'];
    Object.keys(byType).sort(function(a,b){ var ia=_ACT_ORD.indexOf(a), ib=_ACT_ORD.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); }).forEach(function(t) {
      var ss = byType[t];
      if (!ss || !ss.length) return;
      var kmT=0,kmN=0,vT=0,vN=0,cT=0,cN=0,fcT=0,fcN=0,dT=0,pasT=0;
      ss.forEach(function(s) {
        dT += s.duree    || 0;
        pasT += s.pas    || 0;
        if (s.distance)    { kmT += s.distance;    kmN++; }
        if (s.vitesse_moy) { vT  += s.vitesse_moy; vN++;  }
        if (s.calories)    { cT  += s.calories;    cN++;  }
        if (s.fc_moy)      { fcT += s.fc_moy;      fcN++; }
      });
      var avgKm   = kmN ? Math.round(kmT / ss.length * 10) / 10 : null;
      var avgVit2 = vN  ? Math.round(vT  / vN        * 10) / 10 : null;
      var avgCal  = cN  ? Math.round(cT  / ss.length)          : null;
      var avgFc   = fcN ? Math.round(fcT / fcN)                  : null;
      var totDur  = Math.round(dT);
      var totPas  = (t === 'marche_normale' || t === 'marche_inclinee') && pasT > 0 ? Math.round(pasT) : null;
      var clr = _CH_CLR[t] || '#6366f1';
      var bg  = _CH_BG[t]  || 'rgba(99,102,241,.14)';
      var lbl = _CARDIO_TYPE_LABELS[t] || t;
      var ico = _CH_ICO[t] || '⚡';

      function miniStat(v, u, l) {
        if (v === null) return '';
        return '<div style="text-align:center;">'
          + '<div style="font-size:13px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1;">' + v
            + '<span style="font-size:9px;font-weight:600;color:var(--text-muted);"> ' + u + '</span></div>'
          + '<div style="font-size:9px;color:var(--text-muted);margin-top:2px;">' + l + '</div>'
          + '</div>';
      }
      var statsHtml = [
        miniStat(avgKm,   'km',   'km moy./séance'),
        miniStat(avgVit2, 'km/h', 'vitesse moy.'),
        miniStat(totDur || null, 'min', 'durée tot.'),
        miniStat(avgCal,  'kcal', 'kcal moy./séance'),
        totPas ? miniStat(totPas.toLocaleString('fr-FR'), 'pas', 'pas totaux') : null
      ].filter(Boolean).join('');
      var statsCols = [avgKm,avgVit2,totDur||null,avgCal,totPas].filter(function(x){return x!==null&&x!==0;}).length;

      activHtml += '<div style="border-left:4px solid ' + clr + ';background:var(--surface);border-radius:12px;padding:12px 14px;margin-bottom:10px;">'
        + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (statsHtml ? '12px' : '0') + ';">'
          + '<div style="width:36px;height:36px;border-radius:10px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">' + ico + '</div>'
          + '<div style="flex:1;">'
            + '<div style="font-size:14px;font-weight:800;color:' + clr + ';">' + escapeHtml(lbl) + '</div>'
            + '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">' + ss.length + ' séance' + (ss.length > 1 ? 's' : '') + '</div>'
          + '</div>'
          + (avgFc ? '<div style="background:rgba(220,53,69,.10);border-radius:20px;padding:3px 9px;font-size:11px;font-weight:700;color:var(--danger);">❤ ' + avgFc + ' bpm</div>' : '')
        + '</div>'
        + (statsHtml ? '<div style="display:grid;grid-template-columns:repeat(' + statsCols + ',1fr);gap:12px;">' + statsHtml + '</div>' : '')
        + '</div>';
    });
  }

  // ── Panel « Séances récentes » (groupées par jour) ────────────
  var recHtml = '';
  if (!filtered.length) {
    recHtml = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0;">Aucune séance sur cette période</div>';
  } else {
    var JOURS = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
    var shown = filtered.slice(0, 25);
    var dayCount = {};
    shown.forEach(function(s) { var k = (s.date || '').slice(0, 10); dayCount[k] = (dayCount[k] || 0) + 1; });
    var lastDayKey = '';
    shown.forEach(function(s) {
      var t   = s.type_cardio || 'autre';
      var clr = _CH_CLR[t] || '#6366f1';
      var bg  = _CH_BG[t]  || 'rgba(99,102,241,.14)';
      var lbl = _CARDIO_TYPE_LABELS[t] || t;
      var ico = _CH_ICO[t] || '⚡';
      var day = s.date ? parseInt(s.date.slice(8,10), 10) : '';
      var moI = s.date ? parseInt(s.date.slice(5,7), 10) - 1 : -1;
      var dateStr = day + ' ' + (moI >= 0 ? MOIS[moI] : '');
      // En-tête de JOUR (séparateur net) quand la journée change
      var dayKey = s.date ? s.date.slice(0, 10) : '';
      if (dayKey !== lastDayKey) {
        var dObj = s.date ? new Date(s.date + 'T00:00:00') : null;
        var wd = (dObj && !isNaN(dObj.getTime())) ? JOURS[dObj.getDay()] : '';
        var cnt = dayCount[dayKey] || 1;
        recHtml += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;'
          + (lastDayKey ? 'padding:13px 0 7px;margin-top:3px;border-top:1px solid var(--border);' : 'padding:2px 0 7px;') + '">'
          + '<span style="font-size:11.5px;font-weight:800;color:var(--text);text-transform:capitalize;">' + wd + ' ' + dateStr + '</span>'
          + (cnt > 1 ? '<span style="font-size:9.5px;font-weight:800;color:var(--accent);background:var(--accent-a14);border-radius:20px;padding:2px 8px;">' + cnt + ' séances</span>' : '')
          + '</div>';
        lastDayKey = dayKey;
      }
      var parts = [];
      if (s.duree)       parts.push(s.duree + ' min');
      if (s.distance)    parts.push(s.distance + ' km');
      if (s.pas)         parts.push(s.pas + ' pas');
      if (s.vitesse_moy) parts.push(s.vitesse_moy + ' km/h');
      recHtml += '<div style="display:flex;align-items:center;gap:10px;padding:7px 0 7px 4px;">'
        + '<div style="width:34px;height:34px;border-radius:10px;background:' + bg + ';display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;">' + ico + '</div>'
        + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:12px;font-weight:800;color:' + clr + ';">' + escapeHtml(lbl) + '</div>'
          + (parts.length ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + parts.join(' · ') + '</div>' : '')
        + '</div>'
        + (s.calories ? '<div style="background:var(--warn-a);border-radius:20px;padding:4px 9px;text-align:center;flex-shrink:0;">'
            + '<div style="font-size:13px;font-weight:900;color:var(--warn);font-variant-numeric:tabular-nums;">' + Math.round(s.calories) + '</div>'
            + '<div style="font-size:8px;font-weight:700;color:var(--warn);opacity:.8;">kcal</div>'
          + '</div>' : '')
        + '<div style="display:flex;gap:4px;flex-shrink:0;margin-left:2px;">'
          + '<button onclick="_cardioModifier(\'' + s.sid + '\')" style="background:var(--accent-a10);border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;" title="Modifier">✏️</button>'
          + '<button onclick="_cardioSupprimer(\'' + s.sid + '\')" style="background:var(--bad-a);border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;" title="Supprimer">🗑️</button>'
        + '</div>'
        + '</div>';
    });
    if (filtered.length > 25) {
      recHtml += '<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:10px 0;">+ ' + (filtered.length - 25) + ' séances non affichées</div>';
    }
  }

  // ── Panel « Pas » — pas par jour (marche + marche inclinée) ──
  var pasJourHtml = '';
  if (hasPasData) {
    // pasMap : ISO yyyy-mm-dd → { pas, n, km, src }. On FUSIONNE deux sources :
    // la montre (total du jour, prioritaire) et les marches saisies (jours sans
    // montre) — sans double compter (le total montre inclut déjà la marche du jour).
    var pasMap = {};
    var _cutD = new Date(); _cutD.setHours(0, 0, 0, 0); _cutD.setDate(_cutD.getDate() - _cardioPeriod);
    var _cutIso = _cutD.getFullYear() + '-' + String(_cutD.getMonth() + 1).padStart(2, '0') + '-' + String(_cutD.getDate()).padStart(2, '0');
    // 1) Pas quotidiens de la montre (total du jour).
    if (_pasQuotidiens && _pasQuotidiens.length) {
      _pasQuotidiens.forEach(function(x) {
        var iso = (x.date || '').slice(0, 10); if (iso.length < 10 || iso < _cutIso) return;
        pasMap[iso] = { pas: Number(x.pas) || 0, n: 1, km: 0, src: 'montre' };
      });
    }
    // 2) Pas des marches saisies — uniquement les jours sans total montre.
    filtered.forEach(function(s) {
      if (!_MARCHE_TYPES[s.type_cardio] || !s.pas) return;
      var iso = (s.date || '').slice(0, 10); if (iso.length < 10) return;
      if (pasMap[iso] && pasMap[iso].src === 'montre') return;
      var d = pasMap[iso] || (pasMap[iso] = { pas: 0, n: 0, km: 0, src: 'saisie' });
      d.pas += s.pas || 0; d.n++; d.km += s.distance || 0;
    });
    var _pasDaily = Object.keys(pasMap).some(function(k) { return pasMap[k].src === 'montre'; });
    var pasDays = Object.keys(pasMap).sort();
    if (!pasDays.length) {
      pasJourHtml = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0;">Aucun pas sur cette période</div>';
    } else {
      var CY = '#22d3ee';
      var totPas  = pasDays.reduce(function(a, k) { return a + pasMap[k].pas; }, 0);
      var bestPas = pasDays.reduce(function(m, k) { return Math.max(m, pasMap[k].pas); }, 0);
      var moyPas  = Math.round(totPas / pasDays.length);
      function kpiP(v, l) {
        return '<div style="background:var(--surface2);border-radius:12px;padding:11px 6px;text-align:center;border-top:3px solid ' + CY + ';">'
          + '<div style="font-size:17px;font-weight:900;line-height:1;color:' + CY + ';font-variant-numeric:tabular-nums;">' + v + '</div>'
          + '<div style="font-size:9px;color:var(--text-muted);margin-top:5px;font-weight:600;line-height:1.2;">' + l + '</div></div>';
      }
      var kpisP = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">'
        + kpiP(moyPas.toLocaleString('fr-FR'), 'moyenne / jour actif')
        + kpiP(totPas.toLocaleString('fr-FR'), 'total (période)')
        + kpiP(bestPas.toLocaleString('fr-FR'), 'meilleur jour')
        + '</div>';

      // Barres par jour sur toute la période (jusqu'à 92 j), couvrant les pas
      // montre (anciens) et les marches saisies (récentes). Couleur par source,
      // ligne objectif, détail au toucher.
      var nDays = Math.min(_cardioPeriod, 92);
      var t0 = new Date(); t0.setHours(0, 0, 0, 0);
      var Wp = 320, Hp = 78, pcL = 8, pcR = 8, pcT = 12, pcB = 15;
      var OBJ = 10000, VIO = '#8b5cf6';
      var series = [];
      for (var di = nDays - 1; di >= 0; di--) {
        var dd = new Date(t0); dd.setDate(t0.getDate() - di);
        var isoK = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
        var eK = pasMap[isoK];
        series.push({ d: dd, iso: isoK, pas: eK ? eK.pas : 0, src: eK ? eK.src : null, has: !!eK });
      }
      var nb = series.length;
      var maxP = OBJ * 1.15;
      series.forEach(function(x) { if (x.pas > maxP) maxP = x.pas; });
      var bwH = (Wp - pcL - pcR) / nb;
      var yObj = Hp - pcB - (OBJ / maxP) * (Hp - pcT - pcB);
      var svgP = '<line x1="' + pcL + '" y1="' + (Hp - pcB) + '" x2="' + (Wp - pcR) + '" y2="' + (Hp - pcB) + '" stroke="var(--border)" stroke-width="1"/>'
        + '<line x1="' + pcL + '" y1="' + yObj.toFixed(1) + '" x2="' + (Wp - pcR) + '" y2="' + yObj.toFixed(1) + '" stroke="#f59f00" stroke-width="1" stroke-dasharray="4 3" opacity="0.75"/>'
        + '<text x="' + (Wp - pcR) + '" y="' + (yObj - 3).toFixed(1) + '" text-anchor="end" font-size="7" fill="#f59f00" font-weight="800">obj 10k</text>';
      var ww = Math.max(1.3, bwH * 0.62);
      var hasSaisie = false, hasMontre = false;
      series.forEach(function(x, i) {
        if (!x.pas) return;
        var h = Math.max(2, (x.pas / maxP) * (Hp - pcT - pcB));
        var bx = pcL + i * bwH + (bwH - ww) / 2, by = Hp - pcB - h;
        var col = x.src === 'saisie' ? VIO : CY;
        if (x.src === 'saisie') hasSaisie = true; else hasMontre = true;
        svgP += '<rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + ww.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="1.5" fill="' + col + '"/>';
      });
      var stepX = Math.max(1, Math.ceil(nb / 7));
      series.forEach(function(x, i) { if (i % stepX === 0 || i === nb - 1) svgP += '<text x="' + (pcL + (i + 0.5) * bwH).toFixed(1) + '" y="' + (Hp - 4) + '" text-anchor="middle" font-size="6.5" fill="var(--text-muted)" font-weight="700">' + x.d.getDate() + '/' + (x.d.getMonth() + 1) + '</text>'; });
      series.forEach(function(x, i) { if (!x.has) return; svgP += '<rect class="pas-hit" data-pas="' + x.pas + '" data-date="' + x.iso + '" data-src="' + (x.src || '') + '" x="' + (pcL + i * bwH).toFixed(1) + '" y="' + pcT + '" width="' + bwH.toFixed(1) + '" height="' + (Hp - pcT - pcB) + '" fill="transparent"/>'; });
      var pasLeg = (hasSaisie && hasMontre)
        ? '<div style="display:flex;gap:14px;justify-content:center;margin-top:4px;">'
          + '<span style="font-size:9.5px;color:var(--text-muted);font-weight:700;display:inline-flex;align-items:center;gap:4px;"><i style="width:8px;height:8px;border-radius:2px;background:' + CY + ';display:inline-block;"></i>⌚ Montre</span>'
          + '<span style="font-size:9.5px;color:var(--text-muted);font-weight:700;display:inline-flex;align-items:center;gap:4px;"><i style="width:8px;height:8px;border-radius:2px;background:' + VIO + ';display:inline-block;"></i>✍️ Saisie</span>'
          + '</div>' : '';
      var chartP = '<svg class="pas-chart" viewBox="0 0 ' + Wp + ' ' + Hp + '" width="100%" style="display:block;overflow:visible;touch-action:pan-y;">' + svgP + '</svg>'
        + '<div style="font-size:9.5px;color:var(--text-muted);text-align:center;font-weight:600;margin:4px 0 2px;">Pas par jour · ' + nDays + ' derniers jours</div>' + pasLeg
        + '<div style="height:12px;"></div>';

      // Liste des jours (récent → ancien)
      var JOURS2 = ['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
      var listP = '';
      pasDays.slice().reverse().slice(0, 20).forEach(function(iso) {
        var dd = new Date(iso + 'T00:00:00'), e = pasMap[iso];
        listP += '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);">'
          + '<div style="width:32px;height:32px;border-radius:10px;background:rgba(34,211,238,.14);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">🚶</div>'
          + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;text-transform:capitalize;">' + JOURS2[dd.getDay()] + ' ' + dd.getDate() + '/' + (dd.getMonth() + 1) + '</div>'
          + '<div style="font-size:10.5px;color:var(--text-muted);margin-top:1px;">' + (e.src === 'montre' ? 'Total du jour ⌚' : (e.n + ' marche' + (e.n > 1 ? 's' : '') + (e.km ? ' · ' + (Math.round(e.km * 10) / 10) + ' km' : ''))) + '</div></div>'
          + '<div style="font-size:15px;font-weight:900;color:' + CY + ';font-variant-numeric:tabular-nums;flex-shrink:0;">' + Math.round(e.pas).toLocaleString('fr-FR') + ' <small style="font-size:9px;font-weight:700;color:var(--text-muted);">pas</small></div>'
          + '</div>';
      });
      pasJourHtml = kpisP + chartP + listP;
    }
  }

  contEl.innerHTML =
    '<div style="margin-bottom:12px;">' + chips + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:' + (kpisRow2 ? '7px' : '16px') + ';">' + kpis + '</div>'
    + (kpisRow2 ? '<div style="margin-bottom:16px;">' + kpisRow2 + '</div>' : '')
    + '<div style="display:flex;background:var(--surface2);border-radius:12px;padding:3px;margin-bottom:14px;gap:3px;">' + btns + '</div>'
    + '<div id="ch-panel-semaine"'  + (_cardioSubTab !== 'semaine'  ? ' style="display:none;"' : '') + '>' + semaineHtml + '</div>'
    + '<div id="ch-panel-activite"' + (_cardioSubTab !== 'activite' ? ' style="display:none;"' : '') + '>' + activHtml + '</div>'
    + '<div id="ch-panel-recentes"' + (_cardioSubTab !== 'recentes' ? ' style="display:none;"' : '') + '>' + recHtml + '</div>'
    + (hasPasData ? '<div id="ch-panel-pas"' + (_cardioSubTab !== 'pas' ? ' style="display:none;"' : '') + '>' + pasJourHtml + '</div>' : '');
  try { _attachPasTip(); } catch (e) {}
}

// Bulle de détail sur la courbe des pas (survol / toucher).
function _attachPasTip() {
  var svg = document.querySelector('#hist-cardio-content .pas-chart');
  if (!svg) return;
  var tip = document.getElementById('_pas-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = '_pas-tip';
    tip.style.cssText = 'position:fixed;pointer-events:none;opacity:0;transform:translate(-50%,-100%);transition:opacity .1s;background:var(--text);color:var(--surface);font-size:11px;font-weight:700;padding:6px 9px;border-radius:8px;white-space:nowrap;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.28);line-height:1.25;';
    document.body.appendChild(tip);
  }
  var show = function(t) {
    var r = t.getBoundingClientRect();
    var src = t.getAttribute('data-src');
    var stag = src === 'montre' ? ' · ⌚ montre' : src === 'saisie' ? ' · ✍️ saisie' : '';
    var dd = new Date(t.getAttribute('data-date') + 'T00:00:00');
    var pas = Number(t.getAttribute('data-pas')).toLocaleString('fr-FR');
    tip.innerHTML = pas + ' pas<span style="display:block;font-weight:600;opacity:.75;font-size:9.5px;">' + dd.getDate() + '/' + (dd.getMonth() + 1) + stag + '</span>';
    tip.style.left = (r.left + r.width / 2) + 'px';
    tip.style.top = r.top + 'px';
    tip.style.opacity = '1';
  };
  var hide = function() { tip.style.opacity = '0'; };
  svg.addEventListener('pointermove', function(e) { var t = e.target; if (t.classList && t.classList.contains('pas-hit')) show(t); else hide(); });
  svg.addEventListener('pointerdown', function(e) { var t = e.target; if (t.classList && t.classList.contains('pas-hit')) show(t); });
  svg.addEventListener('pointerleave', hide);
}

// =============================================================================
// CARDIO — Supprimer / Modifier une séance
// =============================================================================

function _cardioSupprimer(sid) {
  var old = document.getElementById('_cardio-confirm-overlay');
  if (old) old.remove();
  var s = _cardioSessions.find(function(x) { return x.sid === sid; });
  if (!s) return;
  var t   = s.type_cardio || 'autre';
  var lbl = _CARDIO_TYPE_LABELS[t] || t;
  var ico = _CH_ICO[t] || '⚡';
  var ov  = document.createElement('div');
  ov.id   = '_cardio-confirm-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,20,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML =
    '<div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -8px 30px rgba(7,11,20,.18);">'
    + '<div style="width:40px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 20px;"></div>'
    + '<div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px;">Supprimer cette séance ?</div>'
    + '<div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">' + ico + ' ' + escapeHtml(lbl) + ' · ' + (s.date || '') + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
      + '<button onclick="document.getElementById(\'_cardio-confirm-overlay\').remove()" style="padding:13px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;">Annuler</button>'
      + '<button onclick="_cardioConfirmSupprimer(\'' + sid + '\')" style="padding:13px;border-radius:12px;border:none;background:var(--bad);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">🗑️ Supprimer</button>'
    + '</div>'
    + '</div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

async function _cardioConfirmSupprimer(sid) {
  var ov = document.getElementById('_cardio-confirm-overlay');
  if (ov) ov.remove();
  if (!athlete) return;
  showToast('Suppression…', 'var(--text-muted)');
  try {
    var r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteCardio', athlete_id: athlete.athlete_id, seance_id: sid })
    });
    var res = await r.json();
    if (res.success) {
      showToast('Séance supprimée', 'var(--good)');
      chargerAppData();
    } else {
      showToast('Erreur : ' + (res.error || 'inconnue'), 'var(--bad)');
    }
  } catch(e) {
    showToast('Erreur réseau', 'var(--bad)');
  }
}

function _cardioModifier(sid) {
  var old = document.getElementById('_cardio-edit-overlay');
  if (old) old.remove();
  var s = _cardioSessions.find(function(x) { return x.sid === sid; });
  if (!s) return;
  var typeOpts = ['footing','velo','marche_normale','marche_inclinee','natation','autre'].map(function(k) {
    return '<option value="' + k + '"' + (s.type_cardio === k ? ' selected' : '') + '>' + (_CARDIO_TYPE_LABELS[k] || k) + '</option>';
  }).join('');
  function numField(id, label, val, unite, step) {
    return '<div><label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">' + label + (unite ? ' (' + unite + ')' : '') + '</label>'
      + '<input type="number" id="' + id + '" value="' + (val || '') + '" step="' + (step || '1') + '" style="width:100%;box-sizing:border-box;padding:9px 10px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-family:var(--font);"></div>';
  }
  var ov = document.createElement('div');
  ov.id  = '_cardio-edit-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(7,11,20,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML =
    '<div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:24px 20px 28px;box-shadow:0 -8px 30px rgba(7,11,20,.18);max-height:85vh;overflow-y:auto;">'
    + '<div style="width:40px;height:4px;background:var(--border);border-radius:4px;margin:0 auto 18px;"></div>'
    + '<div style="font-size:15px;font-weight:800;margin-bottom:16px;">Modifier la séance</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + '<div><label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Date</label>'
        + '<input type="date" id="_ce-date" value="' + (s.date || '') + '" style="width:100%;box-sizing:border-box;padding:9px 10px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;"></div>'
      + '<div><label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px;">Type</label>'
        + '<select id="_ce-type" style="width:100%;box-sizing:border-box;padding:9px 10px;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;">' + typeOpts + '</select></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + numField('_ce-duree',    'Durée',         s.duree,       'min',   '1')
      + numField('_ce-distance', 'Distance',      s.distance,    'km',    '0.1')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + numField('_ce-vitesse',  'Vitesse moy.',  s.vitesse_moy, 'km/h',  '0.1')
      + numField('_ce-calories', 'Calories',      s.calories,    'kcal',  '1')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">'
      + numField('_ce-fc',       'FC moy.',       s.fc_moy,      'bpm',   '1')
      + '<div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">'
      + numField('_ce-rpe',      'RPE',           '',            '1-10',  '0.5')
      + '<div></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">'
      + '<button onclick="document.getElementById(\'_cardio-edit-overlay\').remove()" style="padding:13px;border-radius:12px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-weight:700;cursor:pointer;">Annuler</button>'
      + '<button onclick="_cardioSauvegarderModif(\'' + sid + '\')" style="padding:13px;border-radius:12px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:700;cursor:pointer;">✅ Enregistrer</button>'
    + '</div>'
    + '</div>';
  ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

async function _cardioSauvegarderModif(sid) {
  if (!athlete) return;
  function gv(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  var date  = gv('_ce-date');
  var duree = gv('_ce-duree');
  if (!date || !duree) { showToast('Date et durée obligatoires', 'var(--warn)'); return; }
  var body = {
    action:       'updateCardio',
    athlete_id:   athlete.athlete_id,
    seance_id:    sid,
    date:         date,
    type_cardio:  gv('_ce-type'),
    duree:        duree,
    distance:     gv('_ce-distance'),
    vitesse_moy:  gv('_ce-vitesse'),
    calories:     gv('_ce-calories'),
    fc_moy:       gv('_ce-fc'),
    pas:          (function(){ var t=gv('_ce-type'); if(!(t==='marche_normale'||t==='marche_inclinee')) return ''; var h=parseFloat((athlete||{}).taille)||0; if(!h) return ''; var d=parseFloat(gv('_ce-distance'))||0; if(d===0){var dur=parseFloat(gv('_ce-duree'))||0; if(dur>0) d=Math.round(4.5*dur/60*10)/10;} return d>0?Math.round(d*100000/(h*0.413)):''; })(),
    rpe:          gv('_ce-rpe')
  };
  var ov = document.getElementById('_cardio-edit-overlay');
  if (ov) ov.remove();
  showToast('Enregistrement…', 'var(--text-muted)');
  try {
    var r = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    var res = await r.json();
    if (res.success) {
      showToast('Séance modifiée ✓', 'var(--good)');
      chargerAppData();
    } else {
      showToast('Erreur : ' + (res.error || 'inconnue'), 'var(--bad)');
    }
  } catch(e) {
    showToast('Erreur réseau', 'var(--bad)');
  }
}
