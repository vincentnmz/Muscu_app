# Cahier des charges fonctionnel

> Novalyz = plateforme multisport d'aide à la décision. Ce document décrit les besoins **par profil utilisateur**. Il est indépendant du sport ; la musculation est le premier module qui l'instancie.

## 1. Profils utilisateurs & besoins

### Athlète
- Se connecter (login 4 chiffres) et s'inscrire de façon autonome.
- Saisir une séance (guidée par programme ou libre) : charge, reps, RPE, repos.
- Remplir son **bien-être** (sommeil, énergie, fatigue, douleur, ressenti).
- Suivre sa **progression**, son **poids**, ses **objectifs**, sa **régularité**.
- Recevoir des **conseils** du coach (badge non-lus).
- **Décision qu'il prend** : « est-ce que je progresse ? dois-je récupérer ? ».

### Coach
- Espace séparé sécurisé.
- Voir la **cohorte à surveiller**, priorisée par le moteur d'alertes.
- Marquer une alerte « traitée » (remise à zéro hebdo, à synchroniser multi-appareils).
- Détail par athlète : aperçu, progression, volume, agenda, conseils.
- Créer/éditer un **programme** (aujourd'hui manuel dans le Sheet — à internaliser).
- Envoyer des conseils, exporter un **bilan PDF**.
- **Décision qu'il prend** : « qui a besoin de moi cette semaine et pourquoi ».

### Préparateur physique
- Vue **charge** (ACWR, RPE, wellness), **tests physiques**.
- **Décision** : « ajuster la charge collective, prévenir la blessure ».

### Analyste de performance
- Accès aux **indicateurs bruts**, tendances, **export** de données.
- **Décision** : « produire une analyse pour le staff ».

### Responsable de centre de formation
- Suivi **collectif** des jeunes, progression dans le temps.
- **Décision** : « qui progresse, qui décroche ».

### Club
- Vue **multi-équipes** : assiduité, santé du groupe, alertes agrégées.
- **Décision** : « santé globale des effectifs ».

### Fédération
- Vue **agrégée multi-clubs**, standards, comparatifs.
- **Décision** : « politique de performance, détection ».

## 2. Exigences transverses (le noyau les garantit pour tous les sports)

| Exigence | Détail |
|---|---|
| Multisport | Le noyau ne dépend d'aucun sport. Ajouter un sport = ajouter un module. |
| Collectif-ready | Une séance = un créneau d'équipe ; chaque athlète a sa participation. Muscu = équipe de 1. |
| Aide à la décision | Chaque écran répond à une décision d'un profil. Pas de stat « pour la stat ». |
| Constater, pas prescrire | L'app suggère ; le coach décide et prescrit. |
| Fiabilité des alertes | Donnée absente = pas d'alerte (aucun faux positif). |
| Confidentialité / RGPD | Données de santé (poids, douleur, ressenti). Consentement, hachage des mots de passe, politique de confidentialité. |
| Multi-profils | Chaque profil ne voit que l'information utile à sa décision. |
| Multi-appareils | État partagé (ex : alertes traitées) synchronisé côté serveur. |

## 3. Module Musculation (instanciation actuelle)

Le premier module concret. Fonctions déjà livrées :
- Séance guidée / libre, surcharge progressive par palier (débutant → expert).
- Tonnage, **1RM estimé (Epley)**, volume par muscle vs cibles, tendances 4/8 sem.
- Moteur d'alertes : stagnation, irrégularité, fatigue, surmenage, risque blessure…
- Bilan PDF coach (KPIs, progression, tonnage, régularité, RPE, points d'attention).

Ce module sert de **référence** : tout nouveau module (foot, hockey…) suit le même contrat (produire des indicateurs génériques consommés par le noyau).

## 4. Hors périmètre (pour l'instant)
- Analyse vidéo (module futur, lié au métier analyste).
- Intégrations matérielles (GPS, cardio) — prévues via la table `Indicateur` (`source`).
- Facturation / SaaS multi-tenant — après validation de l'architecture (horizon Phase 5+).

## 5. Contraintes techniques actuelles
- Front : PWA mono-fichier `index.html` (vanilla JS).
- Backend : Google Apps Script (`Code.gs`, **hors repo** — livré manuellement).
- Données : Google Sheets (migration Supabase prévue Phase 5).
- Sécurité : hachage des mots de passe **déjà** en place côté backend.
