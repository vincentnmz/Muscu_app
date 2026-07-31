# Novalyz — Contexte projet (lire en premier)

> Ce fichier est lu automatiquement au début de chaque session. Il évite de tout ré-expliquer.
> Pour l'architecture détaillée, voir le dossier [`docs/`](./docs/).

## Le projet en une phrase

**Novalyz** = plateforme d'analyse et d'aide à la décision pour le sport. Aujourd'hui centrée musculation, elle évolue vers une **plateforme multisport** (foot, hockey…). L'app transforme les données d'entraînement en **décisions** pour le coach. Cible : athlètes, coachs, clubs, centres de formation, fédérations.

Contexte perso du porteur : reconversion en analyse vidéo / cellule de performance (DU haute performance nov., DU sport élite avril). Objectif long terme : proposer l'app à une fédération.

## Stack & déploiement (IMPORTANT)

- **Front** : PWA vanilla JS, **architecture multi-fichiers** (depuis la refonte P0) :
  - `index.html` = structure seule (aucun `<style>`/`<script>` inline)
  - `css/novalyz.css` = tous les styles (→ sera découpé en `tokens/base/components/layout` en P1)
  - `js/app.js` = toute la logique (métier inchangé)
  - Objectif : charte pilotée par des **tokens CSS**, structure en **templates de page**, zéro style dans l'HTML.
- **Backend** : `Code.gs` (Google Apps Script) — **versionné dans ce repo** (`./Code.gs`). Collé à la main dans l'éditeur Apps Script + déployer une nouvelle version.
- **Données** : Google Sheets. **Un seul backend Apps Script partagé** par toutes les URLs front (même `SCRIPT_URL`).
- **Déploiement front = GitHub Pages auto** (`.github/workflows/deploy.yml`) :
  - push sur **`main`** → déploie la coquille front (`index.html` + `css/` + `js/`) sur l'**URL de production**
  - push sur **`dev`** → déploie sur l'**URL de préprod** (`/dev/`)
  - la branche de travail `claude/ai-saas-mvp-strategy-egvo9i` **n'est pas déployée**
  - Flux cible : bricoler → `dev` (tester) → PR `dev`→`main` (publier)
- **Le push GitHub est bloqué (403)** pour l'assistant → on **livre les fichiers** (via SendUserFile), l'utilisateur les uploade lui-même sur la branche voulue.

## ⚠️ RÈGLES CRITIQUES (à ne jamais oublier)

1. **`Code.gs` : toujours partir de `./Code.gs` du repo**, jamais d'une copie de mémoire. Une fois, une copie incomplète a effacé tout le système de mot de passe en prod (« remplace tout »). Ne plus jamais livrer un `Code.gs` partiel.
2. **L'utilisateur remplace TOUT le fichier** quand il colle un `Code.gs`. Donc tout `Code.gs` livré doit être **complet**.
3. **Le hachage des mots de passe existe déjà côté backend** (salé + pepper en Script Properties). Ne PAS le mettre côté front. Ne pas le casser. Algorithme : `s2$` + SHA-256(`login|pepper|password`).
4. **Après toute modif de `Code.gs`**, faire un **croisement front↔backend** : chaque `action` appelée par `index.html` doit avoir une route dans `doGet`/`doPost`.
5. **Ne pas réimplémenter ce qui existe déjà.** Lire le code avant de proposer.
6. **Vérifier la syntaxe** de `index.html` et `Code.gs` (node --check) avant de livrer.

## Modèle de données (colonnes Sheets)

- **Athletes** : [0]id [1]login [2]loginCoach(C) [3]nom [4]ddn [5]taille [6]annees [7]strategie [8]coach_id(I) [9]password_hash(J)
- **Coachs** : [0]coach_id [1]login [2]nom [3]password_hash(D) [4]sport(E)
- **Performances** : [0]date [1]semaine [2]seance_id [3]nom [4]athlete_id [5]exercice [6]muscle [7]exercice_id [8]serie [9]charge [10]reps [11]rpe [12]repos [13]volume

## Vision multisport (roadmap)

Voir [`docs/roadmap-produit.md`](./docs/roadmap-produit.md). Décisions figées (voir `docs/README.md`) :
séance=créneau d'équipe + participations · match=type de séance · Test≠Exercice · poste/catégorie sur le lien athlète-équipe · entité Blessure · vocabulaire par sport (noyau neutre).

Phases : 0 Documentation ✅ · 1 Isoler le noyau ✅ (balisage dans index.html) · 2 Entité Sport 🚧 (Option A : sport porté par le coach, col E) · 3 UI par profil (hub) · 4 Indicateurs génériques + collectif · 5 Supabase · 6 2ᵉ sport.

Le **moteur d'analyse** (`NovalyzEngine` dans index.html) est déjà sport-agnostique : `SEUILS` + `normaliser()` + règles. Pour brancher un sport, on alimente `normaliser()`, on ne réécrit pas le moteur.

## Fonctionnement de la collaboration

- Livrer les fichiers modifiés via SendUserFile (l'utilisateur les uploade).
- Commits : garder `Code.gs` et `index.html` à jour dans le repo comme filet de sécurité.
- Le hook « Unverified » qui se répète : cosmétique (pas de signature GPG), sans impact — ne pas s'en inquiéter.
- L'utilisateur préfère qu'on avance **par étapes validées**, en expliquant les choix et en proposant des options quand une décision lui revient.
