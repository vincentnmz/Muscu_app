# Douleur forte : progression HORS zone — mini-protocole (14/11/2026, à valider, AUCUN CODE)

> Demande du porteur (14/11) : dernier contrôle de cohérence avant de déployer A–E. Formaliser le cas, tester la règle sur
> des profils, **puis** coder. Légende : **[V]** vérifié (code, banc, /dev/) · **[P]** proposition · **[D]** décision attendue.

## 1. Constat [V]

Deux références différentes décident de « progresser ou non » pour une même douleur :

| Où | Référence | Ce qui est affiché (John /dev/, banc `douleur_vigilance`, `gene_poignet`) |
|---|---|---|
| Athlète — cibles de séance (saisie, « Ta séance ») | **disponibilité globale** du moteur (`_vigilanceDuJour` : Vigilance / À surveiller) | **tous** les exercices : « jour de vigilance : pas de progression aujourd'hui, mêmes charges » |
| Athlète / coach — plan, leviers, pistes | **zone** de la douleur (`_lv3GeneActive`, règle par exercice validée le 14/11) | exercices de la zone : « n'ajoute ni charge ni séries » ✅ ; **hors zone : « +4 séries de Squat… va jusqu'à RPE 9-10 »**, plan « Ischios / Quadriceps 13 séries » actif |

→ Pour un exercice hors zone (ex. Squat avec douleur épaule 4/5), l'athlète lit « pas de progression aujourd'hui » et le coach lit
« +4 séries, va jusqu'à RPE 9-10 ». Le même cas existe pour une douleur **modérée** (3/5 → Vigilance) [V, code].
La zone elle-même est cohérente partout (aucun écart trouvé).

## 2. Règle candidate « H » [P]

Condition : douleur **forte** active (alerte moteur `douleur` sévérité haute = « Douleur forte signalée », dernier questionnaire ≤ 7 j).

| Exercice | Plan / leviers / pistes coach | Cibles de séance athlète |
|---|---|---|
| **Dans la zone** | inchangé : en pause / « n'ajoute ni charge ni séries » (garde-fou prioritaire) | maintien (inchangé) |
| **Hors zone** | jamais « +N séries », « RPE 9-10 », « jusqu'à l'échec » ; phrase : « Hors zone douloureuse : progression possible si elle reste confortable. Pas besoin de forcer ni d'aller à l'échec. » ; actions de **volume** (+séries) **en pause (douleur forte)** | **[D1]** |

Les deux vues (athlète et coach) disent alors **la même chose** pour un même exercice.

## 3. Décisions attendues [D]

- **D1 — cibles hors zone pendant une douleur forte** :
  (a) **maintien** comme aujourd'hui (« pas de progression aujourd'hui ») et la phrase coach devient « hors zone : garde tes charges ;
  la progression reprendra quand la douleur sera levée » — cohérent sans toucher la vigilance ;
  (b) **progression douce** possible hors zone (+1 rep à charge égale seulement, jamais de charge en plus, RPE ≤ 8) — touche à la
  règle « vigilance = pas de progression » validée en octobre.
  *Mon avis* : (a) d'abord (plus prudent, une seule référence), (b) seulement si le réel montre un besoin.
- **D2 — douleur modérée (3/5)** : même écart aujourd'hui. Appliquer H aussi (hors zone : pas de « RPE 9-10 / +N séries ») ou
  laisser la progression hors zone (et alors aligner les cibles athlète, qui sont en maintien) ?
- **D3 — volume hors zone** pendant une douleur forte : en pause (proposé) ou reformulé « si confortable » ?

## 4. Profils de test (banc, fictifs, déterministes) et comportement attendu

| Id | Profil | État moteur attendu | Attendu (après H, D1 = a) |
|---|---|---|---|
| H1 | Douleur forte épaule 4/5 + **jambes** (Squat, RDL) | À surveiller | Jambes : pas de « +N séries / RPE 9-10 » ; plan jambes en pause (douleur forte) ; cibles maintien ; coach = même lecture |
| H2 | Douleur forte épaule 4/5 + **exercices d'épaule** (DM, couché, tirage) | À surveiller | Inchangé : en pause « gêne épaule », « n'ajoute ni charge ni séries » |
| H3 | Douleur **modérée** épaule 3/5 | Vigilance | Selon **D2** |
| H4 | **Aucune** douleur | Prêt | **Strictement inchangé** (texte identique au banc actuel) |
| H5 | Douleur forte 4/5 + **récupération dégradée** (sommeil 2, fatigue 4) | À surveiller | Comme H1, + reco récupération ; aucune augmentation nulle part |
| H6 | Douleur forte 4/5 + **récupération normale** | À surveiller | Comme H1 (la bonne récup ne rouvre pas « RPE 9-10 / +N séries ») |

## 5. Contrôle automatique (R8, ajouté au banc AVANT le code)

Pour chaque profil, sur Aujourd'hui, Analyses, Croisé, Forme et la fiche coach :
- **R8a** douleur forte → aucun « +N série(s) de », « jusqu'à RPE 9-10 », « aller à l'échec » (hors phrase « pas besoin… »).
- **R8b** même exercice : si la cible athlète dit « pas de progression », aucune piste/levier coach ne propose d'augmenter cet exercice.
- **R8c** H4 : texte identique au fichier attendu actuel (non-régression).
Critères : **R8 rouge sur le code actuel** pour H1, H5, H6 (preuve que le test voit le problème) ; **vert après correction** sur les 6
profils ; banc complet + `npm test` verts ; puis vérification réelle sur /dev/ (John, données de test déjà en place).

## 6. Hors périmètre (noté)

- Cardio proposé par Croisé pendant un pic de charge (« ajoute 1 à 2 séances de cardio ») : chantier séparé (cardio = charge ou
  reco distincte ?).
- Rowing / tirage avec douleur **poignet** proposés « +4 séries » (banc `gene_poignet`) : la table zone ↔ exercice validée le 14/11 ne
  relie pas ces exercices au poignet ; avec H (douleur forte), ils ne seraient de toute façon plus poussés.
