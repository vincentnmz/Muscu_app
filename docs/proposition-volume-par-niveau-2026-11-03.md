# Proposition — volume cible par niveau (03/11/2026, option b validée par le porteur)

**À corriger par le porteur avant mise en place.** Une seule table serveur, lue partout (athlète, coach, mail, plan de la semaine).

## Ce que disent les sources (vérifié, avec leurs limites)
- **Schoenfeld, Ogborn & Krieger 2017** (méta-analyse, 15 études) : plus de séries/semaine → plus d'hypertrophie, jusqu'à **10+ séries/muscle/semaine** ; pas assez de données au-delà.
- **Baz-Valle et al. 2022** (revue, J. Hum. Kinet., hommes entraînés 18-35 ans, ≥ 1 an) : **12-20 séries/muscle/semaine** proposé comme repère ; pas de différence nette avec > 20 (quadriceps, biceps), avantage du haut volume seulement pour le triceps.
- **Pelland et al. 2024** (préprint, 67 études) : plus de volume = plus de muscle, avec **rendements décroissants** ; les séries « indirectes » comptent pour **0,5** (méthode la mieux soutenue) — c'est déjà ce que fait Novalyz (secondaire = 0,5).
- **ACSM 2009** : les débutants progressent **autant avec peu de séries** qu'avec beaucoup ; volume plus élevé recommandé pour les entraînés. (Mise à jour ACSM 2026 citée par des sources secondaires : ≥ 10 séries/muscle/semaine — non vérifiée sur le texte original.)
- Débutantes non entraînées, mollets : **6, 9 et 12 séries/semaine** font toutes grossir, un peu plus à 12.

## Proposition (séries/semaine, séries indirectes comptées 0,5)
| Muscle | Débutant (0-3 ans) | Intermédiaire (4-7) | Avancé (8-10) | Expert (11+) |
|---|---|---|---|---|
| Pectoraux, dos, quadriceps, fessiers, ischios | **6-10** | **10-16** | **12-20** | **12-20** |
| Épaules, biceps, triceps, mollets | **4-8** | **8-14** | **10-18** | **10-18** |
| Abdominaux | **4-8** | **6-12** | **8-14** | **8-14** |
| Trapèze, avant-bras, adducteurs | pas de cible (comptés s'ils sont travaillés, jamais d'alerte) | | | |

Ce qui vient **directement** des sources : le seuil ≥ 10 (intermédiaire), 12-20 (entraînés), « peu suffit » au début.
Ce qui est **mon interpolation** (à valider) : les chiffres débutant, les petits muscles plus bas (ils reçoivent déjà du volume indirect à 0,5), les abdos, avancé = expert (aucune étude ne les distingue).

Le **minimum** déclenche les signaux « sous le minimum » et le « +N séries » du plan ; l'**optimum** sert de repère haut.

## Aujourd'hui (pour comparaison)
- Serveur (athlète) : une table pour tous — pecs 8-14, dos 10-16, épaules 8-14, biceps 8-14, triceps 6-12, quadriceps 8-14, ischio 6-12, fessier 8-14, mollets 8-14, abdos 6-13.
- App (coach) : pecs 8-12 / 12-16 / 16-20 / 16-20 selon le niveau, source inconnue ; trapèze 10-14 inventé.

## Sources
- Schoenfeld 2017 : https://researchgate.net/profile/Brad-Schoenfeld/publication/305455324
- Baz-Valle 2022 : https://pmc.ncbi.nlm.nih.gov/articles/PMC8884877/
- Pelland 2024 (préprint) : https://sportrxiv.org/index.php/server/preprint/download/460/967/908
- ACSM 2009 : https://sfu.ca/~ryand/kin343/ACSMresistance.pdf
- Mollets 6/9/12 séries (via Stronger by Science) : https://www.strongerbyscience.com/?p=61503

## Retour porteur (03/11) : débutant « 6-12 partout » + lien avec les programmes Novalyz
Programmes **débutant** proposés par Novalyz (vrai générateur `_genProgramme2`, vrai catalogue, 3 séries/exercice, 75 min), séries/semaine (indirect = 0,5) :

| Programme | Pecs | Dos | Épaules | Biceps | Triceps | Quadri | Ischio | Fessier | Mollets | Abdos |
|---|---|---|---|---|---|---|---|---|---|---|
| Full Body découverte 2 j | 6 | 6 | 6 | 9 | 9 | 6 | 9 | **1,5** | 6 | **0** |
| Full Body 3 j | 9 | 9 | 9 | 13,5 | 13,5 | 9 | 12 | **3** | 9 | **0** |
| PPL 3 j | 9 | 12 | 9 | 10,5 | 10,5 | 9 | 11 | **5,5** | **4** | **0** |
| Upper / Lower 4 j | 12 | 12 | 12 | 12 | 13,5 | 12 | 17 | 8,5 | 8 | 6 |
| Split 5 j | 12 | 15 | 12 | 13,5 | 12 | 9 | 11 | **5,5** | **4** | **4** |

Avec « 6-12 partout » pour le débutant : pecs / dos / épaules / bras / quadriceps / ischios **atteignent le minimum dans les 5 programmes** (Full Body 2 j pile à 6). En revanche **fessiers, mollets, abdos** sont sous 6 dans 3 à 4 programmes → l'app signalerait « sous le minimum » dès la 1re semaine d'un programme qu'elle a elle-même proposé (même défaut que P3 du 01/11).
