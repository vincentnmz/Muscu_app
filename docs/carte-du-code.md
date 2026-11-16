# Carte du code — Novalyz (16/11/2026)

> But : retrouver vite **où se trouve quoi** sans relire 30 000 lignes. Les fonctions sont citées par leur **nom** (les numéros de ligne bougent) : chercher `function nomDeLaFonction`.
> À tenir à jour quand une zone change de place ou qu'un fichier est créé.

## 1. Les fichiers

| Fichier | Taille | Rôle |
|---|---|---|
| `index.html` | ~3 500 l. | Structure de toutes les vues (login, onglets athlète, écrans coach, fenêtres). Charge `env.js` → `app.js` → modules. |
| `js/env.js` | petit | Choix **prod / préprod** (`/dev/` ou APK Dev → préprod). Donne `SCRIPT_URL`. Chargé en premier. |
| `js/app.js` | ~29 500 l. | **Toute l'app web** (athlète + coach). Monolithe : voir § 2. |
| `js/lecture-v3.js` | ~900 l. | **Lecture Novalyz v3** : diagnostic d'un exercice (pourquoi ça bloque · levier · action), plan de la semaine, journal des décisions. Testé seul (`tests/lecture-v3.test.js`). Modèle à suivre pour le nouveau code. |
| `js/sommeil-perf.js` | petit | Couche « sommeil → performance » (apprentissage, pas de conclusion avant N séances). |
| `js/platform.js` | petit | `NovalyzPlatform` : web / android / ios. |
| `js/notifications.js` | petit | Notifications natives (FCM) vs web-push. |
| `css/tokens.css` · `base.css` · `components.css` · `layout.css` | | Couleurs/variables · base · composants · mise en page. |
| `sw.js` | petit | Service worker (cache `novalyz-shell-vNNN`, **à incrémenter à chaque modif front**). Désactivé dans l'app native. |
| `supabase/functions/handler/index.ts` | ~8 600 l. | **Tout le serveur** (Edge Function Deno) : routes, droits, moteur d'analyse, mails, IA. Voir § 3. |
| `supabase/migrations/` + `MIGRATIONS.md` | | Schéma versionné (préprod d'abord). `supabase/*.sql` = archives déjà appliquées. |
| `android/` + `capacitor.config.json` | | Coque Android (Capacitor 8). Thèmes : `android/app/src/main/res/values/styles.xml` (aucune barre de titre). |
| `Code.gs` | | **Archive** (ancien backend Google Sheets). Non branché. |

## 2. `js/app.js` par zone (chercher le nom de la fonction)

**Démarrage & session**
- Réseau : surcharge de `fetch` (ajoute le jeton `_t`, file hors-ligne) près de `_nvzTok`.
- Connexion : `seConnecter`, `seConnecterCoach`, `seDeconnecter`, inscription (« Inscription athlète en 2 écrans »).
- Chargement des données athlète : appel `getAppData` → `dernierAppData` (cache local), puis rendu. `_marquerOuverture` (dernière ouverture).
- Navigation : `switchTab(tab)`.

**Athlète — écrans**
- Aujourd'hui : `renderAujourdhui` (lecture du jour, « Ta séance du jour », reco).
- Entraînement : `renderEntrainement`, démarrage `_enDemarrer` → état du jour `ouvrirEtatDuJour` → séance.
- Saisie de séance : `ajouterSerie`, `terminerExercice`, `validerSeance` → `_validerFinSeance` → bilan (`validerBilanSeance` / `_bilanSkip`) → `saveSeance`.
- Cible série par série : `majPlanSeries` + **règle de progression** `_progDecision` (charge / reps / consolide / bloqué…), fourchettes `_exoFourchette`, petit pas `_petitPas`.
- Analyses (Résumé, Évolution, Tendances, Historique) : section « Écran Analyses : navigation 2 niveaux » ; diagnostic d'exercice via `lecture-v3.js` (`maVoirPourquoi`).
- Forme : questionnaires (« Questionnaires (Phase 1) »), bien-être, montre (« Montre 06/11 »).
- Programme : éditeur (`cdSetSchema`, cibles série par série `_seriesPerso`), **générateur** `ouvrirGenProgramme` / `_genProgramme2`.
- IA : fil « Novalyz IA », **morpho** `ouvrirMorpho` / `_morphoAnalyser` / `_morphoRender` / `_morphoVersProgramme`.

**Coach**
- Accueil, Équipe, fiche athlète (préfixes `cd…`, `ct…`), messagerie (« Fil Coach »), réglages coach, saisie de séance pour un athlète (`_saisieCoach`).

**Divers**
- Récompenses, centre d'alertes (cloche), mise à jour in-app (Play), HYROX, décodeur FIT (import montre), login animé.

## 3. `supabase/functions/handler/index.ts`

**Entrée** : `Deno.serve` → `_authGate` / `authCheck` (droits : un athlète ne lit que lui, un coach ses athlètes) → `switch (action)` (**124 routes**).
- GET (lecture) : `getAppData`, `getSeancesDetail`, `getCoachAthletes`…
- POST (écriture) : `saveSeance`, `saveBienEtre`, `genererProgramme`, `chatIA`, `analyseMorpho`, `marquerOuverture`…
- Ajouter une route = 1 `case` + 1 handler + **vérifier `authCheck`** (le test `tests/securite-droits-routes.test.js` contrôle toutes les routes).

**Sécurité / comptes** (ne pas casser) : `hashSalted`, `verifyPwd`, `handleLogin`, `handleLoginCoach`, sessions signées (`withSession`).

**Moteur d'analyse (source de vérité, déterministe)**
- État du jour : `evaluerEtatAthlete` (+ chaîne ACWR).
- Historique : `buildProgressionParExo`, `buildDailyMuscu`.
- Lecture des exercices (records / progresse / bloqué / recule) : `_rcLectureExos`.
- Lecture Novalyz texte : `buildSyntheseMuscu`, `buildSyntheseCardio`, `buildSyntheseCroise`.
- Point d'entrée : `handleGetAppData` (assemble tout pour l'app).

**IA (couche de langage, n'invente pas de chiffre)** : `_iaContexte` + `handleChatIA` ; morpho `handleAnalyseMorpho`, `_morphoEntrainement`, `recoMorphoExercices` ; accès testeurs `_iaAutorise`.

## 4. Tests et outils

- `npm test` → `scripts/run-tests.mjs` : **119 suites** (moteur, droits, sessions, saisie, lecture, générateur, IA…).
- **Parcours navigateur** (`tests/parcours-navigateur.test.js` + `scripts/parcours-navigateur/`) : vraie app + vrai serveur, connexion → séance → Analyses.
- **Banc de profils** (`scripts/banc-profils/`) : tout le texte affiché pour 16 profils fictifs, comparé à des fichiers relus. Phrase modifiée volontairement → `node scripts/banc-profils/run.mjs --maj`.
- Audit des droits : `scripts/audit-droits/`. Simulations : `scripts/simulation-*`.
- Inventaire des phrases d'analyse : `docs/inventaire-phrases-analyse-2026-11-16.md`.

## 5. Règles pour le nouveau code

1. **Nouveau module = nouveau fichier** (modèle `js/lecture-v3.js`) plutôt que d'agrandir `app.js` ; testable seul.
2. Toute phrase affichée qui affirme un fait : tracée jusqu'au code + cas où elle serait fausse (CLAUDE.md, règle 6bis).
3. Front modifié → incrémenter `sw.js`. Serveur modifié → `index.ts` complet à redéployer en prod (manuel).
4. Schéma de base modifié → migration dans `supabase/migrations/` + `MIGRATIONS.md`.
