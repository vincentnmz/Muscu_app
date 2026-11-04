# Audit coach — écran 8 : Messagerie (04/11/2026)

Rendu réel (mobile 390 + bureau 1280) avec les vrais messages de Vincent et Alizé (table `commentaires`, lecture seule) + un message athlète non lu simulé. Code : `ouvrirMessagerieCoach` / `_msgFillList` (liste), `ouvrirMessagerie2` / `_msg2Open` (bureau 2 volets), onglet fiche `cdtab-conseils` (`renderConversationAlertes`, `renderBullesChat`, `repondreAlerte`, `envoyerCommentaireCoach`).

## Constats (vérifiés)

| # | Où | Constat |
|---|---|---|
| M1 | Mobile : liste → conversation (et accueil « Messages non lus ») | **Les messages ne sont pas marqués lus** : `ouvrirConversationDepuisMessagerie` → `ouvrirDetailAthleteCoach(a,'conseils')` n'appelle pas le marquage (seul le bouton d'onglet « Conversation » le fait, et sur les messages de l'athlète précédemment chargé). Vérifié : aucun `marquerCommentairesLus`, badge toujours à 1, bulle « non lu ». Le bureau, lui, marque bien (`_msg2MarkRead`). |
| M2 | Liste | L'heure seule est affichée quel que soit le jour : Vincent « 20:41 » pour un message du **12/09** → on croit à aujourd'hui. |
| M3 | Bureau | Bulles de l'athlète **sans fond** (même couleur que le panneau) → on ne distingue pas les messages reçus. |
| M4 | Conversation (fiche) | « Alertes de la semaine » : icônes vides (carrés colorés), aucune action (ni répondre ni marquer traité) — doublon passif du bloc de l'Aperçu. |
| M5 | Conversation | « Répondre » préremplit « À propos de : X\n\nMon conseil : » — tournure robot (messages réels : « À propos de : Volume insuffisant — Aucune séance … »). |
| M6 | Conversation | Bloc « Analyse morpho · Prochainement » épinglé en tête du fil (mobile et bureau) : bruit dans une conversation. |
| M7 | Liste | Initiales simples (pas `_coachAv`), pas de contexte (état, gêne, séance du jour), pas de filtre « non lus », pas de recherche ; John / Yann « Aucun message » sans action. |
| M8 | Bureau | Le fil n'a aucun contexte athlète : pour répondre à « j'ai mal à la hanche », il faut quitter la messagerie et ouvrir la fiche. |
| M9 | Bulles | Avatar de l'athlète = 2 premières lettres du prénom (« AL », « VI ») ≠ initiales ailleurs (« A », « V »). |

## Propositions

- **P1 (bug)** : marquer lus à l'ouverture du fil quel que soit le chemin (liste mobile, accueil, onglet, bureau), APRÈS chargement des messages de CET athlète.
- **P2** : heure si aujourd'hui, « Hier », sinon jj/mm.
- **P3** : bulles reçues avec fond contrasté sur ordi.
- **P4** : remplacer « Alertes de la semaine » par une barre **Contexte** compacte au-dessus du fil : état (ex. « gêne hanche 2/5 aujourd'hui »), dernière séance, séance du jour / en retard, plan x/n — chaque point avec « Répondre » (préremplit) et « Traité ».
- **P5** : préremplissage naturel avec le fait : « Au sujet de ta gêne à la hanche (2/5 ce matin) : … ».
- **P6** : retirer le bloc morpho du fil (il reste accessible depuis la fiche quand il sera prêt).
- **P7** : liste enrichie — avatar, pastille d'état (même règle que l'accueil), aperçu daté, filtre « Non lus », recherche ; « Écrire » sur les athlètes sans message.
- **P8** : bureau — volet Contexte à droite du fil (état, douleurs 7 j, dernière séance, plan, lien « Ouvrir la fiche »).
- **P9** : initiales cohérentes.

## Ajouts proposés

- **N1 Messages rapides** préremplis avec les faits : relancer le ressenti, séance en retard (« dos jambes prévue mardi »), féliciter un record (« record au Développé décliné machine »), douleur signalée.
- **N2 Message à plusieurs** : choisir des athlètes (ou un filtre : « sans ressenti 7 j », « inactifs ») → même message à chacun, dans son fil.
- **N3 Lien séance** : un message envoyé depuis une séance (« 🚩 Gêne/douleur — Rowing bucheron ») ouvre la séance concernée.
