# Audit de l'état du jour (Prêt / Vigilance / À surveiller) contre la littérature — 22/11/2026

Source : `supabase/functions/handler/index.ts` (`CORE_SEUILS`, `evaluerEtatAthlete`, ~l. 560 et 3693) ; affichage : bloc État
(`renderCockpitEtat`, `js/app.js`), règles `NovalyzEngine` (`js/app.js` ~l. 439), vue coach.

## Ce que fait le moteur

| # | Élément | Règle exacte | Verdict |
|---|---|---|---|
| 1 | **Récupération** (score 0-100) | moyenne des réponses sommeil, fatigue, stress, courbatures (type indice de Hooper) ; Excellent ≥ 75 · Bon ≥ 60 · Moyen ≥ 45 · Faible < 45 | **Soutenu pour le principe** : les mesures ressenties suivent mieux la charge que les mesures objectives (Saw 2016, revue de 56 études) ; le questionnaire de bien-être prédisait le surentraînement chez des nageurs (Hooper 1995, 14 nageurs). **Seuils 45/60/75 = choix Novalyz** (aucune étude ne les fixe). |
| 2 | Vigilance (orange) | fatigue ≥ 4/5, sommeil ≤ 2/5, récup < 45, douleur ≥ 3/5, courbatures ≥ 4/5, retour progressif | **Prudence** — signaux ressentis, cohérents avec Saw 2016 ; seuils Novalyz. |
| 3 | À surveiller (rouge) | douleur forte (≥ 4/5), blessure modérée/grave, indisponible | **Prudence** — garde-fou santé, pas une prédiction. |
| 4 | Charge seule | ne change PAS le verdict (repère « Charge en hausse ») | **Bon choix** — cohérent avec les critiques de l'ACWR (ci-dessous). |
| 5 | Charge : fraîcheur (TSB, modèle de Banister) en premier, ACWR en repli | TSB % ; ACWR 0,8 / 1,3 / 1,5 | **Modèle, à présenter comme repère** — le modèle fitness-fatigue a des limites connues (paramètres fixes non individualisés, hypothèses linéaires, prédiction individuelle faible). L'ACWR est **fortement contesté** comme indicateur de blessure (Impellizzeri 2020, 2021 : artefacts statistiques, fenêtres arbitraires) ; le débat n'est pas clos. |
| 6 | **« Risque blessure : Faible / Modéré / Élevé »** | points : surcharge (ACWR/TSB) + douleur + fatigue + courbatures | **NON soutenu** — aucun de ces cumuls n'est validé pour prédire une blessure ; l'ACWR, qui en fait partie, est justement la mesure la plus critiquée. Le mot « risque de blessure » promet une prédiction que rien ne garantit. |
| 7 | Alerte « **Risque accru de blessure** » (règle NovalyzEngine) | ACWR élevé + douleur élevée + fatigue élevée | **Même problème de wording** — l'action conseillée (réduire la charge, consulter si la douleur persiste) est prudente et correcte ; c'est le titre qui affirme trop. |

## Propositions (à valider)

- **E1** — Renommer **« Risque blessure »** en **« Signaux d'alerte : aucun / 1 / plusieurs »** (ou « Points de vigilance »), avec la
  liste des signaux qui ont compté (charge haute, douleur, fatigue, courbatures). Même calcul, plus de promesse de prédiction.
- **E2** — Titre de l'alerte : **« Charge, douleur et fatigue élevées en même temps »** au lieu de « Risque accru de blessure » ;
  recommandation inchangée.
- **E3** — Sous la charge (ACWR / fraîcheur), une ligne d'explication : « Repère de charge, pas une prédiction de blessure »
  (déjà présent pour l'ACWR dans un bloc : à généraliser).
- Seuils 45/60/75, fatigue 4/5, sommeil 2/5, douleur 3-4/5 : **inchangés**, présentés comme repères Novalyz.

## Références (recherche du 22/11)
- Saw, Main, Gastin 2016, Br J Sports Med — https://pmc.ncbi.nlm.nih.gov/articles/PMC4789708
- Hooper et al. 1995 (nageurs) — https://pubmed.ncbi.nlm.nih.gov/7898325/
- Impellizzeri et al. 2020, IJSPP « Conceptual issues and fundamental pitfalls » — https://opus.lib.uts.edu.au/handle/10453/141898
- Impellizzeri et al. 2021, Sports Med « Time to dismiss ACWR » — https://pmc.ncbi.nlm.nih.gov/articles/PMC7534938
- Éditorial Frontiers 2021 (débat ACWR) — https://pmc.ncbi.nlm.nih.gov/articles/PMC8138569/
- Limites du modèle fitness-fatigue — https://www.pubmed.gov/35320776/
