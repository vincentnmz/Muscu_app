# Audit Lecture Novalyz · Cardio & Croisé — 29 oct. 2026

> Méthode : copie des données réelles de Vincent mise à jour au 29/10 (séance « pec epaule 2 » du jour incluse),
> **vrai `index.ts` actuel** rejoué dessus, puis écrans Analyses ▸ Cardio et ▸ Croisé rendus par le vrai front,
> en Semaine, Mois et Année. Chaque phrase a été confrontée au code et aux données.
> « Vérifié » = constaté sur le code ET sur les données.

## Défauts trouvés

| # | Gravité | Où | Défaut | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| 1 | **Élevée** | Croisé › répartition + Lecture + reco | **Muscu et cardio ne sont pas comptés dans la même unité.** Muscu = tonnage ÷ 50 (« proxy simple »), cardio = RPE × durée. Une marche de 30 min à RPE 6 (180) pèse plus qu'une séance muscu de 5,5 t (110). Année : « Charge surtout **cardio (83 %)** → **Ajoute du renforcement musculaire** » à quelqu'un qui fait 4 séances de muscu par semaine. | Vérifié : app.js `_maCroise` (`muscuUA = tonnage/50`). Rejeu : cardio 27 540 UA vs muscu 5 093. | Même unité des deux côtés : **RPE de la séance × durée** (méthode sRPE). La durée muscu est **estimée** depuis les repos réels saisis + temps de série. La durée réelle de séance n'est pas enregistrée (`duree_muscu` vide). **→ décision** |
| 2 | **Élevée** | Croisé (Année surtout) | **La marche du quotidien compte comme de l'entraînement cardio** : 106 marches importées de la montre = **82 %** de la charge cardio de l'année (22 710 / 27 540 UA). Sans RPE saisi, l'app suppose un effort de 5/10. | Vérifié : rejeu, `_chargeInterneCardio` (RPE 5 par défaut). | Marche = **activité** (comme les pas), **exclue de la charge d'entraînement** (ou comptée à moitié). **→ décision** |
| 3 | Moyenne | Cardio › bandeau de période (Mois / Année) | « 2 sorties enregistrées. **Continue** pour bâtir ta base d'endurance » juste sous la Lecture « Forte baisse (−94 %) — reprends progressivement ». Contradiction. | Vérifié : texte fixe app.js `_maCardioResume`. | Phrase factuelle sans « Continue » : « 2 sorties ce mois-ci (3,5 km). » |
| 4 | Moyenne | Cardio › Pas quotidiens (Année) | Le graphe s'arrête au **08/09** : il lit l'ancienne source (`pasjour_`, ancienne synchro), pas la montre via Health Connect (`sante_`, à jour au 29/10). « Ø 9 689 pas/jour » sur l'année est donc faux. | Vérifié : `_maCardioResume` lit `data.pas_quotidiens` ; `sante_historique` contient les pas jusqu'au 29/10. | Fusionner les deux sources (la montre prime), comme le fait déjà l'écran Forme. |
| 5 | Faible | Croisé › « Fiabilité : … bien-être N relevés » | Compte des **tranches de temps**, pas des relevés : Année « 3 relevés » (**34** en réalité), Mois « 5 relevés » (**16** en octobre). | Vérifié : `nForme` = nombre de tranches (jours, semaines ou mois) non vides. | Compter les vrais relevés de la période. |
| 6 | Faible | Croisé › Fiabilité (Année) | « bonne · **52 sem.** » alors que les données commencent mi-mai (cardio) / juin (muscu). | Vérifié : `nWeeks = jours de la période / 7`. | Semaines **réellement couvertes** par des données. |
| 7 | Faible | Croisé › « Charge d'entraînement ↓ −39 % **sur 4 sem.** » / « −55 % sur 52 sem. » | C'est en réalité la **2ᵉ moitié vs la 1ʳᵉ moitié** de la période, pas une évolution « sur 4 sem. ». | Vérifié : `_half()` + `chSub`. | « −39 % (2ᵉ quinzaine vs 1ʳᵉ) » / « (2ᵉ semestre vs 1er) ». |
| 8 | Info | Cardio › Tous sports (Année) | « Vélo 18 sorties · 10h39 · **0,9 km** · 3,3 km/h » : la distance ne compte que les sorties qui en ont une, et la vitesse est la moyenne des vitesses saisies, d'où l'incohérence. « Footing 1 sortie · 1 min ». | Vérifié : `_maCardioAgg`. | À traiter dans l'**audit Cardio par sport** (déjà prévu). |

## Vérifié juste
- Lecture Cardio (4 sem.) : « 2 sorties (3,5 km) », « forte baisse −94 % », reco « Reprends progressivement » — conforme aux données (02 et 03/10) et au correctif #3 du 28/10.
- Repères cardio : « Sorties 4 sem. 2 · 3,5 km · Charge 7 j 0 UA ».
- Croisé (Semaine) : « que de la musculation », « Récupération Excellent · disponibilité Prêt » (= moteur), « 3 séances » (26, 27, 29/10), « Forme 95/100 », « 3 relevés » (26, 27, 29/10 : juste par coïncidence, voir #5).
- Charge cardio Mois : 248 UA la semaine du 01/10 (2 marches, 62 min), puis 0.
