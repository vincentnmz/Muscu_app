# Audit des règles de la cible en séance contre la littérature — 22/11/2026

Source : `js/app.js` `_progDecision` (cible affichée pendant la saisie et dans « Ta séance du jour »). Même méthode que
`docs/audit-leviers-science-2026-11-21.md` : ce que fait le code, puis ce que disent les études, puis le verdict.

## Les règles, dans l'ordre de priorité du code

| # | Mode | Déclencheur exact | Cible proposée | Verdict |
|---|---|---|---|---|
| 1 | **Reprise** | ≥ 21 jours sans aucune séance | refaire la dernière fois, sans pousser | **Soutenu** — la force se maintient ≈ 3 semaines puis baisse plus vite (McMaster 2013, revue de 27 études, athlètes de sports collectifs). |
| 2 | **Déload** (contexte déclaré) | l'athlète déclare un déload | même charge, mêmes reps, 1 série de moins, RPE ≤ 7 | **Partiellement** — le principe (moins de stress d'entraînement) vient d'un consensus d'experts (Bell 2023, Delphi) ; les chiffres « 1 série, RPE 7 » sont un choix Novalyz, déjà indiqué dans le code. Un déload d'arrêt complet d'1 semaine n'apporte rien de plus (Coleman 2024). |
| 3 | **Sous la fourchette** | majorité des séries < minimum, RPE ≥ 9 | petit pas ≈ −5 % sur ces séries | **Soutenu** — baisser un peu ne coûte pas de muscle si on reste proche de l'échec (Schoenfeld 2017). |
| 4 | **Vigilance** (moteur) | jour en vigilance (douleur, fatigue…) | aucune progression ce jour | **Prudence** — logique d'autorégulation ; l'autorégulation fait au moins aussi bien qu'une charge fixe (Hickmott 2022). |
| 5 | **Échec répété** | RPE 10 deux séances de suite | garder tout, viser RPE 9 | **Soutenu** — l'échec allonge la récupération (Morán-Navarro 2017) sans gain de muscle en plus (Refalo 2023). |
| 6 | **Monter la charge** | toutes les séries au haut de la fourchette, RPE ≤ 8 ; débutant : 1 fois ; sinon 2 séances de suite ou 1 fois à RPE ≤ 7 | + le palier de l'exercice, reps au bas de la fourchette | **Logique, attribution à corriger** — c'est la « double progression » des entraîneurs. Le code cite « ACSM 2009 » pour « 2 séances de suite » : **non vérifié** dans le texte de l'ACSM lors de cette recherche (règle souvent appelée « 2 pour 2 » en pratique). À re-citer ou à présenter comme pratique courante. |
| 7 | **Consolider** | toutes les séries à RPE > 8 | mêmes charges, mêmes reps | **Soutenu** — à RPE 9 il reste ≈ 1 rep ; ajouter une rep pousse vers l'échec, sans bénéfice prouvé (Refalo 2023). |
| 8 | **+1 rep** | séries à RPE ≤ 8 | +1 rep sur ces séries | **Logique** — progression par les reps à réserve suffisante (double progression) ; cohérent avec l'échelle RIR (Zourdos 2016). |
| 9 | **Bloqué** | plateau ≥ 4 semaines (décision 21/11) | garder, la cible suit le levier du diagnostic | **Seuil = décision d'entraîneur** — aucune étude ne définit un « blocage » en semaines (voir ci-dessous). |
| 10 | **Choix (avancé / expert)** quand la charge peut monter | 4 options : charge · charge + 30 s de repos · +1 rep + 30 s · **réduire le repos** | **3 options sur 4 soutenues ; « réduire le repos » NON** — moins de repos = moins de force et de muscle (Schoenfeld 2016 : 3 min > 1 min ; Singer 2024 : petit avantage au-delà de 60 s). Ce n'est pas une progression utile pour la force ou l'hypertrophie. |

## « Bloqué » : combien de semaines ? (retour porteur : un coach parle de 14 semaines sans progrès « pas forcément un problème »)

- **Ce qui est établi** : plus on est entraîné, plus la marge de progression est faible et lente ; les entraînés répondent à des
  doses différentes des débutants (Rhea 2003, méta-analyse de 140 études : intensité et fréquence optimales différentes selon le statut).
- **Ce qui n'existe pas** : aucune étude ne fixe une durée au-delà de laquelle un plateau devient un « problème ». 4 semaines comme
  14 semaines sont des choix d'entraîneur.
- **Proposition** : seuil selon le niveau, et wording neutre pour les confirmés :
  - débutant **4 semaines** (il doit progresser presque chaque séance : un plateau d'un mois est un vrai signal) ;
  - intermédiaire **6 semaines** ;
  - avancé / expert **8 semaines**, et l'étiquette « **Stable depuis N semaines** » plutôt que « Bloqué » (pas d'alarme, le
    diagnostic reste accessible).
  14 semaines rendrait l'information inutile pendant plus de 3 mois ; à trancher par le porteur.

## Propositions (à valider)

- **C1** — Retirer l'option « Réduire le repos » du choix avancé (ou la garder uniquement si le repos dépasse 3 min).
- **C2** — Corriger la référence « ACSM 2009 » de la règle « 2 séances de suite » : la présenter comme pratique courante (double progression).
- **C3** — « Bloqué » selon le niveau : 4 / 6 / 8 semaines + « Stable depuis N semaines » pour avancé / expert.
- Règles 1, 3, 4, 5, 7, 8 : inchangées. Règle 2 (déload) : inchangée, chiffres déjà présentés comme choix Novalyz.

## Références (recherche du 22/11)
- McMaster et al. 2013, Sports Med 43:367 — https://pubmed.ncbi.nlm.nih.gov/23529287/
- Bell et al. 2023, Sports Med Open (Delphi déload) — https://pmc.ncbi.nlm.nih.gov/articles/PMC10511399/
- Coleman et al. 2024, PeerJ — https://peerj.com/articles/16777
- ACSM 2009, Med Sci Sports Exerc 41:687 — https://pubmed.ncbi.nlm.nih.gov/19204579/ (règle « 2 séances » non retrouvée dans les extraits consultés)
- Rhea et al. 2003, Med Sci Sports Exerc — https://pubmed.ncbi.nlm.nih.gov/12618576/
- Schoenfeld et al. 2016, JSCR (repos) — https://pubmed.ncbi.nlm.nih.gov/26605807/
- Singer et al. 2024 — https://pubmed.ncbi.nlm.nih.gov/39205815/
- Morán-Navarro 2017 — https://pubmed.ncbi.nlm.nih.gov/28965198/ · Refalo 2023 — https://pubmed.ncbi.nlm.nih.gov/36334240/
- Schoenfeld 2017 (charges) — https://pubmed.ncbi.nlm.nih.gov/28834797/ · Hickmott 2022 — https://pubmed.ncbi.nlm.nih.gov/35038063/

## Décision porteur (22/11) : C1, C2, C3 acceptées et codées (allonger le repos reste une option ; seuls « réduire le repos » disparaît).
