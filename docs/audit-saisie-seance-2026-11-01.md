# Audit — saisie de séance : cibles et règle de progression (01/11/2026)

Méthode : la VRAIE règle `_progDecision` (js/app.js, utilisée par la saisie ET par Aujourd'hui via `_tjCibles`) exécutée sur la dernière et l'avant-dernière séance réelles de chacun des 16 exercices du programme (données au 30/10, catégories enregistrées le 01/11, niveau intermédiaire).

## Constat principal ❌ — la progression est presque toujours bloquée

Règle actuelle (validée le 28/10) : **si UNE série de la dernière fois est à RPE ≥ 9 → « consolide »** (même charge, mêmes reps, aucune progression proposée).

Sur tes vraies séances : **12 exercices sur 16 en « consolide »**, 1 « sous la fourchette », 3 seulement avec une cible qui progresse. Tu t'entraînes à RPE 8-9 (c'est aussi ce que l'app conseille : « vise RPE 8-9 sur toutes tes séries ») → la règle te met presque partout en pause, alors que tu as battu 16 records en octobre.

| Exercice | Dernière fois | Règle actuelle |
|---|---|---|
| Développé machine | 90×7@9 · 90×6@9 · 75×10@8 | consolide |
| Tirage horizontal prise large | 80×7@9 · 75×8@9 · 70×10@8 | consolide |
| Leg curl allongé | 35×8@8 · 35×8@8 · 35×8@9 · 30×12@9 | consolide |
| … (12 au total) | | |

## Options

| Option | Règle | Exercices en « consolide » sur tes données |
|---|---|---|
| Actuelle | 1 série à RPE ≥ 9 → tout l'exercice consolide | 12 / 16 |
| A | consolide si la **majorité** des séries est à RPE ≥ 9 | 12 / 16 |
| **B (recommandée)** | **série par série** : une série à **RPE 10 (échec)** garde sa charge et ses reps ; les autres visent **+1 rep** (jusqu'au haut de la fourchette) | 1 / 16 (Développé incliné Smith, déjà « sous la fourchette ») |
| C | série par série, mais on garde dès RPE 9 (+1 rep seulement sur les séries à RPE ≤ 8) | progression partielle (ex. Développé machine 90×7 · 90×6 · 75×**11**) |

Pourquoi B : RPE 9 = 1 rep en réserve, c'est la zone visée (RPE 8-9) — pas un signal d'arrêt. RPE 10 (échec) = au-delà de la cible → on consolide cette série. Le passage à la charge supérieure reste inchangé (toutes les séries au haut de la fourchette, 1 ou 2 séances selon le niveau) ; « sous la fourchette » reste prioritaire.

🟠 À décider par le porteur. Aucun changement appliqué.
