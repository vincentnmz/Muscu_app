# Audit des lectures de Vincent (18/11/2026)

**Méthode.** Base de prod lue sans rien modifier (copie à jour au 18/11 : 986 séries, 1 549 indicateurs, 45 questionnaires, mêmes comptes qu'en prod). Le vrai `index.ts` tourne sur cette copie, la vraie app est ouverte dans Chromium (sessions exigées), le texte de chaque écran est relevé (Aujourd'hui, Entraînement, Analyses ▸ 5 onglets + 33 exercices, État), puis chaque chiffre est recalculé à part. Aucune erreur JavaScript, aucun appel refusé.

« Vérifié » = recalculé sur les données et identique, ou tracé dans le code. « Déduction » = cause probable, pas prouvée.

## A. Faux

1. **« Effort en hausse à charge égale : Traction 10 kg, RPE 8,5 → 10 »** (Résumé, Évolution, moteur). **Faux, vérifié.** Les 27/10 et 30/10 étaient au poids du corps (0 kg), les 06/11 et 17/11 avec 10 kg de lest. Cause (code, `ressentiConcordant`) : quand la charge « avant » vaut 0, la variation de charge est forcée à 0 % → la hausse de charge est lue comme « charge égale ». Ici la Traction compte dans les 2 exercices qui déclenchent le signal « RPE ». Le verdict ne change pas (la fatigue suffit), mais chez un autre athlète cela peut suffire à déclencher le signal.
2. **Écran Évolution ▸ Traction contradictoire.** « Ce que Novalyz vise : 10 kg × 3, mêmes charges que la dernière fois » et, juste en dessous, « Levier : 5 kg (petit pas) ». Le plan dit « proposé 5 kg ». Vérifié dans le rendu.

## B. Incohérences entre blocs

3. **Aujourd'hui : trois messages qui se contredisent.** « Prêt à performer », « récupération excellente », puis « Charge en hausse : tu récupères moins bien : allège une séance », puis « si tu te sens frais, entraîne-toi normalement », et sur chaque exercice « pas de progression aujourd'hui ». Vérifié : le verdict « Prêt » n'exige pas une charge élevée plusieurs jours de suite (2 jours ici, 3 requis), alors que la ligne « Charge en hausse » ne regarde que la fraîcheur et le ressenti.
4. **« Charge en forte hausse » exagéré.** Les 7 derniers jours font 20,6 t contre 16,7 t en moyenne par semaine sur 4 semaines : **+24 %**. L'ACWR vaut 1,24, et le moteur le classe lui-même « normal ». Les −38 % de fraîcheur viennent du modèle sur le tonnage. Cause probable (déduction) : la semaine de vacances (une seule séance) fait baisser la « forme de fond », et la séance du 17/11 pèse 9,6 t, dont 4,8 t de Belt squat.
5. **Le plan affiché diffère du journal de la semaine.** Le journal du 16/11 a été figé lundi à 7 h 47 avec Quadriceps, Ischios et Tirage trapèze (RPE). L'écran montre Traction 5 kg, plus Quadriceps et Ischios en pause. Le journal évaluera donc une action qui n'est plus affichée, et jamais la Traction. Vérifié (table `decisions` contre écran). Cause probable : une modification de code du 16/11.
6. **Journal de la semaine du 09/11.** Il affiche « 1 / 3 réalisée » alors que les trois statuts sont « Pas tenté », « Pas tenté » et « Pas atteint » : « réalisée » y veut dire « tentée ». De plus, la semaine était déclarée en vacances du 09 au 13/11, et la mention « Pas tenté · aucune série » n'est pas juste pour une semaine de vacances.
7. **Fréquence du trapèze : 2 chiffres.** Évolution ▸ Tirage trapèze dit « Fréquence 2×/sem, pas en cause ». Tendances dit « Trapèze 0,4×/sem ». L'exercice lui-même a été fait 4 fois en 5 semaines. Le « 2× » compte le trapèze en muscle secondaire des élévations latérales.
8. **Deux fourchettes de reps.** Le programme dit 8-12 partout. Les analyses disent « ta fourchette est 8-20 » pour l'Écarté (catégorie petit) et 6-12 pour la Traction (catégorie gros), avec « +1 rep jusqu'à 20 ». Les catégories ont été voulues le 31/10, mais Vincent voit deux fourchettes différentes. **À trancher.**
9. **Plan ▸ Traction « séance dos jambes ».** Cette séance a déjà été faite mardi. La prochaine séance avec Traction est « dos jambe 2 », vendredi.

## C. Mineurs

10. « … au lieu de 1 +4 » : le « +4 » (= 4 autres exercices) se lit encore comme « +4 reps » (déjà noté le 06/11).
11. Records personnels : Belt squat 200 kg daté du 17/11, alors que le 05/11 avait le même 200 × 7 à un RPE plus bas. Tirage serré 80 kg daté du 13/11, identique au 23/10.
12. Pas : le 17/11 compte 3 040 pas synchronisés à 9 h 49 (journée incomplète), et ce chiffre entre dans la moyenne de 4 990.
13. Poids : la dernière pesée date du 15/09, et l'app ne le signale pas.
14. Le programme garde « Développé décliné à la Smith » (non assisté), alors que la séance du 16/11 s'est faite sur la version assistée. La cible se base donc sur le 02/11. **Question : passer le programme sur la version assistée ?**

## Vérifié juste

- Records du 17/11 (Traction 10 × 3, T-bar prise haute 60 × 7).
- Exercices en progrès : Leg extension 8 → 9, Leg curl 9 → 10, Élévation frontale 2 séries à 10.
- Écarté machine sous la fourchette : 30 × 9 → 30 × 9 → 30 × 8 → 32,5 × 6, saut de +8 %.
- Tirage trapèze : RPE 8 → 9 à 50 kg.
- Volume de la semaine : Pectoraux 9, Dos 7, Quadriceps 6, Ischios 4, Épaules 9, Trapèze 4,5, Biceps 3,5, Triceps 3, Fessiers 2.
- Équilibres musculaires : 56/44, 60/40, 54/46.
- Semaine en cours : 38 séries, 7,2 t par séance, note des séances 7,5 contre RPE des séries 9.
- Moyennes sur 4 semaines : pectoraux 12,3, quadriceps 3, ischios 2 (la semaine de vacances y compte).
- Volume +61 % (12 séances contre 8).
- Montre : sommeil 6 h 58 sur 5 nuits, FC au repos 61.
- Fatigue 2,7 contre une normale de 1,3 : la hausse est réelle (3/5 les 11, 14 et 17/11).
- Ma semaine, séance du jour, force estimée du Développé machine +13 %.

Non recalculé : sommeil → performance (16/20), score de saisie, récompenses, cardio (rien depuis le 03/10).
