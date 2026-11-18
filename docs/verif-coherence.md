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

## Pas encore couvert (prochaines règles, dans cet ordre)
1. « Ta normale » du bien-être (comptes et moyennes) et la fraîcheur (charge et récupération).
2. Le classement des exercices (en progrès, bloqué, sous la fourchette) et les cibles de la prochaine séance.
3. Les pas, le sommeil et la FC de la montre (moyennes, jours incomplets).
4. Les vues coach (Équipe, fiche) et le mail récapitulatif : mêmes chiffres que l'app.
5. Le contexte envoyé à l'IA : mêmes chiffres que l'app.
6. Le cardio.

Tant qu'une ligne de cette liste n'est pas couverte, sa fiabilité n'est **pas démontrée**.
