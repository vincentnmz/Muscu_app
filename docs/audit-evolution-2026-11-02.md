# Audit — Analyses ▸ Évolution ▸ Par groupe / Par séance (02/11/2026)

Méthode : code (`_maProgGrp`, `_maProgSea`, `_maWin`, comparé au Résumé `_maMuscuResume` et au serveur `_addSeriesMuscle`) + **tes vraies données** (copie à jour, séance « pec epaule » du 02/11 incluse, backend rejoué au 02/11) + captures mobile de chaque vue (Semaine, Mois, Année, semaine sans séance, Par séance).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## Juste ✅
- **Séries par muscle** : même total que le Résumé et le serveur (direct = 1 série, muscle secondaire = ½ série). Ex. octobre : Dos 71 séries des deux côtés.
- **Par séance** : liste des séances réelles (5 + « Charger plus »), meilleure série de chaque exercice comparée à la **dernière fois** (même exercice) ; charge d'abord, puis reps, puis séries au top / RPE plus bas — même règle que la Lecture Novalyz. Vérifié sur ta séance du 02/11 : Smith 70 × 8 « + séries (3 séries à 8 au lieu de 1) », décliné machine 60 × 8 « +1 rep », élévation latérale 7,5 × 10 vs 11 « −1 rep ». 18 séries, 4,6 t : exact.
- Badge d'en-tête : tonnage comparé à la **même séance** précédente (même nom), masqué pour « Libre ».

## Défauts
| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **E1** ❌ | **Par groupe divise par la durée TOTALE de la période**, pas par les semaines écoulées (le Résumé, lui, le fait depuis R1). Tes données : **novembre** (2 jours) → Pectoraux « 2,3/14 séries/sem » rouge alors que tu en as fait 9 (Résumé : 9) ; **année** → tout rouge à ~3,5/sem (divisé par 52 semaines, tu t'entraînes depuis le 15/06 = 20) ; octobre → 4 semaines au lieu de 4,4 (+11 %). Deux onglets, deux chiffres pour la même chose. | Même calcul que le Résumé : semaines de max(début de période, 1re séance) à min(fin, aujourd'hui). |
| **E2** ❌ grave | **Période sans séance → affiche tes 12 dernières séances comme si c'était cette période.** Semaine du 21–27 sept. (aucune séance) : « Dos 61 séries/sem, 6×/sem, tonnage ▲ +241 % », tout en vert. | « Aucune séance sur cette période. » |
| **E3** ❌ | **Tendance du tonnage** : une période **en cours** est comparée à la période précédente **complète** → baisse affichée en rouge chaque début de semaine / mois. Lundi après 1 séance : Pectoraux ▼ 44 %, Épaule ▼ 49 % ; en Mois : ▼ 81 %. | 🟠 (a) **Recommandé** : comparer au **même nombre de jours** de la période précédente (lun→lun de la semaine d'avant, 1er→2 du mois d'avant) ; (b) masquer la tendance tant que la période n'est pas finie. |
| **E4** ❌ | **Déload / reprise ignorés** (le correctif X1 n'a été fait que dans le Résumé et la Lecture) : Par groupe met en **rouge** le volume réduit, Par séance affiche « **régression** » en rouge. | Même règle que X1 : gris « Réduit (déload) » / « Baisse attendue (déload / reprise) ». |
| **E5** | **Statuts différents du Résumé** : Par groupe = vert / orange / rouge sans mot ; Résumé = Sous-MEV / Suffisant / Optimal / **Au-delà** (violet). Un muscle au-delà du max récupérable apparaît vert ici. | Mêmes 4 statuts, avec le mot (« Optimal », « Sous-MEV »…). |
| **E6** | Les muscles de ton programme **non travaillés** sur la période disparaissent (Résumé : listés en gris « pas travaillés »). En novembre : Dos, Biceps, Quadriceps, Ischios absents sans le dire. | Les lister en gris en bas, comme le Résumé. |
| **E7** | Tonnage **indirect** : le muscle secondaire reçoit ½ du tonnage de l'exercice (Triceps « 1,5 t » = moitié des développés pectoraux) → sa tendance suit surtout les pecs. | 🟠 (a) tonnage = exercices **directs** seulement (les séries indirectes restent à ½) ; (b) laisser. |
| **E8** 🟠 | Par séance, **badge « tonnage » rouge quand la séance est simplement plus courte** : 30/10 « dos jambe 2 » ▼ 65 % (11 séries, 4 exercices au lieu de la séance complète). Le détail des exercices peut être en progrès. | (a) **Recommandé** : badge = bilan des exercices « 3 ↑ · 1 ↓ · 2 = », tonnage en gris neutre à côté ; (b) laisser. |
| **E9** | Décimales anglaises : « Tonnage 3.9 t », « 4.6 t ». | Virgule (3,9 t). |

Écarté après vérification : « Trapéze » (faute) vu en capture venait de ma copie locale du catalogue ; ta base dit bien « Trapèze ».

## Réalisé (02/11, validé porteur : tout, E3 a, E7 a, E8 a)
- **E1** Par groupe et Résumé partagent le même calcul des semaines couvertes (`_maSemCouvertes`) : au 02/11, Pectoraux 9/14 « Suffisant » (avant 2,3 rouge en Mois) ; année = depuis le 15/06.
- **E2** Période sans séance → « Aucune séance sur cette période. » (vérifié semaine du 21-27 sept.).
- **E3 (a)** Période en cours comparée au même nombre de jours de la période précédente (lundi vs lundi : Pectoraux +12 % au lieu de ▼ 44 %).
- **E4** Déload / reprise : « Réduit (déload) » gris (Par groupe), « baisse attendue » pour les séances faites pendant le contexte (Par séance).
- **E5** Mêmes 4 statuts que le Résumé, avec le mot, + légende. **E6** Muscles non travaillés listés en gris.
- **E7 (a)** Tonnage = exercices directs seulement (l'indirect reste à ½ série).
- **E8 (a)** Badge de séance = bilan des exercices « 3 ↑ · 2 = · 1 ↓ » ; tonnage vs la précédente en gris (30/10 : « 3 ↑ », −65 % en gris).
- **E9** Virgule décimale (3,9 t, RPE).
- Test `evolution-groupe` (6 cas) ; 72 suites vertes. Captures relues : semaine, mois, année, semaine vide, Par séance, déload simulé.
