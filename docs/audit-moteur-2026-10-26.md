# Audit du moteur d'analyse — 26 oct. 2026

> Méthode : le **vrai** `handleGetAppData` / `handleGetCoachAthletes` (index.ts du repo, avec les
> correctifs douleur/charge du jour) rejoué sur une **copie des données réelles** du compte Vincent
> (athlète 1 : 828 séries, 32 bien-être, 1387 indicateurs), puis chaque affirmation confrontée aux
> données brutes et au code. « Vérifié » = constaté sur le code ET sur les données ; « code » = défaut
> établi par lecture du code, pas encore observé sur un compte réel.
>
> **Statut (28/10) : les 9 correctifs sont APPLIQUÉS** (validés par le porteur), vérifiés par rejeu sur les données
> réelles + test `tests/audit-moteur.test.js`. Base nettoyée : 8 lignes `exercices` + 4 lignes `performances`.
> ⚠️ Actifs en prod seulement après redéploiement d'`index.ts`.

## Déjà corrigé aujourd'hui (rappel)
- Alerte charge sans ressenti dégradé → supprimée (règle charge + ressenti).
- Douleur : Légère = point d'attention, Modérée = Vigilance, Forte = rouge ; dernière saisie (redescend).
- Carte « Lecture Novalyz » : « Charge en hausse » au lieu de « Fatigue » ; cause du verdict affichée.

## Défauts trouvés

| # | Gravité | Où | Défaut | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| 1 | **Élevée** | Analyses › synthèse muscu (`_syntheseMuscu`, index.ts ~1665) | « **Régularité sous ton objectif (1/4 séances)** » + reco « Vise 4 séances/semaine » : la régularité compte la **semaine calendaire** (lundi → aujourd'hui). Un lundi, 1 séance « cette semaine » alors que 3 séances sur 7 jours glissants. | Vérifié : rejeu 26/10 → `seances_semaine=1`, `seances_j7=3`, constat affiché. | Juger sur **7 jours glissants** (ou au prorata des jours écoulés), en respectant le réglage « semaine type » de l'athlète. |
| 2 | **Élevée** | Volume par muscle, objectifs de volume, « muscle en retard » | **Noms de muscles incohérents** : objectifs = « Mollets », catalogue = « **Moletts** » ; « **fessier** » (minuscule, Hip thrust machine) ; « **Triceps␣** » (espace, Dips triceps). La comparaison est à l'identique → ces séries ne comptent **jamais** pour leur muscle. | Vérifié : `volume_obti` vs `exercices` vs `performances.muscle`. | Corriger le catalogue ET l'historique `performances.muscle` (SQL) + normaliser la clé muscle dans le moteur (casse, espaces, alias). |
| 3 | **Élevée** | Coach › fiche › cockpit (« Risque blessure », « Surcharge ») | Le **risque de blessure** et la **surcharge** sont calculés sur la **charge seule** (fraîcheur). Ton cas : « Risque blessure : Modéré » + « Surcharge : Modéré » en orange alors que ton ressenti est bon → contredit la règle charge + ressenti validée. | Vérifié : rejeu → `risque_blessure=Modéré`, `surcharge=Modéré`, `charge_ressenti.degrade=false`. | La charge ne compte dans le risque que si le ressenti est dégradé ; « Surcharge » → « Charge » neutre (« en hausse · encaissée »). |
| 4 | Moyenne | Moteur (`_aggSignaux`) | **Courbatures = pire valeur des 7 jours** (même défaut que la douleur avant correctif) : une seule journée à 4/5 garde la Vigilance et fait baisser la récupération pendant 7 jours. | Code. | Dernière saisie, comme la douleur. |
| 5 | Moyenne | Accueil/fiche « Muscle en retard » (`muscle_retard`) | Ne compte que le **muscle principal** : « **Fessier en retard 0/32** » alors que squat, belt squat, RDL travaillent les fessiers. L'onglet Analyses, lui, compte le travail indirect (0,5 série) → deux vérités différentes. | Vérifié : rejeu → `{muscle: Fessier, series_faites: 0}`. | Compter le muscle secondaire (0,5) comme les Analyses. |
| 6 | Moyenne | Analyses › synthèse muscu | « Ton volume progresse (**+88 %** sur 4 semaines)… **tu construis à poids stable** » : la hausse vient surtout d'une **pause** (18/09 → 01/10) dans la période de comparaison ; et « tu construis » n'est pas mesuré (poids stable ≠ gain musculaire). | Vérifié : 6 séances (avec 13 j de trou) vs 11. | Ne pas comparer si la période précédente contient un trou ≥ 10 j (ou le dire : « après ta pause ») ; retirer l'affirmation « tu construis ». |
| 7 | Faible | `calculerAlertes` (ancien moteur, `dashboard.alertes`) | Stagnation sur les 4 dernières séances **sans limite de temps** (juin vs oct.) ; « RPE en hausse » sur le Leg curl non pratiqué depuis le 18/09. | Vérifié sur données, **non affiché** côté athlète (champ non lu) ; côté coach la liste est limitée à 28 j. | Nettoyage (borne de récence) — pas urgent. |
| 8 | Faible (structurel) | Alertes coach vs athlète | Le coach reçoit les alertes de l'**ancien moteur** (`calculerAlertes`), l'athlète celles du **moteur central** (`alertes_centre`) → risque de messages différents pour le même athlète. | Code (pas de divergence visible aujourd'hui sur ton compte). | Faire lire au coach les mêmes `alertes_centre`. |
| 9 | Faible | Synthèse cardio | **Micro-séances** comptées comme « sorties » (footing 0,03 km, vélo 1 min, marches de 1 min) → nombres et % bruités (« −89 % »). | Vérifié : `cardio.history`. | Ignorer < 5 min et < 0,3 km. |

## Non couvert par cet audit (à faire si besoin)
Moteur foot (fiche joueur, suivi équipe), « Coup d'œil » coach (déjà audité le 23/10), morpho, nutrition, récompenses.
