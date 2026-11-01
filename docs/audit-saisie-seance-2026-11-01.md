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

## Décision et réalisation (01/11, validé porteur)

Règle par niveau + garde-fous récupération (sources : ACSM 2009 — +2 à 10 % quand 1-2 reps au-dessus de l'objectif 2 séances de suite ; Morán-Navarro 2017 — l'échec rallonge la récupération neuromusculaire ; Refalo 2023 — la proximité de l'échec n'a pas d'effet linéaire).

| Niveau | +1 rep (série par série) | Charge | 
|---|---|---|
| Débutant (0-3 ans) | série à RPE ≤ 8 ; au-dessus, la série est gardée | toutes au haut de la fourchette, 1 séance, RPE ≤ 8 |
| Intermédiaire (4-7), avancé (8-10), expert (11+) | série à RPE ≤ 9 ; RPE 10 (échec) gardée | toutes au haut 2 séances de suite (ou 1 fois à RPE ≤ 7), jamais si RPE 10 ; avancé/expert : choix du jour |

Garde-fous : échec 2 séances de suite sur l'exercice → tout gardé, « vise RPE 9 » ; jour en Vigilance (verdict du moteur) → aucune progression ; « sous la fourchette » prioritaire. Phrase d'explication unique (`_progWhy`) pour la saisie, Aujourd'hui et Par exercice.

Résultat sur les 16 exercices réels : **15 progressent (+1 rep série par série), 1 « sous la fourchette »** (Développé incliné Smith, 2 séances à l'échec) — avant : 12 bloqués. Tests : `surcharge-serie` 48 cas (10 nouveaux sur les seuils de chaque niveau et les garde-fous).

Seuils « RPE ≤ 8 débutant » et « échec 2 séances de suite » = choix Novalyz cohérents avec ces sources (aucune ne les donne tels quels).

## Suite de l'audit (01/11)

| # | Point | Constat | Statut |
|---|---|---|---|
| S2 | Envoi de la séance | Aucune protection serveur contre un double envoi : si le réseau coupe APRÈS l'écriture, l'app met la séance en file et la renvoie → 2 enregistrements. Aucun doublon dans la base à ce jour (vérifié), mais le cas est possible. | **Corrigé** : identifiant d'envoi unique par séance (envoi, file d'attente, brouillon) ; le serveur ignore un envoi déjà reçu. Test `envoi-unique` (4 cas, ancienne app comprise). ⚠️ `index.ts` à redéployer. |
| S3 | Tableau des séries | Si la dernière fois comptait plus de séries que le programme (Pendulum 4 vs 3), la série en plus était cachée. | **Corrigé** : toutes les séries de la dernière fois s'affichent. Vérifié en capture. |
| S4 | Pré-remplissage | Charge et reps pré-remplies = cible de la règle, série par série (Pendulum : 60 × 9). | ✅ OK |
| S5 | Brouillon | Un brouillon qui correspond à une séance déjà enregistrée ce jour-là est effacé en silence ; l'identifiant d'envoi est conservé dans le brouillon. | ✅ OK |
| S6 | RPE non saisi | Ne bloque pas la progression (pas de valeur inventée) ; la saisie d'une série exige un RPE. | ✅ OK |
