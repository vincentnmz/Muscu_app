# Audit — « Lecture Novalyz · Analyses ▸ Ce que Novalyz lit » + « Reco du jour » (Aujourd'hui) — 14/11/2026

> Demande du porteur. **Aucune modification du moteur** (phase d'observation) : constats + options, décision au porteur.
> Données : copies réelles (John prod 13/11, compte A 11/11, Lucas préprod). Légende : **[V]** vérifié code + données · **[D]** déduction.

## 1. « Ce que Novalyz lit » (Analyses ▸ Résumé)

Sources [V] : constats du serveur (`analyse_synthese.muscu.constats`, `index.ts`) + classement des exercices
`_lectureExos` (`js/app.js`) + « Pourquoi / Levier » (`_lv3Diags`) + titre de la carte (`moteur.disponibilite.niveau`).

| # | Gravité | Constat | Preuve |
|---|---|---|---|
| L1 | **Élevée** | **« Progresse » = 1 rep de plus qu'à la séance précédente**, même si ce niveau était déjà atteint avant (simple oscillation). Comme « progresse » est testé **avant** « bloqué », un exercice qui oscille (9-10-9-10 reps à la même charge) n'est **jamais** « bloqué » mais affiché « en progrès ». | [V] règle `dj ≤ 14 && (c0 > c1 \|\| r0 > r1)` ; John : **5/5** « en progrès » reviennent à un niveau déjà atteint (Squat 105 × 9-10 depuis le 18/10 = 7 séances à plat) ; Lucas 1/9 |
| L2 | **Élevée** | **Le titre « Sur la bonne voie / Ajuste le tir » vient de l'état du jour** (récup), pas de l'entraînement des 4 semaines annoncées. Lucas : « Ajuste le tir » avec 18 exercices en progrès ; John : « Sur la bonne voie » avec volume −21 % et 0/4 séances. | [V] `niv = moteur.disponibilite.niveau` → `VB` |
| L3 | Moyenne | Avec 2 exercices « bloqués », le **« Pourquoi / Levier » ne concerne que le 1er** mais n'est pas nommé : on peut l'attribuer au 2e. | [V] `_pq(L.bloque[0].exo)` ; Lucas (2 bloqués, gêne épaule) |
| L4 | Faible | « 3 séries à 10 reps au lieu de 1 » se lit « 3 séries au lieu d'1 série » (sens réel : 3 séries ont atteint 10 reps, contre 1 la fois d'avant). Double espace après certains noms (nom d'exercice avec espace final). | [V] compte A |
| L5 | Faible | Fenêtres différentes dans une carte titrée « 4 dernières semaines » : records = 10 jours, progrès = séance précédente, régularité = cette semaine (chaque ligne le dit, mais le titre généralise). | [V] |
| L6 | Faible | « Bloqué depuis 12 séances » + « force +13 % sur 6 semaines » pour le même exercice (John, Tirage vertical) : les deux sont vrais (hausse de 65 → 75 kg il y a 5 semaines, plat depuis) ; la carte force l'indique déjà. | [V] |

Vérifiés justes [V] : volume ±%, « pause de 12 jours : évolution pas représentative », « 0/4 séances cette semaine » (John :
dernière muscu le 05/11), records, « sous ta fourchette », bloqué Lucas (67,5 × 6 depuis 5 séances, RPE qui monte), pas de
double comptage records / progrès.

## 2. « Reco du jour » (Aujourd'hui)

Sources [V] : **phrase du moteur d'état du jour** (`moteur.reco`, `index.ts` ~l. 3735 : priorité indispo → données
insuffisantes → douleur → récup faible → charge haute → vigilance → absence ≥ 7 j → **sinon « RAS — maintenir la charge
actuelle. »**) + éventuellement « Séance du jour (…) : N exercices à pousser / … sous ta fourchette » (`_tjCibles`).

| # | Gravité | Constat | Preuve |
|---|---|---|---|
| R1 | **Élevée** | Cas le plus courant chez un athlète en forme : **« RAS — maintenir la charge actuelle. »** — jargon (RAS) et rien d'actionnable. | [V] John prod 13/11 |
| R2 | **Élevée** | « Maintenir la charge actuelle » **contredit** d'autres lignes : le moteur classe la charge récente **en sous-charge** (John : ratio 0,18, `acwr_categorie: sous_charge`, volume −21 %) ; le plan de la semaine et « Ce que Novalyz vise » proposent +1 rep / + charge. | [V] John |
| R3 | Moyenne | Redit l'état du jour déjà affiché juste au-dessus (douleur, vigilance) au lieu d'ajouter une action. | [V] Lucas : « Douleur modérée… » |
| R4 | — | Utile quand un signal existe : « Ta charge monte — renseigne ton état du jour… » (A), douleur (Lucas). | [V] |

## Options (décision porteur — touchent la règle de classement ou le moteur)

- **L1** : « progresse » seulement si la séance dépasse le **meilleur des N dernières séances** (N = seuil « bloqué » du niveau) ;
  sinon l'oscillation compte dans « bloqué ». Change le moteur de classement → contrôle sur données + tests avant.
- **L2** : titre tiré de l'entraînement (progrès / bloqués / volume / régularité), l'état du jour restant sur Aujourd'hui.
- **L3** : nommer l'exercice dans « Pourquoi (Développé couché barre) ».
- **R1-R2** : remplacer le défaut « RAS » par la **première action concrète du jour** déjà calculée ailleurs (séance du jour :
  exercices à pousser ; sinon plan de la semaine ; sinon « jour de repos prévu »), ou **masquer** la reco quand il n'y a rien
  à dire. Ne jamais dire « maintenir » quand le moteur classe en sous-charge.
