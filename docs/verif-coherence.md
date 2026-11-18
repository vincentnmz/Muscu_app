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
- **Sur les vraies données**, avec la commande `node scripts/verif-coherence/verif.cjs <base.json> <appdata.json> [ecrans.txt] [AAAA-MM-JJ]`. Le 18/11, Vincent, Romain, Idris et Célia sont à **0 écart**.
- **Preuve sur les anciens écrans** (avant les corrections du 18/11) : il retrouve les erreurs corrigées le jour même (records mal datés, force 12 contre 11, « 12.5 kg », « Objectif semaine 1/3 » à côté de « 2/3 »). L'erreur de séries par muscle n'a pas pu être rejouée faute d'ancien relevé, mais le test permanent l'injecte et elle est attrapée.

## Bugs trouvés par le vérificateur lui-même
- 18/11 : « Objectif semaine 1/3 » à côté de « 2/3 séances » (semaine glissante) → libellé « lun → dim ».
- 18/11 : formats « 87.5 kg », « 86.0 », « 8.1h ».
- 18/11 : **changement d'heure** — l'app comptait les jours en millisecondes ; après le 25/10, la nuit (ou le questionnaire) de J-34 sortait de la fenêtre : normale du sommeil sur 27 nuits au lieu de 28, différente du serveur. Même défaut corrigé dans « ta normale » du bien-être et dans le graphique de régularité (un lundi passait dans la semaine d'avant au printemps).
- 18/11 : cibles : « RPE 10 sur toutes tes séries » alors que des séries étaient à 9 (Célia ×6, Idris ×4) → plage réelle « RPE 9-10 ».
- 18/11 : carte « Charge & fraîcheur » : « tonnage pondéré par l'effort » alors que la source est le tonnage brut (charge × reps) → « tonnage : charge × répétitions ».

## Ce qu'il vérifie aujourd'hui
| Règle | Ce qui est recalculé |
|---|---|
| records | meilleure série à vie (charge, puis reps), datée de la **première** fois |
| séances | jours distincts depuis lundi, et sur 7 jours glissants |
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
| cibles « Ce que Novalyz vise » | départ = meilleure série de la dernière séance ; raison vraie dans les séries (« RPE x sur toutes », « échec N séances de suite », « +1 rep sous N reps », « sous ta fourchette », « haut de fourchette → +N kg », « mêmes charges » si le moteur signale un ressenti en baisse) |
| phrases du classement | « Record : C kg × R le … », « Records : … », « a → b reps », « C × R → C × R », « N séries à R reps au lieu de M », « même niveau à RPE x au lieu de y », « Sous ta fourchette … », « Bloqué … depuis N séances » : chaque chiffre est vérifié dans les séries brutes |

## Pas encore couvert (prochaines règles, dans cet ordre)
1. Les leviers « Pourquoi ça bloque » (repos réel, fréquence, volume cités).
2. Le plan de la semaine et le journal des décisions.
3. Les vues coach (Équipe, fiche) et le mail récapitulatif : mêmes chiffres que l'app.
4. Le contexte envoyé à l'IA : mêmes chiffres que l'app.
5. Le cardio.

Tant qu'une ligne de cette liste n'est pas couverte, sa fiabilité n'est **pas démontrée**.
