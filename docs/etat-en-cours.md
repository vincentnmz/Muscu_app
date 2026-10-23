# État en cours — reprise de session

> **But** : qu'une nouvelle conversation reparte sans rien perdre, sans dépendre d'un prompt collé.
> Mis à jour à chaque fin de lot. Compléments : [`suivi-points.md`](./suivi-points.md) · [`generateur-v2.md`](./generateur-v2.md).
> Dernière mise à jour : **23 oct. 2026**.

## Où en est le travail
- Branche de travail : `claude/novalyz-player-profile-mockups-g4bock`. On pousse **aussi sur `dev`** (fast-forward) après chaque lot → préprod `https://vincentnmz.github.io/Muscu_app/dev/`.
- ⚠️ **REDEPLOY `index.ts` EN ATTENTE** (N5 récompenses) : ajout `records_total` + `gagnes` basé dessus (points permanents) dans `getAppData` **et** `handleClaimRecompense`. Tant que ce n'est pas redéployé sur Supabase, le solde reste calculé sur `records_30j` (glissant) en prod ; le front a un fallback permanent (records_par_exo) uniquement si `recompenses` absent. SW = **v386** (bumper à chaque modif de `js/app.js`).
- Vérifs avant push : `node --check js/app.js` + `node scripts/run-tests.mjs` (**46 suites vertes** à maintenir).

## Fait récemment (tout sur `dev`)
- **Générateur de programmes v2 COMPLET** (spec `generateur-v2.md`, maquette `mockups/novalyz-generateur-v2.html`) :
  - Moteur : `_G2_BLOCKS` (11 blocs muscle), `_g2GenDays` (fb/ul/ppl/split/custom), `_genProgramme2` (hypertrophie), `_genProgrammeForce` (powerlifting, listes déroulantes). Fonctions pures testées (`tests/generateur-v2.test.js`).
  - UI : modal athlète `ouvrirGenProgramme` / `_genRender` / `_genGenerer` → 2 parcours (galerie débutant `_G2_PRESETS` / configurateur objectif **Hypertrophie|Force** · organisation · jours · temps). Force = squelette éditable (`_g2ForceSkel`, `_g2ForceLignesFromDOM`, pools `_G2_FPOOL`).
  - Variantes « ou: » → bouton **Remplacer** (`_g2VariantsFor` : autres exos du même slot, résolus au catalogue).
- **Séance — « dernière fois → cible »** : cases S1/S2/S3 (`majPlanSeries`) montrent le poids×reps de la dernière séance (`getPerf(exo).series`) → cible surcharge (`_refSerie`, `_cibleSerieSurcharge` double progression, `_incrementExo`). Tests `tests/surcharge-serie.test.js`.
- **Fraîcheur** : explications grand public (`_MA_INFO.fraicheur`, `renderChargeFatigueJour`, `ouvrirInfoChargeFatigue`).
- **Catalogue** : ajout `Ecarté haltéres incliné` (id 91) + `décliné` (id 92) dans la table `exercices` (Supabase) + au générateur.
- **Bouton « Remplacer » (séance)** : explicite (icône + libellé, `.sc-swapbtn`) au lieu d'une icône grise.
- **N13 (refonte Aperçu coach) — ✅ FAIT (v3)** : bloc en tête (`renderCoachCoupDoeil`, conteneur `#cd-coupdoeil`, CSS `.cdcp-*`), 2 sections **Coup d'œil** (Entraînement + État) et **Lecture Novalyz · pour le coach**. ANALYSE, pas recopie. Maquette de référence : `mockups/novalyz-coach-coupdoeil-v3.html`.
  - **Entraînement = charge · reps · RPE réels (plus de 1RM Epley)**, classé par exo depuis `progression_par_exo` (charge=top set, reps à cette charge, `series[].rpe`) : **★Records** (charge/reps battu ≤10 j, base ≥2 pts), **▲Progresse** (charge↑ ou reps↑ à charge égale, ≤14 j), **▼Recule** (charge ET reps↓ vs séance précédente, pas déjà reparti), **⏸Stagne** (≥3 séances même charge, reps non croissantes, RPE↑), **🔥Effort** (RPE moyen 7 j + tendance), **✓/⚠ Travaillé/Non travaillé** (5 grands groupes 7 j).
  - **État & récup** = 1 ligne/signal (Récup, Sommeil, Énergie, Fatigue, Stress, Douleur, Pas) **niveau+tendance** + **ligne Cardio TOUJOURS affichée** : si `data.cardio.history` vide ou pas de sortie ≤7 j → « **manque de cardio** » explicite ; sinon fréquence 7 j + efficience FC à effort égal (seulement si RPE comparable & assez de données, sinon omise — règle 6bis).
  - **Lecture Novalyz** : narratif (dynamique records+progression, stagnation, recul, volume délaissé, intensité haute RPE≥8.5, manque de cardio) + **Reco** priorisée (récup → volume → stagne → recule → cardio → maintien).
  - **Dédoublonnage** : ancienne « Lecture Novalyz » athlète (`#cd-analyse`, `renderAnalyseCoach`) **masquée** dans l'Aperçu.
  - Maquettes : `mockups/novalyz-coach-coupdoeil-v3.html` (référence v3) + `novalyz-coach-apercu-v2.html` (écran complet responsive).

## À faire (priorité)
1. **Backlog, maquette d'abord** : **N5** (récompenses bugs+barème), **N3** (photos+mensurations), **N9** (régularité), **N11** (morpho IA, gated clé API).
2. **Promouvoir `dev` → `main`** (prod) quand l'utilisateur a validé tout ce qui est sur dev.
3. (option) N13 fin fine : réordonner les blocs de données du bas si besoin (le coup d'œil résume volume/état déjà affichés plus bas — garder le détail, acceptable).
2. **Backlog, maquette d'abord** : **N5** (récompenses bugs+barème), **N3** (photos+mensurations), **N9** (régularité), **N11** (morpho IA, gated clé API).
3. **Promouvoir `dev` → `main`** (prod) quand l'utilisateur a validé.

## Règles clés (rappel, en plus de CLAUDE.md)
- **Rule 6bis (fiabilité)** : chaque phrase affichée doit être **vraie vs les données** — jamais « recopier », toujours analyser ; se méfier des pièges (volume mi-semaine, muscle non travaillé ≠ muscle qui « pêche »). Tester sur un vrai athlète (ex. Vincent) via Supabase MCP si besoin.
- **Méthode** : étapes validées, **maquette avant gros feature**, livrer maquettes via SendUserFile (render) + push.
- Commits : footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Dyo8fwGQF8enz2j8mVwhAb`.
- **APK dev** : workflow `build-apk-dev.yml` (dispatch via `gh api`, release `novalyz-apk-dev`, télécharger l'asset avec `curl -L` + `$GH_TOKEN` + `--cacert /root/.ccr/ca-bundle.crt`). Supabase `project_id = jhbrvgguybynzeceeceu`.
