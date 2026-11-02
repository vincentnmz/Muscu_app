# Audit — Photos & mensurations (02/11/2026)

Méthode : code (front `renderSuiviCorps`, `_svPhotosHtml`, `_svMesuresHtml`, `_svSaveMesures`, envoi photo ; vue coach `_maSuiviHtml` ; serveur `handleSaveMensuration`, `handleSuiviPhotoUploadUrl`, `handleSaveSuiviPhoto`, `handleSupprimerSuiviPhoto`, lecture dans getAppData) + **base réelle** (espaces de stockage, lignes) + capture (mensurations avec données d'exemple).
Usage réel : **0 photo**, **1 mesure** (toi) — l'audit porte surtout sur le code.
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## Juste ✅
- Photos : espace de stockage **privé** (liens signés 2 h), formats limités (jpg/png/webp), 25 Mo max côté stockage, photo compressée avant envoi, chemin vérifié (un athlète n'écrit/supprime que dans son dossier), suppression = fichier + ligne ; 0 fichier orphelin. Supprimées avec le compte.
- Avant / après par angle (face, profil, dos) = la plus ancienne vs la plus récente. Vue coach en lecture seule.

## Défauts
| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **P1** ❌ | **Mesures qui disparaissent** : « Dernières mesures » n'affiche que la **dernière date**. Tu mesures les bras le 01/10 et seulement la taille le 02/11 → les bras et la masse grasse n'apparaissent plus (capture). Même défaut côté coach. | Chaque mesure : **sa** dernière valeur + sa date, tendance vs **sa** valeur précédente. |
| **P2** ❌ | **Enregistrer efface les mesures déjà saisies le même jour** : le serveur supprime toute la date puis réécrit ce qui est envoyé, et le formulaire est vide → ajouter le mollet le soir efface la taille du matin. | Le serveur ne remplace **que les mesures envoyées** ; le formulaire est prérempli avec les mesures du jour. |
| **P3** ❌ | **Couleur de tendance trompeuse** : ▲ vert / ▼ rouge pour toutes les mesures. Un tour de taille ou une masse grasse qui **baisse** est affiché en rouge (capture), un tour de taille qui monte en vert. | 🟠 (a) **Recommandé** : flèches **neutres** (grises) — Novalyz ne juge pas une mensuration sans connaître ton objectif ; (b) couleur selon l'objectif (sèche : taille / masse grasse en baisse = vert ; prise de masse : bras / cuisses en hausse = vert). |
| **P4** ❌ | **Valeurs non bornées** (serveur et app) : 500 cm de bras ou 90 % de masse grasse passent. | Bornes : tours 10-250 cm, masse grasse 2-60 %. |
| **P5** ❌ | **Mise en page** : les champs de la colonne de droite dépassent du cadre sur téléphone (capture). | Champs à la largeur de leur colonne. |
| **P6** ❌ confidentialité | La **politique de confidentialité** ne mentionne ni les **photos de suivi**, ni les **mensurations** (ni la nutrition, ni les photos / vidéos envoyées au coach) parmi les données traitées ; elle parle encore de « Google Health » (remplacé par Health Connect). | Compléter la liste « Données que nous traitons » (et la fenêtre « Confidentialité » de l'app). |
| **P7** 🟠 | Photo datée **du jour** obligatoirement : impossible d'ajouter une ancienne photo « avant ». | (a) choisir la date (au plus tard aujourd'hui) ; (b) laisser. |
| **P8** | Pas d'**historique** : seules 2 valeurs sont comparées, aucune courbe. | 🟠 (a) toucher une mesure → son historique (liste datée + mini-courbe) ; (b) plus tard. |

Non vérifié : envoi réel d'une photo depuis le téléphone (aucune photo en base) — à tester après correction.
