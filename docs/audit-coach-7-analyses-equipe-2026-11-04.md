# Audit coach — écran 7 : Analyses équipe (04/11/2026)

Principe porteur : **aider le coach à décider, pas lui apprendre son métier** — des faits justes, comparables d'un écran à l'autre, et une action à portée.

Méthode : rendu réel (mobile 390 + bureau 1280) avec les données du jour rejouées par le serveur (Vincent : dernière séance 02/11 ; Alizé : séance « Full body » du 04/11 + gêne hanche 2/5 ; John : 48 j sans séance ; Yann : pas de programme). Code : `renderCoachSynthese` (bloc `analysesHtml`, mobile) et `_coachDeskAnalyses` (bureau).

## Constats (vérifiés contre le code et les données)

| # | Bloc | Ce qui s'affiche | Problème |
|---|---|---|---|
| T1 | Assiduité (mobile + bureau « · 7 j ») | Vincent **1/4 rouge**, « À relancer · 25 % » | Semaine **en cours** brute, un mercredi : 1 faite (lun.), 1 manquée (mar.), 2 à venir. Même erreur que l'ancienne alerte volume. Le libellé bureau « 7 j » est faux (c'est lundi → aujourd'hui). |
| T2 | KPI « Assiduité moyenne 42 % » (bureau) | moyenne Alizé 100 % / Vincent 25 % / John 0 % | Moyenne de semaines entamées + inactifs mélangés → chiffre sans sens. |
| T3 | Répartition des états (bureau) + « Résumé équipe » (Aujourd'hui mobile) | En forme 2 · À surveiller 1 · Intervention / **Surcharge** 1 | Règle différente de l'accueil et d'Équipe : Vincent et Alizé « en forme » ici, « à surveiller (gêne légère) » ailleurs ; **John (48 j sans séance) compté « Surcharge »** sur mobile → faux. |
| T4 | Vigilance bien-être | « Sommeil moy. Bon · Fatigue moy. Faible » ; bureau « Rien à signaler » | Moyenne du dernier questionnaire de chacun **quelle que soit sa date** (Vincent 30/10, Alizé 04/11) : « Faible » = moyenne de « Aucune » et « Modérée ». Douleur prise seulement à ≥ 3 → les 2 gênes 2/5 (Alizé hanche aujourd'hui, Vincent) n'apparaissent pas, alors que l'accueil les signale. |
| T5 | Blessures & douleurs actives | « **0** · aucune en cours » | Ne lit que la table blessures. Le titre promet les douleurs → faux quand 2 athlètes signalent une gêne. |
| T6 | Progression & stagnations | Vincent **Belt squat +67 %** ; Alizé **Presse sumo 0 % (stagnation)** ; mobile sous-titré « 1RM estimé » | Calcul : dernière perf vs meilleure charge de **tout l'historique**, sans fenêtre de temps, reps ignorées quand la charge change. +67 % = 200 kg × 5 (16/10) vs 120 kg × 10 (juin, 4 mois avant). Alizé : 86 kg × 12 aujourd'hui = son record d'août après 4 semaines d'arrêt → c'est un **retour au niveau**, pas une stagnation. Sous-titre « 1RM estimé » faux (le calcul n'utilise plus le 1RM). Diffère du classement de la fiche (records / progresse / bloqué / recule). |
| T7 | KPI « Charge ressentie moy. RPE 8,3 » (bureau) | moyenne des RPE de 2 athlètes | Pas actionnable (on ne décide rien sur une moyenne d'équipe de 2 RPE). |
| T8 | KPI « Athlètes suivis 4 · 4 avec un état calculé » | | John et Yann sont inactifs : « état calculé » n'apporte rien. |
| T9 | Fiabilité des données | Ressenti 2/4 · **Nutrition 0/4** (orange) | Nutrition non utilisée par tes athlètes → barre orange permanente. Pas de bouton « relancer » (il existe sur Aujourd'hui). |

## Propositions

**Règle commune** : l'écran juge sur des **semaines terminées** (4 dernières, lundi → dimanche) + une ligne « cette semaine à date » qui ne compte que ce qui était prévu **jusqu'à aujourd'hui** (agenda / jours conseillés, même règle que la séance du jour). Mêmes catégories que l'accueil et Équipe.

- **P1 Assiduité** : par athlète « cette semaine : 1 faite · 1 en retard · 2 à venir » + barre **régularité 4 semaines** (séances faites / prévues). « À relancer » seulement si séance en retard ou ≥ 7 j sans activité ; John : « 48 j sans séance », Yann : « pas de programme ».
- **P2 KPI bureau** : Régularité 4 sem. (équipe, hors vacances / sans programme) · Séances cette semaine (faites / prévues à date) · Athlètes actifs (x/4) · Douleurs & blessures (nombre réel).
- **P3 Répartition** : mêmes catégories que l'accueil — Prêts / À surveiller / Inactifs / Vacances — avec la raison courte, cliquable vers Équipe filtrée. Plus de « Surcharge » pour un absent.
- **P4 Bien-être** : plus de moyennes d'équipe. Une ligne par athlète : date du dernier ressenti (« ancien » si > 7 j), et ce qui sort de **sa normale** (sommeil, fatigue, stress) — le moteur la calcule déjà.
- **P5 Douleurs & blessures** : blessures déclarées + douleurs signalées 7 j (ressenti ou fin de séance, dès 2/5, comme l'accueil) avec zone, niveau, et persistance (« 2e fois en 10 j »).
- **P6 Progression** : même classement que la fiche et la Lecture Novalyz, sur 6 semaines : par athlète « ★ records · ▲ en progrès · ■ bloqués · ▼ reculent », exercices nommés, clic → l'exercice dans sa fiche. Athlète en reprise : « en reprise » (pas « stagnation »).
- **P7 Fiabilité** : Ressenti 7 j + « séances avec RPE » (la fiabilité des cibles en dépend) ; nutrition seulement si l'athlète la suit ; bouton « Relancer » sur chaque ligne.

## Ajouts proposés (utiles pour décider)

- **N1 Volume par muscle de l'équipe** : tableau athlète × groupe (jambes, dos, pecs, épaules, bras) sur 4 semaines terminées, même calcul que l'alerte (muscles du programme seulement) → voir d'un coup d'œil qui manque de quoi.
- **N2 Charge d'entraînement** : séries / tonnage par semaine sur 6 semaines, par athlète (petite courbe) ; signale une hausse brutale (> 30 % d'une semaine à l'autre). L'ACWR seulement s'il est jugé fiable.
- **N3 Suivi des programmes** : qui a un programme, dernière modification (et par qui), plan de la semaine x/n fait, « propositions Novalyz » au coach ou aussi à l'athlète.

Plus tard (club / fédération) : filtre par groupe ou catégorie, export PDF / CSV.
