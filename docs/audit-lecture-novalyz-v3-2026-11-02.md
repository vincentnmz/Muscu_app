# Audit — Lecture Novalyz & recommandations : aller plus loin (02/11/2026)

Demande du porteur : « revoir les analyses, recommandations, lectures Novalyz pour aider l'athlète à performer et progresser — ne rien casser, améliorer ».
Méthode : code (`_lectureExos`, `_progSecondaire`, `_lxRecos`, `_leviersBlocage`, `_maLectureNovalyzBloc`, `_tjDepuisDerniere`, `renderCoachCoupDoeil`, `renderCorrelationBienEtre`) + **calculs sur tes 895 séries** (copie à jour au 02/11).
Légende : ✅ à garder tel quel · ⬆ à améliorer · ➕ nouveau · ⏳ pas encore (données insuffisantes).

## Ce qui est bien en place — on garde ✅
- **Classement des exercices** partagé athlète / coach / mail (record, progresse, sous la fourchette, bloqué, recule, baisse attendue) sur les vraies charges / reps / RPE ; progrès « secondaire » reconnu (plus de séries au top, même niveau à RPE plus bas).
- **Verdict** + « Ce que Novalyz lit » + **3 recos variées** (sous la fourchette avec options, « à pousser » avec la cible de la prochaine fois, bloqué, volume / régularité) ; contexte déload / reprise respecté.
- **Volume par muscle** au prorata, **fiabilité des données**, **effort à charge égale** (RPE qui monte), « Depuis ta dernière séance », cibles du jour.

## Ce que tes données permettent (vérifié)
- RPE et repos sur **100 %** des séries ; 21 exercices suivis sur ≥ 5 séances.
- Effort bien dosé : 98 % des séries à RPE ≥ 7 → un conseil « rapproche-toi de l'échec » serait faux pour toi.
- Reps stables d'une série à l'autre (−0,8 % en moyenne, quel que soit le repos) → un conseil « repos » n'est **pas** justifié par tes données.
- Sommeil → performance : **11** séances seulement avec une nuit mesurée la veille → trop peu pour conclure.

## Manques
| # | Constat | Amélioration |
|---|---|---|
| **L1** ⬆➕ | Le progrès est jugé **séance contre séance** (charge, puis reps) : pas de tendance sur plusieurs semaines, et le RPE n'entre pas dans le calcul. Ex. réel : Élévation latérale passe de 10 à 11 reps mais à RPE plus élevé → « en progrès », alors que la force estimée n'a pris que **+2,5 %** (contre +6,6 % sans le RPE). | **A — Force estimée corrigée par le RPE** par exercice (charge, reps et reps en réserve = 10 − RPE, plafonnées à 4), tendance sur 6 semaines. Tes données : Arrière épaule +26 %, Développé machine +16 %, Écarté +15 %, Élévation frontale +9 %, Décliné machine +3 %, Smith incliné **−2 %**. |
| **L2** ⬆ | **« Bloqué » : leviers génériques** (placer plus tôt, persister à RPE 8-9, repos) proposés à tous, sans regarder la cause. | **B — Diagnostic** : on teste les causes sur les données et on ne garde que celle qui est vraie → **un** levier. Causes testées : volume du muscle sous le minimum · effort qui monte à charge égale · bloqué en bas de fourchette · charge trop lourde pour la fourchette · muscle travaillé 1×/sem · sinon « aucune cause visible ». |
| **L3** ➕ | Les recos sont éparpillées (Aujourd'hui, Analyses, coach) et ne forment pas un **plan** ; rien ne dit si elles ont été suivies. | **C — Ton plan de la semaine** : 3 actions max, chacune avec sa raison chiffrée, cochées automatiquement quand la séance les réalise ; rappel sur Aujourd'hui. |
| **L4** ➕ | La fiabilité est **globale** ; une conclusion tirée de 3 séances s'affiche comme une tirée de 10. Le bloc « impact de l'état du jour sur le tonnage » (code présent mais **non affiché**) concluait dès **2** valeurs par groupe et comparait des séances différentes (jambes vs bras). | **D — Fiabilité par conclusion** (« sur 8 séances ») ; ce qui manque de données passe en « en apprentissage (11/20) » au lieu d'une conclusion. L'ancien bloc corrélation reste désactivé. |

## Non retenu pour l'instant ⏳
- Lien sommeil / forme → performance : à partir de 20 séances avec nuit mesurée (affiché « en apprentissage » d'ici là).
- Volume idéal personnel par muscle : plusieurs blocs de 4-6 semaines à volumes différents nécessaires.
- Poids / nutrition vs objectif : 6 pesées seulement.

Fourchettes : celles de l'app (catégorie d'exercice — gros / moyen 6-12, léger 8-20 — ou fourchette personnalisée du programme), confirmé par le porteur : « sur les gros exercices je descends à 6 reps minimum ».

Maquette : `mockups/lecture-novalyz-v3.html` (chiffres réels de tes données).
