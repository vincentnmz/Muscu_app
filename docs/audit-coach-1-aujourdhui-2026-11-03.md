# Audit coach — écran 1 : « Aujourd'hui » (03/11/2026)

Code : `renderCoachSynthese` (js/app.js), `computeMarqueursCoach`, `infoPrio`, `labelAlerteCourt`, `handleGetCoachAthletes` (index.ts).
Données : coach 1, **rejoué sur les vraies données** de Vincent (copie du 02/11) et d'Alizé (base au 03/11). John et Yann **simulés** à partir de leurs vraies dates (dernière séance 17/09 ; aucune séance).
Capture : `mockups/audit-coach-aujourdhui-avant.png`.

## Ce qui est juste ✅ (vérifié dans le code)
- Le hero est cohérent : « à surveiller » + « intervention » = « à voir » (4 = 2 + 2) ; % à jour = (total − à voir) / total.
- Seuils d'absence : plus de 7 jours → orange, plus de 14 jours → rouge ; athlète en vacances jamais listé.
- Les questionnaires sont pris sur 7 jours : dernier bien-être de chaque athlète, fatigue ≥ 4 en rouge.
- Le bloc « Analyse Novalyz » est vide **à raison** aujourd'hui : le moteur ne sort que du « succès » (Vincent) ou de l'« info » (Alizé), et le bloc ne montre que les avertissements.

## Constats
| # | Constat | Proposition |
|---|---|---|
| **A1** | **Absence = muscu seule.** Alizé : « 27 jours sans séance » en rouge (intervention), alors qu'elle a fait du cardio le 25/10 (9 j). Côté athlète, le moteur (`derniere_activite`) et les rappels push comptent muscu **et** cardio (hors marche) : le coach et l'athlète ne disent pas la même chose. | Utiliser `moteur.derniere_activite` pour la gravité, avec ce texte : « 27 j sans muscu · cardio il y a 9 j ». Elle passe alors en **orange** (pas de rouge si une activité a eu lieu dans les 14 derniers jours). |
| **A2** | **« douleur » en minuscule brute** : Vincent apparaît en priorité avec le mot « douleur ». En réalité, c'est « Gêne légère signalée » (sévérité basse, 02/11). La table des libellés ne connaît pas les types du moteur (`douleur`, `absence`, `fatigue`…). | Afficher le titre du moteur et sa date : « Gêne légère signalée · 02/11 ». Garder l'athlète en orange : une gêne doit rester visible pour le coach. |
| **A3** | **Carrés vides** à gauche de chaque ligne prioritaire : l'icône est une chaîne vide. | Mettre les initiales, comme dans les autres blocs, avec la couleur de gravité. |
| **A4** | **L'entraînement n'apparaît pas** sur l'accueil coach : seulement les absences et les alertes bien-être. Le plan de la semaine et les « Pourquoi ça coince » existent déjà (même calcul que chez l'athlète) mais ne sont visibles que dans la fiche. Exemple réel : Vincent, « Smith incliné : proposé 75 kg (ou 70) » · « Élévation frontale : effort en hausse ». | Nouveau bloc **« Entraînement à regarder »** : 1 ligne par athlète, avec le premier diagnostic ou la première action du plan, puis « ✓ 1/3 fait » pour l'avancement du plan. On clique pour ouvrir la fiche ▸ Progression. |
| **A5** | **Plan de la semaine incohérent après un arrêt.** Alizé : « Fessier +4 séries de Hip thrust · Ischio +4 séries de RDL ». Elle n'a fait aucune séance de muscu depuis le 07/10 : le volume est jugé « bas » simplement parce qu'elle ne vient plus. Ce même plan est montré à l'athlète. | Si aucune séance muscu dans les 14 jours avant lundi, le plan devient **une seule action : « Reprendre : 1 séance cette semaine »**, sans ajout de séries. |
| **A6** | **« relancer → » ne relance pas** : il ouvre seulement la fiche. | Au choix : **a** renommer en « voir → » ; **b** vraie relance : ouvrir la conversation avec un message prérempli, « Petit rappel : remplis ton ressenti du jour 🙂 », que le coach envoie lui-même. |
| **A7** | **Ordre des blocs** : les messages non lus sont en bas, après les questionnaires. Alizé apparaît 3 fois (priorité, questionnaire, message). | Monter « Messages non lus » juste sous « À traiter ». Sur la ligne prioritaire, ajouter une pastille « 💬 1 » quand l'athlète a écrit. |
| **A8** | **Coût réseau** : `getCoachAthletes` calcule déjà les données de chaque athlète côté serveur, puis le front redemande `getAppData` et `getCommentaires` pour chacun, soit 3 appels lourds par athlète. Ça passe à 4 athlètes, pas à 25 (club). | Pas pour ce lot : à traiter avec la montée en charge (une seule action « accueil coach »). Noté dans la roadmap bêta. |

## Décisions porteur (03/11)
Validé : tout ; **A6 = b** (conversation ouverte avec message prérempli, envoyé par le coach) ; **A8 plus tard**.
Souhait : **photos des athlètes** dans les carrés à terme → A3 fait un avatar « photo si disponible, sinon initiales » ; l'envoi de la photo (Réglages athlète ou coach) = lot à part (backlog).
Maquette : `mockups/coach-aujourdhui-v2.html` (+ `-1.png`, `-2.png`).

## Réalisé (03/11)
- **A1** Absence = muscu **et** cardio hors marche (`moteur.derniere_activite`) : « 27 j sans muscu · cardio il y a 9 j », orange ; rouge seulement après 14 j sans **aucune** activité. Même règle pour le KPI « absents », le filtre Équipe « Inactifs » et le statut « Inactif » (`computeMarqueursCoach`). Repli sur la dernière séance muscu tant que le serveur n'envoie pas le moteur.
- **A2** Libellé = titre du moteur + date (« Gêne légère signalée · 02/11 ») ; repli = type avec majuscule.
- **A3** Carré = photo de l'athlète si `photo_url` existe (à venir), sinon initiales colorées selon la gravité (`_coachAv`).
- **A4** Bloc « Entraînement à regarder » (mobile + bureau) : 1re ligne du diagnostic ou du plan + « Plan x/n fait » ; clic → fiche ▸ Analyses ouverte sur l'exercice (comme « Voir le détail »).
- **A5** Plan de la semaine : aucune séance muscu dans les 14 j avant lundi → une seule action « Reprendre : 1 séance de muscu cette semaine », cochée dès qu'une séance muscu est faite (athlète et coach).
- **A6** « relancer → » ouvre la conversation avec le message prérempli (le coach l'envoie lui-même) — mobile + bureau.
- **A7** Messages non lus remontés sous « À traiter » + pastille 💬 sur la ligne prioritaire.
- **Défaut trouvé en vérifiant** (existait avant) : fiche ouverte directement sur Analyses (et rechargement sur cet onglet) → analyses vides, car affichées avant l'arrivée des données. Corrigé. `maVoirPourquoi` côté coach visait un onglet inexistant (`progression` → `prog`) : corrigé.
- À voir à l'écran 4 (Progression coach) : bouton « Importer mes séances » visible côté coach ; textes adressés à l'athlète (« ta fourchette »).
- Tests : `coach-accueil` (6 cas, nouveau), `lecture-v3` (18 cas) ; 77 suites vertes. Captures relues : accueil mobile, bureau, relance (mobile + bureau), ouverture Analyses, plan d'Alizé côté athlète. Capture : `mockups/coach-aujourdhui-apres.png`.
