# Banc de profils — filet permanent contre les phrases fausses (14/11/2026)

## Ce que c'est
8 profils **fictifs** (aucune donnée réelle) passent par la **vraie chaîne** : base en mémoire → vrai `handleGetAppData`
(`index.ts`, date figée au jeudi 12/11/2026 18:00) → vraie app (`index.html` + `js/*`) dans Chromium (horloge et hasard
figés, réseau coupé). Tout le texte affiché sur **Aujourd'hui**, **Analyses ▸ Résumé (muscu)** et **Forme** est comparé à
`tests/banc-profils/<profil>.txt`. La moindre phrase qui change fait échouer `npm test` et la CI, avec la ligne avant / après.

| Profil | Cas couvert |
|---|---|
| `debutant_regulier` | débutant, 3 semaines, progrès réguliers, normale pas encore établie |
| `intermediaire_plateau` | oscillation 9-10 reps (cas John), vrai progrès au couché |
| `avance_pause` | avancé, pause dans la période de comparaison |
| `montre_sommeil` | montre, 30 séances avec nuit, épisodes de nuits courtes (sommeil → performance) |
| `douleur_vigilance` | douleur forte à l'épaule + fatigue déclarées aujourd'hui |
| `nouveau_vide` | compte neuf, aucune donnée |
| `sous_fourchette` | saut de charge, séries sous la fourchette à RPE 10 |
| `coach_sans_propositions` | athlète suivi, propositions Novalyz coupées par le coach |

## Utilisation
- `npm test` (ou `node scripts/banc-profils/run.mjs`) : compare. Sans Playwright sur la machine : « ignoré » ; en CI il tourne toujours.
- Une phrase change **volontairement** → relire les lignes « + » / « − », puis `node scripts/banc-profils/run.mjs --maj <profil>`
  et committer le `.txt` avec le changement (la relecture fait partie de la livraison).
- Nouveau cas trouvé par un audit ou un testeur → l'ajouter dans `scripts/banc-profils/profils.js`.

## ⚠️ Statut des fichiers attendus
Ils photographient l'app **au 14/11 (préprod, commit du banc)** : ils protègent contre les changements **non voulus**, ils ne
certifient pas que tout est juste. Première relecture (14/11) — constats à traiter (décision porteur) :

| # | Gravité | Profil | Constat |
|---|---|---|---|
| B1 | **Élevée** | douleur_vigilance | Douleur **forte** à l'épaule déclarée aujourd'hui, mais le plan de la semaine et le « Levier » proposent « +4 séries de Développé militaire » (exercice d'épaule). La douleur n'apparaît qu'en 2e cause (« Possible : gêne épaule »). |
| B2 | Moyenne | douleur_vigilance | Aujourd'hui dit « À surveiller » (douleur forte), Analyses dit « Ton état du jour appelle à la vigilance » : deux niveaux différents pour le même état. |
| B3 | Moyenne | coach_sans_propositions | Coach a coupé les propositions, mais Aujourd'hui affiche « Reco du jour : 3 exercices à pousser » et Analyses une « Reco entraînement » (protéines). |
| B4 | Faible | nouveau_vide | Aujourd'hui ▸ Reco du jour : « Données insuffisantes pour établir une tendance. » (jargon ; masqué sur Forme mais pas ici). |
| B5 | Faible | tous | Muscle sans accent ni majuscule dans les phrases : « Volume epaule », « exercices d'epaule ». |
| B6 | Faible | tous | Forme : « ACWR 0.97 » (point au lieu de virgule), « Forme de fond 2864 / Fatigue récente 2253 » (chiffres bruts sans unité). |
| B7 | À vérifier | tous | Forme ▸ « Ressenti & bien-être · 7 derniers jours » affiche « — » malgré 4 questionnaires en 7 jours (peut venir du profil fictif : champ `ressenti_global` non rempli). |
