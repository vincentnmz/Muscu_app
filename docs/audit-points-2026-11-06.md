# Audit — points du 06/11/2026 (avant onboarding)

Tout est vérifié dans le code et, quand c'est indiqué, sur les données réelles (copie `.work/audit/out_now.json`, compte Vincent).

## 1. Liste des exercices
- Catalogue : 91 exercices. Muscles mal saisis (« Moletts », « fessier » / « Fessier », « Triceps␣ »), 1 seul adducteur, 3 abdos, aucun champ matériel ni consigne.
- Déjà noté dans `docs/roadmap-beta.md` (avant le test fermé).
- Proposé : liste de muscles fermée (corrige la base), + champ **matériel** (barre, haltères, machine, poulie, poids du corps), + champ **consignes** (sert au point 3), compléter les groupes pauvres, choix par muscle partout (ajout, remplacement) comme dans « Enchaîner avec… ». Base : migration SQL + `index.ts` (à redéployer).

## 2. Questionnaire bien-être — comment il compte (vérifié `index.ts`)
- Fenêtre : **7 derniers jours** (`_aggSignaux`).
- **Verdict de l'athlète** (Aujourd'hui, séance) : fatigue = **moyenne 7 j**, sommeil = **moyenne 7 j**, douleur et courbatures = **dernière saisie**.
- **Vue coach / équipe** : fatigue = **MAXIMUM 7 j** → une seule journée à 4/5 affiche « Fatigue élevée » chez le coach **pendant 7 jours**, même si l'athlète a la pêche le lendemain. Incohérent avec le verdict athlète.
- Côté athlète, si une seule réponse existe sur 7 j (la mauvaise), la moyenne = cette réponse → Vigilance jusqu'à 7 j tant qu'il ne répond pas à nouveau.
- En séance, la Vigilance donne « pas de progression aujourd'hui, mêmes charges ».
- Proposé : **le jour compte pour le jour**. Verdict du jour = questionnaire du jour (ou de la veille) ; sans réponse récente (> 2 j), la fatigue/le sommeil ne déclenchent plus la Vigilance. Une **tendance** (alerte coach « fatigue élevée ») seulement si ≥ 2 réponses hautes sur 7 j **ou** moyenne 7 j haute. Même règle athlète et coach. Douleur : inchangée (dernière saisie). `index.ts` à redéployer.

## 3. Conseils techniques pour débutants
- Aujourd'hui : aucune consigne technique par exercice (catalogue sans champ, vérifié).
- Proposé : consignes par **famille de mouvement**, affichées en séance sous l'exercice pour un débutant (repliables, désactivables). Textes donnés par le porteur (rien d'inventé) :
  - poussée pectoraux : « sors la cage, resserre les omoplates » ;
  - épaules / dos : « baisse les épaules » ;
  - quadriceps : « descends sous 90° ».
  Les autres familles : textes à écrire ou valider par le porteur avant d'être affichés.

## 4. Connexion de la montre (vérifié)
- Android seulement, via **Health Connect** (plugin `capacitor-health`) : bouton « Connecter ma montre » (Forme / Analyses), lecture des séances 365 j, pas 7 j, sommeil, FC repos. Plus : import de fichiers .GPX / .TCX / .FIT.
- Limites : il faut que l'appli de la montre écrive dans Health Connect (Garmin ne le fait pas nativement) ; rien sur iPhone (pas d'appli iOS) ; le lien est mémorisé par téléphone.
- Pistes : (a) écran guidé par marque (Samsung, Google/Fitbit, Garmin via une appli relais, Polar/Suunto/Coros) ; (b) synchro automatique à l'ouverture + date de dernière synchro visible ; (c) connexion **Strava** (API OAuth ouverte aux développeurs) pour les sorties ; (d) Garmin / Polar en direct : programmes partenaires à demander, pas garanti.

## 5. Blocs « Ton plan de la semaine », « Ta force estimée · 6 semaines », « Fréquence par muscle » (données réelles)
- **Plan** : 3 actions, cohérentes avec les diagnostics (Smith 75 kg ou 70 kg ; +4 séries Pendulum ; +4 séries Leg curl). Point d'attention : « +4 séries d'un seul exercice » en une séance, c'est beaucoup → proposer de répartir (ex. +2 / +2 sur 2 séances ou 2 exercices).
- **Force 6 semaines** : « Arrière épaule à la poulie **+24 %** » alors que le même exercice est **« bloqué »** ailleurs (7,5 kg × 10 depuis plusieurs séances). Les deux sont vrais (progrès il y a 3-6 semaines, plateau depuis), mais côte à côte c'est contradictoire → afficher « bloqué depuis N séances » sur la ligne, ou la tendance récente.
- **Fréquence par muscle** : en vue Semaine, affiche « Pas encore assez de recul (4 jours) » → vide une bonne partie de la semaine. Proposé : fréquence calculée sur les **4 dernières semaines terminées** (comme le volume des alertes).

## 6. Exercice bloqué — conseil « change de variante » (vérifié `js/lecture-v3.js`, `_lv3Diag`)
- Causes testées : charge trop lourde, échec répété, volume du muscle, effort en hausse, fréquence, **bas** de fourchette. Sinon → « persiste… si ça dure, **change de fourchette ou de variante** » (intermédiaire) / « change de fourchette ou de variante 3-4 semaines » (avancé).
- Cas réel : Arrière épaule à la poulie 7,5 kg × 10, fourchette 8-20 → aucune cause → « change de variante ». Pas adapté : sur un petit exercice d'isolation, la marche suivante (+2,5 kg sur 7,5 kg = **+33 %**) est trop grosse.
- Proposé, avant le « sans cause » :
  - **pas encore en haut de la fourchette** → « garde X kg, +1 rep par séance jusqu'à [haut] » (double progression) ;
  - **marche de charge trop grosse** (≥ 15 % de la charge) → « monte quand tu fais [haut] reps sur toutes les séries ; la marche suivante fait +N % (micro-disques ou poulie au plus petit cran si possible) » ;
  - « change de variante » réservé aux avancés, en dernier recours, jamais sur un débutant.
