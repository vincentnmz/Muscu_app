# Audit — écran Aujourd'hui (01/11/2026)

Méthode : le VRAI backend (`handleGetAppData`, `index.ts` redéployé le 01/11) rejoué sur la copie réelle des données, rendu de la vraie app (Playwright, mobile 420 px + bureau 1280 px) à 3 dates : **30/10 au soir** (séance faite le jour même), **01/11** (dimanche, semaine complète), **09/11** (simulé : 10 jours sans séance ni questionnaire). Chaque phrase affichée a été tracée jusqu'au code et chaque chiffre recalculé à part.
Légende : ✅ vérifié · ❌ défaut (vérifié contre code + données) · 🟠 à décider.

## Juste ✅
- **Régularité** 4/4 (26, 27, 29, 30/10) ; « Semaine complète ✓ · prochaine séance : pec epaule » le dimanche.
- **Séance faite aujourd'hui** (30/10) : « dos jambe 2 ✓ · 11 séries · 3,2 t · RPE 8,2 » ; statuts par exercice = lecture des Analyses (Tirage horizontal ★ record 80×7, vrai record : meilleur précédent 80×6 ; Traction et Tirage trapèze ▲ progrès).
- **Depuis ta dernière séance** : mêmes statuts, mêmes chiffres.
- **Normale bien-être** : Sommeil 4 vs 3,9 (14 saisies), Fatigue 1 vs 1,1 — recalcul identique ; Stress / Courbatures : 3 saisies de base → « normale après 7 saisies » (juste).
- **Montre** : sommeil 8 h 15 = moyenne des 29 et 28/10 (2 nuits sur 7 j) ; normale 7 h 43 sur 23 nuits ; FC repos 59,5 bpm vs 62 (le 30/10).
- **Pas** : moyenne 2 645 = (2 676 + 3 090 + 2 168) / 3.
- **Points** : 1 400 gagnés, 0 dépensé (les anciens badges ne sont plus déduits, décision du 29/10) ; records en points calculés par jour (pas de faux record entre séries d'une même séance).
- **Cibles « Ce que Novalyz vise »** : même règle que la saisie (`_progDecision`), vérifiée lors de l'audit saisie.

## Défauts

| # | Où | Constat | Correctif proposé |
|---|---|---|---|
| **T1** ❌ | Verdict + « Ton point du jour » | Le verdict et la ligne « Sommeil bon · fatigue aucune » reprennent le **dernier questionnaire, quel que soit son âge**, sans date. Au 09/11 (10 jours sans questionnaire ni séance) : **« Prêt à performer · Sommeil bon · fatigue aucune »** = valeurs du 30/10 ; le moteur, lui, n'a plus aucun signal de forme (confiance « faible », récup « — »). Le 01/11, « Ton point du jour » affiche aussi le questionnaire du 30/10. | (a) **Recommandé** : sans questionnaire sur les 7 derniers jours (la fenêtre du moteur), pas de « Prêt à performer » mais un état neutre « **État non renseigné** — fais ton questionnaire » ; « Ton point du jour » daté quand il n'est pas d'aujourd'hui (« questionnaire du 30/10 ») et vide au-delà de 7 jours. (b) Garder le verdict, ajouter seulement la date. |
| **T2** ❌ | Reco du jour (backend) | Au 09/11 : « **RAS — maintenir la charge actuelle** » juste sous « Absence prolongée → reprends une séance » (contradictoire), et « Séance du jour : **6 exercices à pousser** ». | Si l'alerte « Absence » est active : la reco devient celle de l'alerte (« Reprends une séance… »), pas de « à pousser ». 🟠 Au-delà de **3 semaines** sans séance (la force est en grande partie conservée jusqu'à ~3 semaines chez le pratiquant entraîné, revue McMaster 2013 — à confirmer), proposer une **reprise** (cibles = dernière fois, sans +1 rep). |
| **T3** ❌ | Montre ▸ Sommeil réel | Pastille **toujours verte** (couleur en dur) : 5 h de sommeil contre une normale de 7 h 45 resterait vert. | 🟠 Seuil à choisir : orange à **≥ 1 h sous ta normale** (moyenne 7 j, ≥ 3 nuits) ; sinon pastille grise (information seule). |
| **T4** ❌ | Bureau ▸ Ma forme ▸ « Sommeil (montre) » | Affiche **8 h 52** = la **dernière nuit enregistrée** (29/10, 3 jours plus tôt), sans date, à côté de la lecture qui dit 8 h 15 (moyenne 7 j). Deux chiffres vrais, présentés comme le même. | Libellé « Dernière nuit (29/10) ». |
| **T5** | Pied du bloc « normale » | « Ta normale = moyenne des 5 semaines précédentes » : vrai pour le questionnaire, mais la montre (sommeil, FC) compare aux **4 semaines** d'avant. | « …5 semaines (montre : 4 semaines) ». |
| **T6** | Badge d'en-tête / trophée « Records battus » | Débloqué dès qu'un exercice a un meilleur de tous les temps — y compris la **1ʳᵉ fois** (même défaut que R2). | Utiliser les vrais records (`records_evenements`, déjà en place). |
| **T7** | Code | Le rendu de l'ancien tableau de bord plante à chaque chargement (`dash-seances-faites` n'existe plus) — aucun effet visible, mais une erreur en console à chaque ouverture. | Retirer ce bloc mort (13 éléments absents de la page). |
| **T8** | Mes pas | Période « **26 – 1 nov.** » (mois manquant à cheval sur 2 mois) ; icône vide (carré sans pictogramme). | « 26 oct. – 1 nov. » ; pictogramme « pas ». |

Les 2 points 🟠 (seuil de reprise de T2, seuil de sommeil de T3) sont des choix Novalyz à valider.

## Réalisé (01/11, validé porteur : T1 a, T2, T3 « vert si 1 h de plus », T4-T8)

- **T1** : sans questionnaire sur les 7 derniers jours (fenêtre du moteur), « **État non renseigné** — pas de questionnaire depuis le 30/10 : fais celui du jour » au lieu de « Prêt à performer » (Aujourd'hui, rail bureau, Analyses ▸ Résumé). Vigilance / À surveiller inchangés (signaux réels). Questionnaire d'un autre jour daté (« Questionnaire du 30/10 », « Ton dernier point (30/10) ») ; au-delà de 7 jours, plus affiché.
- **T2** : reco du moteur en cas d'absence ≥ 7 j = « Pas de séance depuis 7 jours ou plus : reprends une séance cette semaine… » (fini « RAS — maintenir la charge ») ; plus de « X exercices à pousser ». **≥ 21 jours sans séance** → mode « reprise » dans la règle de progression (saisie + Aujourd'hui) : mêmes charges et reps que la dernière fois. Source : McMaster et al. 2013, *Sports Med* 43:367 (force conservée ~3 semaines, puis déclin) — vérifiée sur le résumé.
- **T3** : sommeil montre jugé dès 3 nuits sur 7 j — orange ≥ 1 h sous la normale ; vert dans la normale ou ≥ 1 h au-dessus (« au-dessus de ta normale ») ; sinon gris.
- **T4** « Dernière nuit (29/10) » (nuit complète ≥ 3 h). **T5** pied « (montre : 4 semaines) ». **T6** trophée/badge et « Ton dernier record » sur les vrais records. **T7** bloc mort neutralisé (0 erreur console). **T8** « 26 oct. – 1 nov. », pictogramme des pas.
- Demandes du 01/11 : bloc « **Récompenses et objectif** » ; login mobile (couleurs qui clignotent) : halos sans flou ni fusion sur mobile (dégradés radiaux), grille du nid d'abeille plus reconstruite quand la barre d'adresse / le clavier changent la hauteur, couleurs mises à jour une fois par image. Non reproductible en navigateur sans écran → **à confirmer sur téléphone**.
- Vérifié : rejeu du vrai backend au 01/11, 09/11 et 25/11 + captures ; tests `surcharge-serie` (+4 cas reprise).
