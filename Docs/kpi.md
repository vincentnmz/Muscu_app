# Documentation des KPI / indicateurs

> Chaque indicateur : sa formule, son unité, son interprétation, et s'il est **générique** (noyau) ou **spécifique** à un module. Les indicateurs génériques sont ceux que le moteur d'analyse consomme via `normaliser()`.

## 1. Indicateurs génériques (noyau — tous sports)

| Indicateur | Formule / définition | Unité | Interprétation |
|---|---|---|---|
| **ACWR** | charge aiguë (7j) / charge chronique (28j) | ratio | Zone optimale 0,8–1,3. `> 1,5` = risque de blessure accru. Métrique inter-sports de référence. |
| **RPE 7j** | moyenne de la charge ressentie sur 7 jours | 1–10 | Fatigue subjective. Base du sRPE en sports collectifs. |
| **Bien-être** | sommeil, énergie, fatigue, douleur, ressenti | 1–5 | sommeil/énergie/ressenti : 5 = bon. fatigue/douleur : 5 = mauvais. |
| **Poids** | mesure déclarée | kg | Suivi de tendance ; variation `> 0,3 kg` significative. |
| **Régularité / assiduité** | séances réalisées / jours (ou / objectif) | % | Adhérence au programme. |
| **Streak** | nb de semaines consécutives avec ≥ 1 séance | semaines | Dynamique d'engagement. |
| **Séances / semaine** | moyenne sur la période | nb | Volume d'entraînement grossier. |
| **Delta période** | (période courante − période précédente) / précédente | % | Évolution vs période équivalente précédente. |

## 2. Signaux dérivés (seuillés — voir `moteur-analyse.md`)

Le moteur transforme ces indicateurs en booléens : `fatigueElevee`, `acwrEleve`, `progressionHausse/Baisse`, `volumeEleve/Faible`, `regulariteFaible/Excellente`, `poidsBaisse/Hausse`, `forceBaisse/Hausse`. Les seuils sont dans `SEUILS`.

## 3. Indicateurs du Module Musculation (spécifiques)

| Indicateur | Formule | Unité | Interprétation |
|---|---|---|---|
| **Tonnage** | Σ (charge × reps) | kg | Volume de travail total sur la période. |
| **Volume (séries)** | nb de séries par muscle | séries | Comparé à une cible `MINI_VOL = nb_semaines × 10`. |
| **1RM estimé** | Epley : `charge × (1 + reps/30)` | kg | Force maximale théorique, comparable indépendamment des reps. |
| **Volume par muscle** | Σ séries regroupées par muscle | séries | Détecte les muscles sous-travaillés (`< 60 % de MINI_VOL`). |
| **Tonnage par semaine** | Σ tonnage groupé par semaine ISO | kg | Courbe de charge hebdomadaire (graphe du bilan PDF). |
| **Surcharge progressive** | palier d'expérience (débutant → expert) | — | Détermine le rythme de progression attendu. |

## 4. Comment un module généralise ses indicateurs

Le contrat : un module **traduit ses mesures propres en indicateurs génériques** que le moteur sait lire.

| Concept générique | Muscu alimente avec | Foot alimenterait avec |
|---|---|---|
| `charge` | charge soulevée / 1RM | charge GPS (distance × intensité) |
| `volume` | tonnage, séries | distance totale, minutes |
| `intensite` | RPE de série | vitesse max, sprints |
| `progression` | évolution 1RM / charge | évolution test (VMA, sprint 10 m) |

> Règle : le moteur ne connaît que la colonne de gauche. Chaque module remplit la traduction. C'est ce qui rend l'ajout d'un sport possible **sans toucher au noyau**.

## 5. Interprétation = décision (rappel philosophie)

Un KPI n'existe dans Novalyz que s'il **sert une décision**. Exemples :
- ACWR élevé + douleur + fatigue → *décision coach* : réduire la charge (alerte `risque_blessure`).
- Volume faible + progression stable + fatigue faible → *décision coach* : marge pour augmenter (alerte `marge_progression`).
- Muscle sous-travaillé → *décision coach* : rééquilibrer le programme.

Un indicateur qui ne débouche sur aucune décision n'a pas sa place sur un écran.
