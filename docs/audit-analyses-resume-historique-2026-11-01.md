# Audit — Analyses muscu ▸ Résumé et ▸ Historique (01/11/2026)

Méthode : vraie app rendue (Playwright) sur la copie réelle des données (Semaine, Semaine précédente, Mois, Octobre, Année, Historique), chaque chiffre recalculé indépendamment (Python) et confronté au code (`_maMuscuResume`, `_maMuscuAgg`, `_maMuscuHistorique`, `_maFiabilite`).

## Juste ✅
- Séances, séries, répétitions, RPE moyen, tonnage moyen / séance : identiques au recalcul pour la semaine en cours (4 · 67 · 601 · 8,4 · 4,6 t), la semaine du 19/10 (2 · 44 · 362 · 4,6 t), octobre (14 · 264 · 2 276 · 4,9 t) et l'année (43 · 877 · 8 004 · 6 t).
- Lecture Novalyz (4 sem.) : 18 exos en progrès dont 8 records, 1 sous la fourchette — cohérent avec le classement.
- Balance en séries (Pecs 18 / Dos 18 → 50/50 ; Quadri 6 / Ischios 4 → 60/40).
- Historique : séances, exos, séries, tonnage par séance (ex. 30/10 dos jambe 2 : 4 exos · 11 séries · 3,2 t).

## Défauts

| # | Où | Constat | Correctif proposé |
|---|---|---|---|
| **R1** ❌ | Résumé ▸ Volume musculaire | La cible est multipliée par le nombre de semaines **de la période entière** (`Math.round(jours/7)`) : en Année, ×52 semaines alors que l'année n'est pas finie et que tes séances ont commencé le 15/06 → **tous les muscles « Sous-MEV »** (ex. Dos 212 séries = ~10/sem. réelles depuis juin). | Semaines réellement couvertes : du début de la période (ou de ta 1ʳᵉ séance si plus tard) jusqu'à aujourd'hui pour la période en cours ; jours exacts ÷ 7. |
| **R2** ❌ | Résumé ▸ « Records battus » | Compte les exercices dont le **meilleur de tous les temps** date de la période — y compris la **1ʳᵉ fois** qu'un exercice est fait (rien n'a été « battu »). Année : 57 = tous les exercices faits ; octobre : 21 alors que 16 records réels (le mail en dit 16, la lecture 8 sur 10 jours). | Même définition partout : un record = charge (ou reps à charge égale) au-dessus de ton meilleur **précédent** ; la 1ʳᵉ fois n'en est pas un. Calcul serveur (historique complet) partagé app + mail. |
| **R3** ❌ | Fiabilité des données | « Cibles de programme définies 0/15 » exige un %1RM ou un RPE cible dans le programme — que **rien n'utilise** dans la lecture. Ton programme a des fourchettes de reps (et des catégories) → −15 points injustifiés (84 au lieu de 99). | Critère = « fourchette de reps définie (programme ou catégorie) ». |
| **R4** ❌ | Mail récap (mon erreur du 01/11) | Le mail compte les muscles secondaires à 0,5 série et écrit « comme dans l'app » : **faux**, le Résumé de l'app ne les compte pas (Biceps octobre : app 12 séries, mail ≈ 42 avec les secondaires des tirages). | 🟠 Décider : (a) secondaires à 0,5 aussi dans l'app (comme le « muscle en retard » du serveur) — recommandé ; ou (b) mail sans secondaires. |
| **R5** | Historique | « 3.2 t » (point) ; la pastille de droite (RPE de séance du bilan) n'a pas de libellé — visible seulement au survol (impossible sur téléphone). | « 3,2 t » ; « RPE 6 » écrit. |
