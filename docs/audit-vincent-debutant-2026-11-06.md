# Vérification des phrases d'analyse — Vincent + cas débutant (06/11/2026)

**Méthode.** Base Supabase à jour, lue sans rien modifier (dump `.work/v8/db_vincent.json`). Le vrai `index.ts` est rejoué sur ce dump, puis l'app est ouverte dans Chromium (date fixée au 06/11 14 h). Chaque phrase affichée est recalculée à part, en Python, à partir des données brutes.

Sauf mention contraire, « vérifié » veut dire : chiffre recalculé et identique.

## 1. Vincent (intermédiaire, 4 ans)

### Aujourd'hui — fait avant (voir l'échange précédent)
- Tout est vérifié juste : séance 16 séries / 5,1 t / RPE 9, records, montre, pas, sommeil, reco, plan, régularité 3/4.
- À discuter : « Ma semaine » marque « non faite » des séances prévues alors que des séances **Libre** ont été faites ces jours-là.

### Analyses ▸ Résumé
| Phrase affichée | Vérifié contre | Résultat |
|---|---|---|
| 15 exos en progrès (dont 5 records) · 1 bloqué | classement | ✅ |
| Records : Ecarté 12,5 × 8 · Traction 10 × 2 · Belt squat 200 × 7 +2 | séries : 12,5 kg jamais fait avant · lest 10 kg nouveau · 200 × 5 (16/10) → 200 × 7 | ✅ (« +2 » = 2 autres records non listés) |
| Progresse : Tirage RPE 8 au lieu de 9 · Leg extension RPE 8,5 au lieu de 9 · Élévation frontale 2 séries à 10 au lieu de 1 +7 | 80 × 7 RPE 9 → 8 ; 60 × 8 RPE 9 → 8/9 ; 7,5 kg : 10/7 → 10/10 | ✅ — mais **« +7 » collé à « au lieu de 1 » se lit comme « +7 reps »** (il veut dire « 7 autres exercices ») → **à discuter** |
| Bloqué : Élévation latérale 7,5 × 10 depuis 3 séances, pourquoi / levier | séries 29/10 → 05/11, tableau validé | ✅ conforme au tableau validé |
| Force 6 sem : Arrière épaule +26 % (9 séances), Smith −1,1 % (5 séances) | recalcul (moyenne 2 dernières vs 2 premières) : +25,9 % · −1,07 % | ✅ |
| Plan : Smith 75 (ou 70) ✓ fait · Quadriceps 6/10 · Ischio 6/10 | 70 × 7 le 06/11 ; quadriceps 6 ; ischio 4 + 0,5 × 4 (belt squat) = 6 | ✅ |
| Moyenne quadriceps 5,5/sem, ischio 4,3/sem · « Rien à changer : pectoraux 13,8 · épaule 13,8 · dos 15,3 » | 4 semaines terminées (05/10 → 01/11), secondaires à 0,5 : 5,5 · 4,25 · 13,75 · 13,75 · 15,25 | ✅ |
| Volume de la semaine : Pec 15 · Dos 10 · Quad 6 · Ischio 6 · Épaule 18 · Biceps 5 · Triceps 4,5 · Trapèze 3 | recalcul | ✅ |
| Cette semaine : 6,1 t/séance · 3 séances · 53 séries · 519 reps · RPE 8,6 | recalcul (6,14 · 8,64) | ✅ |
| Note des séances 6 vs RPE des séries 8,6 | bilan 6/6/6 | ✅ |
| Balance Pec 60/40 Dos · Quad 50/50 · Biceps 53/47 | 15/10 · 6/6 · 5/4,5 | ✅ |
| Records personnels : Belt squat 200 kg 05/11 · Presse 134 kg 17/08 · Dév. machine 100 kg 02/07 · Smith 80 kg 15/10 | date de la **meilleure série** à la charge max (200 × 7, 134 × 8, 100 × 7, 80 × 3) | ✅ règle cohérente. 200 kg avait déjà été fait le 16/10 (× 5) ; on n'affiche que les kg, sans les reps → **à discuter** |
| Fiabilité 100/100, sommeil → perf 15/20 | — | non recalculé (supposé) |

### Analyses ▸ Évolution (Élévation latérale)
| Phrase | Résultat |
|---|---|
| 18 séances suivies · bloqué à 7,5 × 10 depuis 3 séances · force estimée 10 kg | ✅ (7,5 × (1 + 11/30) = 10,25) |
| Pourquoi ça bloque : repos 2 min stable · RPE 9 · « Possible : 5 kg 16 → 19 reps / 7,5 kg 11 → 10 » | ✅ |
| **« Ce que Novalyz vise : 7,5 kg × 10 · +1 rep (haut de fourchette : 20) · 2 séries à RPE 9-10 gardées telles »** | ❌ **CONTRADICTOIRE.** Le « +1 rep » vient du calcul de l'écran de saisie (`_progDecision`), qui l'applique à la **série à 5 kg** (19 → 20, car RPE 7). La ligne juste en dessous dit « garde ta série à 5 kg au niveau d'avant (≈ 16 reps) ». En séance, la cible de la série 1 serait donc 5 kg × 20, l'inverse du levier. De plus, la flèche affiche 7,5 × 10 → 7,5 × 10 avec le texte « +1 rep » : le +1 rep ne correspond pas au chiffre montré. *(Vérifié dans le code ; écran de saisie pas encore rendu.)* |
| Volume épaule **15,8**/sem · fréquence **1,8**×/sem (« pas en cause ») | ⚠️ Chiffres justes, mais calculés sur les 28 derniers jours. Le Résumé dit **13,8** et Tendances **1,5×/sem** (4 semaines terminées). Même donnée, 2 fenêtres, 2 chiffres → **à aligner** |

### Analyses ▸ Tendances
| Phrase | Résultat |
|---|---|
| Régularité, 12 semaines : 2 0 1 1 4 0 2 2 4 2 4 3 · 3/12 à l'objectif · 2,1/sem · série 1 | ✅ |
| Tonnage de la semaine 18,4 t · « +67 % non représentatif (pause de 12 jours) » | ✅ (pause du 19/08 au 02/09 enregistrée) |
| Répartition sur 53 séries : lourd 4 % · léger 13 % | ✅ (2 et 7 séries) |
| Fréquence par muscle (4 semaines terminées) | ✅ fenêtre annoncée, mais voir l'écart avec l'Évolution plus haut |

### Historique
- 05/11 : 6 exos · 19 séries · 8,8 t. 30/10 : 4 · 11 · 3,2 t. 29/10 : 6 · 18 · 4,2 t → ✅
- « RPE 6/7 » = note du bilan → ✅. Mais le libellé « RPE » est le même que pour le RPE des séries (8,6) → à discuter.

### Forme
- Pas : moyenne 6 220 ✅. FC repos : 60 ✅. Sommeil de la semaine : 7 h 23 ✅ (Aujourd'hui affiche 7 h 25 sur 7 nuits : autre fenêtre, annoncée).
- Charge : « −62 % de fraîcheur » affiché à côté de « tu encaisses bien ». Calcul : (2271 − 3676) / 2271 = −62 % → chiffre juste, mais **alarmant à côté d'un verdict positif** → à discuter.
- Poids 83 kg ▼ 1 kg (dernière pesée 15/09) ✅. La pesée a presque 2 mois et l'app ne le signale pas → à discuter.

## 2. Débutant

Deux variantes, rejouées sans rien écrire en base :

### 2a. Mêmes données, niveau débutant (annees = 1)
- Bloqué après **2** séances (règle débutant). 3 bloqués : T-bar row, Élévation latérale, Écarté poulie haute.
- T-bar 60 × 8 : « Effort en hausse : RPE 8,5 → 9 » → levier « garde 60 kg, vise RPE 8 » → ✅ cohérent ; « basé sur 2 séances · à confirmer » → ✅ honnête.
- Cibles de volume débutant 6-12, plan coché (minimum 6 atteint) → ✅ cohérent.
- Texte force : « À ton niveau, la force monte souvent d'une séance à l'autre » → ✅
- ⚠️ Le Résumé annonce **« 3 bloqués »** mais n'en nomme que **2**, sans « +1 » (les records et les progrès, eux, ont le « +N ») → à corriger.
- ❌ Même contradiction « +1 rep » dans « Ce que Novalyz vise » sur un exercice bloqué.

### 2b. Nouveau compte : 3 séances seulement (02, 05, 06/11), niveau débutant
| Phrase | Résultat |
|---|---|
| Fiabilité 63/100 « à compléter », 0 séance de comparaison | ✅ honnête |
| **Bloqué élévation latérale — Pourquoi : « Volume épaule 4,5 séries/sem (minimum 6) · Travaillé 0,5×/sem »** | ❌ **FAUX.** Il a fait **18 séries d'épaule** en 2 séances cette semaine. Le calcul divise toujours par 4 semaines (`_lv3Volume`) même quand le compte a 5 jours d'historique (18 / 4 = 4,5). Un vrai nouvel inscrit verra donc toujours « volume trop bas » et « fréquence trop basse ». |
| « Marche suivante : **+1,3 kg** = +17 % » | ⚠️ Le pas réel est de 1,25 kg, arrondi à l'affichage → « 1,25 » attendu |
| **Reco entraînement : « Mets de l'intensité : tes dernières séries doivent finir proches de l'échec »** | ❌ **FAUX dans ce contexte.** RPE moyen 8,6, plusieurs séries à RPE 10, et le même écran dit plus bas « chaque série va près de l'échec ». C'est une reco générique (`index.ts` : `pushReco` « info », toujours ajoutée) qui s'affiche quand il n'y a rien de plus prioritaire. |
| « Sur la bonne voie » avec 1 bloqué + 2 sous la fourchette, fiabilité 63 | ⚠️ verdict optimiste pour 3 séances → à discuter (dire plutôt « on apprend à te connaître ») |
| Aujourd'hui : « ta normale arrive après 7 saisies (0 pour l'instant) » | ✅ |
| Records personnels (Tirage 80 kg 06/11…) / « Records battus 0 » | ✅ (1ʳᵉ fois, rien à battre) |

## 3. Ce qu'il faut corriger (proposition, rien n'est codé)

1. **« +1 rep » sur un exercice bloqué** (Évolution + cibles de l'écran de saisie). Quand le diagnostic donne un levier, la cible doit le suivre : série à 5 kg gardée à ≈ 16, séries de travail gardées, plus aucun « +1 rep ». Le texte de la cible ne doit pas annoncer une hausse que le chiffre ne montre pas.
2. **Volume et fréquence d'un compte récent** (`_lv3Volume`) : diviser par les semaines réellement couvertes (comme le fait « Par groupe »), et ne pas conclure à « volume bas » avant 2 semaines d'historique. Utiliser la **même fenêtre** que le Résumé et Tendances (4 semaines terminées) pour ne plus avoir 13,8 / 15,8 et 1,5 / 1,8.
3. **Reco « Mets de l'intensité »** : seulement si le RPE moyen des séries est < 8.
4. « 3 bloqués » : nommer le 3ᵉ ou ajouter « +1 ».
5. « +1,3 kg » → « +1,25 kg ».
6. À discuter (pas faux) : « +7 » dans la liste des progrès, « −62 % de fraîcheur », ancienneté de la pesée, libellé « RPE » de la note du bilan dans l'Historique, verdict « Sur la bonne voie » à 3 séances, séances Libre dans « Ma semaine ».

Non couvert à ce stade : écran de saisie rendu, fiche coach (textes), clic de tous les écrans ordi et mobile.

## 4. Corrections faites (06/11, validées par le porteur)
1. **Exercice bloqué** : nouveau mode `bloque` dans `_progDecision`. Plus de « +1 rep » : charges et reps gardées, et la série d'avant est ramenée au niveau du diagnostic. Élévation latérale → cibles 5 × 16 · 7,5 × 10 · 7,5 × 10, texte « pas de +1 rep forcé… ta série à 5 kg revient à ≈ 16 reps ». Même calcul pour la saisie, Aujourd'hui et Évolution. Les exercices non bloqués ne changent pas (vérifié : Arrière épaule 7,5 × 11 → 12).
2. **Volume / fréquence** (`_lv3Volume`) : on divise par les semaines réellement couvertes (max 4). Moins de 2 semaines de recul → pas de conclusion. Le diagnostic prend la même période que le Résumé et Tendances (4 semaines terminées) : épaule 13,8 et 1,5× partout. Nouveau compte : la ligne « volume 4,5/sem, 0,5×/sem » a disparu.
3. **« Mets de l'intensité »** (`index.ts`) : seulement si le RPE moyen des séries sur 28 jours est < 8, chiffre cité. Vérifié : absent pour Vincent (8,4), présent à RPE 7.
4. « 3 bloqués » → 2 nommés + « +1 ». « +1,3 kg » → « +1,25 kg » (`_cdFmtKg` garde les quarts de kilo).
5. **Tendances ▸ Exercices en progrès** (question du porteur) : en vue Mois, un point = une semaine ; début novembre = 1 seule semaine → courbe vide avec le message faux « dès 2 séances ». Maintenant : « Sur cette semaine : 5 exercices en progrès sur 17 exercices réalisés… La courbe apparaît à partir de 2 semaines ».

Tests : `tests/audit-0611-corrections.test.js` (9 cas), suite complète 82/82. Captures ordi et mobile contrôlées. `index.ts` à redéployer pour le point 3.
