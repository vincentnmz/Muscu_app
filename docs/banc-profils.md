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
| `gene_poignet` | gêne 4/5 au poignet : règle par exercice (couché, militaire en pause) |
| `douleur_autre` | gêne 3/5 zone « Autre » : rien en pause, ligne de prudence |
| `nouveau_vide` | compte neuf, aucune donnée |
| `sous_fourchette` | saut de charge, séries sous la fourchette à RPE 10 |
| `coach_sans_propositions` | athlète suivi, propositions Novalyz coupées par le coach |
| `coach_equipe` | **espace coach** : accueil coach + fiche (Aperçu) de 5 athlètes (plateau, douleur, sous la fourchette, propositions coupées, poignet) |

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
| B1 | ✅ **corrigé 14/11 (préprod)** — Élevée | douleur_vigilance | Douleur **forte** à l'épaule déclarée aujourd'hui, mais le plan de la semaine et le « Levier » proposent « +4 séries de Développé militaire » (exercice d'épaule). La douleur n'apparaît qu'en 2e cause (« Possible : gêne épaule »). |
| B2 | ✅ corrigé 14/11 — Moyenne | douleur_vigilance | Aujourd'hui dit « À surveiller » (douleur forte), Analyses dit « Ton état du jour appelle à la vigilance » : deux niveaux différents pour le même état. |
| B3 | ✅ corrigé 14/11 — Moyenne | coach_sans_propositions | Coach a coupé les propositions, mais Aujourd'hui affiche « Reco du jour : 3 exercices à pousser » et Analyses une « Reco entraînement » (protéines). |
| B4 | ✅ corrigé 14/11 — Faible | nouveau_vide | Aujourd'hui ▸ Reco du jour : « Données insuffisantes pour établir une tendance. » (jargon ; masqué sur Forme mais pas ici). |
| B5 | ✅ corrigé 14/11 — Faible | tous | Muscle sans accent ni majuscule dans les phrases : « Volume epaule », « exercices d'epaule ». |
| B6 | ✅ corrigé 14/11 — Faible | tous | Forme : « ACWR 0.97 » (point au lieu de virgule), « Forme de fond 2864 / Fatigue récente 2253 » (chiffres bruts sans unité). |
| B7 | ✅ pas un défaut — À vérifier | tous | Forme ▸ « Ressenti & bien-être · 7 derniers jours » affiche « — » malgré 4 questionnaires en 7 jours (peut venir du profil fictif : champ `ressenti_global` non rempli). |

## Suivi
- **B1 corrigé (14/11, préprod)** : « gêne active » = douleur ≥ 3/5 au **dernier** questionnaire (≤ 7 j) sur une zone
  sollicitée par le muscle (`_lv3GeneActive`, table des zones validée le 09/11). Diagnostic : la gêne passe en 1re cause,
  levier « n'ajoute ni charge ni séries… garde ta charge ou allège (avis kiné si ça persiste) ». Plan de la semaine : les
  actions sur la zone sont **en pause** (affichées, hors compteur, jamais envoyées au journal), elles reviennent quand le
  questionnaire ne signale plus la gêne. Défaut trouvé au passage : « Dos » devenait « do » (`_musKey`) → la gêne n'était
  jamais reliée au dos ; corrigé (`_lv3Cle`). Tests `gene-active` + référence du banc mise à jour (profil douleur_vigilance).
- **Mail récap aligné (14/11, préprod)** : `_rcGeneActive` (serveur) = même règle que l'app (test : mêmes réponses sur
  10 cas). Le mail signale d'abord la gêne (« n'ajoute ni séries ni charge pour : épaules… ») et ne propose plus de séries,
  de « débloquer » ni de charge sur un muscle touché. **`index.ts` : déploiement prod manuel** (même lot que L1).
- **Zones (14/11, porteur — option A)** : **nuque / cou** → trapèzes, épaules, dos ; **« Autre » ou zone vide** (≥ 3/5) → rien
  en pause, ligne « ⚠ Gêne N/5 signalée le … (zone non précisée) : allège les exercices qui la réveillent, avis kiné si ça
  persiste » sous le plan de la semaine et dans le mail récap. Profil `douleur_autre` ajouté au banc.
- **Plus tard (option B, décidée)** : règle par **exercice** (articulations sollicitées par exercice dans le catalogue :
  développé couché → poignet, épaule ; squat → genou, lombaires…), à relire exercice par exercice avec le porteur.
- **B2-B7 (14/11, préprod, affichage seulement)** : B2 Analyses ne répète plus l'état du jour (il vit sur Aujourd'hui) ·
  B3 coach a la main → plus d'« exercices à pousser » ni de conseil d'entraînement Novalyz (Aujourd'hui, Analyses) ·
  B4 « Données insuffisantes… » masqué ; sans données, l'en-tête de Forme invite au questionnaire (et non « Bonnes
  conditions… », erreur attrapée par le banc pendant la correction) · B5 muscles lisibles (« épaules », « ischios ») ·
  B6 « ACWR 0,97 », milliers séparés, unité expliquée sous « Forme de fond / Fatigue récente » · B7 pas un défaut : le bloc
  Ressenti est replié par défaut et le « — » était le bloc Poids ; le banc déplie maintenant Ressenti (couvert).
- **Gêne par exercice (option B, 14/11, préprod)** : table exercice → zones (135 exercices, validée) branchée dans l'app
  (diagnostic, plan, « Ce que Novalyz vise ») et le mail récap ; s'ajoute à la règle par muscle. Volume « +N séries » en pause
  si un exercice du programme pour ce muscle sollicite la zone. Profil `gene_poignet`. Les profils du banc utilisent
  désormais les **noms exacts du catalogue** (le banc a montré qu'un nom hors catalogue n'est protégé que par la règle par
  muscle — limite connue : exercices privés de coach ou renommés).

## Banc coach (14/11) — 1re relecture, constats (aucune correction)

| # | Gravité | Écran | Constat |
|---|---|---|---|
| **C1** | **Élevée** | Fiche coach ▸ À décider + ligne « Plan de la semaine » | Athlète avec **gêne forte à l'épaule** : la fiche affiche « **Proposé à l'athlète** : +4 séries de Développé militaire / Tirage vertical / Développé couché / Rowing » et liste l'action Épaule du plan **sans « en pause »**, alors que l'athlète ne voit plus ces propositions (gêne active). Faux pour le coach. |
| **C2** | Moyenne | Fiche coach | Athlète dont le coach a **coupé les propositions** : « Plan de la semaine proposé à l'athlète … (calculé par Novalyz, **le même que voit l'athlète**) » et « Novalyz : +4 séries » — l'athlète ne voit aucune proposition. Phrase fausse. |
| C3 | Faible | Fiche coach | Muscle sans accent dans la ligne du plan (« Epaule : 8 séries cette semaine »). |
