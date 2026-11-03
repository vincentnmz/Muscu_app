# Audit coach — écran 4 : Fiche athlète ▸ Analyses (Progression) (03/11/2026)

Cap porteur : aider le coach à décider (faits, ce qui est proposé à l'athlète, actions) — pas de consignes, pas de texte écrit pour l'athlète.
Code : `_maCoachAttach` (les Analyses de l'athlète affichées dans la fiche), `_maApply` (côté coach : Évolution, Tendances, Photo & mensurations ; Résumé seulement en Croisé), `_maProgExo`, `_lv3DiagCardHtml`, fréquence par muscle (`w.days`).
Données : Vincent (copie 02/11), rejoué au 03/11. Captures : `mockups/audit-coach-progression-evolution-avant.png`, `…-tendances-avant.png`.

## Juste ✅ (vérifié)
- Mêmes calculs que l'athlète : force estimée (83 kg le 29/10 ; +7 kg sur l'année), meilleure série, record, régularité (3/12 semaines à l'objectif, 1,9 séance/sem), tonnage, répartition d'intensité (0 % lourd · 78 % moyen · 22 % léger sur 18 séries).
- « Pourquoi ça bloque » (Smith incliné) : mêmes faits que « ① À décider ».
- Anciens blocs coach (records, tendance mensuelle, volume hebdo) bien masqués.

## Constats
| # | Constat (vérifié) | Proposition |
|---|---|---|
| **G1** | Bouton **« Importer mes séances (montre & capteurs) »** affiché au coach (il ne peut pas importer la montre de l'athlète). | Masqué côté coach. |
| **G2** | **Textes écrits pour l'athlète** dans la vue coach : carte « Pourquoi ça bloque » (« ta fourchette », « attends-toi à… », « ta meilleure série », « C'est toi qui choisis / décides »), explications (« ta meilleure série… tu vois d'un coup si tu montes… », « qu'il te restait », « tes séries »), Cardio « CHOISIS TON ACTIVITÉ ». | Côté coach : « sa fourchette », « **Proposé à l'athlète** : 75 kg (ou 70 kg) », explications neutres ; même ton que « ① À décider ». |
| **G3** | **Moyennes sur le mois entier en début de mois** : « Fréquence par muscle · ce mois-ci » divise par 4 semaines alors qu'on est le 3 → pecs, triceps, épaules, trapèze à **0,3×/sem en rouge** (1 séance en 3 jours). **Touche aussi l'athlète.** | Diviser par les **jours écoulés** de la période en cours (le 03/11 : 3 jours → on n'affiche pas de fréquence tant qu'il y a moins de 7 jours, ou on prend les 4 dernières semaines). |
| **G4** | **Mois par défaut le 3 du mois** : Évolution = 1 seul point (« 7.5×10 — 1 séance »), tonnage = 1 point. | Côté coach : période par défaut **Année** dans Évolution (toute l'histoire de l'exercice), 4 dernières semaines dans Tendances. |
| **G5** | **Exercice ouvert par défaut** = le plus souvent fait (Élévation latérale), pas celui qui demande une décision. | Ouvrir d'abord l'exercice du 1er point « À décider » (Smith incliné), sinon le plus fait. |
| **G6** | Tableau « Dernières séances » : colonne **« 1RM »** alors que c'est la force estimée (avec le RPE) ; « 7.5×10 » avec un point, « 9,5 » avec une virgule. | « Force est. » ; virgule partout. |
| **G7** | **Planning de la semaine** (« Glisse une séance sur un jour ») en bas d'Évolution — il existe déjà dans l'onglet Programme. | Retiré d'Analyses (reste dans Programme). |

À noter (pas un défaut) : avec les nouvelles cibles intermédiaire (redéployées), le plan de Vincent propose maintenant « Quadriceps +4 séries de Pendulum · Ischio +4 séries de Leg curl ».

## Réalisé (03/11, validé porteur)
- **G1** Bouton « Importer mes séances (montre) » masqué dans la fiche coach (rendu à l'athlète en sortant).
- **G2** Ton coach : les phrases adressées à l'athlète sont réécrites dans la fiche (« sa fourchette », « sa meilleure série », « Proposé à l'athlète : … », « on voit s'il monte… », « Activité » ; « C'est toi qui choisis / décides » retiré). L'athlète garde ses textes (vérifié).
- **G3** Fréquence par muscle : divisée par les jours écoulés de la période en cours ; moins de 7 jours → « Pas encore assez de recul (3 jours) » au lieu de « 0,3×/sem » en rouge. **Vaut aussi pour l'athlète** (vérifié).
- **G4** Côté coach : Année par défaut (Évolution et Tendances) — la maquette disait « 4 dernières semaines » pour Tendances, mais l'app n'a que Semaine / Mois / Année ; Année retenu (tonnage par semaine sur l'année).
- **G5** Exercice ouvert par défaut = celui du 1er point « À décider » (Smith incliné pour Vincent).
- **G6** Colonne « Force est. » (avec le RPE, avant : formule sans RPE sous l'étiquette « 1RM ») ; virgule dans les charges (« 7,5×10 »).
- **G7** Planning retiré d'Analyses (reste dans l'onglet Programme).
- Tests : 77 suites vertes. Captures relues : `mockups/coach-progression-apres-evolution.png`, `…-tendances.png`.
