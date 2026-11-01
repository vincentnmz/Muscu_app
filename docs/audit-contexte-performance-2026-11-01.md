# Audit — Contexte de performance (01/11/2026)

Jamais audité jusqu'ici (construit : backlog C3 ; survolé dans `audit-moteur.md`).
Méthode : chaque promesse de la carte (« Effet sur ton analyse — … ») tracée jusqu'au code : moteur serveur (`CORE_CONTEXTES`, `evaluerEtatAthlete`, synthèse, ACWR, règle « charge + ressenti »), moteur de l'app (`NovalyzContexte`), lecture des exercices, règle de progression, volume par muscle ; base réelle (`contexte_athlete`).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## Ce que fait chaque état — réellement (vérifié contre le code)

| État (durée par défaut) | Serveur (verdict, alertes, synthèse) | App (moteur NovalyzContexte) |
|---|---|---|
| **Déload** (7 j) | alertes absence / volume trop bas en veille ; niveau de surcharge −1 ; baisse de volume « normale pendant ton déload » | neutralise volume faible, baisse de force, baisse de progression |
| **Retour de vacances** (14 j) | alertes en veille ; surcharge **+1** (plus sensible) ; ACWR non interprété 28 j après le début ; baisse de volume « cohérente avec ta reprise » | neutralise baisses ; suspend irrégularité et comparaisons |
| **Retour de blessure** (21 j) | au moins « Vigilance » ; risque +1 ; alertes en veille | neutralise baisses ; suspend irrégularité, surmenage |
| **Intensification** (14 j) | hausse de RPE pas signalée dans la synthèse ; **aucun autre effet** | fatigue « élevée » seulement à 5/5 |

✅ Juste : veille des alertes (déload / vacances / blessure), Vigilance minimale en retour de blessure, synthèse des 4 semaines adaptée, suggestion « Tu reprends après une coupure ? » après ≥ 14 j sans séance (jamais posé d'office), carte « En vacances » quand le mode vacances est actif.

## Défauts

| # | Constat | Correctif proposé |
|---|---|---|
| **X1** ❌ | **Lecture des exercices et volume ignorent le contexte** : la carte promet qu'une baisse « n'est pas signalée comme une régression », mais pendant un déload / une reprise, la Lecture Novalyz (Analyses, Aujourd'hui « Depuis ta dernière séance », mail récap) classe les exercices en **« recule »** et le volume par muscle passe en **« Sous-MEV »** rouge. | Pendant déload / retour : « recule » → neutre « baisse attendue (déload / reprise) », Sous-MEV → gris « réduit (déload) ». |
| **X2** ❌ | **Déload : la règle de progression pousse quand même** (+1 rep, charge si haut de fourchette) ; le déload consiste au contraire à **réduire** le stress d'entraînement (volume, proximité de l'échec, charge — Bell et al. 2023, consensus Delphi). | 🟠 Mode « déload » dans la règle : même charge, **1 série de moins**, viser **RPE ≤ 7** (pas de +1 rep). Chiffres = choix Novalyz (le consensus ne donne pas de valeur unique). |
| **X3** ❌ | **Intensification** : la carte dit « une hausse de RPE n'est pas traitée comme une alerte », mais la règle serveur « charge + ressenti » (RPE qui monte à charge égale) peut quand même afficher « tu récupères moins bien — allège ». Le verdict serveur ignore l'intensification (fatigue haute → Vigilance → progression bloquée), alors que le moteur de l'app tolère la fatigue jusqu'à 5/5. | En intensification : la hausse de RPE ne compte plus comme « ressenti dégradé » ; la fatigue ne déclenche Vigilance qu'à 5/5 (même seuil que l'app) ; sommeil, douleur, récup faible restent des signaux. |
| **X4** ❌ | **Retour de vacances** : la carte dit « ACWR en pause ~4 semaines », mais l'état dure **14 jours** par défaut → la pause ACWR s'arrête à 14 j. Elle omet aussi que la surcharge est **plus sensible** (+1). | Texte exact : « … pendant ta reprise (14 j) ; Novalyz surveille la surcharge plus tôt (une remontée trop rapide est signalée) ». |
| **X5** | **Deux « vacances »** : Réglages ▸ Mode vacances (pause) et Contexte ▸ Retour de vacances, sans lien. | À la fin du mode vacances, **proposer** « Retour de vacances » (comme la suggestion après coupure). |
| **X6** | Suggestion « Aucune séance depuis X jours » : ne compte que la muscu (le vélo / la course ne comptent pas, contrairement à l'absence depuis N4). | Utiliser la dernière activité (muscu ou cardio hors marche). |
| **X7** | Base réelle : **6 lignes identiques** « retour de vacances » pour Alizé (même dates) — chaque appui sur « Appliquer » ajoute une ligne. Sans effet sur le calcul (le plus récent gagne) mais l'historique est faux. | Poser un état remplace l'état en cours ; nettoyer les 5 doublons (avec ton accord). |
| **X8** | Libellé déload : « abaisse le seuil de surcharge » dit l'inverse de ce qui se passe (le niveau de surcharge signalé est **réduit**). | « Novalyz signale moins vite la surcharge ». |
