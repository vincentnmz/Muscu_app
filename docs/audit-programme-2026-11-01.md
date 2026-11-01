# Audit — Programme : générateur, modèles et éditeur (01/11/2026)

Méthode : le VRAI générateur (`_genProgramme2`, `_g2GenDays`, `_g2Build`, `_g2Resolve` de `js/app.js`) exécuté en node sur **toutes** les combinaisons proposées (niveau × organisation × jours × durée, 120 programmes) avec le vrai catalogue d'exercices ; volume hebdo par muscle calculé comme l'app (muscle principal 1 série, secondaire 0,5, noms de muscles normalisés comme le backend) et comparé aux cibles `volume_obti` (min / optimum) que l'app utilise pour « Sous-MEV / Optimal ». Éditeur : code de sauvegarde + backend `handleSaveProgrammeLigne` + rendu réel (Playwright) avec ton programme.
Légende : ✅ vérifié · ❌ défaut (vérifié contre code + données) · 🟠 à décider.

## Juste ✅
- Tous les exercices générés existent dans le catalogue (2 noms absents — « Élévation frontale poulie », « Hack squat » — sont remplacés automatiquement par la variante suivante du même angle).
- Ordre des exercices : gros muscles d'abord (pecs / dos / quadriceps avant les bras).
- Repos du générateur : 3 min polyarticulaires, 90 s isolation (cohérent avec Schoenfeld 2016) ; superset biceps/triceps à 90 s.
- Débutant : 3 séries de 10-12 reps (dans la recommandation ACSM 2009 pour débutant : 8-12 reps).
- Jours : 4 j = lun, mar, jeu, ven ; noms de séance uniques pour Full Body, PPL, Split.
- Éditeur : déplacer un exercice d'un jour à l'autre ne perd rien (le backend ne modifie que les champs envoyés).
- **Ton programme** : 4 séances, 23 lignes, tous les exercices au catalogue.

## Défauts

| # | Où | Constat | Correctif proposé |
|---|---|---|---|
| **P1** ❌ | Générateur + modèle « Haut / Bas × 3 » (6 jours) | Les séances 5 et 6 reprennent les noms « Haut A » / « Bas A » → l'app les **fusionne** avec les séances 1 et 2 : **4 séances au lieu de 6**, « Haut A » avec 10-18 exercices sur 2 jours différents. | Nommer Haut A / B / C et Bas A / B / C. |
| **P2** ❌ | Générateur ▸ abdos | Crunch / Relevé de jambe / Roulette générés en « 3 × **0–0** reps ». | Fourchette 10-15. |
| **P3** ❌ | Générateur ▸ volume | Le programme proposé est **immédiatement « Sous-MEV »** dans tes propres Analyses sur plusieurs muscles. Ex. intermédiaire Haut/Bas 4 j · 60 min : Dos 6 séries/sem. (min 10), Épaules 6 (min 8) ; Full Body 3 j · 60 min : Fessiers 0, Mollets 0, Abdos 0 ; PPL 3 j : Pecs 6, Quadriceps 6. À l'inverse, Haut/Bas 4 j · 75 min : Ischios 21 (> 1,5 × l'optimum 12). Cause : la coupe par durée garde le 2ᵉ exercice des pecs avant le 1ᵉʳ… du dos manquant, sans regarder les cibles. | 🟠 (a) **Recommandé** : le générateur répartit les exercices selon le **déficit** par rapport au minimum de chaque muscle (dans la durée choisie), et affiche avant création le volume par muscle + ce qui restera sous le minimum (« à 60 min, Dos reste à 8/10 : passe à 75 min ou 5 jours »). (b) Seulement l'avertissement. |
| **P4** ❌ | Éditeur ▸ repos | Tout exercice ajouté reçoit **90 s** de repos (ton programme : 90 s sur les 23 lignes). Tes repos réels : 2-3 min sur les polyarticulaires (Traction, Pendulum, développés : médiane 180 s). Ce 90 s **pré-règle le minuteur** à la saisie et s'affiche « Repos prévu : 1 min 30 », alors que la règle de l'app compte 2 à 5 min pour ces exercices. | Défaut à l'ajout = 3 min polyarticulaire / 90 s isolation (comme le générateur). 🟠 Mettre à jour ton programme avec tes repos réels (médiane d'octobre) — seulement avec ton accord. |
| **P5** ❌ | Éditeur ▸ fourchette | L'éditeur affiche la fourchette brute (« 8–12 ») alors que l'app utilise celle de la **catégorie** quand le programme est resté à 8-12 : Écarté machine affiché 8–12, mais la saisie et Aujourd'hui visent jusqu'à **20** (petit muscle). | Afficher la fourchette réellement utilisée : « 8–20 · petit muscle ». |
| **P6** ❌ | Éditeur ▸ saisie | Aucun contrôle : reps min > reps max (12–8), champ vidé enregistré à **0**, 0 série acceptés (front et backend). | Refuser le vide, bornes (séries 1-10, reps 1-50), inverser min/max si besoin. |
| **P7** | Code | Ancien générateur (`_genProgramme`, `_progModele`, `_GEN_*`) jamais appelé. | Supprimer. |

## Réalisé (01/11, validé porteur : P3 option a, P4 avec mise à jour du programme, P1-P2, P5-P7)

- **P1** Haut/Bas 6 j → Haut/Bas A, B, C (6 séances distinctes, générateur et modèle « Haut / Bas × 3 »).
- **P2** Abdos 10-15 reps.
- **P3 (a)** Répartition par **déficit** de volume (mêmes cibles et même comptage que les Analyses) : 1 exercice par muscle et par séance, puis les places restantes de la durée choisie vont au muscle le plus loin de son minimum (tous les angles du muscle déjà présent dans la séance), puis +1 série sur ses exercices s'il reste du temps ; ensuite complément sans dépasser 1,5 × l'optimum. Sur les 120 combinaisons (cibles réelles) : muscles « au-delà » **108 → 13**, manque sous le minimum **480 → 440** (le reste est impossible dans le temps choisi, ex. Full Body 2 j : 9 muscles × 8 séries > 2 séances). L'aperçu du générateur affiche les séries par muscle et **dit** ce qui reste sous le minimum (« Dos 9/10, Épaule 6/8 : plus de temps par séance ou un jour de plus »). Budget de temps respecté (testé).
- **P4** Repos par défaut à l'ajout : 3 min polyarticulaire / 90 s isolation. **Ton programme mis à jour** avec la médiane de tes repos réels d'octobre (18 lignes : Traction / Pendulum / développés 180 s, tirages 150 s, isolation 120 s ; anciennes valeurs sauvegardées dans `.work/audit/backup-repos-programme-2026-11-01.txt`).
- **P5** Éditeur : fourchette réellement utilisée (« 8–20 · léger », « 6–12 · lourd/moyen ») + note sous les champs reps.
- **P6** Contrôles : champ obligatoire vidé → non enregistré ; bornes (séries 1-10, reps 1-50, repos 0-600 s, %1RM 1-100) ; fourchette inversée remise dans l'ordre (vérifié dans la vraie app : 15–12 → 12–15, 25 séries → 10, vide refusé).
- **P7** Ancien générateur v1 supprimé.
- Tests : `generateur-v2` +6 cas (28). Pas de changement backend (rien à redéployer).
