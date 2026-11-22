# Audit cardio / Croisé et nutrition contre la littérature — 22/11/2026

Sources : `supabase/functions/handler/index.ts` (`buildSyntheseCardio`, `chargeInterneCardio`, synthèse Croisé ~l. 2405-2483) ;
`js/app.js` (`_nutObjectifsFor`, `_nutAnalyse` ~l. 28700).

## A. Cardio et Croisé

| # | Règle | Verdict |
|---|---|---|
| A1 | Charge cardio = RPE × durée (session-RPE) | **Méthode reconnue** (Foster) ; déjà utilisée telle quelle. |
| A2 | Imports montre sans RPE : RPE **estimé depuis la FC moyenne avec des seuils fixes** (≥ 165 bpm → 9, ≥ 150 → 8, … ≥ 110 → 5) | **Approximation à améliorer** — la même FC ne représente pas le même effort à 20 et à 50 ans : la FC max baisse avec l'âge (≈ 208 − 0,7 × âge, Tanaka 2001, 351 études). 165 bpm ≈ 85 % de la FC max à 25 ans, mais ≈ 97 % à 55 ans. |
| A3 | « À effort comparable, ta FC moyenne baisse (≥ 4 bpm) — bon signe pour ton endurance » | **Logique physiologique** — une FC plus basse au même effort est une adaptation aérobie classique ; formulé « bon signe », sans promesse : correct. |
| A4 | Charge cardio +50 % sur 4 semaines → « hausse rapide » | **Factuel** (comparaison de charge) ; seuil Novalyz. |
| A5 | Muscu ≥ 85 % : « un peu de cardio renforcerait ta base d'endurance » ; cardio ≥ 85 % : « la musculation entretient force et masse » | **Soutenu** — l'OMS recommande les deux (150-300 min d'activité aérobie modérée + renforcement 2 jours/sem, Bull 2020) ; et le cardio ne freine ni la force maximale ni l'hypertrophie (Schumann 2022, 43 études ; seule la force explosive est un peu freinée, surtout dans la même séance). |
| A6 | Entre 15 et 85 % : « Bon équilibre muscu / cardio » | **Acceptable** — aucune étude ne fixe un « bon » ratio ; c'est un repère Novalyz. |

## B. Nutrition

| # | Règle | Verdict |
|---|---|---|
| B1 | Métabolisme de base = **Mifflin-St Jeor** × niveau d'activité (choisi par l'athlète) | **Soutenu** — l'équation la plus souvent à ±10 % de la mesure (Frankenfield 2005) ; erreurs individuelles possibles : cibles « indicatives », déjà écrit ainsi. |
| B2 | Sèche −15 % · prise de masse +10 % · recomposition −10 % | **Soutenu** pour la sèche et la masse : perte visée 0,5-1 %/sem (Helms 2014) ; surplus 10-20 %, bas de fourchette pour les confirmés (Iraki 2019). Recomposition −10 % : **choix Novalyz**. |
| B3 | Protéines : sèche / recomposition 2,2 g/kg · masse 2,0 · entretien 1,8 | **Soutenu** — plateau des gains vers 1,6 g/kg (Morton 2018) ; en déficit, apports plus élevés (2,3-3,1 g/kg de masse maigre, Helms 2014 ; 1,8-2,7 g/kg, mise à jour 2020). |
| B4 | Lipides ≈ 27 % des calories, glucides = le reste | **Soutenu** — dans la fourchette 15-30 % (Helms 2014). |
| B5 | Conseil du jour : « protéines **~1,6 à 2 g/kg** » | **Incohérent avec B3** en sèche (cible affichée 2,2 g/kg). |

## Propositions (à valider)

- **N1 (B5)** : conseil du jour → « protéines ~1,6 à 2,2 g/kg/jour selon ton objectif (haut de fourchette en sèche) », aligné sur la cible affichée.
- **N2 (A2)** : quand l'âge est connu, estimer le RPE d'un import montre en **% de la FC max estimée** (208 − 0,7 × âge) au lieu de
  seuils fixes en bpm (mêmes paliers, exprimés en %) ; âge inconnu → seuils actuels. À noter : la FC max individuelle varie de ±10 bpm
  autour de la formule — ça reste une estimation, signalée comme telle.
- Le reste : inchangé.

## Références (recherche du 22/11)
- Frankenfield et al. 2005, J Am Diet Assoc — https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/
- Helms, Aragon, Fitschen 2014, JISSN — https://pmc.ncbi.nlm.nih.gov/articles/PMC4033492
- Iraki et al. 2019, Sports — https://pmc.ncbi.nlm.nih.gov/articles/PMC6680710
- Morton et al. 2018, Br J Sports Med — https://pubmed.ncbi.nlm.nih.gov/28698222/
- Schumann et al. 2022, Sports Med — https://pubmed.ncbi.nlm.nih.gov/34757594/
- Bull et al. 2020 (OMS), Br J Sports Med — https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/
- Tanaka, Monahan, Seals 2001, JACC — https://pubmed.ncbi.nlm.nih.gov/11153730/
