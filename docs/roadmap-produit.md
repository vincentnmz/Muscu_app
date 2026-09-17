# Novalyz — Roadmap produit & journal de livraison

> **Fichier de suivi durable** (le contexte de session peut être compacté).
> Source de vérité = roadmap envoyée par le porteur (reproduite ci-dessous, condensée
> mais fidèle) + décisions de session. **À mettre à jour à chaque item livré.**
> Voir aussi [`vision-produit.md`](./vision-produit.md), [`backlog-app.md`](./backlog-app.md),
> [`roadmap-beta.md`](./roadmap-beta.md).
>
> Statuts : ✅ fait · 🟡 partiel / en place à améliorer · 🔵 en cours · ⬜ à faire.

## 0. Vision

Faire évoluer Novalyz d'une app qui **affiche des données** vers une **cellule de
performance**. Promesse **Solo** : « Je t'aide à mieux t'entraîner, comprendre si tu
progresses et savoir quoi améliorer. » **Coach** : « Je t'aide à suivre tes athlètes,
comprendre leur état et prendre de meilleures décisions. »

Cœur = la chaîne : **Objectif → Programme → Exécution → Données → Analyse → Contexte →
Recommandation → Action → Progression**. L'app doit répondre à : ① Comment m'entraîner ?
② Est-ce bien fait ? ③ Quoi améliorer ?

## Règle absolue de développement

Le **code existant = source de vérité**. La roadmap = direction produit, pas archi imposée.
Pour chaque item : **Audit → Plan → (Validation si choix archi) → Implémentation minimale
isolée → Tests (unit/intég/régression) → Rapport → 1 commit → STOP.**
Interdits : refaire une fonctionnalité qui marche · 2ᵉ moteur · dupliquer données ·
modifier le moteur sans nécessité · IA là où une règle déterministe suffit · mélanger
plusieurs domaines · refonte visuelle pendant une étape fonctionnelle.
Si une fonctionnalité existe déjà à 80-100 % → **ne pas la refaire**.

---

## Ordre de travail décidé (porteur, sept. 2026 — mis à jour)

**Cap confirmé par le porteur : après avoir bouclé P0/P1, on avance dans l'ordre
numérique des phases → P2, puis P3, puis P4, puis P5, puis P6.**

0. **P0/P1 côté athlète** : ✅ **P0-1 Objectifs livré**. Reste mineur = peaufinage
   **P1-10 Mes analyses** (au fil de l'eau). **P1-13 adaptatif = mis de côté**
   (porteur, sept. 2026) : à reprendre plus tard, moteur fiable requis.
1. **P2 — Données sportives** ⬅️ **EN COURS** : Cardio/Hyrox dédié · activités structurées · GPS ·
   Watch/Health Connect · déduplication · vélo/running/natation · séances hybrides.
2. **P3 — Nutrition** : nutrition dans Mon état + analyse nutritionnelle (Solo puis Coach).
3. **P4 — IA** : conversation groundée sur le moteur + IA de recommandation/explication.
4. **P5 — Coach** : home, aujourd'hui, alertes, analyses, programme, conversation.
5. **P6 — Business** : premium, paiement, rapports mensuels, e-mails auto.

> **Revisite visuelle** de l'app athlète : **décidé (porteur, sept. 2026)** → elle se
> fera **avec la phase coach, tout à la fin** (une fois tout le fonctionnel terminé),
> pas entre P0/P1 et P2.

## ORDRE DE PRIORITÉ (backbone de travail)

### P0 — CERVEAU
1. **Objectifs** comme colonne vertébrale des analyses — ✅ (volet « cadré » livré :
   écran « Mon objectif » qui explique ce que l'objectif change ; objectif profil ↔
   générateur réconciliés (dict `OBJECTIFS`, pré-réglage du générateur) ; Maintien +
   recomposition cadrent maintenant la Lecture Novalyz. Option « objectifs chiffrés
   suivis » = extension possible plus tard, non retenue pour cette étape.)
2. **Analyse des données** (données → interprétation en phrases) — ✅ Lecture Novalyz
   (muscu · cardio · croisé)
3. **Recommandations** (finding/priority/evidence/reco/confidence/context) — ✅ dans la synthèse
4. **Contexte de performance** (retour vacances/blessure/deload, fiabilité affichée) — ✅
   (système complet : l'athlète pose un état → moteur ajusté ; la carte explique
   maintenant l'EFFET concret sur l'analyse « pourquoi Novalyz interprète différemment »)
5. **Fiabilité** des analyses — 🟡 (confiance/reliability exposés ; tendances fiabilisées)
6. **Alertes** (centre unifié type/severity/source/evidence/context/reliability/read/action) — ✅

### P1 — SOLO
7. **Programme côté athlète** (builder manuel, réutiliser l'existant) — ✅ (jours, charge
   %1RM, RPE cible, supersets, prévu vs réalisé)
8. **Aujourd'hui** (état → séance → point d'attention → action) — ✅
9. **Mon entraînement** (prévu → réalisé → effet) — ✅
10. **Mes analyses** (chiffres + interprétation) — 🟡 (interprétation + Lexique + « respect
    du programme » dans la synthèse ; reste à étoffer certaines tendances)
11. **Mon état** (donnée / analyse / recommandation distinctes) — ✅ (par signal :
    donnée → 🔎 analyse → 💡 conseil, réutilise les alertes du moteur ; + bandeau fiabilité)
12. **Programme proposé par Novalyz** (objectif+jours+niveau→structure) — ✅ (onboarding + génération)
13. **Programme adaptatif** (ajustements depuis données réelles) — ⬜ **mis de côté** (à reprendre plus tard, moteur fiable requis)

### P2 — DONNÉES SPORTIVES
> **Ordre P2 (porteur, sept. 2026)** : ① **Stabiliser le cardio existant** (cohérence
> types, fiabilité) ⬅️ en cours · ② **Import d'activités (Strava / GPS / autres)** —
> important, à faire ensuite · ③ **Hyrox** — important, **placement à décider**.
14. Cardio (section dédiée) — 🟡 (saisie + analyses cardio existent) · 15. GPS type Strava — ⬜
16. Activités structurées — ⬜ · 17. Multi-sources — ⬜ · 18. Déduplication (activités + pas) — ⬜
19. Watch / Health Connect — ⬜ · 20. Vélo — ⬜ · 21. Running/marche — 🟡 · 22. Hyrox — ⬜
23. Natation — ⬜ · 24. Séances hybrides muscu/cardio — ⬜

### P3 — NUTRITION
25. Nutrition Solo (dans Mon état, liée à l'objectif) — ⬜ · 26. Analyse nutritionnelle — ⬜
27. Nutrition Coach — ⬜

### P4 — IA
28. Coach IA (conversation groundée sur le moteur) — 🟡 (écran conversation en place, IA à brancher)
29. IA de recommandation / explication — ⬜ · 30. Morphologie IA (photos, premium) — ⬜

### P5 — COACH (phase 2)
31. Home Coach — 🟡 · 32. Aujourd'hui Coach — ⬜ · 33. Alertes Coach — ⬜
34. Analyse Coach — 🟡 · 35. Programme Coach — ✅ (existant) · 36. Conversation Coach↔Athlète — 🟡

### P6 — BUSINESS
37. Premium — ⬜ · 38. Paiement — ⬜ · 39. Rapports mensuels — ⬜ · 40. Emails automatiques — 🟡 (Resend en place)

> **Alertes & notifications (Phase 8 détaillée)** : 28. Centre d'alertes ✅ ·
> 29. **Notifications intelligentes** (push seulement si assez important) — ✅ **livré &
> vérifié** (action `cronPushAlertes`, severity haute, anti-spam hebdo ; cron pg_cron 8h UTC
> en place + secret `CRON_SECRET`, test OK : scanned/pushed) · 30. Notifications Coach ⬜.

### Navigation cible (direction, à ne pas coder telle quelle sans audit)
`AUJOURD'HUI · MON ENTRAÎNEMENT · CARDIO/HYROX · MES ANALYSES · MON ÉTAT · PROFIL` (+ nav Coach distincte).

---

## ✅ Journal de livraison (branche `claude/novalyz-player-profile-mockups-g4bock`)

- **P2-14 Cardio — stabilisation (types cohérents)** : les 4 types déjà connus des
  analyses/édition mais **absents de la saisie** (rameur, HIIT, elliptique, boxe) sont
  désormais saisissables. Champs dédiés ajoutés (`_CARDIO_SPEC` : puissance/cadence/FC
  selon le type), icônes/couleurs complétées (`_MA_CARDIO_META` : elliptique, boxe).
  Cohérence saisie ↔ champs ↔ stockage ↔ analyses ↔ édition sur les 10 types.
  Front-only (backend `saveCardio` accepte déjà tout type). Tests 41/41.
  **+ Calories cohérentes** : rameur/HIIT/elliptique/boxe (sans distance naturelle)
  reçoivent enfin une estimation à la **durée via MET** (Compendium of Physical
  Activities) au lieu de rien ; documenté dans `docs/bases-scientifiques.md`.
- **P0-1 Objectifs (colonne vertébrale, volet cadré)** : dict `OBJECTIFS` = source
  unique reliant l'objectif du profil (a) au type de programme conseillé et (b) à la
  façon dont la Lecture Novalyz cadre les analyses. Écran « Mon objectif » enrichi
  d'un bloc « Ce que ça change pour toi » (programme conseillé · priorité · lecture
  Novalyz). Générateur de programme **pré-réglé** sur l'objectif du profil (modifiable).
  Backend `buildSyntheseMuscu` : **Maintien** et **recomposition** (masse + sèche)
  cadrent désormais le wording (avant : masse/sèche seulement) + 2 tests dédiés.
- **P0-2/3/5** Lecture Novalyz muscu/cardio/croisé (fenêtre fixe 4 sem.) + fiabilité tendances
  (tendance robuste, « Par exercice » filtré période, ressenti « Par séance »).
- **P0-4/5** Calibrage sévérité du verdict (fatigue en moyenne récente).
- **P0-6** Centre d'alertes athlète (modèle unifié + état « lu » durable).
- **P1-8** Écran Aujourd'hui (état → séance → point d'attention → action).
- **P1-9** Mon entraînement (prévu/réalisé fusionné au sélecteur, détail en pastilles partagé).
- **P1-7** Builder programme athlète complet : jour conseillé (non pénalisant), charge cible
  **% du 1RM**, RPE cible.
- **② Est-ce bien fait** : exécution vs cible (charge %1RM ±5 % · RPE ±1) en fin de séance + Analyses.
- **P1-12** Onboarding 1re connexion (explication + parcours par profil coach/solo) + **programme
  proposé** (génération déterministe objectif/jours/niveau). Déclenché à l'inscription.
- **Régularité** : objectif séances/sem dérivé du programme.
- **Notifs intelligentes (#29)** : action cron `cronPushAlertes` (réutilise getAppData ;
  push des alertes « haute » dont l'absence ; anti-spam par type/semaine). Tap → Accueil.
  Cron pg_cron planifié (8h UTC, voir `supabase/cron-alertes.sql`) + testé (pushed OK).
- **P1-11 Mon état** : chaque signal bien-être (sommeil/fatigue/douleur) affiche
  donnée → 🔎 analyse → 💡 conseil (réutilise les alertes du moteur, zéro nouveau calcul)
  + bandeau de fiabilité des données (moteur.confiance).
- **Questionnaire du matin** : recentré sur **Sommeil · Fatigue · Motivation** (nouveau
  champ `motivation`, colonne DB ajoutée). Accueil « point du jour » et « ressenti 7 j »
  alignés ; État distingue les signaux du matin des signaux post-séance (ressenti/douleur
  = « après séance »).
- **Fiabilité Lecture Novalyz (P0-5)** : garde-fou de base — une évolution % (muscu
  tonnage, cardio charge) n'est affirmée que si la période précédente est une vraie
  base (muscu ≥ 3 séances, cardio ≥ 2 sorties) → fini les % aberrants sur peu de recul ;
  confiance recalculée sur le nb réel de séances ; efficience FC ≥ 4 bpm. Constat
  « pas assez de recul » sinon.
- **Centre d'alertes** : la stagnation NOMME les exercices en baisse (au lieu de
  « 3 exercices en baisse » sans détail).
- **État ▸ ACWR non calculable** : explication athlète (« charge récente vs habituelle »)
  + seuil (~4 semaines / 28 j, ≥ 6 jours d'entraînement).
- **Lecture Novalyz — respect du programme (#4)** : constat « tu es dans la cible sur X/Y
  exercices » (exécution vs cible charge %1RM / RPE) intégré à la synthèse muscu
  (helper backend buildRespectProgramme, réutilise la logique du front).
- **Contexte de performance (P0-4)** : la carte contexte (Accueil) explique l'EFFET
  concret de l'état actif sur l'analyse. **Fiabilité** : les phrases ont été VÉRIFIÉES
  contre le moteur et la Lecture Novalyz rendue consciente du contexte (déload → baisse
  de volume = normale, pas une régression ; intensification → hausse de RPE = attendue,
  pas une alerte). Entrée Lexique ajoutée.
- **« ? » par bloc + bases scientifiques** : chaque bloc d'analyse (Tonnage, Volume,
  Balance, RPE, Progression/1RM, Exécution vs cible, Régularité, ACWR) a un « ? » qui
  explique CE bloc (définition + calcul + **fiabilité/limite**), sans doublonner les
  phrases (légendes raccourcies). Contenu sourcé → `docs/bases-scientifiques.md`.
  **ACWR adouci** partout (indice à interpréter, pas un verdict — littérature à l'appui).
  **« ? » étendu au cardio et au croisé** : Charge cardio (session-RPE/Foster),
  Ressenti des sorties, Efficience, Répartition muscu/cardio, Charge globale,
  Indice de forme — chacun avec sa fiabilité/limite. Le bloc « Ressenti » (muscu +
  cardio) a désormais un « ? » exact (échelle 1–4 de difficulté de séance, pas un
  RPE 1–10). Composites (charge globale, répartition, indice de forme) documentés
  honnêtement comme proxys de tendance dans `docs/bases-scientifiques.md`.
- **Lexique** (compréhensibilité) : glossaire des termes techniques (Tonnage, RPE, ACWR,
  1RM/e1RM, surcharge, balance, efficience, récupération, fiabilité…) en langage simple,
  accessible via « ? » dans l'en-tête des Analyses et Réglages ▸ Découverte.
- **Réglages** : semaine calendaire/glissante · « Revoir l'intro ».

## 🚚 Distribution / MAJ auto
- **Play Store — test interne** = vraie solution d'auto-update (compte dev en validation Google).
  Quand validé : build **release signé (AAB)** + fiche.
- En attendant : **PWA** (web, auto via Service Worker) ou **bannière « MAJ dispo »** in-app.

## 🐞 Bugs / correctifs à faire (backlog)
- **Accueil « Aujourd'hui »** : à l'ouverture, l'animation du cercle de séance se
  rejoue plusieurs fois (devrait s'animer une seule fois). — à corriger.

---
_Mettre à jour ce fichier à chaque item livré (cocher le statut + ligne de journal)._
