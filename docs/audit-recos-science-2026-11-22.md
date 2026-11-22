# Audit des recommandations (Aujourd'hui · Résumé · « le mot de Novalyz ») contre la littérature — 22/11/2026

Source : `supabase/functions/handler/index.ts`, `buildSyntheseMuscu` (constats, `reco`, `reco_pool`) ; le front affiche la reco
principale et **un conseil du pool par jour** (rotation, `js/app.js` ~l. 16010). Les leviers par exercice et le plan de la semaine
(+ séries) ont déjà été audités (`docs/audit-leviers-science-2026-11-21.md`).

## A. Reco principale (une seule, par priorité)

| # | Déclencheur | Texte (résumé) | Verdict |
|---|---|---|---|
| A1 | RPE moyen +0,7 à volume stable, ou récup faible | « Allège 1 à 2 séances » | **Soutenu (consensus)** — réduire le stress d'entraînement pour récupérer (Bell 2023, Delphi). |
| A2 | Régularité < 60 % de l'objectif | « …la régularité est **le 1er moteur de progression** » | **Trop affirmatif** — ce qui est établi, c'est le volume (Pelland 2024) ; la régularité sert à l'atteindre. |
| A3 | État en vigilance (± progression) | garder la charge, priorité récupération | **Prudence**, cohérent avec la cible en séance. |
| A4 | Volume −8 % ou plus | revenir aux charges / remonter le volume | **Soutenu** — dose-réponse du volume. |
| A5 | Volume +5 % sans hausse d'effort | poursuivre la surcharge progressive | **Soutenu** (surcharge progressive, ACSM 2009). |

## B. Conseils du pool (un affiché par jour)

| # | Déclencheur | Texte (résumé) | Verdict |
|---|---|---|---|
| B1 | Sommeil moyen < 3/5 | « vise 7-9 h… **le 1er facteur** de récupération et de progression » | **Partiellement** — 7-9 h = recommandation adulte ; manque de sommeil = baisse de force modeste (≈ −3 %) et d'endurance de force (≈ −10 %) (Craven 2022). « 1er facteur » : non établi. |
| B2 | Stress ≥ 3,5/5 | « il freine la récupération » | **Soutenu** — stress chronique = récupération musculaire plus lente sur 96 h (Stults-Kolehmainen 2014, n = 31). |
| B3 | Courbatures ≥ 4/5 | ~48 h avant de recharger fort le muscle | **Logique** — pas d'étude qui fixe 48 h. |
| B4 | Fraîcheur (TSB) ≥ +5 % fiable | « bon moment pour une séance plus intense » | **Modèle** — repère du modèle fitness-fatigue (Banister), pas une preuve individuelle ; formulé comme opportunité : correct. |
| B5 | Repos moyen < 90 s (hors sèche) | viser 2-3 min sur les exercices lourds | **Soutenu** — Schoenfeld 2016 (3 min > 1 min). |
| B6 | Volume en hausse | +1 rep ou +2,5 kg sur un exercice clé | **Logique** (double progression). |
| B7 | Volume stable | +1 rep puis +2,5 kg en haut de fourchette | **Logique** (double progression). |
| B8 | Volume non en baisse | +1-2 séries sur un muscle sous sa cible | **Soutenu** — dose-réponse. |
| B9 | RPE moyen 28 j < 8 | dernières séries à 1-2 reps de l'échec | **Soutenu** — Robinson 2024. |
| B10 | toujours | « une variable à la fois et **garde les mêmes exercices** » | **À nuancer** — mesurer demande de garder ses exercices principaux, mais varier de façon raisonnée aide (Kassiano 2022) et c'est un levier proposé aux confirmés. |
| B11 | toujours | 7-9 h de sommeil, 2-3 min de repos sur les gros exercices | **Soutenu** (B1, B5). |
| B12 | toujours | protéines ~1,6 à 2 g/kg/jour | **Soutenu** — plateau des gains de masse maigre vers 1,6 g/kg/j (Morton 2018, 49 essais). |
| B13 | toujours | « **tempo contrôlé** et amplitude complète rendent chaque série plus efficace » | **Partiellement** — amplitude complète ≥ partielle (Pallarés 2021, Wolf 2023) ; le tempo, lui, ne change pas l'hypertrophie entre 0,5 et 8 s par rep (Schoenfeld 2015). |
| B14 | toujours | « enregistre ton RPE » | Conseil d'usage de l'app : correct. |

## C. Constats du Résumé (« Ce que Novalyz lit »)

Volume ±, respect du programme, RPE qui monte, régularité, récupération : **factuels** (calculés sur les données), seuils de
décision Novalyz (−8 % / +5 % volume, +0,7 RPE, 60 % de l'objectif). Le seuil RPE +0,7 porte sur une moyenne 28 j contre 28 j
(beaucoup de séries) : moins sensible au bruit que la comparaison d'une seule séance → cohérent avec Q1.

## Propositions (à valider)

- **R1 (A2)** : « Vise N séances/semaine : c'est ce qui te permet d'atteindre ton volume par muscle, le 1er levier de progression. »
- **R2 (B1)** : retirer « le 1er facteur » → « vise 7-9 h et des horaires réguliers : le manque de sommeil fait baisser la force et surtout l'endurance de force ».
- **R3 (B10)** : « Progresse une variable à la fois et garde tes exercices principaux assez longtemps pour mesurer tes progrès (au moins 4-6 semaines). »
- **R4 (B13)** : « Soigne l'exécution avant la charge : amplitude complète et mouvement maîtrisé. » (sans promettre d'effet du tempo).
- Le reste : inchangé.

## Références (recherche du 22/11)
- Craven et al. 2022, Sports Med (sommeil) — https://www.pubmed.gov/35708888/
- Stults-Kolehmainen et al. 2014, JSCR (stress) — https://pubmed.ncbi.nlm.nih.gov/24343323/
- Morton et al. 2018, Br J Sports Med (protéines) — https://pubmed.ncbi.nlm.nih.gov/28698222/
- Pallarés et al. 2021 (amplitude) — https://pubmed.ncbi.nlm.nih.gov/34170576/ · Wolf et al. 2023 — https://doaj.org/article/99e86b317bec40f5abc2f0008358737e
- Schoenfeld 2015 (durée de rep) — https://pubmed.ncbi.nlm.nih.gov/25601394/ · Kassiano 2022 — https://pubmed.ncbi.nlm.nih.gov/35438660/
- Bell 2023 — https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/ · Schoenfeld 2016 (repos) — https://pubmed.ncbi.nlm.nih.gov/26605807/
- Robinson 2024 — https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/ · Pelland 2024 — https://sportrxiv.org/index.php/server/preprint/view/460

## Décision porteur (22/11) : R1 à R4 acceptées et codées (serveur).
