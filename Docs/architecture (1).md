# Architecture cible — Hub plateforme

## 1. Principe directeur

Novalyz est un **hub central** qui héberge des **modules sport**. Un athlète possède un profil unique et transversal ; chaque sport qu'il pratique ajoute ses propres données et ses propres écrans, sans jamais modifier le noyau.

```
┌──────────────────────────────────────────────────────────────┐
│                          HUB NOVALYZ                          │
│                                                               │
│   Tableau de bord central (profil transversal de l'athlète)   │
│   Athlète · Coach · Club · Équipe · Saison · Fédération       │
│                                                               │
│   ┌─────────────────────────────────────────────────────┐    │
│   │              NOYAU (sport-agnostic)                  │    │
│   │                                                      │    │
│   │   Entités génériques  ─────────►  MOTEUR D'ANALYSE   │    │
│   │   Séance · Participation · Indicateur                │    │
│   │   Test · Questionnaire · Objectif    (règles →       │    │
│   │                                       alertes)       │    │
│   └─────────────────────────────────────────────────────┘    │
│            ▲              ▲               ▲                    │
│   ┌────────┴──────┐ ┌─────┴───────┐ ┌────┴─────────┐          │
│   │ MODULE Muscu  │ │ MODULE Foot │ │ MODULE …     │          │
│   │ (existant)    │ │ (futur)     │ │              │          │
│   │ tonnage, 1RM, │ │ GPS, sprints│ │              │          │
│   │ volume/muscle │ │ distance HI │ │              │          │
│   └───────────────┘ └─────────────┘ └──────────────┘          │
└──────────────────────────────────────────────────────────────┘
```

## 2. La règle d'or

> Un module **produit des indicateurs génériques** ; le noyau les **consomme** sans connaître le sport.

Le moteur d'analyse ne connaît jamais les mots « muscle », « sprint » ou « longueur de bassin ». Il ne voit que des **indicateurs typés** : une charge, une intensité, un volume, un ressenti, une évolution en %.

Concrètement, le contrat existe **déjà** dans le code : la fonction `normaliser(data)` (`index.html`, moteur `v1.0.0`) transforme des données hétérogènes en « faits » nullables. C'est le point d'entrée unique du moteur. Un module foot n'aura qu'à alimenter `r.acwr`, `r.rpe7j`, `r.charge28EvolPct` avec ses propres données — le reste du moteur fonctionne sans modification.

## 3. Modèle collectif (décision validée)

Une **séance appartient à l'équipe**, pas à l'athlète. Chaque athlète y a une **participation** qui porte ses propres indicateurs.

- Entraînement d'une équipe de 20 = **1 `Seance` + 20 `Participation`**.
- Musculation solo = **équipe de 1** (une seule participation) : le module masque cette mécanique à l'utilisateur.
- Un **match** = `Seance type="match"` : même moteur de charge, l'ACWR intègre le match.

Ce choix rend Novalyz utilisable en **cellule de performance** (sports collectifs), tout en gardant la muscu simple.

## 4. Les trois couches

### Couche 1 — Noyau (jamais dépendant d'un sport)
- **Entités** : Athlète, Coach, Club, Équipe, Saison, Séance, Participation, Programme, Objectif, Exercice/Test, Questionnaire, Indicateur, Analyse, Recommandation, Alerte.
- **Moteur d'analyse** : voir [`moteur-analyse.md`](./moteur-analyse.md).
- **Services transversaux** : authentification, gestion des rôles, bien-être, messagerie coach↔athlète, historique d'alertes.

### Couche 2 — Modules sport (branchables)
Chaque module déclare :
- ses **types d'indicateurs** (`cle`, `unite`, sens) ;
- ses **écrans de saisie** (ex : saisie série charge/reps pour la muscu) ;
- ses **écrans d'analyse** spécifiques (ex : volume par muscle) ;
- éventuellement des **règles d'alerte additionnelles** injectées dans le moteur.

Ajouter un sport = ajouter un module. **Zéro modification du noyau.** C'est le critère de succès de l'architecture (Phase 6 de la roadmap : brancher un 2ᵉ sport prouve que le noyau est bien isolé).

### Couche 3 — Hub & profils
Le hub affiche, par **profil utilisateur**, uniquement l'information utile à sa décision :

| Profil | Voit |
|---|---|
| Athlète | Sa progression, son bien-être, ses objectifs, ses conseils |
| Coach | Cohorte à surveiller, alertes priorisées, détail par athlète |
| Préparateur physique | Charge, ACWR, wellness, tests physiques |
| Analyste de performance | Indicateurs bruts, tendances, export |
| Centre de formation | Suivi collectif, progression des jeunes |
| Club | Vue multi-équipes, assiduité, santé du groupe |
| Fédération | Vue agrégée multi-clubs, standards, comparatifs |

Le sport actif d'une équipe pilote **quels modules** et **quels indicateurs** sont affichés ; le profil utilisateur pilote **quel niveau de lecture**.

## 5. État actuel vs cible

| | Aujourd'hui | Cible |
|---|---|---|
| Front | `index.html` mono-fichier, vues `#view-login/#view-coach/#view-app` | Hub + modules chargés dynamiquement |
| Sport | Musculation en dur | `Sport` comme entité, muscu = 1 module |
| Séance | Rattachée à l'athlète | Rattachée à l'équipe + participations |
| Données | Onglets Sheets typés muscu (`Performances`, `Exercices`…) | Table `Indicateur` générique + modules |
| Base | Google Sheets | PostgreSQL / Supabase (Phase 5) |
| Moteur | Déjà générique (`normaliser` + `SEUILS`) | Inchangé — c'est déjà le bon design |

## 6. Ce qui est déjà générique (à préserver)

Le diagnostic du code montre que **~60 % du noyau est déjà sport-agnostique** :

- **Moteur d'alertes** `v1.0.0` : `SEUILS` centralisés, `normaliser()`, système de signaux, priorisation.
- **ACWR** (Acute:Chronic Workload Ratio) : métrique universelle de gestion de charge.
- **RPE 7j** (sRPE) : standard des sports collectifs.
- **Bien-être** : sommeil, énergie, fatigue, douleur, ressenti — 100 % transversal.
- **Entités déjà neutres** : Athlètes, Coachs, Objectif, Poids, Notes, Commentaires, Bien_etre, Pauses, Alertes.

Le travail de migration n'est donc **pas une reconstruction** : c'est **formaliser la frontière qui existe déjà** entre noyau et module musculation.

## 7. Ce qui est spécifique musculation (à isoler dans le module)

- Onglets `Performances`, `Programme`, `Exercices`, `Volume obti`.
- Concepts : tonnage (charge × reps), 1RM estimé (Epley), volume par muscle, cibles `MINI_VOL`, surcharge progressive par palier.

Ces éléments deviennent le **Module Musculation** — le premier des N modules.
