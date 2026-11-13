# Audit — bloc « Fiabilité des données » (Analyses ▸ Résumé, muscu) — 13/11/2026

> Demande du porteur : vérifier ce bloc. **Aucune modification de code** (phase d'observation).
> Légende : **[V]** vérifié (code + données) · **[D]** déduction.

## Ce que fait le bloc (code)

Affiché dans la carte « Lecture Novalyz · Analyses » (`_maLectureNovalyzBloc`, `js/app.js`) : un anneau x / 100 +
5 critères + « Pour fiabiliser : … ». Calcul `_maFiabilite(data)` sur les **28 derniers jours** (aujourd'hui compris),
comparés aux 28 jours d'avant. (`_maFiabiliteBloc`, version détaillée, n'est plus appelé nulle part.) [V]

| Critère affiché | Points | Ce qui est réellement compté [V] |
|---|---|---|
| Base de comparaison (N séances avant) | 25 | jours d'entraînement des 28 jours précédents, plein à 3 |
| Profondeur (N séances) | 25 | jours d'entraînement des 28 derniers jours, plein à 6 |
| RPE renseigné (x %) | 20 | séries avec un RPE / séries des 28 derniers jours |
| **Questionnaire bien-être** | 15 | **jours avec une note de séance** (RPE de séance du bilan de fin de séance, `analyses.rpe_muscu`, ou ancien « ressenti ») / jours d'entraînement — **pas le questionnaire du jour** |
| Fourchette de reps définie (n/m exos) | 15 | exercices du programme avec une fourchette (programme, ou catégorie de l'exercice) |

Seuils de couleur : vert ≥ 75 « fiable », orange ≥ 50 « à compléter », rouge sinon.

## Mesuré sur de vraies données (copies, comptes seulement) [V]

| Compte | Score | Questionnaires du jour (28 j) | Notes de séance (28 j) | Critère « Questionnaire bien-être » | Conseil affiché |
|---|---|---|---|---|---|
| A (copie du 11/11) | 94 | 6 | 5 | 9 / 15 | « fais ton questionnaire du jour (+6) » |
| John (prod, 13/11) | 85 | **10** | 0 | **0 / 15** | **« fais ton questionnaire du jour (+15) »** |
| Lucas (préprod) | 85 | **13** | 0 | **0 / 15** | **« fais ton questionnaire du jour (+15) »** |

Les 4 autres critères sont justes sur ces comptes (bases et profondeurs recoupées, RPE 100 %, fourchettes présentes).

## Constats

| # | Gravité | Constat | Preuve |
|---|---|---|---|
| **F1** | **Élevée** | Le critère **« Questionnaire bien-être »** compte en réalité la **note de séance** (bilan de fin de séance). Un athlète qui remplit son questionnaire tous les jours peut avoir 0/15 et lire « fais ton questionnaire du jour (+15) » : phrase fausse, et le conseil ne peut pas faire monter le score. | [V] code (`_maEffortSeries` = `analyses.rpe_muscu` / `ressenti_muscu`) + John 10 questionnaires → 0/15 |
| **F2** | Moyenne | L'aide du « ? » dit « plus tu renseignes RPE, **bien-être** et cibles, plus elle monte » : même confusion. | [V] `ouvrirInfoLectureAnalyses` |
| **F3** | Moyenne | **Deux « Fiabilité des données » différentes** dans l'app : Aujourd'hui affiche celle du moteur (`moteur.confiance` : faible / moyenne / élevée, selon jours d'historique, nombre de questionnaires et charge interprétable), Résumé affiche ce score maison. Sur les 3 comptes : **Aujourd'hui « moyenne » (orange) / Résumé 85 à 94 « fiable » (vert)** le même jour. | [V] `moteur.confiance = moyenne` sur les 3 copies ; même libellé aux deux endroits |
| F4 | Faible | « Fourchette de reps définie » est presque toujours pleine (le générateur et les catégories d'exercices en donnent une par défaut) : vrai, mais n'apprend presque rien à l'athlète. | [V] `_exoFourchette` ; 100 % sur les 3 comptes |
| F5 | Faible | « Séances » = jours avec des séries (2 séances le même jour comptent 1). | [V] `_maMuscuAgg` |
| F6 | Faible | Vue coach : la même carte peut s'afficher avec des conseils au tutoiement (« renseigne ton RPE ») adressés au coach. | [D] non vérifié à l'écran |

## Corrections proposées (non appliquées — décision du porteur)

- **F1 + F2** (au choix) : (a) **compter vraiment le questionnaire du jour** (jours avec questionnaire sur les 28 jours,
  ou la même règle que le moteur) et garder le libellé ; ou (b) garder le calcul et **renommer** le critère « Note de fin
  de séance » avec le conseil « note ta séance à la fin (bilan) ». Recommandé : **(a)**, c'est ce que le moteur utilise
  pour sa propre confiance et ce que l'athlète comprend par « questionnaire ».
- **F3** : une seule notion de fiabilité affichée (ou deux noms différents) — rejoint le P1-3 de l'audit moteur
  (échelle de confiance commune), à traiter après la phase d'observation.
- F4 à F6 : à garder pour plus tard.

Rien n'est modifié tant que le porteur n'a pas décidé (consigne : on ne touche plus au moteur pendant l'observation ;
ce bloc est de l'affichage, pas le moteur — à arbitrer par le porteur).

## Suivi — 13/11 (décision du porteur : option a)

- **F1 corrigé (préprod)** : le critère s'appelle « Questionnaire du jour (N/28 j) » et compte les **jours distincts avec un
  questionnaire** (`data.bien_etre`) sur les 28 derniers jours, rapportés aux jours d'entraînement (plein si ≥). La note
  de séance n'entre plus dans ce critère. Test `tests/fiabilite-questionnaire.test.js`. SW v585. [V]
- Recontrôlé sur les copies : A 96 (11/15, conseil « +4 » juste), John 100 (15/15, plus de conseil faux), Lucas 100. [V]
- **F2 reste à faire** (texte du « ? »), petit.
- **F3 s'accentue** : John lit maintenant « 100/100 — fiabilité maximale » dans Résumé pendant qu'Aujourd'hui dit
  « fiabilité moyenne ». À traiter avec P1-3 (échelle de confiance commune).

## Ligne « En apprentissage : sommeil → performance » (Aujourd'hui) — audit 13/11, rien modifié

Code : `_lv3Apprentissage` / `_lv3ApprentissageHtml` (`js/lecture-v3.js`), seuil `LV3_SEUIL_SOMMEIL = 20`.
Compte les jours où il y a à la fois des séries muscu et une nuit mesurée (`sommeil_min > 0`) à la même date.

| # | Gravité | Constat |
|---|---|---|
| S1 | **Élevée** | [V] Aucun code ne calcule de lien sommeil → performance. À 20 séances la ligne **disparaît** simplement : la promesse « Novalyz tirera une conclusion » n'est pas tenue. |
| S2 | Faible | [V] Toute nuit > 0 min compte, alors que le reste de l'app écarte les nuits < 3 h (sieste, synchro partielle). Sur la copie A, les 11 nuits appariées font ≥ 3 h : écart théorique. |
| S3 | Faible | [D] Le rapprochement « nuit du même jour que la séance » suppose que la montre date la nuit au jour du réveil — non vérifié. |

Le compteur lui-même est juste (copie : 11/11 ; le porteur voit 16/20). Options proposées au porteur : (1) reformuler
sans promesse (« Novalyz collecte tes nuits ; aucune analyse sommeil → performance n'est faite pour l'instant ») ;
(2) retirer la ligne ; (3) coder l'analyse (chantier moteur, hors phase d'observation).
