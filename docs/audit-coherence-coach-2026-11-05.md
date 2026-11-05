# Audit cohérence visuelle ordi ↔ mobile — espace coach (05/11/2026)

Captures côte à côte : `mockups/audit-coherence-coach.png` (ordi 1280 px à gauche, mobile 390 px à droite), mêmes données (Vincent + Alizé).
Script : `.work/coh.mjs` / `.work/coh2.mjs`.

## Cause (vérifiée dans le code)
Deux rendus distincts : ordi = shell `#coach-rail` + `#coach-shell` (`renderCoachHome`, `_coachDeskAujourdhui`, `_coachDeskEquipe`…), mobile = ancien accueil `#view-coach` + bandeau bas `#coach-bandeau` (`coachBandeauGo`). Commentaire `index.html` : « SHELL DESKTOP (≥992px ; mobile strictement inchangé) ». Les écrans **partagés** (Analyses équipe `_aeHtml`, fiche ▸ Analyses / Séances, Profil) sont déjà cohérents ; les écarts se concentrent là où il y a deux fonctions de rendu.

## Écarts par écran

### 1. Aujourd'hui
- C1 · Mobile **sans** « À surveiller en priorité », « Messages non lus », « Lecture Novalyz · équipe » (présents sur ordi).
- C2 · Questionnaires bien-être : ordi = 1 carte liste à puces (« fatigue 3/5 » en gris) ; mobile = 1 carte par athlète, avatar, fatigue colorée.
- C3 · Titres de section : ordi = titre simple / en-tête de carte en capitales ; mobile = icône + titre + lien bleu (« plan de la semaine »).
- C4 · Avatars : rond gris (ordi) vs carré arrondi coloré (mobile).
- C5 · En-tête : ordi = titre de page « Aujourd'hui » ; mobile = « Espace coach / Vincent COACH » + boutons + et déconnexion, sans titre de page.

### 2. Équipe
- E1 · Ordi = tableau (Niveau, État, Dernière activité, Assiduité, Plan) ; mobile = cartes (RPE 7 j, Tonnage, Régul., Plan). **Pas les mêmes informations** : niveau et dernière activité absents sur mobile, RPE et tonnage absents sur ordi.
- E2 · Libellés différents pour la même donnée : « Assiduité » (ordi) vs « Régul. » (mobile).
- E3 · Mobile : liseré coloré à gauche + avatar vert ; ordi : avatar gris, pas de liseré.

### 3. Analyses équipe — cohérent (même rendu `_aeHtml`), rien de bloquant
- A1 · Mobile sans titre de page « Analyses » (cf. C5).

### 4. Fiche ▸ Aperçu
- F1 · Navigation : ordi = barre d'onglets (Aperçu · Progression · Séances · Programme · Conversation) ; mobile = **pas d'onglets**, seulement des boutons au milieu de l'Aperçu (Entraînement · Analyses · Programme · Son état).
- F2 · Noms incohérents : onglet « Progression » → page « Analyses » ; onglet « Séances » → page « Entraînement » ; bouton mobile « Entraînement ».
- F3 · Blocs différents : ordi « Charge & assiduité » (RPE moy, tonnage, régularité, ACWR) + « Ma montre » ; mobile « Repères » (régularité, ACWR, dernière séance, plan), pas de « Ma montre ».
- F4 · Mobile sans « Contexte de performance » (Saison normale / Poser un état) ni « Proposer un déload » ; ordi sans « Réinitialiser le mot de passe ».
- F5 · Même bloc, deux titres : « Dernières séances » (ordi) vs « Comment il s'entraîne » (mobile).
- F6 · Ordre des blocs différent (actions en haut à droite sur ordi, au milieu sur mobile).

### 5. Fiche ▸ Analyses / Séances — cohérents (même rendu)
- S1 · Ordi : contenu Analyses sur ~620 px, colonne droite vide.
- S2 · Mobile : le fond s'arrête avant le bas de la page (zone blanche) sur les pages courtes.

### 6. Fiche ▸ Programme
- P1 · Ordre inverse : ordi = constructeur d'abord, réglages (propositions, zones, semaine) dessous ; mobile = réglages d'abord, séances en accordéon dessous.
- P2 · Ordi seulement : « Ma semaine » (lundi→dimanche / 7 jours), « Volume de la séance ». Mobile seulement : encadrés « Novalyz propose cette semaine » sous chaque séance.
- P3 · Séances : liste latérale (ordi) vs pastilles bleues + corbeille rouge (mobile).

### 7. Messages
- M1 · En-tête : mobile = bandeau bleu « Messages » ; ordi = en-tête blanc « Conversations ». Titre différent.

### 8. Profil — cohérent entre ordi et mobile
- R1 · Mais en-tête bleu (ordi et mobile) alors que les autres écrans ont un en-tête blanc ; boutons et champs en police système (pas Quicksand).

## Transversal
- T1 · En-têtes : 3 styles (blanc + titre, blanc « Espace coach », bandeau bleu).
- T2 · Avatars : 2 styles. · T3 · Titres de section : 2 styles. · T4 · Police système sur certains boutons / champs.

## Proposition de lots
1. **Lot 1 — Socle commun** : un seul en-tête (titre de page partout, logo), un seul style d'avatar, de titre de section et de carte, police Quicksand partout (T1-T4, C3-C5, M1, R1, A1, S2).
2. **Lot 2 — Aujourd'hui + Équipe** : mêmes blocs sur les deux formats (C1-C2), mêmes infos et libellés dans Équipe (E1-E3).
3. **Lot 3 — Fiche** : barre d'onglets aussi sur mobile, mêmes noms d'onglets et de pages, mêmes blocs dans l'Aperçu (F1-F6, S1).
4. **Lot 4 — Programme** : même ordre et mêmes blocs (P1-P3).

Chaque lot : maquette → validation → code → captures avant/après 1280 / 390 / 360.
