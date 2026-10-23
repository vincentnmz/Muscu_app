# État en cours — reprise de session

> **But** : qu'une nouvelle conversation reparte sans rien perdre, sans dépendre d'un prompt collé.
> Mis à jour à chaque fin de lot. Compléments : [`suivi-points.md`](./suivi-points.md) · [`generateur-v2.md`](./generateur-v2.md).
> Dernière mise à jour : **23 oct. 2026**.

## Où en est le travail
- Branche de travail : `claude/novalyz-player-profile-mockups-g4bock`. On pousse **aussi sur `dev`** (fast-forward) après chaque lot → préprod `https://vincentnmz.github.io/Muscu_app/dev/`.
- **Rien en attente de redeploy backend** (`index.ts` inchangé récemment — tout le travail est front). SW = **v377** (bumper à chaque modif de `js/app.js`).
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
- **N13 (refonte Aperçu coach) — quasi fini** : bloc en tête (`renderCoachCoupDoeil`, conteneur `#cd-coupdoeil`, CSS `.cdcp-*`), label **« Lecture Novalyz · pour le coach »**. **ANALYSE, pas recopie** :
  - **Synthèse narrative** (1 phrase coach : « <Prénom> — prêt/à surveiller · <point entraînement clé> ») + **carte Reco d'action** (récup / rééquilibrer volume / revoir surcharge / maintenir). ✅ fait (N13 point a).
  - Entraînement = verdict progression (1RM) + couverture des **5 grands groupes sur 7 j** → « Non travaillé : Dos, Bras, Jambes » (groupes **à 0**). *(Corrige le bug « pecs pêchent » alors que c'était le seul muscle travaillé.)*
  - État = verdict récup + tendance (sommeil/fatigue/stress/douleur vs historique `bien_etre`), **pas** la recopie du questionnaire.
  - Maquette : `mockups/novalyz-coach-apercu-v2.html` (responsive, 2 colonnes desktop).

## À faire (priorité)
1. **Finir N13 — reste le point (b)** : **réordonner / dédoublonner** les blocs du bas. Il y a maintenant DEUX « Lecture Novalyz » : la nouvelle (coach, en tête) et l'ancienne plus bas (`renderAnalyseCoach`, formulée « tu… » pour l'athlète) → masquer/relabel l'ancienne et retirer les doublons (volume/état déjà repris dans le coup d'œil).
2. **Backlog, maquette d'abord** : **N5** (récompenses bugs+barème), **N3** (photos+mensurations), **N9** (régularité), **N11** (morpho IA, gated clé API).
3. **Promouvoir `dev` → `main`** (prod) quand l'utilisateur a validé.

## Règles clés (rappel, en plus de CLAUDE.md)
- **Rule 6bis (fiabilité)** : chaque phrase affichée doit être **vraie vs les données** — jamais « recopier », toujours analyser ; se méfier des pièges (volume mi-semaine, muscle non travaillé ≠ muscle qui « pêche »). Tester sur un vrai athlète (ex. Vincent) via Supabase MCP si besoin.
- **Méthode** : étapes validées, **maquette avant gros feature**, livrer maquettes via SendUserFile (render) + push.
- Commits : footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Dyo8fwGQF8enz2j8mVwhAb`.
- **APK dev** : workflow `build-apk-dev.yml` (dispatch via `gh api`, release `novalyz-apk-dev`, télécharger l'asset avec `curl -L` + `$GH_TOKEN` + `--cacert /root/.ccr/ca-bundle.crt`). Supabase `project_id = jhbrvgguybynzeceeceu`.
