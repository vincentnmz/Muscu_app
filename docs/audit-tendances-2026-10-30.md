# Audit Analyses ▸ Tendances (Muscu + Cardio) — 30 oct. 2026

> Méthode : vrai `index.ts` rejoué sur la copie des données réelles de Vincent (au 29/10). Onglets Tendances
> Muscu et Cardio rendus par le vrai front, en Semaine, Mois et Année. Chaque chiffre a été recalculé.

## Défauts trouvés

| # | Gravité | Où | Défaut | Statut |
|---|---|---|---|---|
| 1 | **Élevée** | Muscu › « Tendance de force · indice (1RM estimé moyen) » | Moyenne du 1RM estimé (formule d'Epley) sur **tous les exercices de la séance**. La courbe bouge selon la **séance du jour**, pas selon ta force. Semaine : **39 → 72 → 44 kg** (pec 26/10, dos 27/10, pec 29/10). Le texte dit « la courbe monte = tu gagnes en force ». Même indicateur que celui retiré de la lecture (décision 29/10). | **→ décision** (voir proposition) |
| 2 | Moyenne | Muscu › Ce qui bouge › « Tonnage 28j vs 28j précédents ▲ +107 % » | Aucune réserve, alors que la lecture dit « pause de 12 jours dans la période précédente : pas représentatif ». | **Corrigé** : la mention « non représentatif : pause de 12 jours » s'affiche, en gris (nouveau champ serveur `volume_fiable`). |
| 3 | Moyenne | Cardio › Efficience « FC moyenne 94 bpm **▼ mieux** » | Verdict « mieux » avec **un seul point** (une seule semaine de FC), et sans vérifier que l'effort était comparable, alors que la légende dit « à lire à effort comparable ». | **Corrigé** : verdict seulement avec au moins 2 points ET un RPE comparable (±1). Sinon « 1 point, pas de tendance » ou « effort non comparable ». |
| 4 | Faible | Muscu › Tonnage (Mois / Année) | Légende « soulevés au total ce jour… seuls les jours d'entraînement sont tracés » alors qu'en Mois et Année chaque point est une semaine ou un mois. | **Corrigé** : la légende suit la période (jour / semaine / mois). |

## Vérifié juste
- **Tonnage** :
  - jours 4,1 t (26/10), 6,9 t (27/10), 4,2 t (29/10 : 4 230 kg, identique à la base) ;
  - semaines d'octobre 19,2 / 9,5 / 12,9 / 20,2 / 4,2 t → total du mois 66 t.
- **Régularité** :
  - barres 3, 2, 0, 1, 1, 4, 0, 2, 2, 4, 2, 3 ;
  - 2 semaines sur 12 à l'objectif (4) ;
  - moyenne de 2 séances par semaine ;
  - série 0 (la dernière semaine complète en a 2) ;
  - la semaine en cours est encadrée et ne casse pas la série.
- **Fréquence par muscle (semaine)** : pectoraux et épaules 2 fois (26 et 29/10), dos, quadriceps et ischios 1 fois (27/10).
- **Répartition d'intensité (semaine)** : 56 séries (18 + 20 + 18).
- **Cardio Mois** : Marche 3,5 km, 2 sorties.

## Proposition pour #1 (à valider)
Remplacer « Tendance de force » par **« Exercices en progrès »** : chaque semaine, le nombre d'exercices en
records ou en progrès, calculé avec le même classement que la lecture v2 (charges et reps réelles, pas de formule).
Une courbe qui monte veut alors vraiment dire que tu progresses. Le détail de chaque exercice reste dans « Par exercice ».
