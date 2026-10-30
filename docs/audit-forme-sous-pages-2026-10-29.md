# Audit Forme — sous-pages — 29/30 oct. 2026

> Méthode : vrai `index.ts` rejoué sur la copie des données réelles de Vincent (à jour au 29/10).
> Écrans rendus par le vrai front (mobile 390 px) : Forme, Nutrition, Mon objectif, Douleurs & blessures,
> Photos & mensurations, Ma montre (pas, sommeil, FC repos). Comptages vérifiés en base.
> Note : mon outil de test n'a pas le profil complet (objectif, taille, date de naissance). Les écarts qui en
> venaient ont été re-vérifiés avec ton vrai profil : « Entretien » et « complète taille + date de naissance »
> étaient des artefacts de test, **pas** des bugs.

> **Statut (30/10) : les 5 correctifs sont APPLIQUÉS** (D = « calcul homme » affiché). Test `tests/audit-forme.test.js`.

## Défauts trouvés

| # | Gravité | Où | Défaut | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| 1 | **Élevée** | Bilan de séance + questionnaire du jour › zone de douleur | **La zone choisie avec les boutons (Épaule, Nuque…) est enregistrée « NaN »**, donc perdue. `selectWQ` convertit toutes les réponses en nombre, y compris la zone, qui est un texte. Affiché tel quel : « NaN » dans Douleurs signalées. | Vérifié : app.js `selectWQ` (`Number(btn.dataset.val)`). En base : 2 bien-être + 2 bilans en « NaN » (dont tes 29/10). Les zones tapées à la main sont intactes. | Garder la zone en texte. Afficher « Zone non précisée » pour les anciennes lignes « NaN » (la zone d'origine est irrécupérable). |
| 2 | **Élevée** | Mon objectif › « Objectif : X séances / semaine » | Affiche **3** alors que ton objectif est **4**. La fonction `_objSeancesCible` existe **en double** : la 2ᵉ copie (sans données → 3 par défaut) écrase la 1ʳᵉ. Le sélecteur « Modifier » est **pré-rempli à 3** : un simple Enregistrer ramènerait ton objectif à 3. | Vérifié : app.js lignes ~12538 et ~16573. Rejeu : `seances_prevues = 4`, affichage 3. | Une seule fonction, qui lit tes vraies données. |
| 3 | Moyenne | Douleurs & blessures › Douleurs signalées | La **date** de chaque douleur affiche « — » et le tri par date ne marche pas : les dates arrivent en `2026-10-29` mais sont lues au format `29/10/2026`. | Vérifié : `renderBlessures` → `_maFRtoDate` sur une date ISO → null. | Lire les deux formats de date. |
| 4 | Faible (6bis) | Nutrition › cibles kcal / glucides / lipides | **Sexe non renseigné** → les calories sont calculées **comme pour un homme**, sans le dire. Juste pour toi, faux de ~165 kcal pour une athlète. | Vérifié : formule Mifflin-St Jeor (+5 si pas « F »), `athletes.sexe = null`. | Ajouter « (calcul homme — renseigne ton sexe dans Réglages) » quand il manque, ou ne pas afficher les kcal. **→ décision** |
| 5 | Faible | Forme › Poids | Par défaut (1 mois), le poids affiche « — kg · Aucune donnée » alors que ta dernière pesée est **83 kg le 15/09**. | Vérifié : rejeu (`poids[0]` = 83 kg, 15/09). | Afficher « Dernière pesée : 83 kg le 15/09 » quand la période est vide. |

## Vérifié juste
- **Nutrition** (avec ton profil) :
  - « Recomposition » (objectif « Prise de masse + sèche ») ;
  - protéines 183 g (2,2 g/kg × 83 kg) ;
  - calories 2 360 kcal (Mifflin-St Jeor, 41 ans, 170 cm, 83 kg, activité « modérée » × 1,55, −10 %) ;
  - lipides 71 g (27 %) et glucides 247 g (le reste).
- **Ma montre** (semaine du 26/10) :
  - pas 2 676 / 3 090 / 2 168 → moyenne 2 645 ;
  - sommeil 7,6 h et 8,9 h → moyenne 8 h 15 ;
  - FC repos 60 et 59 → moyenne 60 bpm.
  - Tout est au bon jour : le décalage que je pensais voir venait de ma lecture.
- **Mon objectif** : texte « Ce que ça change pour toi » cohérent avec la recomposition.
- **Photos & mensurations** : « mesures maj 23/10/2026 » (tour de taille 102 cm) ; aucune photo.
- **Douleurs & blessures** : « Aucune blessure suivie » (table vide) ; les douleurs de niveau 2 et plus des bilans sont bien listées.
