# Audit coach — écran 3 : Fiche athlète ▸ Aperçu (03/11/2026)

**Cap donné par le porteur (03/11)** : « aider le coach à prendre les bonnes décisions — ne pas lui apprendre son métier, lui faciliter et lui donner tout pour faire progresser son athlète ».
→ Règle de lecture de l'audit : la fiche donne **des faits chiffrés et datés**, montre **ce que Novalyz a proposé à l'athlète** (transparence), et met **l'action à portée de main** (programme, message). Elle ne donne pas de consignes de coaching au coach.

Code : `renderCoachCoupDoeil` (coup d'œil, état & récup, lecture, reco), `renderEtatDuJourCoach`, `renderAlertesCoach`, `renderCoachIndicateurs`, `renderCoachHubVolume`, `renderCoachProchaineSeance`, bloc IA (`coachIaSend`).
Données : Vincent (copie 02/11) et Alizé (base 03/11), rejouées. Captures : `mockups/audit-coach-fiche-vincent-avant.png`, `mockups/audit-coach-fiche-alize-avant.png`.

## Juste ✅ (vérifié)
- Records, « progresse », « sous la fourchette », « effort en hausse à charge égale », plan de la semaine : mêmes calculs que l'athlète.
- Repères : régularité 1/4, ACWR 0,88, dernière séance 02/11 · 18 séries : conformes au serveur.
- Sommeil / fatigue « dans sa normale », pas, poids : conformes.

## Constats
| # | Constat (vérifié dans le code) | Proposition |
|---|---|---|
| **F1** | **Douleur contradictoire** : en-tête « Douleur : Légère » (questionnaire 30/10 : 2/5) ; coup d'œil « Douleur aucune » — il ne lit que la *zone* douloureuse (vide) et ignore le niveau. | Une seule lecture : « Douleur légère (2/5) · 30/10 », + zone si renseignée. |
| **F2** | **« Travaillé / Non travaillé (7 j) » faux** : calculé depuis **lundi**, pas sur 7 jours. Vincent : « Dos, Jambes non travaillés », « délaissés cette semaine », reco « réintègre Dos et Jambes » — alors qu'il a fait « dos jambe 2 » le 30/10 (il est mardi). | Vrais 7 derniers jours (séries par muscle des séances). Plus de consigne : le fait seul (« Dos : 0 série depuis 7 j » s'il est vrai). |
| **F3** | **Deux référentiels de volume.** La fiche coach utilise une table du front (intermédiaire : pecs 12-16) ; l'athlète voit celle du serveur (pecs 8-14). Le trapèze n'est dans aucune table → cible **inventée** 10-14 → alerte **PRIORITAIRE « Volume insuffisant »** déclenchée par 1,5 série de trapèze un mardi. | Une seule source : les cibles du serveur (celles de l'athlète). Muscle sans cible → pas d'alerte. |
| **F4** | **Alizé : l'essentiel n'apparaît pas.** Aucune ligne « pas de muscu depuis 27 j » ; la lecture dit « manque de cardio » alors qu'elle a fait du cardio il y a 9 j (75 sorties). L'alerte serveur dit « depuis **7** jours » (le seuil) au lieu du vrai nombre. | En tête du coup d'œil : « Muscu : dernière le 07/10 (27 j) · cardio : 25/10 (9 j) ». Alerte avec le vrai nombre de jours (serveur → redéploiement). « Manque de cardio » retiré (jugement, pas un fait). |
| **F5** | **Le ton** : textes écrits pour l'athlète dans la vue coach (« ta fourchette », « C'est toi qui choisis ») et consignes de métier (« réintègre Dos et Jambes », « base d'endurance à entretenir, 1 à 2 sorties/sem. », « intensité très élevée → surveiller la fatigue »). | Faits au coach + « **Proposé à l'athlète** : 75 kg (ou 70) » + boutons **Modifier dans le programme** / **Écrire à Vincent**. Le coach garde la main (il peut changer ce que Novalyz propose). |
| **F6** | **La même info 3-4 fois** (état du jour, état & récup, lecture, alertes, repères) ; page ≈ 4 000 px sur téléphone. « Lecture Novalyz pour le coach » + « Reco prochaine séance » redisent le coup d'œil sous forme de consignes. | Réorganiser autour de la décision : ① **À décider** (alertes + points ouverts, chacun avec ses actions) ② **Entraînement** (faits) ③ **État** (faits) ④ **Repères & prochaine séance**. Lecture + reco retirées (fondues dans ①). |
| **F7** | Repère « **Progression — pas assez de données** » (ancien calcul 7 j / 7 j) alors que records et progrès sont listés au-dessus. « Trapèze 1.5 ». | Repère « Plan 0/3 » (ou « 4 records · 13 exos en hausse »). « 1,5 ». |
| **F8** | **Prochaine séance à faire** : ne montre pas ce que Novalyz va proposer (Pendulum +3 séries, Smith 75 kg). | Repère sur l'exercice : « Novalyz propose : +3 séries » / « 75 kg (ou 70) », avec « modifier ». |
| **F9** | **Bloc IA** actif en apparence (boutons, champ) mais la clé n'est pas posée : chaque question répond « pas encore activé… *Tes* analyses… ». | Tant que l'IA n'est pas active : bloc « Bientôt » non cliquable (comme l'athlète). |
