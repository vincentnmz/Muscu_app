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

## Ordre de travail décidé (porteur, sept. 2026)

1. **Tout finir côté ATHLÈTE (Solo)** — avant de toucher au coach. Sous-ordre :
   - **A. Cerveau + écrans** : P1-11 Mon état (donnée→analyse→reco) · P1-10 Mes analyses
     (interprétation étoffée) · P0-4 Contexte de perf (+ fiabilité) · P0-1 Objectifs
     (consolidation) · Lecture Novalyz enrichie (exécution vs cible en phrases).
   - **B. Données sportives (P2)** : Cardio/Hyrox dédié · activités structurées · GPS ·
     Watch/Health Connect · déduplication · vélo/running/natation · séances hybrides.
   - **C. Nutrition solo (P3)** : nutrition dans Mon état + analyse nutritionnelle.
   - **D. IA athlète (P4)** : conversation groundée sur le moteur.
   - **E. P1-13 Programme adaptatif** (en dernier, moteur fiable requis).
2. **Revisite visuelle** de l'app athlète (validée avec le porteur) — cohérence globale.
3. **Tout le COACH (P5)** — home, aujourd'hui, alertes, analyses, programme, conversation.

## ORDRE DE PRIORITÉ (backbone de travail)

### P0 — CERVEAU
1. **Objectifs** comme colonne vertébrale des analyses — 🟡 (objectif contextualise la
   Lecture Novalyz / la génération de programme ; structure à étendre au besoin)
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
13. **Programme adaptatif** (ajustements depuis données réelles) — ⬜ (après moteur fiable)

### P2 — DONNÉES SPORTIVES
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
