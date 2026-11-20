# Vérificateur de cohérence des calculs (18/11/2026)

**Objectif fixé par le porteur : un calcul fiable à 100 %.** Chaque chiffre que l'app affiche doit être juste, et le même d'un écran à l'autre.

## Principe
`scripts/verif-coherence/verif.cjs` recalcule chaque chiffre directement à partir des séries brutes. Son code est écrit à part : rien n'est repris du moteur (`index.ts`, `app.js`). Il compare ensuite :
- les données servies par le serveur (`getAppData`) à son propre recalcul ;
- le texte affiché à l'écran à son recalcul, en vérifiant aussi que la même mesure est identique sur tous les écrans.

Quand une erreur passe le filet, on corrige le code **et** on ajoute la règle ici, pour qu'elle ne revienne jamais.

## Où il tourne
- **À chaque `npm test` et en intégration continue**, sur les 16 profils fictifs du banc. C'est bloquant : un écart fait échouer les tests.
- **Test du vérificateur lui-même** (`tests/verif-coherence.test.js`) : on injecte chaque type d'erreur trouvé lors des audits et on vérifie qu'il est attrapé. Un vérificateur qui ne détecte rien ne prouverait rien.
- **Sur les vraies données**, avec la commande `node scripts/verif-coherence/verif.cjs <base.json> <appdata.json> [ecrans.txt] [AAAA-MM-JJ]`. Le 18/11, Vincent, Romain, Idris et Célia sont à **0 écart**. Le 20/11, les **9 athlètes actifs** (+ Max, les deux Sébastien, Alizé, Hugo) : 2 écarts trouvés et corrigés (voir plus bas), puis **0 écart** partout.
- **Preuve sur les anciens écrans** (avant les corrections du 18/11) : il retrouve les erreurs corrigées le jour même (records mal datés, force 12 contre 11, « 12.5 kg », « Objectif semaine 1/3 » à côté de « 2/3 »). L'erreur de séries par muscle n'a pas pu être rejouée faute d'ancien relevé, mais le test permanent l'injecte et elle est attrapée.

## Bugs trouvés par le vérificateur lui-même
- 18/11 : « Objectif semaine 1/3 » à côté de « 2/3 séances » (semaine glissante) → libellé « lun → dim ».
- 18/11 : formats « 87.5 kg », « 86.0 », « 8.1h ».
- 18/11 : **changement d'heure** — l'app comptait les jours en millisecondes ; après le 25/10, la nuit (ou le questionnaire) de J-34 sortait de la fenêtre : normale du sommeil sur 27 nuits au lieu de 28, différente du serveur. Même défaut corrigé dans « ta normale » du bien-être et dans le graphique de régularité (un lundi passait dans la semaine d'avant au printemps).
- 18/11 : cibles : « RPE 10 sur toutes tes séries » alors que des séries étaient à 9 (Célia ×6, Idris ×4) → plage réelle « RPE 9-10 ».
- 18/11 : « bloqué à 50 × 7 depuis 3 séances » (mail) alors qu'une des 3 séances avait fait 8 → le palier affiché est le meilleur nombre de reps du plateau (app et serveur).
- 18/11 : mail : « (au Sun N, fin de la période) » au lieu de la date → corrigé (« au 15/11 »).
- 18/11 : contexte IA : « RPE moyen 9.2 » (point décimal que l'IA pouvait recopier) → « 9,2 ».
- 18/11 : cardio : « 11.6 km », « 1.7 km · 1.5 km/h » → virgule ; fenêtres « 4 sem. » (29 j → 28 j) et « Charge 7 j » (8 j → 7 j) alignées sur le serveur.
- 19/11 (retour porteur) : plan : Tirage trapèze fait mardi dans « dos jambes » mais le plan renvoyait vers « dos jambe 2 » comme s'il restait à faire ; Quadriceps / Ischios renvoyaient vers « dos jambes », déjà faite → le plan dit « tenté mardi (50 kg × 8, RPE 9) » et indique la PROCHAINE séance pas encore faite (aucune s'il n'y en a plus) ; fiche coach : l'action s'affiche sur la séance où l'exercice a été réellement fait.
- 20/11 (banc, profils `deux_seances_jour` et `seance_libre`) : 2 séances le même jour → « Full body A ✓ · 18 séries » (nom de la 1re, chiffres de la journée), exercices de la 2e invisibles, « 2/2 séances » pour 3 faites ; séance libre rattachée → la séance qu'elle remplace re-proposée. Corrigé ; une séance = date + nom partout (objectif, régularité, moyennes, points, bilan, mail).
- 20/11 (relance sur les 9 athlètes actifs, données du jour) : « Sous ta fourchette » à côté d'une cible inchangée (8 kg × 8) — seules les séries SOUS le minimum descendent, la série affichée (la plus lourde) restait identique sans que la phrase le dise → la phrase cite les séries concernées et leur cible (« sur 2 séries sur 3 : celles-ci passent à 7,5 kg × 8, ta série la plus lourde reste telle quelle »), sur la même série que la carte.
- 20/11 : petit pas hors grille (8 kg → 6,75 kg sur une poulie au pas de 1,25) et différent d'un écran à l'autre (« au choix » : 1 pas → 77,5 ; carte : −5 % → 75) → un seul calcul, multiple du pas juste sous −5 %. Règle `cible.petit_pas`.
- 20/11 : poids « 76.9 kg » et « ▼ 0kg » (onglet Forme) → « 76,9 », « = stable ».
- 18/11 : carte « Charge & fraîcheur » : « tonnage pondéré par l'effort » alors que la source est le tonnage brut (charge × reps) → « tonnage : charge × répétitions ».

## Ce qu'il vérifie aujourd'hui
| Règle | Ce qui est recalculé |
|---|---|
| records | meilleure série à vie (charge, puis reps), datée de la **première** fois |
| séances | séances (date + nom : 2 le même jour = 2, décision porteur 20/11) depuis lundi, et sur 7 jours glissants |
| tonnage | 7 derniers jours et les 7 d'avant (t) |
| volume par muscle | séries sur la fenêtre du réglage « semaine » (muscle secondaire = 0,5) |
| totaux | séries, répétitions, tonnage et séances à vie |
| progression | meilleure série et nombre de séries de chaque exercice, jour par jour |
| objectif de points | séances depuis lundi (règle des récompenses, calendaire) |
| écran : format | aucun nombre décimal avec un point |
| écran : force estimée | la tuile et la ligne du tableau donnent le même chiffre |
| écran : records | charge et date affichées identiques au recalcul |
| écran : séances « cette semaine » | même nombre sur Aujourd'hui, Entraînement et Volume ; libellé « lun → dim » quand ce n'est pas la même fenêtre |
| ta normale (bien-être) | 3 dernières saisies sur 7 jours contre les autres saisies des 5 semaines (≥ 7) : moyennes, état (dans / au-dessus / sous), compteur « dans N questionnaires » |
| moteur ↔ normale | raisons « fatigue » et « sommeil » du moteur identiques à la normale recalculée |
| montre : sommeil | moyenne des nuits ≥ 3 h sur 7 jours, normale J-34 → J-7 dès 14 nuits |
| montre : FC au repos | récente J-2 → J (≥ 2 mesures), normale J-30 → J-3 (≥ 14), hausse ≥ 5 bpm |
| montre : pas | moyenne de la semaine sans la journée en cours de synchronisation |
| fraîcheur | forme de fond (EWMA 42 j, plancher = moyenne réelle des 28 j), fatigue récente (EWMA 7 j), %, source (tonnage ou note de séance × durée) et son libellé |
| ACWR | 7 derniers jours ÷ (28 derniers jours ÷ 4), sur le tonnage |
| cibles « Ce que Novalyz vise » | départ = meilleure série de la dernière séance ; raison vraie dans les séries (« RPE x sur toutes », « échec N séances de suite », « +1 rep sous N reps », « sous ta fourchette » — y compris « sur N séries sur M : celles-ci passent à … », « haut de fourchette → +N kg », « mêmes charges » si le moteur signale un ressenti en baisse) ; petit pas = multiple du pas de l'appareil juste sous −5 %, identique sur tous les écrans |
| effort à charge égale | exercices et RPE avant → après du moteur = recalcul (4 dernières séances, 1re série à la charge max) ; phrases « Effort en hausse à C kg : RPE a → b » partout (Aujourd'hui, Résumé, Évolution) |
| leviers : repos cité | « Repos : X, stable » et « tu prends X, essaie Y » = repos réel des séries de travail de la dernière séance |
| coach ▸ Équipe | pour chaque athlète, sur SES séries : RPE 7 j, tonnage 7 j, évolution et sa référence « vs 7 j d'avant » |
| volume / fréquence des leviers | « Volume X : N séries/sem », « Fréquence X : F×/sem », « Travaillé F×/sem », « (N → M séries/sem) », « (F×/sem aujourd'hui) » = 4 semaines terminées, divisées par les semaines réellement couvertes |
| journal des décisions | statut de chaque action (atteint / pas atteint / pas tenté / non évaluable : vacances ou blessure ≥ 3 j), « Réalisé : … », « N / M tentée(s) », jours de pause cités |
| plan de la semaine | actions affichées = actions enregistrées au journal, compte « N / M fait », « Semaine dernière : … », « Rien à changer : muscle X séries/sem » |
| fiche coach | Aperçu, Analyses et Forme d'un athlète : mêmes règles que ses propres écrans (dont « Records — … », « Progresse — a→b reps ») |
| mail récapitulatif | séances, séries, reps, tonnage, RPE, jours de vacances, volume moyen par muscle, équilibres, records de la période, « bloqué » et « sous la fourchette » à la fin de la période ; HTML sans texte cassé ni point décimal |
| texte cassé (partout) | jamais « undefined », « NaN », « Invalid Date » ni date brute « Sun Nov … » |
| contexte envoyé à l'IA | dernier questionnaire, dernière séance (séries, RPE), séances depuis lundi, records récents, bloqués, sous la fourchette, volume de la semaine (et sa fenêtre), poids ; aucun point décimal |
| cardio | « N sorties ces 4 semaines (X km) » (28 jours, micro-sorties exclues), tuiles Sorties / Distance 4 sem., Charge 7 j (RPE × durée, marche = 0), chaque ligne d'historique (distance, durée, vitesse) |
| plan : séance et tentative | « Séance « X » » jamais une séance déjà faite cette semaine ; « Tenté <jour> : C kg × R à RPE x » = meilleure série de l'exercice cette semaine |
| phrases du classement | « Record : C kg × R le … », « Records : … », « a → b reps », « C × R → C × R », « N séries à R reps au lieu de M », « même niveau à RPE x au lieu de y », « Sous ta fourchette … », « Bloqué … depuis N séances » : chaque chiffre est vérifié dans les séries brutes |

## Pas encore couvert
Tous les blocs listés le 18/11 sont couverts. Restent hors vérificateur : la saisie de séance elle-même (formulaire), les écrans foot / multisport, les graphiques (dessin, pas les chiffres affichés à côté). À ajouter dès qu'ils portent un chiffre affiché.
