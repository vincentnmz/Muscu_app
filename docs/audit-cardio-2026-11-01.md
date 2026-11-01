# Audit cardio — par sport, Tendances, Croisé Mois / Année (01/11/2026)

Méthode : vraie app rendue (Playwright) sur la copie réelle des données (133 sorties cardio, 2026), chaque chiffre affiché recalculé indépendamment (Python) et confronté au code (`_maCardioAgg`, `_maCardioParSport`, `_maCardioTendances`, `_maSportTrend`, Croisé).
Légende : ✅ vérifié · ❌ défaut (vérifié contre code + données) · 🟠 à décider / à confirmer.

## 1. Ce qui est juste ✅
- Totaux par sport sur l'année : Marche 106 sorties / 283,1 km / 72h38 ; Vélo 18 / 10h39 ; Autre 8 / 20,1 km / 5h26 ; FC moyennes (101, 108, 117 bpm) — recalcul identique.
- Croisé : Semaine = 4 séances (26 → 1 nov.), répartition et tendance « 2ᵉ moitié vs 1ʳᵉ » calculées sur les seuls mois avec données (les mois futurs ne faussent pas la tendance).
- « Dernière sortie le 03/10 (Marche) » quand la période est vide : juste.

## 2. Défauts

| # | Où | Constat (données réelles) | Correctif proposé |
|---|---|---|---|
| **C1** ❌ | Tendances ▸ Efficience | Les mois **sans aucune sortie** (jan.–avr., nov., déc.) sont remplis avec la FC du 1ᵉʳ mois (`v \|\| fcFirst`) → courbe de points **inventés** (101,8 bpm répété, y compris pour des mois pas encore passés). | Ne tracer que les mois avec des sorties (trous laissés vides). |
| **C2** ❌ | Tendances ▸ Efficience | La FC moyenne **mélange les sports** (marche ~101 bpm, vélo ~108, « autre » ~117) : une baisse peut venir d'un mois avec plus de marche, pas d'un progrès. | Courbe par sport (sport le plus pratiqué par défaut, sélecteur). |
| **C3** ❌ | Données + import montre | **6 doublons** début septembre (05–08/09 : 1 vélo 16 min, 5 marches) : la séance Fitbit + une copie créée le 23/09 par « Tout importer » (Health Connect). Cause : l'import groupé **saute le contrôle de doublon** (`_hcImport(i, silent)` → pas de `_cardioDoublonProbable`). ≈ 162 min et ≈ 10 km comptés deux fois. | Import groupé : ignorer automatiquement une séance du même jour à ±2 min (déjà détectée en import unitaire). Nettoyage des 6 copies **avec ton accord**. |
| **C4** ❌ | Par sport, Résumé, Tendances | **Distance / vitesse trompeuses** quand peu de sorties ont une distance : Vélo « 0,9 km · 3,3 km/h » = **1 sortie sur 18** (vélo d'intérieur sans distance) ; 3,3 km/h n'est pas crédible pour du vélo. « Volume par sport » classé en **km** → le vélo (10h39) apparaît quasi nul. | Afficher la distance avec « (1 sortie sur 18) » quand elle manque sur la moitié des sorties ou plus ; volume par sport en **temps** (km en complément). |
| **C5** ❌ | Par sport / Résumé | **Vitesse moyenne = moyenne des moyennes** : Marche 3,6 km/h affiché, vitesse réelle distance ÷ temps = **3,9 km/h**. | Vitesse pondérée (km totaux ÷ heures des sorties avec distance). |
| **C6** ❌ | Par sport ▸ graphique | En « Année », l'en-tête affiche « **0 km/mois** » = la valeur du **mois en cours** (novembre, vide), lue comme une moyenne. | Libellé explicite (« nov. : 0 km ») ou total de la période. |
| **C7** ❌ | Résumé, Tendances, Dernières sorties | Décimales avec **point** (« 283.1 km », « 3.6 km/h ») alors que les tuiles ont la virgule ; « Footing 0 km · **1 sorties** ». | Format français partout ; accord singulier/pluriel. |
| **C8** 🟠 | Données | 4 **micro-sorties de test** (< 3 min : 3 marches et 1 vélo le 23/09, 1 footing de 1 min / 30 m le 22/09). Elles apparaissent dans les comptes (« Footing 1 sortie · 1 min · 1,4 km/h »). | Les supprimer **avec ton accord** (ou les masquer des stats < 3 min). |
| **C9** 🟠 | Données | 8 sorties « Autre » (juin, Fitbit) ont des pas et 4,3–4,5 km/h : ce sont très probablement des **marches** mal typées à l'import Fitbit (le code d'import Fitbit n'est pas dans le repo → non vérifiable). | Les reclasser en Marche si tu confirmes. |
| **C10** 🟠 | Résumé | « Marche … RPE 6 » : calculé sur **20 sorties notées sur 106**, sans le dire. | « RPE 6 (20 sorties notées) ». |
| **C11** 🟠 | Croisé ▸ Mois | Le 1ᵉʳ du mois, « Mois » = mois civil en cours (1 jour) → « Pas encore assez de séances ». Juste, mais peu utile. | Indice « début de mois : regarde le mois précédent (‹) ». |

## 3. Non couvert / à vérifier sur téléphone
- Import Health Connect réel (types de séances renvoyés par ta montre) — la correspondance `_hcMapType` est correcte pour WALKING / BIKING / RUNNING… ; le typage Fitbit historique (C9) ne l'est pas forcément.

## 4. Réalisé (01/11, validé porteur)
- **Données** : 6 doublons supprimés (copies du 23/09 ; originaux Fitbit conservés ; copie des valeurs dans `.work/audit/backup-doublons-cardio-2026-11-01.txt`). 7 sorties « Autre » avec des pas reclassées en Marche ; la 8ᵉ (21/06, 36 min, FC 154, sans pas ni distance) laissée en « Autre ». Les 4 micro-sorties de test (< 3 min) **n'ont pas été touchées** (non demandé).
- **C1** points inventés supprimés (seuls les mois avec sorties sont tracés ; un seul point = sa vraie date). **C2** Efficience par sport (puces Marche / Vélo / Autre). **C3** « Tout importer » ignore une séance du même jour à ±2 min (« X déjà présente(s), ignorée(s) »). **C4** distance « — » ou « (n sorties sur N) » ; volume par sport en temps. **C5** vitesse pondérée (Marche 3,9 km/h). **C6** en-tête des graphiques avec la période du point (« oct. », « sem. du… »). **C7** virgule décimale (listes + axes de tous les graphiques), « 1 sortie ». C10 fait aussi (« RPE 6 (20 notées) »).
- Vérifié : rendu réel sur les données corrigées ; courbe Marche 101,8 / 103,4 / 99,8 / 94 bpm = recalcul indépendant.
