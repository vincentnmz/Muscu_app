# Audit des leviers contre la littérature scientifique — 21/11/2026

Demande porteur : « vérifier tous les leviers et regarder si la science / des articles permettent quelque chose de 100 % cohérent ».
Source des leviers : `js/lecture-v3.js` (`_lv3Diag`), `js/app.js` (`_levierRepos`, `_LEVIERS_BLOCAGE`).

**Limite honnête** : aucune étude ne garantit un résultat à 100 % pour un individu. Les méta-analyses donnent des effets moyens,
souvent petits, avec beaucoup de variabilité. Le but réaliste : chaque levier (a) s'appuie sur une étude réelle, ou (b) est
marqué comme « logique d'entraînement » quand aucune étude ne le teste — jamais présenté comme prouvé s'il ne l'est pas.

## Ce que disent les études (références vérifiées par recherche, 21/11)

| Sujet | Résultat | Référence |
|---|---|---|
| Volume / semaine | Plus de séries → plus d'hypertrophie, rendements décroissants (plus marqués pour la force) | Pelland et al. 2024 (préprint SportRxiv, méta-régression 67 études) ; Baz-Valle et al. 2022 (J Hum Kinet) : 12-20 séries/sem/muscle |
| Fréquence | À volume égal, pas d'effet net sur l'hypertrophie ; effet identifiable sur la force | Schoenfeld, Grgic, Krieger 2019 ; Pelland 2024 |
| Repos entre séries | Petit bénéfice au-delà de 60 s ; **aucune différence mesurée au-delà de 90 s** (hypertrophie) | Singer et al. 2024 (Front Sports Act Living) |
| Proximité de l'échec | Plus près de l'échec → plus d'hypertrophie ; la force bouge peu selon la réserve | Robinson et al. 2024 (Sports Med) |
| Échec complet vs presque | Pas d'avantage à l'échec strict sur « près de l'échec » | Refalo et al. 2023 (Sports Med) |
| Charge légère vs lourde | Hypertrophie similaire si séries proches de l'échec ; force meilleure avec charges lourdes | Schoenfeld et al. 2017 (JSCR) ; Lopez et al. 2021 |
| Varier les fourchettes (périodisation) | Petit gain de force (ES 0,31), **pas d'effet sur l'hypertrophie** | Moesgaard et al. 2022 (Sports Med, 35 études) |
| Varier les exercices | Variation systématique : utile ; rotation excessive/aléatoire : peut nuire | Kassiano et al. 2022 (JSCR) |
| Ordre des exercices | Plus de gain de force sur les exercices faits en premier ; hypertrophie identique | Nunes et al. 2021 (Eur J Sport Sci) |
| Déload (1 semaine d'arrêt) | Hypertrophie identique, force du bas du corps un peu moins bonne | Coleman et al. 2024 (PeerJ) |
| RPE / RIR | Échelle utile, mais les pratiquants sous-estiment souvent leur réserve | Zourdos et al. 2016 ; Steele et al. 2017 |
| Autorégulation (RPE) | Pas de différence nette avec une charge fixe | Hickmott et al. 2022 (Sports Med Open) |

## Verdict levier par levier

| # | Levier (déclencheur) | Verdict | Commentaire |
|---|---|---|---|
| 1 | Sous la fourchette à RPE ≥ 9 → petit pas −5 % puis +1 rep | **Soutenu** | Baisser un peu la charge ne coûte pas d'hypertrophie si on reste proche de l'échec (Schoenfeld 2017). |
| 2 | Volume du muscle < minimum → + séries | **Soutenu** | Dose-réponse (Pelland 2024, Baz-Valle 2022). |
| 3 | Effort en hausse à charge égale → garder la charge, viser RPE 8, sinon −10 % | **Partiellement** | Lire la hausse du RPE comme de la fatigue = logique d'entraînement (échelle RIR, Zourdos 2016). Le « −10 % » est une pratique, aucune étude ne fixe ce chiffre. |
| 4 | Fréquence ≤ 1×/sem → répartir sur 2 séances | **Faible pour l'hypertrophie** | À volume égal, la fréquence ne change rien (Schoenfeld 2019) ; utile surtout parce que ça permet d'ajouter du volume, et pour la force (Pelland 2024). |
| 5 | Repos raccourci (≥ 30 s de moins) → revenir au repos habituel | **Soutenu** | Moins de repos = moins de reps dans les séries suivantes ; cohérent avec Singer 2024 sous 90 s. |
| 6 | Réserve (RPE ≤ 8) → dernière série à RPE 9-10 | **Soutenu, à nuancer** | Plus près de l'échec = plus d'hypertrophie (Robinson 2024), mais l'échec strict n'apporte rien de plus (Refalo 2023) → viser **RPE 9** suffit. |
| 7 | Série plus légère avant, dont les reps montent → la garder au niveau d'avant | **Logique, non testé** | Aucune étude ne teste ce cas précis ; c'est de la gestion de fatigue. |
| 8 | Marche de charge ≥ 15 % → micro-disque | **Logique, non testé** | Pas d'étude sur la taille des paliers ; bon sens. |
| 9 | Gêne sur la zone → ne pas pousser, avis kiné | **Prudence** | Pas une question d'efficacité, c'est un garde-fou. |
| 10 | Option « +30 s de repos » quand repos < 3 min | **NON soutenu au-delà de 90 s** | Singer 2024 : aucune différence d'hypertrophie au-delà de 90 s. « 2 min → 2 min 30 » n'a pas d'appui ; « 50 s → 1 min 20 » en a. |
| 11 | Aucune cause visible → « garde ta charge ; si ça dure, change de fourchette 3-4 semaines » | **Faible** (retour porteur : « n'apporte rien ») | Changer de fourchette ne fait rien pour l'hypertrophie (Moesgaard 2022), petit effet sur la force. Le levier le mieux soutenu quand le volume n'est pas haut est **+ séries sur le muscle** (dose-réponse). |
| 12 | « Le placer plus tôt dans ta séance » (texte générique) | **Soutenu pour la force** | Nunes 2021. |

## Propositions (à valider par le porteur)

- **P1 — Option repos** : ne la proposer que si le repos de travail est **< 90 s** (cible 90 s). Au-delà, plus d'option repos.
- **P2 — « Aucune cause visible »** remplacé par un levier actionnable, dans cet ordre :
  1. volume du muscle < 20 séries/sem → **« +2 séries de X par semaine »** (dose-réponse, chiffré avec le volume réel) ;
  2. sinon → **« place X en premier dans ta séance pendant 3-4 semaines »** (Nunes 2021) ;
  3. sinon → **variante proche de l'exercice pendant 4 semaines** (Kassiano 2022).
  Le texte dit honnêtement ce qui n'est pas mesuré (sommeil, alimentation, stress hors questionnaire).
- **P3 — Réserve** : « va jusqu'à RPE 9 (≈ 1 rep en réserve) » au lieu de « RPE 9-10 (0 à 1 rep) ».
- **P4 — Effort en hausse** : garder, mais retirer le « −10 % » chiffré → « allège la charge ou une série cette semaine ».
- **P5 — Fréquence** : présenter « 2 séances/sem » comme un moyen d'ajouter des séries, pas comme un effet en soi.
- **P6 — Bouton « D'où vient ce conseil ? »** sous le levier : la référence (auteur, année) — à décider (lisibilité).

## Décisions du porteur (21/11) — codées
- Bloqué : **4 semaines** minimum de plateau (≈ 1 séance/sem par exercice → 3 séances ne suffisent pas).
- Repos : « +30 s » gardé, **selon le type d'exercice** — gros/moyen (poly-articulaires) sous 2 min (Schoenfeld 2016 : 3 min > 1 min en force et en muscle), isolation / non classé sous 90 s (Singer 2024), plafond 3 min.
- « Aucune cause visible » **par niveau** : débutant = régularité ; intermédiaire = +2 séries/sem (si < 20) ou exercice en début de séance ; avancé/expert = idem + **tempo à tester** (descente 2-3 s, montée rapide ; Wilk 2021 ; 0,5-8 s/rep = même hypertrophie, Schoenfeld 2015) ou variante proche 4 semaines.
- P3 (RPE 9), P4 (sans −10 %), P5 (fréquence = moyen d'ajouter des séries) : codées. P6 (référence affichée) : non retenue pour l'instant.
