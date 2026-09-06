# Novalyz — Contexte projet (lire en premier)

> Ce fichier est lu automatiquement au début de chaque session. Il évite de tout ré-expliquer.
> Pour l'architecture détaillée, voir le dossier [`docs/`](./docs/).

## Le projet en une phrase

**Novalyz** = plateforme d'analyse et d'aide à la décision pour le sport. Aujourd'hui centrée musculation, elle évolue vers une **plateforme multisport** (foot, hockey…). L'app transforme les données d'entraînement en **décisions** pour le coach. Cible : athlètes, coachs, clubs, centres de formation, fédérations.

Contexte perso du porteur : reconversion en analyse vidéo / cellule de performance (DU haute performance nov., DU sport élite avril). Objectif long terme : proposer l'app à une fédération.

## Stack & déploiement (IMPORTANT)

- **Front** : `index.html` (PWA, structure) + `js/app.js` (logique) + `css/tokens.css` / `base.css` / `components.css` / `layout.css` + `sw.js` (cache v3).
- **Backend** : `Code.gs` (Google Apps Script) — **versionné dans ce repo** (`./Code.gs`). Collé à la main dans l'éditeur Apps Script + déployer une nouvelle version.
- **Données** : Google Sheets. **Un seul backend Apps Script partagé** par toutes les URLs front (même `SCRIPT_URL`).
- **Déploiement front = GitHub Pages auto** (`.github/workflows/deploy.yml`) :
  - push sur **`main`** → déploie sur l'**URL de production**
  - push sur **`dev`** → déploie sur l'**URL de préprod** (`/dev/`)
  - les branches de travail `claude/*` **ne sont pas déployées**
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

- **Athletes** : [0]id [1]login [2]loginCoach(C) [3]nom [4]ddn [5]taille [6]annees [7]strategie [8]coach_id(I) [9]password_hash(J) [10]sport(K) [11]poste(L) [12]jambe_dominante(M) [13]poids(N) [14]antecedents(O) [15]heatmap(P) [16]sexe(Q) [17]club(R) [18]categorie(S) [19]date_entree(T) [20]discipline(U)
- **Coachs** : [0]coach_id [1]login [2]nom [3]password_hash(D) [4]sport(E)
- **Performances** : [0]date [1]semaine [2]seance_id [3]nom [4]athlete_id [5]exercice [6]muscle [7]exercice_id [8]serie [9]charge [10]reps [11]rpe [12]repos [13]volume
- **Indicateurs** (multisport) : [0]date [1]athlete_id [2]seance_id [3]cle [4]valeur [5]unite [6]source
- **Bien_etre** : [0]date [1]seance_id [2]athlete_id [3]sommeil [4]energie [5]fatigue_musculaire [6]douleur [7]zone_douloureuse [8]ressenti_global [9]note
- **Tests** : [0]date [1]athlete_id [2]cle [3]valeur [4]unite
- **Objectifs** (joueurs) : [0]id [1]athlete_id [2]categorie [3]description [4]statut [5]date
- **Blessures** : [0]id [1]athlete_id [2]date [3]type [4]localisation [5]gravite [6]duree [7]retour_terrain [8]retour_competition [9]statut

## Vision multisport (roadmap)

Voir [`docs/roadmap-produit.md`](./docs/roadmap-produit.md). Décisions figées (voir `docs/README.md`) :
séance=créneau d'équipe + participations · match=type de séance · Test≠Exercice · poste/catégorie sur le lien athlète-équipe · entité Blessure · vocabulaire par sport (noyau neutre).

Phases : 0 ✅ · 1 ✅ · 2 ✅ · 3a ✅ (routing sport→vue) · 3b 🔜 (hub transversal) · 4 🚧 (foot sur Indicateurs ✅, muscu sur Performances 🔜) · 5 🔜 (Supabase) · 6 🚧 ~80% (module foot complet, NovalyzEngine branché sur bienetre foot).

Le **moteur d'analyse** (`NovalyzEngine` dans `js/app.js`) est sport-agnostique : `SEUILS` + `normaliser()` + règles. Pour brancher un sport, on alimente `normaliser()`, on ne réécrit pas le moteur. Le moteur est désormais aussi appelé depuis la vue joueur foot (signaux bien-être communs).

## Fonctionnement de la collaboration

- Livrer les fichiers modifiés via SendUserFile (l'utilisateur les uploade).
- Commits : garder `Code.gs` et `index.html` à jour dans le repo comme filet de sécurité.
- Le hook « Unverified » qui se répète : cosmétique (pas de signature GPG), sans impact — ne pas s'en inquiéter.
- L'utilisateur préfère qu'on avance **par étapes validées**, en expliquant les choix et en proposant des options quand une décision lui revient.
