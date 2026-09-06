# Catalogue de métriques (bibliothèque)

> **Principe fondateur.** Novalyz ne code pas les indicateurs « en dur » sport par sport. Il tient une **bibliothèque de métriques** : chaque mesure est décrite par ses métadonnées. Le noyau (saisie, stockage, moteur d'analyse, dashboard) lit ces métadonnées — il ne connaît jamais un sport en particulier.
>
> **Conséquence :** ajouter un sport (rugby, natation…) = **enrichir cette bibliothèque** avec de nouvelles métriques. Aucun changement du cœur. C'est ce qui rend la plateforme crédible et évolutive à 5-10 ans.

Toutes les mesures se stockent dans une **table unique `Indicateurs`** (une ligne = une mesure : `date, athlete_id, seance_id, cle, valeur, unite, source`), quel que soit le sport. Ce catalogue est le **dictionnaire** de la colonne `cle`.

## Schéma d'une métrique (métadonnées)

| Champ | Rôle |
|---|---|
| `cle` | Identifiant technique unique (ex. `distance_hi`) |
| `nom` | Libellé lisible (ex. « Distance haute intensité ») |
| `categorie` | Bien-être · Séance · Exposition · Performance · Test · Charge · Blessure · Récup · KPI |
| `sport` | `tous` · `football` · `muscu` · … (qui utilise la métrique) |
| `type` | nombre · pourcentage · temps · score · booléen |
| `unite` | kg · min · % · m · km/h · 1-5 · 1-10 · — |
| `min` / `max` | Bornes si applicable (ex. score 1-5) |
| `saisie` | `manuel` · `calculé` · `importé` (GPS/fichier) |
| `frequence` | par séance · quotidien · hebdo · saison · ponctuel |
| `moteur` | La métrique est-elle lue par le moteur d'analyse ? (oui/non) |
| `kpi_derives` | KPI calculés auxquels elle contribue |

---

## 1. Identité athlète · `categorie = identite` · `frequence = ponctuel`

| cle | nom | sport | type | saisie |
|---|---|---|---|---|
| `nom`, `prenom` | Nom, Prénom | tous | texte | manuel |
| `date_naissance` | Date de naissance | tous | date | manuel |
| `sexe` | Sexe | tous | score | manuel |
| `taille` | Taille | tous | nombre (cm) | manuel |
| `poids` | Poids | tous | nombre (kg) | manuel |
| `sport` | Sport | tous | texte | manuel |
| `discipline` | Discipline | tous | texte | manuel |
| `poste` | Poste | football… | texte | manuel |
| `jambe_dominante` | Jambe dominante | football… | score | manuel |
| `club`, `equipe`, `categorie_age` | Club / Équipe / Catégorie | tous | texte | manuel |
| `date_entree` | Date d'entrée | tous | date | manuel |
| `antecedents_blessures` | Antécédents de blessures | tous | texte | manuel |

## 2. Objectifs · `categorie = objectif` · `frequence = ponctuel` · `sport = tous`

`developpement_physique` · `retour_blessure` · `performance` · `prevention` · `maintien` · `perte_poids` · `prise_masse` (type booléen/score, saisie manuelle).

## 3. Bien-être — questionnaire pré-séance · `categorie = bien_etre` · `type = score 1-5` · `saisie = manuel` · `frequence = par séance` · `moteur = OUI` · `sport = tous`

| cle | nom | contribue à (KPI) |
|---|---|---|
| `sommeil` | Qualité du sommeil | Disponibilité, État récup |
| `fatigue` | Fatigue | Risque surcharge, Récup |
| `energie` | Énergie | Disponibilité |
| `motivation` | Motivation | Disponibilité |
| `stress` | Stress | Risque blessure |
| `courbatures` | Courbatures | Récup, Risque surcharge |
| `douleur` | Douleurs | Risque blessure, Disponibilité |
| `dispo_mentale` | Disponibilité mentale | Disponibilité |

> ⚙️ Déjà partiellement en place (sommeil, énergie, fatigue, douleur, ressenti) — à étendre.

## 4. Données de séance · `categorie = seance` · `frequence = par séance` · `sport = tous`

| cle | nom | type / unité | saisie | moteur | kpi_derives |
|---|---|---|---|---|---|
| `date`, `heure` | Date, Heure | date/temps | manuel | — | Régularité |
| `duree` | Durée | temps (min) | manuel | oui | Charge interne, Temps d'entraînement |
| `type_seance` | Type de séance | texte | manuel | oui | — |
| `intensite_prevue` | Intensité prévue | score | manuel | non | — |
| `intensite_realisee` | Intensité réalisée | score | manuel | oui | — |
| `rpe` | RPE séance | 1-10 | manuel | oui | Charge interne, Monotonie, Strain |
| `charge_interne` | Charge interne (RPE × durée) | nombre (UA) | **calculé** | oui | ACWR, Charge hebdo/mensuelle |

## 5. Exposition · `categorie = exposition` · `frequence = par séance` · `sport = football…`

| cle | nom | type | saisie |
|---|---|---|---|
| `type_evenement` | Match / Entraînement | texte | manuel |
| `titulaire` | Titulaire | booléen | manuel |
| `minutes_jouees` / `temps_jeu` | Minutes jouées / Temps de jeu | temps | manuel/importé |

## 6. Performance Football · `categorie = performance` · `sport = football` · `frequence = par match` · `moteur = non` (perf pure, pas charge)

- **Attaque** : `buts`, `xg`, `xa`, `tirs`, `tirs_cadres`, `passes_cles`, `centres_reussis`
- **Milieu** : `passes_reussies`, `passes_progressives`, `ballons_recuperes`, `pressings_reussis`, `duels_gagnes`
- **Défense** : `interceptions`, `tacles_reussis`, `degagements`, `duels_gagnes`, `fautes`
- **Gardien** : `arrets`, `xgot_arrete`, `relances_reussies`, `sorties_aeriennes`

(type nombre ou %, saisie manuel/importé.)

## 7. Préparation physique (tests) · `categorie = test` · `frequence = ponctuel` · `sport = tous`

| cle | nom | unité | saisie | kpi_derives |
|---|---|---|---|---|
| `sprint_10m`, `sprint_30m` | Sprint 10 m / 30 m | s | manuel | Progression |
| `cmj`, `squat_jump` | CMJ / Squat Jump | cm | manuel | Progression (explosivité) |
| `yoyo_test` | Yo-Yo Test | m | manuel | Endurance |
| `vma` | VMA | km/h | manuel | Progression aérobie |
| `agilite_5_10_5` | Agilité 5-10-5 | s | manuel | — |
| `force_iso`, `force_max` | Force isométrique / maximale | kg/N | manuel | Progression force |

## 8. Charge externe — GPS · `categorie = charge` · `saisie = importé` · `frequence = par séance` · `sport = football…` · `moteur = OUI`

| cle | nom | unité | kpi_derives |
|---|---|---|---|
| `distance_totale` | Distance totale | m | Charge hebdo |
| `distance_hi` | Distance haute intensité | m | Risque surcharge |
| `sprint_distance` | Sprint distance | m | Risque surcharge |
| `sprints` | Nombre de sprints | nb | Risque surcharge |
| `accelerations` | Accélérations | nb | Risque blessure |
| `decelerations` | Décélérations | nb | Risque blessure |
| `vitesse_max` | Vitesse max | km/h | Progression |
| `charge_gps` | Charge GPS (player load) | UA | ACWR, Charge hebdo |

## 9. Blessures · `categorie = blessure` · `sport = tous` (entité dédiée, voir modèle de données)

`date`, `type`, `localisation`, `gravite`, `duree`, `retour_terrain`, `retour_competition`.
→ Alimente **Disponibilité** et neutralise les alertes d'assiduité (fait « indisponible »).

## 10. Récupération post-séance · `categorie = recup` · `type = score 1-5` · `saisie = manuel` · `frequence = par séance` · `moteur = OUI` · `sport = tous`

`fatigue_post`, `difficulte_seance`, `satisfaction`, `douleur_post`, `commentaire` (texte).

## 11. KPI calculés (dérivés) · `categorie = kpi` · `saisie = calculé` · `moteur = OUI`

| cle | nom | sport | statut |
|---|---|---|---|
| `acwr` | ACWR (aigu/chronique) | tous | ✅ en place |
| `charge_hebdo`, `charge_mensuelle` | Charge hebdo / mensuelle | tous | 🚧 |
| `monotonie`, `strain` | Monotonie / Strain | tous | ✅ (moteur récent) |
| `volume` | Volume | tous | ✅ |
| `volume_par_muscle`, `tonnage` | Volume/muscle, Tonnage | **muscu** | ✅ |
| `progression` | Progression | tous | ✅ |
| `regularite` | Régularité | tous | ✅ |
| `temps_entrainement`, `temps_jeu` | Temps d'entraînement / de jeu | tous | 🚧 |
| `tendance_7j`, `tendance_28j`, `tendance_saison` | Tendances | tous | ✅ (4/8 sem) |

## 12. Sorties du moteur d'analyse (la vraie valeur)

Le moteur ne renvoie pas des chiffres bruts mais des **décisions**, à partir des métriques `moteur = OUI` :

| Sortie | Niveaux | S'appuie sur |
|---|---|---|
| **Disponibilité** | 🟢 Prêt · 🟠 Vigilance · 🔴 À surveiller | bien-être, blessures, charge |
| **Risque de surcharge** | Faible · Modéré · Élevé | ACWR, distance_hi, charge_gps |
| **État de récupération** | Excellent · Bon · Moyen · Faible | sommeil, fatigue, courbatures, récup post |
| **Progression** | En progression · Stable · Régression | tests, charge/perf dans le temps |
| **Risque de blessure** | Faible · Modéré · Élevé | ACWR + douleur + fatigue (+ accel/décel) |
| **Recommandation auto** | texte | combinaison des règles (ex. « Réduire le volume de sprint 48 h ») |

> Ces sorties existent déjà en partie dans `NovalyzEngine` (règles `risque_blessure`, `surmenage`, `bonne_adaptation`…). Le passage foot = **alimenter `normaliser()` avec les métriques ci-dessus**, pas réécrire le moteur.

## 13. Dashboard Coach (ce qu'on affiche, pas 150 graphiques)

🔴 Joueurs à risque · 🟠 à surveiller · 🟢 disponibles · Charge de l'équipe · Bien-être moyen · Progression · Alertes · Joueurs en régression / progression · Dernières séances · Blessés · Retours de blessure.

---

## Comment on s'en sert (feuille de route)

1. **Cette bibliothèque = la référence.** Toute nouvelle métrique s'ajoute ici d'abord.
2. **Table `Indicateurs`** (générique) stocke les valeurs ; `cle` pointe vers ce catalogue.
3. **Le moteur** lit les métriques `moteur = OUI` via `normaliser()`.
4. **Ajouter un sport** = ajouter ses lignes ici + alimenter la table. Le cœur ne bouge pas.
