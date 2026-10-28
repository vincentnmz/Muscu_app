# État en cours — reprise de session

> **But** : qu'une nouvelle conversation reparte sans rien perdre (objectif + niveau), sans dépendre d'un prompt collé.
> Lu en 2ᵉ après `CLAUDE.md`. Compléments : [`cahier-des-charges.md`](./cahier-des-charges.md) (**CDC interne/technique consolidé**) · [`suivi-points.md`](./suivi-points.md) · [`generateur-v2.md`](./generateur-v2.md) · [`backlog-app.md`](./backlog-app.md) · [`roadmap-produit.md`](./roadmap-produit.md) · [`roadmap-beta.md`](./roadmap-beta.md) · [`vision-produit.md`](./vision-produit.md) (boussole produit).
> Dernière mise à jour : **26 oct. 2026**.

## Boussole (ne pas dériver)
Novalyz aide à **① comment s'entraîner · ② si c'est bien fait · ③ comment progresser (données + ressenti)**. Moteur déterministe = **source de vérité** ; l'IA est une *couche langage* branchée dessus, elle n'invente aucun chiffre. Segmentation **muscu B2C grand public / autres sports B2B pro** sur **un seul moteur**. Détails figés : `docs/vision-produit.md`, `docs/roadmap-produit.md`.

## Où en est le travail (flux + déploiement)
- Branche de travail : `claude/novalyz-player-profile-mockups-g4bock`. On pousse **aussi sur `dev`** (fast-forward) après chaque lot → préprod `https://vincentnmz.github.io/Muscu_app/dev/`. Promotion `dev → main` (prod) quand l'utilisateur valide.
- **SW = `novalyz-shell-v434`** (bumper `sw.js` à CHAQUE modif de `js/app.js` / `index.html` / `css`).
- Vérifs avant push : `node --check js/app.js` + `node scripts/run-tests.mjs` (**46 suites vertes** à maintenir). Pour une UI : **rendre un screenshot Playwright et le relire** avant de livrer (règle CLAUDE.md).
- **`index.ts` = déploiement MANUEL** (coller tout le fichier dans la fonction Supabase `smooth-service` → Deploy). Supabase `project_id = jhbrvgguybynzeceeceu`.

## ⚠️ ACTIONS UTILISATEUR EN ATTENTE (bloquent des features déjà codées)
1. **REDÉPLOYER `index.ts`** sur Supabase. Sans ça : (a) le **poids à l'inscription** n'est pas enregistré (le front l'envoie, l'ancien backend l'ignore) ; (b) l'**analyse morpho v2** (questionnaire + segments + reco exos + export mail) ne tourne pas.
2. **Clé `ANTHROPIC_API_KEY`** en variable d'env Supabase → sinon morpho IA + chat IA inactifs (le moteur déterministe, lui, marche sans clé). Cf. `docs/activer-ia.md`.

## Fait récemment

- **28 oct. (3)** — ⚠️ `index.ts` à redéployer.
  - Séance proposée : l'accueil et l'onglet Entraînement prenaient toujours la 1re séance du programme → ils prennent `dashboard.prochaine_seance`. Le backend part de la séance la plus récente de la semaine.
  - Repos : la molette prend le repos du programme de l'exercice (avant : la dernière valeur, 2 min par défaut).
  - Années d'expérience :
    - le niveau est calculé dès l'inscription (avant : « intermédiaire » jusqu'à la reconnexion) ;
    - l'enregistrement du profil ne double plus les années écoulées (on stocke la base = effective − écoulées).
  - Droits par ligne (`ROW_OWNED` + `_checkLignes`) : commentaire, programme, planning, objectif, blessure, contexte, photo de suivi → propriétaire vérifié (test session-auth).
  - Saisie des séries (maquette `mockups/novalyz-saisie-series.html` VALIDÉE puis codée) :
    - tableau S1… = dernière fois (dernière date de l'exercice, toute séance ; charge×reps + « RPE n » + repos) · cible · aujourd'hui ;
    - légende RPE sous chaque bouton (10 = « à l'échec ») + phrase d'explication ;
    - nom de la séance retiré pendant la saisie (« Exercice X / N », en-tête « Séance en cours ») ;
    - Programme vs réalisé factuel (✓ ≈ ↔ –) ; variante = exercice hors programme du même muscle.
  - `getLastPerf` renvoie aussi le `repos` de chaque série (test derniere-fois-repos).
  - **Surcharge progressive par niveau** (maquette `mockups/novalyz-surcharge-niveaux.html` validée) — règle UNIQUE `_progDecision` (tableau + cible pré-remplie + message), remplace `calculerSurcharge` / `_cibleSerieSurcharge` :
    - débutant : toutes les séries prévues au haut de la fourchette 1 fois, RPE ≤ 8 → charge ;
    - intermédiaire, avancé, expert : 2 séances de suite (ou 1 fois avec RPE ≤ 7) ;
    - petit pas du catalogue ; sinon +1 rep ; RPE ≥ 9 → consolide ;
    - avancé / expert : choix du jour (charge · charge +30 s · +1 rep +30 s · repos −30 s), non mémorisé ;
    - repos de référence = repos réellement pris la dernière fois (sinon programme) ;
    - bornes de repos : polyarticulaires 2-5 min, le reste 1-3 min (`_estPoly`).
    - `getLastPerf` renvoie `prev_series` / `prev_date`. Test `surcharge-serie` réécrit (30 cas).
  - Onboarding : intro + visite seulement à l'inscription (drapeau serveur `onboarding_vu`), plus rien à la reconnexion ; visite coach auto seulement après inscription coach.
  - Tablette 992-1279 px (option A) : menu 200 px, rail 290 px, centre élargi (layout.css, fin de fichier).
  - Régularité de la lecture Analyses : suit le réglage semaine (calendaire = lundi → aujourd'hui, prorata ; glissant = 7 j) — test regularite-semaine.
  - Fraîcheur : libellé unique `_frEtat` (« Charge en hausse », orange seulement si ressenti dégradé) dans les rails Accueil / Analyses et la carte Forme (il restait « Fatigue »).
  - Seuils de niveau UNIFIÉS (validés) : débutant 0-3 · intermédiaire 4-7 · avancé 8-10 · expert 11+ ; cibles de volume : avancé et expert partagent les cibles hautes dès 8 ans (test niveau-experience).

### Lot 28 oct. (2) — prêt pour le TEST FERMÉ Play Store (sur `dev`, SW v443) — **index.ts à REDÉPLOYER**
- Google Play configuré par l'utilisateur ; reste à recruter **12 testeurs × 14 jours** (viser 14-15). Morpho IA et foot : APRÈS le test (coût / validation muscu).
- **Suppression de compte complète** (exigence Play) : athlète +7 tables + photos `suivi-photos` ; coach : alertes traitées, jetons push, nom anonymisé. Test `suppression-compte-complete`.
- **Sessions (jeton signé HMAC, clé dérivée de PEPPER, 30 j)** : `signSession`/`verifySession`/`authCheck`/`withSession`/`_authGate` dans index.ts ; jeton renvoyé par login/register/loginCoach/registerCoach ; front = enveloppe UNIQUE de `window.fetch` (ajoute `_t`, mémorise `nvz_tok`, 401 `auth` → reconnexion). Droits : athlète = ses données (+ messagerie avec SON coach : `ATHLETE_COACH_ACTIONS`) ; coach = ses athlètes. **Mode OBSERVATION par défaut** (journalise `[auth:observation]` dans les logs Supabase) → **passer `AUTH_ENFORCE=1`** (secret Supabase) quand plus aucun appel non conforme n'apparaît. Test `session-auth` (31 vérifs).

### Lot 28 oct. — douleur + audit moteur (sur `dev`, SW v442) — **index.ts à REDÉPLOYER**
- **Douleur** (validé) : 2 Légère = point d'attention · 3 Modérée = Vigilance · 4 Forte = rouge ; suit la **dernière saisie** (redescend). `moteur.causes` = cause du verdict affichée (« Pourquoi : … »). `moteur.charge_ressenti` → carte « Charge en hausse · tu encaisses bien » (plus « Fatigue » sur la charge seule).
- **Audit moteur** (`docs/audit-moteur-2026-10-26.md`, rejeu du vrai backend sur données réelles) — 9 correctifs appliqués : régularité 7 j glissants · noms de muscles canoniques (`normMuscle` + base nettoyée) · risque/« Charge » sans la charge seule · courbatures = dernière saisie · muscle en retard avec travail indirect 0,5 · « +X % » neutralisé après une pause ≥ 10 j (et plus de « tu construis ») · récence des alertes legacy · **alertes coach = moteur central** (`getCoachAthletes` appelle `handleGetAppData` par athlète muscu) · micro-séances cardio ignorées. Tests `douleur-derniere-saisie` + `audit-moteur`.

### Lot 26 oct. (soir) — branche `claude/pensive-ritchie-5p62gt` (pas encore sur `dev`)
- **Méthode réaffirmée par l'utilisateur** : TOUJOURS expliquer, poser les questions, maquette si besoin, **décider avant de coder** ; écrire en **français**.
- **Séries prévues** (validé) : réf « dernière fois » = dernière fois que l'EXO a été fait, toutes séances confondues (avant : même `seance_id` → split A/B / séance Libre comparés à une vieille séance). `getLastPerf` renvoie aussi le **RPE** par série ; les cases affichent `7.5×10 @8 → 7.5×11` + date de réf. **index.ts à redéployer.**
- **Onboarding coach** : le login n'était JAMAIS transmis au front (payload login/register sans `login`) → écran « Donne ton login à ton coach » jamais affiché. Corrigé front + back ; texte 3 étapes. **Visite guidée** : drapeau « vue » désormais **par compte** (`_tourScope`), avant par téléphone.
- **Règle « charge + ressenti »** (validée, sources Meeusen 2013, Saw 2016, Impellizzeri 2020, Mujika 2000, Bickel 2011) : alerte charge seulement si **TSB% < -12 sur ≥ 3/5 j** (`chargeSoutenueJours`) **ET** ressenti concordant (`ressentiConcordant` : fatigue +1 / sommeil −1 vs baseline perso, ≥3 saisies récentes + ≥7 baseline ; ou RPE +1 à charge ≤ sur ≥ 2 exos). Sous-charge seulement si ratio ATL/CTL < 0.80 **chaque jour sur 14 j** (`sousChargeSoutenue`). Champs optionnels d'`EtatInput` → foot inchangé (règle historique). Push absence : J7 puis **tous les 3 jours**. Test `tests/regle-charge-ressenti.test.js`.
- Défauts corrigés : bulle « Demande à Novalyz » masquée pendant l'onboarding (`body.onb-open`) ; phrase en dur retirée de `#tj-nova-txt`.
- Mail récap mensuel : cron `novalyz-recaps-auto` (07:10 UTC) → 1er nov. Resend configuré par l'utilisateur (domaine) — vérifier `athletesOk` le 1er nov.
- **Maquette** `mockups/novalyz-je-gere-programme.html` (mobile + bureau) — **validée et IMPLÉMENTÉE** (sur `dev`, SW v438) :
  - `ouvrirConstruireProgramme` (« Je gère » à l'onboarding + « Programme vierge » athlète) : séances en chips (plus de `prompt`), cartes séance. **Modèles prêts à l'emploi 2→6 jours** (`_JG_MODELES` + `_modelesJoursHTML`, moteur `_genProgramme2`) UNIQUEMENT dans « Mon programme › Partir de… » (retirés de Construis ton programme : pas de doublon).
  - **Panneau de réglage par exercice** (option B validée, tout facultatif) : séries, reps mini/maxi, repos, %1RM, RPE cible, schéma (fixe/double/top set+back-off/pyramidal via `_schemaControlsHtml`), superset (`cdAjouterPartenaire`). `cdProgrammeLignes` partagé avec `_jg.lignes`.
  - **Page de choix plein écran** `ouvrirPickerExos` (groupes `_EXO_GROUPES` + Cardio `_CARDIO_CATALOG`, multi-sélection, gros muscles d'abord dans le lot) — remplace le tiroir partout (`cdAjouterExercice`, athlète ET coach). Bureau = 3 colonnes.
  - Coach : « nouvelle séance » dans une fenêtre au style de l'app (`#cd-newseance`), plus de `prompt`.
  - Générateur « Novalyz te propose » : vrai plein écran en bureau (2 colonnes, aperçu collant), **un seul défilement** (`body.gen-open`).
- `index.ts` v187 déployé par l'utilisateur le 26 oct. 14:24 UTC — **identique au repo** (vérifié).
- APK dev lancé depuis `dev` (run 225).
- Parqués : tablette, programme sur-mesure morpho. ⚠️ Sécurité à traiter avant bêta : `getAppData` sans auth (n'importe qui peut lire un athlète par id) ; liaison coach par login 4 chiffres sans accord de l'athlète.

### Lot 26 oct. (sur `dev` + branche, sw v434) — tests « nouveau compte athlète »
- **Poids à l'inscription** : champ « Poids (kg) » à côté de la taille (`index.html` `#reg-poids`, `sInscrire` dans `app.js`, `handleRegister` dans `index.ts` → colonne `athletes.poids`). **⚠️ redeploy index.ts requis.**
- **Fuite des pas entre comptes (critique) — CORRIGÉ en code.** Cause : Health Connect lit les pas de **l'appareil** (pas du compte) ; `_syncSanteMontre` les poussait au serveur sous le compte connecté → pollution. Fix : lecture/synchro natives **réservées au compte ayant explicitement connecté la montre** (flag local `nvz_hc_connected_<id>`, posé dans `ouvrirImportMontre`). Helpers `_hcConnected`/`_hcMarkConnected`. Sinon fallback historique serveur **propre au compte**. Backend déjà filtré par `athlete_id` (pas de fuite serveur). En prod c'est non-bloquant (1 compte/téléphone) ; utile pour partage d'appareil + tests. **Données déjà polluées : compte test « Alizé » (id 2) garde 57 j de pas de Vincent — l'utilisateur a dit de LAISSER.**
- **Ordre des exercices garanti** : priorité musculaire `_G2_MUSRANK` (gros muscles d'abord) appliquée au rendu de chaque séance dans `_g2Build`. Vérifié : le générateur produisait **déjà** pec/dos avant bras ; c'est une sécurité pour toute régénération + custom. Un ancien programme « bras d'abord » doit être **régénéré**.
- **Générateur en PLEIN ÉCRAN** (`ouvrirGenProgramme`, plus de demi-page) + **objectif à la création** : chips `st.but` **Prise de masse / Sèche / Maintien / Force** (`_g2Set('but',…)`, note honnête masse≈sèche à l'entraînement, maintien = volume allégé via `_genProgramme2` objectif `maintien`). Force garde le squelette éditable.
- **Onboarding manquant** : le tour guidé (`nvTourAthlete`) démarre désormais aussi après les chemins **« Novalyz »** et **« Je gère »** (drapeau `_onbPendingTour` + `_onbTourMaybe`, déclenché à la fermeture générateur/éditeur) — avant, seulement le chemin « coach ».
- Divers : phrases onboarding cohérentes (« Novalyz assemble », plus de « j'assemble ») ; modal bien-être (`#wellness-modal`) et générateur centrés/plein écran ; emphase boutons `#en-gen`/`#en-creer` selon présence d'un programme (`_enSetMode`).

### Morpho-anatomie v2 (gros feature, FRONT livré — backend à redéployer)
- Maquette de réf : `mockups/novalyz-morpho-v2.html` (corps anatomique **homme + femme** issu de react-native-body-highlighter MIT, 9 marqueurs de segments, point ④ = grands trochanters). Test 2 colonnes : `mockups/novalyz-morpho-analyse-test.html`. Bloc morpho en conversation : `mockups/novalyz-morpho-dans-message.html`.
- Front (`index.html` `#tab-morpho` + `app.js` `ouvrirMorpho`…) : **questionnaire** (sexe, pathologie, grossesse, antécédents — fiabilité), **saisie segments** (schéma corps homme/femme), **photos** avec bouton supprimer ×, **analyse** → **reco exercices déterministes SI segments présents** (badges Mesuré/À nuancer/Antécédent), **export mail + PDF**. State `_morphoQ`/`_morphoSeg`/`_morphoImgs`/`_morphoLast`.
- Backend (`index.ts`) : `recoMorphoExercices` (leviers fémur/tronc, ape index, épaules/hanches, SDT, squat stance, amplitude DC, pistes tibia/avant-bras, garde-fous antécédents), `handleAnalyseMorpho` (injecte questionnaire+segments dans le prompt Sonnet, attache `exercices`), `handleEnvoyerMorphoMail`. **À REDÉPLOYER.**
- **Parqué** (à reprendre) : **programme sur-mesure à partir de l'analyse morpho** (maquette `mockups/novalyz-programme-sur-mesure.html`) — l'utilisateur a dit « on reviendra sur le programme à partir de l'analyse après, y a des choses à dire dessus aussi ».

### Avant (rappel, déjà en prod/dev)
- **Générateur v2 complet** (`generateur-v2.md`) : `_G2_BLOCKS`, `_g2GenDays` (fb/ul/ppl/split/custom), `_genProgramme2`, `_genProgrammeForce`. Tests `tests/generateur-v2.test.js`.
- **Agenda daté** (table `planning`, routes `getPlanning`/`planSeance`/`movePlanning`/`unplanPlanning`, `planning[]` dans getAppData ; composant coach `.cdag`, carte athlète `renderTjPlanning`). **Déployé.**
- **Aperçu coach v3** (`renderCoachCoupDoeil`, charge·reps·RPE réels, état+récup, Lecture Novalyz pour le coach). Nutrition (import MFP), morpho/mensurations coach, récompenses v2, etc.

## À faire (priorité)
1. **(Utilisateur)** Redéployer `index.ts` + poser `ANTHROPIC_API_KEY` (voir section ⚠️).
2. **Programme sur-mesure depuis l'analyse morpho** (parqué — discuter d'abord avec l'utilisateur ce qu'il veut dire dessus).
3. **N11 morpho IA** (`backlog-app.md`) : finaliser une fois la clé API posée + tester sur de vraies photos/segments.
4. Backlog restant (`backlog-app.md`) : maquette d'abord pour tout gros feature.
5. Promouvoir `dev → main` quand l'utilisateur valide le lot courant.

## Règles clés (en plus de CLAUDE.md)
- **Rule 6bis (fiabilité)** : chaque phrase affichée = **vraie vs le code/les données**, jamais « recopier », chercher activement le cas où elle serait fausse (peu de données, base faible, contexte actif). Distinguer « vérifié contre le code » de « supposé ».
- **Vérifier au rendu** : screenshot Playwright (`NODE_PATH=/opt/node22/lib/node_modules`, `chromium.launch()`) + relire le PNG avant de livrer une UI. Ne rien inventer ; si bloqué, le dire.
- **Méthode** : étapes validées, **maquette avant gros feature**, livrer via SendUserFile (render) + push.
- Commits : footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Dyo8fwGQF8enz2j8mVwhAb`.
- **APK dev** : workflow `build-apk-dev.yml` (dispatch via `gh api`, release `novalyz-apk-dev`). Supabase `project_id = jhbrvgguybynzeceeceu`.
