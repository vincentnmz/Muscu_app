# Modèle de données générique

## 1. Objectif

Définir un modèle **indépendant du sport**, compatible avec une future base relationnelle (PostgreSQL / Supabase), et mappable dès aujourd'hui sur les Google Sheets existants sans casse.

Concept pivot : **la table `Indicateur`** remplace la logique actuelle « une colonne = un muscle ». Un indicateur est une mesure typée (`cle`, `valeur`, `unite`) — le noyau n'a pas besoin de savoir ce qu'elle représente.

## 2. Entités du noyau

> **Décisions d'architecture validées (2026-07)** :
> 1. **Une séance appartient à l'équipe**, pas à l'athlète. Chaque athlète y a une **participation** qui porte ses propres indicateurs. La musculation = une équipe de 1 (séance solo). → modèle *collectif-ready*.
> 2. **Un match est une `Séance` de `type = "match"`** : il réutilise tout le moteur de charge (ACWR compte le match). Les détails spécifiques (adversaire, score, temps de jeu) vivent dans le module sport, pas dans le noyau.
> 3. **`Test` reste séparé d'`Exercice`** : le test est une mesure ponctuelle de capacité (1RM, VMA, sprint 10 m, CMJ), pas du travail répété.
> 4. **`poste` et `categorie` sur `AthleteEquipe`** : permet de comparer un athlète à la norme de son poste / sa catégorie d'âge.
> 5. **Entité `Blessure` générique** : suivi des indisponibilités et de la réathlétisation (remplace les simples « pauses »). Central pour une cellule de performance.
> 6. **Vocabulaire par sport** : le noyau garde des termes neutres (Athlète, Équipe, Séance). Chaque module définit ses **libellés d'affichage** dans `Sport.config_json` (ex : « joueur », « groupe »). Le code ne change jamais, seul l'affichage s'adapte.

```
Club(id, nom, federation_id?)
Federation(id, nom, sport_principal?)
Saison(id, club_id, libelle, date_debut, date_fin)
Equipe(id, club_id, nom, sport_id, saison_id)

Coach(id, nom, email, role)                  role: coach|prepa|analyste|resp_formation
Athlete(id, nom, prenom, date_naissance, taille)
AthleteEquipe(athlete_id, equipe_id, poste?, categorie?)   ← poste & catégorie ici

Sport(id, cle, nom, config_json)             cle: "muscu", "foot", "hockey"...
AthleteSport(athlete_id, sport_id)           un athlète peut pratiquer 2 sports

-- SÉANCE = créneau d'équipe (décision 1 & 2) --
Seance(id, equipe_id, sport_id, date, type, duree_min?)     type: entrainement|match|test|recup
Participation(id, seance_id, athlete_id, presence, temps_jeu_min?)
Indicateur(id, participation_id, cle, valeur, unite, source)   ← rattaché à la participation

-- MESURES DE CAPACITÉ (décision 3) --
Test(id, athlete_id, sport_id, cle, valeur, unite, date)

Objectif(id, athlete_id, cle, cible, date_echeance)
Questionnaire(id, athlete_id, date, type)    type: "wellness"...
QuestionnaireReponse(questionnaire_id, cle, valeur)

Commentaire(id, athlete_id, coach_id, texte, date, lu)
Alerte(id, athlete_id, type, priorite, date, statut)
Note(id, athlete_id, texte, date)
Poids(id, athlete_id, valeur, date)

-- SANTÉ / DISPONIBILITÉ (décision 5) --
Blessure(id, athlete_id, date_debut, zone, type, gravite,
         statut, date_retour_prevue?, date_retour_reelle?)
         statut: active | reathletisation | disponible
```

### La table `Indicateur` — le cœur générique

Un indicateur est rattaché à la **participation** d'un athlète à une séance (décision 1). Ainsi, un entraînement collectif d'une équipe de 20 = 1 `Seance` + 20 `Participation`, chacune avec ses propres indicateurs.

| Champ | Exemple muscu | Exemple foot |
|---|---|---|
| `cle` | `tonnage` | `distance_hi` |
| `valeur` | `12000` | `850` |
| `unite` | `kg` | `m` |
| `source` | `saisie` | `gps` |

Le module musculation produit `{cle:"tonnage", valeur:12000, unite:"kg"}`.
Un module foot produira `{cle:"distance_hi", valeur:850, unite:"m"}`.
Le moteur d'analyse consomme `charge`, `intensite`, `volume`, `evol_pct` — jamais `muscle` ni `sprint`.

### Séance individuelle = cas particulier

La musculation reste simple : une séance solo est une `Seance` rattachée à une équipe de 1 (ou une équipe « perso » de l'athlète), avec une seule `Participation`. Le module muscu masque cette mécanique à l'utilisateur — il continue de voir « sa » séance.

### Détail spécifique sport → `config_json` du Sport

Ce qui est propre à un sport (liste de muscles, postes, zones de terrain, barème de tests) vit dans `Sport.config_json`, **pas dans le schéma**. Ajouter un sport ne modifie aucune table.

```json
{
  "cle": "muscu",
  "nom": "Musculation",
  "libelles": {
    "athlete": "Athlète", "equipe": "Groupe", "seance": "Séance"
  },
  "indicateurs": [
    {"cle": "tonnage", "unite": "kg", "sens": "haut=plus de volume"},
    {"cle": "charge",  "unite": "kg", "sens": "haut=plus fort"},
    {"cle": "rpe",     "unite": "1-10"}
  ],
  "tests": [{"cle": "1rm", "unite": "kg"}],
  "postes": [],
  "groupes": ["Pectoraux", "Dos", "Jambes", "Épaules", "Bras"]
}
```

Exemple foot (mêmes clés, autres libellés) :
```json
{
  "cle": "foot", "nom": "Football",
  "libelles": { "athlete": "Joueur", "equipe": "Équipe", "seance": "Séance" },
  "postes": ["Gardien", "Défenseur", "Milieu", "Attaquant"]
}
```

### La table `Blessure` et le moteur d'analyse

Une blessure `active` ou en `reathletisation` **modifie le comportement du moteur** : un athlète indisponible ne doit pas générer d'alerte « irrégularité » ou « sous-entraînement » (c'est normal qu'il ne s'entraîne pas). Le statut de disponibilité devient un **fait** lu par `normaliser()`, qui neutralise les règles concernées — même mécanique que les « pauses » actuelles, mais avec un vrai suivi (zone, gravité, date de retour).

## 3. Mapping avec les Google Sheets actuels

L'objectif est une migration **sans casse** : les onglets existants restent, on ajoute une couche de correspondance.

| Onglet Sheets actuel | Nature | Cible générique |
|---|---|---|
| `Athletes` | générique | `Athlete` |
| `Coachs` | générique | `Coach` |
| `Objectif` | générique | `Objectif` |
| `Poids_historique` | générique | `Poids` |
| `Notes` | générique | `Note` |
| `Commentaires` | générique | `Commentaire` |
| `Bien_etre` | générique | `Questionnaire` (type wellness) |
| `Pauses` | générique | `Blessure` (statut) |
| `AlertesTraitees` / `AlertesHistorique` | générique | `Alerte` |
| `Performances` | **muscu** | `Seance` + `Participation` + `Indicateur` (module muscu) |
| `Programme` | **muscu** | module muscu |
| `Exercices` | **muscu** | `Sport.config_json` (module muscu) |
| `Volume obti` | **muscu** | cibles du module muscu |

### Rappel : structure actuelle de `Performances`
```
[0]=date [1]=semaine [2]=seance_id [3]=nom [4]=athlete_id
[5]=exercice [6]=muscle [7]=exercice_id [8]=serie
[9]=charge [10]=reps [11]=rpe [12]=repos [13]=volume
```
Devient : une `Seance` (date, equipe, sport=muscu) → une `Participation` (athlete_id)
→ N `Indicateur` (`charge`, `reps`, `rpe`, `volume`), avec `muscle`/`exercice` portés
par la config du module.

## 4. Stratégie de migration des données

**Double écriture (Phase 4)** : pendant la transition, chaque saisie écrit à la fois dans l'ancien onglet `Performances` ET dans le nouveau format `Indicateur`. On valide que les deux concordent avant de basculer la lecture. Zéro interruption, retour arrière toujours possible.

**Bascule base (Phase 5)** : Sheets → Supabase. Le moteur d'analyse ne lit que via `normaliser()` : changer la source de données ne le touche pas.

## 5. Compatibilité PostgreSQL / Supabase

Le modèle ci-dessus est directement traduisible en tables relationnelles :
- clés étrangères explicites (`club_id`, `sport_id`, `equipe_id`, `seance_id`, `athlete_id`) ;
- `Indicateur`, `Test` et `Participation` = tables « longues » (une ligne = une mesure/un lien), idéales pour l'agrégation SQL et les vues fédération ;
- `config_json` → colonne `jsonb` Postgres (indexable).

Aucune décision de ce document ne bloque la migration relationnelle.
