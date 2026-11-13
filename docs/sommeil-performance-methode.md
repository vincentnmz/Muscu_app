# Sommeil → performance — méthode statistique (FIGÉE AVANT SIMULATION, 13/11/2026)

> Validation porteur du 13/11 : nuit courte < 7 h · épisodes · ≥ 20 séances + ≥ 5 épisodes + ≥ 5 normales · **pas de
> seuil de 3 %** · robustesse à formaliser. **Aucun code dans l'app, aucun changement de base.**
> Ce document est poussé **avant** de lancer les simulations : aucun paramètre ci-dessous ne sera modifié après avoir vu
> les résultats simulés. Si la méthode échoue, on le dira tel quel et on reviendra au porteur.

## 1. Données d'entrée

- **Force estimée** d'un exercice un jour donné = max sur ses séries de `charge × (1 + (reps + RIR) / 30)`,
  RIR = 10 − RPE plafonné à [0 ; 4] (0 si pas de RPE) — formule existante de l'app (`_lv3ForceSerie`). Charge > 0 seulement.
- **Nuit** = durée de la plus longue session de sommeil, datée au jour du réveil (import Health Connect existant).
  Nuit < 180 min = ignorée (enregistrement incomplet, règle existante).

## 2. Score de séance (jour d)

Pour chaque exercice `e` fait le jour `d` : `réf = moyenne des forces de e les autres jours dans [d − 28 ; d + 28]`,
au moins 2 jours de référence, sinon l'exercice est ignoré. `écart_e = (force − réf) / réf × 100`.
**Score(d) = médiane des écart_e.** Jour sans aucun exercice noté = pas de score.

## 3. Séances appariées et classement

- Séance appariée = jour avec un score **et** une nuit ≥ 180 min datée ce jour-là.
- **Courte** si nuit < 420 min (7 h), **normale** sinon. Une seule définition, pas d'autre essayée.

## 4. Épisodes

Séances courtes triées par date ; deux séances courtes **à 2 jours ou moins** d'écart appartiennent au même épisode
(chaînage : 22, 23, 25 → un épisode). **Score d'épisode = moyenne des scores de ses séances.**
Les séances normales restent des unités séparées.

## 5. Conditions d'affichage

`N_appariées ≥ 20` **et** `K_épisodes ≥ 5` **et** `M_normales ≥ 5`. Sinon : « en apprentissage » avec les compteurs
(séances x/20, épisodes de nuits courtes y/5, séances après nuit normale z/5).

## 6. Estimation et test

- `Δ = moyenne(scores des séances normales) − moyenne(scores des épisodes)` (un épisode pèse 1).
  Δ > 0 ⇔ performance plus basse après les nuits courtes.
- Erreur type (Welch, unités = épisodes et séances normales) : `SE = √(s_ép² / K + s_norm² / M)` ;
  `ddl = (a + b)² / (a² / (K − 1) + b² / (M − 1))`, a = s_ép²/K, b = s_norm²/M.
- `t = Δ / SE`. **Significatif** si `|t| ≥ t_crit(0,975 ; ddl)` (bilatéral, 5 %). Table de Student, ddl arrondi
  **vers le bas** (conservateur), loi normale au-delà de 30.

## 7. Robustesse (formalisée)

On recalcule Δ en retirant **chaque unité une à une** (chaque épisode, chaque séance normale ; les conditions de la
section 5 ne sont pas re-vérifiées pour ce calcul). **Robuste** si **tous** les Δ recalculés ont le **même signe** que Δ.

## 8. Verdict (3 sorties, pas d'autre)

- **Écart net** = significatif (§ 6) **et** robuste (§ 7). Texte : « Après tes nuits de moins de 7 h, ta force estimée
  est en moyenne X % sous (ou au-dessus de) ton niveau du moment (K épisodes, M séances après nuit normale). »
  X = |Δ| arrondi à l'unité (0,5 si < 1).
- **Pas d'écart net** sinon. Texte : « Pas d'écart net entre tes nuits de moins de 7 h et les autres. Un écart de moins
  de Y % ne serait pas détectable avec tes données. »
- Toujours : « Association observée, pas une preuve de cause. »
- **Y (seuil minimal détectable)** = `(t_crit(0,975 ; ddl) + 0,84) × SE`, arrondi à l'unité supérieure
  (écart détecté 8 fois sur 10 avec ce bruit et ce nombre d'unités).

## 9. Plan de simulation (fixé avant de lancer)

- **2 000 tirages** par scénario. Effet sommeil vrai : **0, 3, 5, 8, 10 %** (toutes les forces de la séance × (1 − effet)
  si la nuit < 7 h).
- **A. Semi-réel** : vraies forces du porteur (47 jours de séance, prod, lecture seule du 13/11), nuits simulées pour
  chaque jour (AR(1) quotidien, ρ = 0,45, moyenne 7 h 38, écart-type = celui des 43 vraies nuits ≥ 3 h), effet injecté.
- **B. Synthétique** : 3 séances types × 5 exercices en rotation, 3 séances/semaine, nuits AR(1) comme A ;
  force = base × tendance (+0,3 %/sem) × phase lente (marche aléatoire, ±1 %/sem) × bruit de séance × bruit d'exercice
  × arrondi des charges (2,5 kg). Bruit calibré pour donner un écart-type du score ≈ **3,3 %** (récent) et ≈ **5,7 %**
  (long). Longueurs : **20, 30, 40, 60** séances appariées. La méthode n'est appliquée que si § 5 est rempli
  (sinon le tirage compte « en apprentissage »).
- **Mesures** : faux positifs (effet 0 → « écart net »), détection (effet > 0 → « écart net » **dans le bon sens**),
  erreurs de sens, part « en apprentissage », Y médian.
- **Critères d'acceptation fixés à l'avance** : faux positifs **≤ 5 %** en moyenne et **≤ 7 %** dans chaque scénario
  (marge d'erreur Monte-Carlo ≈ ±1 %) ; erreurs de sens **≤ 1 %** ; à effet 10 % et bruit récent, détection rapportée telle
  quelle (pas de critère : c'est ce qu'on cherche à mesurer).

---

## 10. Résultats des simulations (13/11, après le commit c63c01e — aucun paramètre modifié)

Script hors app (graine fixe 20261113, 2 000 tirages/scénario). Détection et faux positifs comptés **parmi les tirages
où un résultat s'affiche** (hors « en apprentissage »).

**Données actuelles du porteur** : « En apprentissage : 16/20 séances · 4/5 épisodes de nuits courtes · 5/5 séances après nuit normale. »

| Scénario | En apprentissage | Faux positifs (effet 0) | Détection 3 % | 5 % | 8 % | 10 % | Y médian affiché |
|---|---|---|---|---|---|---|---|
| A. Semi-réel (vraies forces, 47 séances, ±5,7 %) | ≈ 1 % | 4,5 % | 29 % | 72 % | 98 % | 99,8 % | 6 % |
| B. ±3,3 %, 20 séances | ≈ 51 % | 4,8 % | 38 % | 76 % | 97 % | 99 % | 5-6 % |
| B. ±3,3 %, 30 séances | ≈ 12 % | 4,9 % | 53 % | 89 % | 99 % | 99,9 % | 5 % |
| B. ±3,3 %, 40 séances | ≈ 2 % | 4,9 % | 63 % | 95 % | 99,9 % | 100 % | 4 % |
| B. ±3,3 %, 60 séances | 0 % | 5,1 % | 82 % | 99,5 % | 100 % | 100 % | 3 % |
| B. ±5,7 %, 20 séances | ≈ 51 % | 5,2 % | 15 % | 39 % | 75 % | 88 % | 9 % |
| B. ±5,7 %, 30 séances | ≈ 12 % | 4,8 % | 22 % | 51 % | 86 % | 96 % | 8 % |
| B. ±5,7 %, 40 séances | ≈ 2 % | 4,5 % | 28 % | 63 % | 94 % | 99 % | 7 % |
| B. ±5,7 %, 60 séances | 0 % | 5,5 % | 41 % | 81 % | 99 % | 100 % | 5 % |

- **Critères fixés à l'avance** : faux positifs moyens 4,9 % (≤ 5 % ✓), max 5,5 % (≤ 7 % ✓) ; erreurs de sens à effet > 0 :
  max 0,1 % (≤ 1 % ✓). → **critères remplis**.
- **Y est honnête** : l'écart annoncé « détectable » est bien détecté ≈ 8 fois sur 10 (ex. ±3,3 %/20 séances : Y = 5, détection à 5 % = 76 %).
- **Taille affichée quand un écart est détecté** : juste pour 8-10 % (médiane 8,3-11 %), **surestimée pour les petits
  effets** (effet réel 3 % affiché 3,3 à 6,9 % en médiane selon le bruit) : un effet faible n'est détecté que les fois où le
  hasard l'a grossi.
- **Limites non couvertes par la simulation** : (1) facteur commun réel (nuits courtes pendant une phase de fatigue ou de
  programme) → la méthode verra une association vraie mais non causale — d'où « association observée, pas une preuve de
  cause » ; (2) effet supposé en marche (< 7 h oui/non), pas proportionnel au manque de sommeil ; (3) semi-réel sur un seul
  athlète ; (4) 1 athlète sur 20 sans aucun effet lira un « écart net » (risque 5 % assumé).
