# Audit coach — écran 5 : Fiche ▸ Séances + saisie par le coach (04/11/2026)

Cap porteur : aider le coach à décider (faits, ce qui est proposé, actions) ; + « si l'écran manque de choses pertinentes, propose ».
Code : `chargerSeancesDetailCoach` (action `getSeancesDetail`), `seancesCardsHTML`, `renderCoachSeancesDetail` (secours), `coachSaisirSeance`.
Données : Vincent (copie 02/11) et Alizé, rejouées avec la vraie action serveur `getSeancesDetail`. Captures : `mockups/audit-coach-seances-avant.png`, `mockups/audit-coach-saisie-avant.png`.

## Juste ✅ (vérifié)
- Liste des 20 dernières séances avec exercices et séries réels (02/11 : 6 exos · 18 séries ; 27/10 : 20 séries).
- Détail d'une séance : séries (charge, reps, RPE + reps en réserve), cible du programme, tonnage 4,6 t, RPE moyen 8,4, exos prévus 6/6, % de reps dans la cible.
- Saisie en présentiel : bandeau « Saisie pour Vincent · demande-lui son RPE à chaque série · Quitter ».

## Constats
| # | Constat (vérifié) | Proposition |
|---|---|---|
| **S1** | **Le bilan de l'athlète n'apparaît pas** : note de séance (/10), durée, douleur + zone, commentaire. Les données existent (getAppData) — ex. réel : **26/10 « pec epaule » : douleur 2/5, épaule gauche** — invisible pour le coach dans ses séances. | Bandeau « Bilan » en tête de chaque séance : note 6/10 · 84 min · ⚠ douleur 2/5 épaule gauche · « commentaire ». |
| **S2** | **La liste ne dit presque rien** : nom, date, exos, séries. Il faut ouvrir chaque séance pour voir RPE, tonnage, douleur. | Sur la ligne : RPE moyen · tonnage · note de séance · ⚠ si douleur · « saisie par le coach ». |
| **S3** | **Le cardio n'apparaît pas** (Alizé : 75 sorties enregistrées, aucune visible ici). | Filtre Muscu / Cardio / Tout ; ligne cardio compacte (activité, durée, distance, FC, note). |
| **S4** | **Fourchette « cible » fausse pour les petits muscles** : le détail affiche la fourchette brute du programme (8-12) alors que l'app utilise la fourchette de la catégorie partout ailleurs (Écarté machine = petit → 8-20). Écarté 20 kg × 16 marqué **▲ au-dessus** et exclu des « reps dans la cible » (67 % au lieu de 72 %). | Même fourchette que l'app (`_exoFourchette`) : « Cible : 3 × 8–20 · léger ». |
| **S5** | « 7.5 kg » (point) à côté de « 4,6 t » (virgule). | Virgule partout. |
| **S6** | Limité aux **20 dernières** séances, sans « voir plus ». | « Voir 20 de plus ». |
| **S7** | Si le serveur ne répond pas (hors ligne), l'affichage de secours compte **1 série par exercice** (« 6 exos · 6 séries »). | Compter les vraies séries des points de progression. |
| **S8** | **Saisie en présentiel = l'écran Entraînement de l'athlète tel quel** : « TA SEMAINE · CHOISIS TA SÉANCE », « Ton état du jour », « Voir le détail de tes séances », et des boutons hors sujet / à risque pour un coach en salle : **« Régénérer avec Novalyz »** (remplace le programme de l'athlète), « Modifier mon programme », « Mes analyses », agenda, onglet Hyrox. | Mode présentiel épuré : « Séance de Vincent · choisis la séance », questionnaire « Son état du jour — demande-lui » (gardé : utile en présentiel), boutons hors sujet masqués. |

## Propositions (manques pertinents, demande porteur)
| # | Proposition | Pourquoi (aide à décider) |
|---|---|---|
| **N1** | **« vs la fois précédente »** sur chaque exercice du détail : ▲ +2 reps à 70 kg · ▼ −1 rep · = (même calcul que « progresse / recule »). | Le coach voit d'un coup si la séance a fait progresser, sans comparer de tête avec la séance d'avant. |
| **N2** | Bouton **« Commenter cette séance »** → conversation avec « Au sujet de ta séance du 02/11 (pec epaule) : » prérempli. | Retour rapide et contextualisé à l'athlète (comme « Écrire à… » de l'Aperçu). |
| **N3** | Sur la séance : **ce que Novalyz proposait pour ce jour-là** (ex. « Smith : proposé 75 kg ») et si c'est fait (✓) — le plan de la semaine relié à la séance. | Le coach voit si l'athlète a suivi la proposition, et décide de la suite. |
