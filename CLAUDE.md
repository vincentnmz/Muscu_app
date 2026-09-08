# Novalyz — Contexte projet (lire en premier)

> Ce fichier est lu automatiquement au début de chaque session. Il évite de tout ré-expliquer.
> Réflexions de fond : [`docs/vision-produit.md`](./docs/vision-produit.md) · [`docs/animations.md`](./docs/animations.md) · archi détaillée : [`docs/`](./docs/).

## Le projet en une phrase

**Novalyz** = plateforme d'analyse et d'aide à la décision pour le sport. Aujourd'hui centrée musculation, elle évolue vers une **plateforme multisport** (foot, hockey…). L'app transforme les données d'entraînement **et le ressenti** en **décisions** (comment s'entraîner, si c'est bien fait, comment progresser). Cible : athlètes, coachs, clubs, centres de formation, fédérations.

Contexte perso du porteur : reconversion en analyse vidéo / cellule de performance (DU haute performance nov., DU sport élite avril). Objectif long terme : proposer l'app à une fédération.

> **Boussole produit** (ne pas dériver) : Novalyz aide à **① comment s'entraîner · ② si c'est bien fait · ③ comment progresser (via données + ressenti)**. Direction figée dans [`docs/vision-produit.md`](./docs/vision-produit.md) : programme = point d'entrée (pas le produit) ; différenciateur = interprétation adaptative ; bloc **IA-coach** grounded sur les données pour l'athlète sans coach ; segmentation **muscu (B2C grand public) vs autres sports (B2B pro)** sur un **seul moteur**.

## Stack & déploiement (IMPORTANT — à jour)

- **Front** : `index.html` (PWA, structure) + `js/app.js` (logique) + `css/tokens.css` / `base.css` / `components.css` / `layout.css` + `sw.js` (cache v3) + modules natifs `js/platform.js` / `js/notifications.js`.
- **Backend = Supabase Edge Function (Deno/TypeScript)** : `supabase/functions/handler/index.ts`.
  - En ligne à `SCRIPT_URL` = `https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service` (défini `js/app.js:701`).
  - **Déploiement backend = MANUEL** : coller le contenu de `index.ts` dans l'éditeur de la fonction Supabase → **Deploy**. (Pas de déploiement auto.)
  - Secrets en **variables d'env Supabase** : `PEPPER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_SERVICE_ACCOUNT` (push natif), VAPID (web-push PWA), `RESEND_API_KEY` (e-mails). **Jamais dans le front / les tests / git.**
- **Données = Supabase (Postgres)** via `createClient(...SERVICE_ROLE_KEY)`. Schémas SQL de référence dans `supabase/*.sql`.
- **`Code.gs` = ARCHIVE** (ancien backend Google Apps Script / Sheets). **N'est plus branché.** Conservé comme *référence historique* de certains seuils métier (des commentaires d'`index.ts` y renvoient). Ne pas le livrer/modifier comme backend.
- **Natif (Android)** : Capacitor 6 (`capacitor.config.json`, appId `com.novalyz.app`, `webDir: www`). Push **FCM HTTP v1**. APK construit sur **GitHub Actions** (`.github/workflows/build-apk.yml`, déclenchement manuel → publie une Release `novalyz-apk-latest`). Signature debug **stable** (`android/app/novalyz-testkey.jks`, clé de TEST, safe à committer). **Le Service Worker est désactivé sur le natif** (il servait de vieux fichiers en cache après mise à jour d'APK). En cours : passage au **Play Store (test interne)** pour les MAJ auto (compte dev en validation d'identité Google).
- **Déploiement front = GitHub Pages auto** (`.github/workflows/deploy.yml`) :
  - push **`main`** → **prod** (`https://vincentnmz.github.io/Muscu_app/`) · push **`dev`** → **préprod** (`/dev/`)
  - branches de travail `claude/*` **non déployées** · flux cible : bricoler → `dev` → PR `dev`→`main`
  - ⚠️ le workflow ne copie que des fichiers **listés** (`index.html`, `manifest.json`, `sw.js`, `privacy.html`, le logo + dossiers `css/js/assets`). Ajouter un fichier racine = l'ajouter à cette liste.
- **Accès Git de l'assistant** : **push ACTIF** (l'app GitHub est liée). L'assistant pousse sur la branche de travail `claude/*`. On peut aussi livrer des fichiers via SendUserFile quand c'est plus simple. **`index.ts` reste à déployer à la main** par l'utilisateur sur Supabase.

## ⚠️ RÈGLES CRITIQUES (à ne jamais oublier)

1. **Backend : toujours partir de `./supabase/functions/handler/index.ts` du repo**, jamais d'une copie de mémoire. (Historique : une copie incomplète de l'ancien `Code.gs` a effacé le système de mot de passe en prod.)
2. **Tout `index.ts` livré/déployé doit être COMPLET** : l'utilisateur remplace TOUT le contenu de la fonction quand il colle.
3. **Le hachage des mots de passe existe déjà côté backend.** Algorithme : `'s2$' + SHA-256(`login|PEPPER|password`)` (salt = login, PEPPER en env Supabase). **Ne PAS** le mettre côté front, **ne pas** le casser (`hashSalted`/`verifyPwd`/`login`/session). **Auth maison sur la table `athletes` — NE PAS migrer vers Supabase Auth.**
4. **Après toute modif d'`index.ts`**, croiser front↔backend : chaque `action` appelée par `js/app.js` doit avoir une route dans le handler.
5. **Ne pas réimplémenter ce qui existe déjà.** Lire le code avant de proposer. Le **moteur d'analyse est la source de vérité** (déterministe) ; une éventuelle IA sera une *couche langage* branchée dessus, elle n'invente pas de chiffre.
6. **Vérifier avant de livrer** : `node --check` (front) et les tests `npm test` (`node scripts/run-tests.mjs`).
7. **Secrets** : ne jamais afficher/demander `RESEND_API_KEY` ni aucun secret ; `google-services.json` (config Firebase Android) est injecté via le secret GitHub `GOOGLE_SERVICES_JSON`, **pas committé**.

## Outillage

- `npm run build:www` (`scripts/build-www.mjs`) : assemble la coquille `www/` pour Capacitor.
- `npm test` (`scripts/run-tests.mjs`) : suite de tests node (le harness transpile `index.ts` + sandbox moteur Supabase en mémoire).

## Modèle de données (tables Supabase — colonnes historiques conservées)

- **athletes** : [0]id [1]login [2]loginCoach(C) [3]nom [4]ddn [5]taille [6]annees [7]strategie [8]coach_id(I) [9]password_hash(J) [10]sport(K) [11]poste(L) [12]jambe_dominante(M) [13]poids(N) [14]antecedents(O) [15]heatmap(P) [16]sexe(Q) [17]club(R) [18]categorie(S) [19]date_entree(T) [20]discipline(U)
- **coachs** : [0]coach_id [1]login [2]nom [3]password_hash(D) [4]sport(E)
- **performances** : [0]date [1]semaine [2]seance_id [3]nom [4]athlete_id [5]exercice [6]muscle [7]exercice_id [8]serie [9]charge [10]reps [11]rpe [12]repos [13]volume
- **indicateurs** (multisport) : [0]date [1]athlete_id [2]seance_id [3]cle [4]valeur [5]unite [6]source
- **bien_etre** : [0]date [1]seance_id [2]athlete_id [3]sommeil [4]energie [5]fatigue_musculaire [6]douleur [7]zone_douloureuse [8]ressenti_global [9]note
- **tests** : [0]date [1]athlete_id [2]cle [3]valeur [4]unite
- **objectifs** (joueurs) : [0]id [1]athlete_id [2]categorie [3]description [4]statut [5]date
- **blessures** : [0]id [1]athlete_id [2]date [3]type [4]localisation [5]gravite [6]duree [7]retour_terrain [8]retour_competition [9]statut
- **native_push_tokens** (token PK), **password_reset_tokens**, **coach_profil**, **athletes_email** : voir `supabase/*.sql`.

## Vision multisport (roadmap)

Voir [`docs/roadmap-produit.md`](./docs/roadmap-produit.md). Décisions figées (voir `docs/README.md`) :
séance=créneau d'équipe + participations · match=type de séance · Test≠Exercice · poste/catégorie sur le lien athlète-équipe · entité Blessure · vocabulaire par sport (noyau neutre).

Le **moteur d'analyse** (`NovalyzEngine`/`evaluerEtatAthlete` + chaîne **ACWR** côté `index.ts`, `SEUILS` + `normaliser()` + règles) est **sport-agnostique**. Pour brancher un sport, on alimente `normaliser()`, on ne réécrit pas le moteur. Déjà branché sur la vue joueur foot (signaux bien-être communs).

## Fonctionnement de la collaboration

- Avancer **par étapes validées**, expliquer les choix, proposer des options quand une décision revient à l'utilisateur.
- Livrer les fichiers via SendUserFile et/ou pousser sur la branche `claude/*` ; garder `index.ts` et `index.html` à jour dans le repo comme filet de sécurité.
- `index.ts` : rappeler à l'utilisateur de **redéployer sur Supabase** après modif (sinon la prod tourne l'ancienne version).
- Le hook « Unverified » qui se répète : cosmétique (pas de signature GPG), sans impact.
