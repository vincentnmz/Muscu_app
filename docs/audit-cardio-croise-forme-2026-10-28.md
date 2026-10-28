# Audit Cardio · Croisé · Forme — 28 oct. 2026

> Méthode : le **vrai** `handleGetAppData` (index.ts du repo) rejoué sur une **copie des données réelles**
> du compte Vincent (828 séries + séances du 26 et 27/10, 34 bien-être, 133 sorties cardio), puis les
> écrans Analyses ▸ Cardio (5 sous-onglets), Analyses ▸ Croisé et Forme rendus par le **vrai** front
> (Playwright, 1280 px). Chaque phrase affichée a été confrontée aux données brutes et au code.
> « Vérifié » = constaté sur le code ET sur les données.
>
> **Statut (28/10) : les 9 correctifs sont APPLIQUÉS** (validés par le porteur), vérifiés par rejeu sur les données réelles
> (Cardio : reco « Reprends progressivement », « Aucune sortie sur cette période · dernière sortie le 03/10 (Marche) »,
> repères « 2 sorties · 3,5 km sur 4 sem. » ; Croisé : Forme **95/100** ; Forme : stress/courbatures « Aucun / Aucune »,
> titre « Dernier bien-être ») + test `tests/audit-cardio-croise.test.js`. ⚠️ #3 et #9 actifs en prod après redéploiement d'`index.ts`.

## Défauts trouvés

| # | Gravité | Où | Défaut | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| 1 | **Élevée** | Forme › Bien-être du jour | **Stress et Courbatures affichés « — »** alors qu'ils sont saisis (27/10 : stress 1, courbatures 1). La fusion des lignes du jour ne recopie pas ces 2 champs. Même oubli dans la frise « Ton ressenti · 7 derniers jours » : la couleur des pastilles est calculée sans eux. | Vérifié : backend renvoie `stress:1, courbatures:1` ; front (app.js ~16588 et ~16545) liste `sommeil, energie, fatigue, motivation, douleur, ressenti…` sans `stress`/`courbatures`. | Ajouter `stress` et `courbatures` aux deux listes. |
| 2 | **Élevée** | Croisé › « Forme (récupération) » + tendance charge/forme | **60/100** (53/100 le 26/10) alors que Forme affiche **91 · Prêt** et récupération **Excellent**. Formule = (sommeil + **énergie** + (6 − fatigue)) / 15 ; l'énergie **n'est plus demandée** par le questionnaire (null sur tous tes relevés) → plafond **67/100**, même en pleine forme. La tendance « forme » du Croisé utilise la même série. | Vérifié : `bien_etre.energie = null` sur 100 % des relevés récents ; 27/10 = (4 + 0 + 5)/15 = 60. | Moyenne des signaux **réellement saisis** (sommeil, fatigue, stress, courbatures, + énergie si présente), même échelle que Forme. 27/10 → 95/100. |
| 3 | Moyenne | Cardio › Lecture (reco) | **Contradiction** : constat « Forte baisse de ton activité cardio (−94 %) — reprends progressivement » puis reco « **Continue sur ce rythme** et varie les intensités ». La reco n'a pas de branche « baisse ». | Vérifié : `buildSyntheseCardio` (index.ts ~1900) : reco « continue » dès qu'il y a ≥ 1 sortie et pas de hausse. | Si baisse ≤ −40 % : « Reprends progressivement : 1 à 2 sorties faciles par semaine pour reconstruire ta base. » |
| 4 | Moyenne | Cardio › Résumé (bloc période) | « **Pas encore de cardio** — Enregistre une séance cardio pour voir tes analyses ici » alors que tu as **133 sorties** : la période choisie (cette semaine) est simplement vide. | Vérifié : `_maCardioResume` teste le total de la période, pas l'historique. | « Aucune sortie sur cette période — dernière sortie le 03/10 (Marche). » ; « Pas encore de cardio » seulement si l'historique est vide. |
| 5 | Faible | Cardio › Repères (rail) | « Sorties 30 j : **4** · 5,6 km » à côté de la lecture « **2** sorties ces 4 semaines (3,5 km) » : fenêtres différentes (30 j vs 28 j) et les repères comptent aussi les micro-sorties que la lecture ignore (audit #9). | Vérifié : 28/09 (×2) entre dans 30 j, pas dans 28 j. | Repères sur **4 semaines** avec le même filtre que la lecture (libellé « Sorties 4 sem. »). |
| 6 | Faible | Croisé › Reco | « Ajoute 1 à 2 séances de cardio par semaine pour équilibrer **et soutenir ta récupération** » : l'effet sur la récupération n'est pas mesuré par l'app (et ta récup est « Excellent »). | Code (texte fixe app.js ~14445). | « … pour ta base d'endurance, sans alourdir ta charge totale. » |
| 7 | Faible | Cardio › Par sport | « Pas de donnée « Distance » pour **Marche** » sur une semaine sans sortie → laisse croire que la marche n'a pas de distance (elle en a : 2,8 km le 02/10). | Vérifié. | « Aucune sortie Marche sur cette période. » |
| 8 | Faible | Forme › titre « Bien-être du jour » | Le relevé affiché peut dater d'**hier** (27/10 affiché le 28/10). La date est écrite juste dessous, mais le titre dit « du jour ». | Vérifié. | Titre « Bien-être du jour » seulement si le relevé est d'aujourd'hui, sinon « Dernier bien-être ». |
| 9 | Faible (structurel) | Backend `analyse_synthese.croise` | Calculée mais **affichée nulle part** (le front recalcule par période depuis le 23/10). Elle dit « Bon équilibre 83 % / 17 % » sur 28 j et contient une faute (« ta récupération est excellent »). Risque si on la réutilise (IA, coach). | Code + rejeu. | Corriger la faute ; la garder comme « 4 sem. » documentée (ou la retirer). |

## Vérifié juste (rien à corriger)
- Cardio : **−94 %** (26 sorties / 915 min du 02/09 au 29/09 → 2 sorties / 62 min depuis le 30/09) ; « 2 sorties · 3,5 km » ; « Charge 7 j : 0 UA » (dernière sortie le 03/10) ; historique (dates, km, durées, vitesses).
- Croisé : « que de la musculation cette semaine » ; « Récupération Excellent · disponibilité Prêt » (= moteur) ; « 2 séances » ; « Fiabilité faible · 1 sem. · 2 relevés ».
- Forme : anneau **91 · Prêt** et reco (= moteur) ; « Charge en hausse · −32 % de fraîcheur » (TSB = (1888 − 2492) / 1888) ; ACWR 1,31 affiché comme repère secondaire ; Douleur « Aucune » (27/10) ; « Fiabilité élevée » (= `moteur.confiance`) ; Poids « aucune donnée sur 1 mois » (dernière pesée le 15/09).

## Non couvert
Graphiques Cardio ▸ Tendances (pas de sortie sur la période testée), Hyrox, sous-pages Forme (nutrition, objectifs, blessures, montre), Croisé en Mois/Année (tendance « forme » — dépend du défaut #2).
