# Documentation Novalyz

> Plateforme multisport d'analyse et d'aide à la décision pour athlètes, coachs, clubs, centres de formation et fédérations.

Cette documentation est la **source de vérité** du projet. Elle permet à un nouveau développeur ou à un partenaire (club, fédération) de comprendre Novalyz sans lire le code.

## Vision en une phrase

Novalyz **transforme les données d'entraînement en décisions**. Ce n'est pas un afficheur de statistiques : chaque écran doit aider un coach à décider, un athlète à comprendre, un staff à gagner du temps.

La musculation est le **premier module**, pas le produit. Le noyau ne dépend d'aucun sport.

## Sommaire

| Document | Contenu |
|---|---|
| [`architecture.md`](./architecture.md) | Noyau sport-agnostique + modules sport. Modèle « Hub plateforme ». |
| [`modele-de-donnees.md`](./modele-de-donnees.md) | Entités génériques, table `Indicateur`, mapping Sheets → SQL. |
| [`moteur-analyse.md`](./moteur-analyse.md) | Le cœur décisionnel : seuils, signaux, règles, alertes. |
| [`kpi.md`](./kpi.md) | Chaque indicateur, sa formule, son interprétation. |
| [`catalogue-metriques.md`](./catalogue-metriques.md) | **Bibliothèque de métriques** : chaque mesure + ses métadonnées (sport, type, unité, saisie, moteur…). Ajouter un sport = enrichir ce catalogue. |
| [`cahier-des-charges.md`](./cahier-des-charges.md) | Besoins fonctionnels par profil utilisateur. |
| [`roadmap-produit.md`](./roadmap-produit.md) | Les 6 phases de migration, sans casser l'existant. |

## Décisions d'architecture validées

| # | Décision | Impact |
|---|---|---|
| 1 | Une **séance appartient à l'équipe** ; chaque athlète y a une **participation** portant ses indicateurs. Muscu = équipe de 1. | Collectif-ready (sports co) |
| 2 | Un **match = `Séance type="match"`** ; détails (adversaire, score) dans le module sport. | Réutilise le moteur de charge |
| 3 | **`Test` séparé d'`Exercice`** : mesure ponctuelle de capacité (1RM, VMA, sprint, CMJ). | Suivi de progression inter-saison |
| 4 | **`poste` + `categorie` sur `AthleteEquipe`**. | Comparaison à la norme du poste |
| 5 | **Entité `Blessure`** (indisponibilité, réathlétisation) remplace les « pauses ». | Suivi santé, cellule de perf |
| 6 | **Vocabulaire par sport** : noyau neutre, libellés d'affichage dans `Sport.config_json`. | « joueur » vs « athlète » sans toucher au code |

## État actuel (2026-07)

- **Stack** : PWA mono-fichier `index.html` (vanilla JS) + Google Apps Script (`Code.gs`) + Google Sheets.
- **Module vivant** : Musculation (séances, tonnage, 1RM, volume par muscle, RPE, bien-être).
- **Noyau déjà générique** : moteur d'alertes `v1.0.0`, bien-être, ACWR, RPE, gestion athlète/coach.
- **Phase en cours** : Phase 0 — documentation (ce dossier).

## Principes de développement (non négociables)

1. **Le noyau ne connaît aucun sport.** Il manipule des concepts génériques uniquement.
2. **L'app constate, le coach prescrit.** Pas de prescription automatique à l'athlète.
3. **Aucune fonctionnalité mono-sport dans le noyau.** Si ce n'est pas réutilisable dans ≥ 2 sports, ça va dans un module.
4. **Pas de dette technique pour aller plus vite.** Horizon de décision : 5-10 ans.
5. **Toute évolution est documentée** avant/pendant, pas après.
