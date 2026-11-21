# Audit des « Pourquoi » contre la littérature scientifique — 21/11/2026

Demande porteur : « on fait une liste des pourquoi après aussi ». Source : `js/lecture-v3.js` (`_lv3Diag`, liste `checks`).
Un « Pourquoi » est un **constat** affiché sous « Pourquoi ça bloque / ça recule / l'effort monte » :
✗ = cause possible trouvée dans les données, ✓ = « pas en cause ». Le levier découle du premier ✗.

Même méthode que les leviers : chaque constat doit (a) décrire exactement ce que le code mesure, (b) s'appuyer sur une étude
quand il affirme un lien de cause, sinon être présenté comme une logique d'entraînement.

## Inventaire (12 constats) et verdict

| # | Constat affiché | Déclencheur exact (code) | Verdict | Commentaire |
|---|---|---|---|---|
| 1 | ✗ Charge : C kg pour R reps, ta fourchette est a-b | majorité des séries de travail sous le minimum, RPE max ≥ 9 | **Factuel** | Comparaison à l'objectif de l'athlète, pas une théorie. |
| 2 | ✗ Saut de A à B kg (+X %) | hausse ≥ 8 % depuis la charge précédente | **Logique** | Plus de charge = moins de reps possibles (relation charge-répétitions). Aucune étude ne fixe « 8 % ». |
| 3 | ✗ 3 séances d'affilée à RPE 10 (à l'échec) | RPE max 10 sur les 3 dernières séances | **Soutenu** | L'échec allonge nettement la récupération (24-48 h+, Morán-Navarro 2017) sans gain de muscle en plus (Refalo 2023). |
| 4 | ✗/✓ Volume muscle : X séries/sem (minimum M) | 4 semaines terminées, minimum par niveau | **Soutenu** | Minimums : Schoenfeld 2017 (≥ 10), Baz-Valle 2022 (12-20 entraînés), débutant 6 (décision porteur). |
| 5 | ✗ Effort en hausse à C kg : RPE a → b | hausse ≥ 0,5 point (moyenne 2 séances vs 2 d'avant si dispo, sinon dernière vs précédente) | **Seuil trop fin** | L'erreur d'estimation de la réserve est ≈ 1 rep en moyenne (Halperin 2022) : +0,5 sur une seule séance peut être du bruit. |
| 6 | ✗ Travaillé F×/sem / ✓ Fréquence | fréquence ≤ 1×/sem (muscle principal + secondaire) | **Faible comme cause** | À volume égal, 1× ou 2×/sem = même hypertrophie (Schoenfeld 2019) ; utile surtout pour placer des séries, et pour la force (Pelland 2024). |
| 7 | ✗ Repos raccourci : A → B / ✓ Repos stable | dernière séance ≥ 30 s de moins que les 3 précédentes | **Soutenu, à borner** | Moins de repos = moins de reps (Schoenfeld 2016) ; mais 3 min 30 → 3 min n'a pas d'effet attendu (au-delà de 90 s-2 min). |
| 8 | ✗ Séries arrêtées à RPE x (≈ N reps en réserve) | RPE moyen des séries de travail < 8,5 sur 3 séances | **Soutenu, à nuancer** | Plus près de l'échec = plus de muscle (Robinson 2024). Les pratiquants **sous-estiment** leur réserve d'≈ 1 rep (Halperin 2022) : la réserve réelle est souvent plus grande. |
| 8bis | ✓ Effort : RPE x — tu pousses déjà, pas en cause | même mesure ≥ 8,5 | **Affirmation trop forte** | Même biais : un RPE 9 déclaré peut être un RPE 8 réel. |
| 9 | ✗ Possible : gêne zone N/5 | gêne ≥ 3/5 sur la zone pendant le plateau | **Prudence** | Garde-fou, formulé « possible » : correct. |
| 10 | ✗ Possible : série à C kg passée de a à b reps | série plus légère avant, +3 reps ou plus, pendant que les séries de travail stagnent | **Logique, non testé** | Fatigue avant les séries de travail ; formulé « possible » : correct. |
| 11 | ✗ Marche suivante : +X kg = +Y % | palier ≥ 15 % de la charge, reps proches du haut de fourchette | **Logique** | Pas d'étude sur la taille des paliers. |
| 12 | ✓ « … — pas en cause » (volume, fréquence, repos, effort) | seuil non atteint | **Wording trop affirmatif** | Ce qu'on sait : « rien d'anormal dans tes données », pas « ce n'est pas la cause ». |

## Propositions (à valider)

- **Q1 — Effort en hausse** : seuil **≥ 1 point** quand on compare une seule séance à la précédente ; garder 0,5 quand c'est la moyenne de 2 séances contre 2 (le bruit est moyenné).
- **Q2 — Fréquence** : ne l'afficher en ✗ que si le volume du muscle est **aussi** sous le minimum (c'est alors un moyen d'ajouter des séries) ; sinon ligne neutre.
- **Q3 — Repos raccourci** : ✗ seulement si le nouveau repos passe **sous le seuil utile** (2 min poly-articulaire, 90 s isolation / non classé — même règle que le levier).
- **Q4 — Réserve** : « Séries arrêtées à RPE 8 (≈ 2 reps en réserve, **souvent plus** : on sous-estime sa réserve) ».
- **Q5 — « pas en cause »** → **« rien d'anormal »** (ex. « Repos : 2 min, stable — rien d'anormal »), et « tu pousses déjà » → « tu indiques pousser à RPE x ».
- Constats 1, 2, 3, 4, 9, 10, 11 : inchangés.

## Références (vérifiées par recherche, 21/11)
- Morán-Navarro et al. 2017, Eur J Appl Physiol — récupération après échec : https://pubmed.ncbi.nlm.nih.gov/28965198/
- Halperin et al. 2022 (préprint) — précision de la réserve estimée : https://sportrxiv.org/index.php/server/preprint/view/67
- Refalo et al. 2023, Sports Med : https://pubmed.ncbi.nlm.nih.gov/36334240/
- Robinson et al. 2024, Sports Med : https://rke.abertay.ac.uk/en/publications/exploring-the-dose-response-relationship-between-estimated-resist/
- Schoenfeld et al. 2016, JSCR — repos 3 min vs 1 min : https://pubmed.ncbi.nlm.nih.gov/26605807/
- Schoenfeld, Grgic, Krieger 2019 / Schoenfeld 2016 — fréquence : https://pubmed.ncbi.nlm.nih.gov/27102172/
- Baz-Valle et al. 2022 : https://pmc.ncbi.nlm.nih.gov/articles/PMC8884877
- Pelland et al. 2024 (préprint) : https://sportrxiv.org/index.php/server/preprint/view/460
