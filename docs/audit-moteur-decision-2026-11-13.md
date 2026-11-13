# Audit — moteur d'analyse et de décision (13/11/2026)

> Mission : `docs/chantiers-futurs/moteur-decision-mission-2026-11.md` (livrable §16, A → H). **Aucune modification de code.**
> But du porteur : savoir précisément ce qui **existe**, ce qui est **fiable**, ce qui est **fragile** et ce qui **manque** dans la
> boucle **diagnostic → hypothèse → décision → action → résultat → vérification**, pour ne pas casser ce que Novalyz fait bien.
> Méthode : lecture du code réel (`supabase/functions/handler/index.ts`, `js/app.js`, `js/lecture-v3.js`), du schéma
> (`supabase/migrations/`), des tests (`tests/`) et des audits précédents (moteur 26/10, Lecture v3 02-06/11, IA 01/11).
> Légende : **[V]** vérifié dans le code · **[D]** déduction · **[?]** inconnu / non vérifié. Pas de rejeu sur données réelles
> dans cet audit (les audits du 26/10 et du 02/11 en ont fait) : les points « à mesurer » sont signalés.

---

## Résumé en 6 lignes

1. Novalyz a déjà **un vrai moteur de décision déterministe et explicable** : verdict du jour, classement des exercices,
   cible de la prochaine séance, diagnostic « pourquoi ça bloque » à causes testées, plan de la semaine. C'est le noyau à protéger.
2. La boucle va aujourd'hui jusqu'à **« l'action a-t-elle été faite ? »** (plan coché automatiquement) et, exercice par exercice,
   la cible suivante dépend de la séance précédente — mais **rien ne vérifie si la décision a donné le résultat attendu**.
3. **Aucune mémoire des décisions** : le plan et les recommandations sont **recalculés à chaque affichage** et jamais
   enregistrés. On ne peut pas dire « le 06/11 on t'a proposé X, voilà ce qui s'est passé ». C'est le manque n° 1. [V]
4. **Trois incohérences vérifiées** entre canaux (app / mail / IA / coach) sur des règles dupliquées : « bloqué », « stagnation »,
   « ta normale ». Ce sont les correctifs les moins risqués et les plus urgents (P0).
5. Ce qui est **fiable** : règles de sécurité santé (douleur, rouge réservé à la blessure), règle charge + ressenti, garde-fous
   contextes (déload, reprise, vacances), double progression série par série, fiabilité « sur N séances », IA bridée.
6. Recommandation : **P0** = aligner les règles dupliquées ; **P1** = journal des décisions + « résultat observé ». Le reste après.

---

## 1. Cartographie : données → indicateurs → détections → interprétations → décisions → actions → vérification

| Étape | Ce qui existe (où) | État |
|---|---|---|
| **Données** | Séries (charge, reps, RPE, repos), bien-être (sommeil, fatigue, stress, courbatures, douleur + zone), cardio, montre (sommeil, FC repos, pas), programme (fourchettes, séries prévues), catégories d'exercices, contexte déclaré (déload, reprise, vacances, blessure, intensification), pause, niveau (ancienneté effective). | [V] riche et bien saisie (RPE et repos sur 100 % des séries chez le porteur, audit 02/11) |
| **Indicateurs** | Tonnage ; séries par muscle (secondaire = 0,5) ; fréquence (jours en principal) ; force estimée corrigée RPE (`_lv3ForceSerie`, Epley + reps en réserve plafonnées à 4) ; fitness-fatigue (TSB %) sur tonnage, ACWR en repli ; score de récupération (Hooper) ; « ta normale » bien-être (5 sem.) et montre (4 sem.) ; RPE à charge égale. | [V] |
| **Détections** | Classement par exercice : record · progresse · progrès secondaire · recule · bloqué (N séances selon niveau) · sous la fourchette · attendu (déload/reprise) (`_lectureExos`). Alertes moteur : absence, charge/surcharge (si ressenti dégradé), sous-charge soutenue 14 j, douleur 3 niveaux, fatigue, sommeil (`evaluerEtatAthlete`). Effort en hausse à charge égale (`ressentiConcordant`). Volume sous le minimum du niveau. | [V] |
| **Interprétations / hypothèses** | Diagnostic « pourquoi » (`_lv3Diag`) : teste 10 causes et affiche lesquelles sont **vraies dans les données** (charge trop lourde, échec répété, volume, effort en hausse, fréquence, repos raccourci, effort laissé en réserve, gêne sur la zone *(possible)*, série légère avant qui fatigue *(possible)*, marche de charge trop grosse) ; « aucune cause visible » sinon. Causes du verdict du jour (`causes`). | [V] très bon niveau : hypothèses marquées « possible », pas de causalité affirmée |
| **Décisions** | Verdict du jour Prêt / Vigilance / À surveiller ; cible de la prochaine séance par série (`_progDecision`) ; levier unique par exercice ; plan de la semaine (≤ 3 actions, `_lv3Plan`) ; reco texte du moteur. | [V] |
| **Actions** | Proposées, jamais imposées (« proposé / au choix / c'est toi qui choisis », décision porteur 03/11). Coach : « Modifier le programme », « Écrire », « Marquer traité ». | [V] |
| **Résultat** | Plan : `fait` = l'action a-t-elle été **réalisée** cette semaine (critère chiffré par type d'action). Séance : la cible suivante tient compte de la dernière séance (atteinte → petit pas ; sinon on garde). | [V] partiel : on mesure l'**exécution**, pas l'**effet** |
| **Vérification** | **Rien.** Aucune comparaison « avant / après la recommandation », aucun statut « objectif atteint / pas atteint / non évaluable » sur la durée, aucune trace des décisions passées. | [V] **manque** |

---

## A. Ce que Novalyz sait déjà faire

- **Verdict du jour unique, partagé athlète / coach** (`evaluerEtatAthlete`, `CORE_*`) avec règles validées par le porteur :
  rouge réservé à la blessure / douleur forte ; charge seule = information, jamais alerte (règle **charge + ressenti**) ;
  confiance `non_interpretable / faible / moyenne / haute` ; **causes affichées** sous le verdict. [V]
- **Contextes de performance** déclaratifs (`CORE_CONTEXTES`) appliqués partout : en déload / reprise, « recule » et « bloqué »
  deviennent « attendu », le plan de progression est suspendu, la stagnation n'est pas criée. Mode vacances = repos prévu. [V]
- **Classement des exercices** commun app / coach (et une copie serveur pour mail et IA — voir faiblesse C1). Progrès
  secondaire reconnu (plus de séries au top, même niveau à RPE plus bas). Jamais « bloqué » sur un exercice neuf (≥ 3 séances). [V]
- **Cible de la prochaine séance** série par série (`_progDecision`) : +1 rep si RPE ≤ 8 ; charge quand toutes les séries sont
  au haut de la fourchette (débutant 1 séance, sinon 2 de suite) ; échec 2 fois → on garde ; jour en Vigilance → pas de
  progression ; sous la fourchette → petit pas (≈ −5 %) ou charge sûre au choix. Sources citées dans le code (ACSM 2009,
  Morán-Navarro 2017). [V]
- **Diagnostic « pourquoi ça bloque »** à causes **testées sur les données** → un levier, sinon « aucune cause visible » adaptée
  au niveau. Exemple de la mission (élévation latérale, série à 5 kg qui monte de 16 à 19 reps) : **déjà codé** (cause
  « avant », `_lv3Diag` étape 9). [V]
- **Plan de la semaine** (≤ 3 actions chiffrées, raison affichée), calculé sur les données **avant lundi** → stable toute la
  semaine et identique athlète / coach ; **coché automatiquement** par les séances réelles ; suspendu en pause / déload /
  reprise ; « reprise » après 14 j sans séance. [V]
- **Fiabilité par conclusion** : chaque force estimée / diagnostic dit « sur N séances en M semaines » ; sommeil →
  performance « en apprentissage (11/20) » ; évolutions % seulement avec une vraie base. [V]
- **Coach** : « À décider » (même diagnostic que l'athlète, ce qui est proposé, actions), coup d'œil, alertes avec
  « Pourquoi ? », « Marquer traité » (mémorisé par semaine), mêmes alertes que l'athlète (audit #8). [V]
- **IA** : couche langage conçue *grounded* (consigne « uniquement les données fournies, ne pas contredire le moteur »,
  contrôle des chiffres prévu) — **non activée en prod** (clé absente, audit 01/11). [V code] [D activation]
- **Tests** : 20 suites environ protègent le moteur (`moteur-etat`, `regle-charge-ressenti`, `alertes-centre`,
  `contexte-*`, `fiabilite-central`, `acwr-*`, `surcharge-serie`, `lecture-v2/v3`, `normale-bienetre`, `audit-moteur`…). [V]

## B. Ce qui est réellement différenciant

1. **Le diagnostic à causes testées** (« on n'affiche que la cause vraie dans tes données ») : rare dans les apps grand
   public, qui donnent des conseils génériques. C'est le cœur de « comprendre → décider ». [D]
2. **La règle charge + ressenti** (la charge seule n'alarme pas) et le **rouge réservé à la blessure** : évite la
   sur-alerte, défaut classique des outils fondés sur l'ACWR. [D]
3. **Le contexte déclaré qui change l'interprétation** (déload ≠ régression). [D]
4. **Le même calcul pour l'athlète et le coach** (une seule vérité). [V] — à compléter : mail et IA (C1).
5. **L'honnêteté sur la fiabilité** (« en apprentissage », « sur N séances », « possible »). [V]

Ce qui **manque pour devenir vraiment différenciant** : la **mémoire** et la **vérification** (« on t'a proposé X, voilà ce qui
s'est passé »). C'est ce qui transformerait un bon outil de lecture en **système qui apprend de l'athlète**.

## C. Faiblesses actuelles (vérifiées)

| # | Faiblesse | Preuve [V] | Risque |
|---|---|---|---|
| **C1** | **« Bloqué » a deux définitions.** App / coach : N séances identiques **selon le niveau** (2 débutant · 3 intermédiaire · 4 avancé/expert, `LV3_BLOQUE_N`). Copie serveur (`_rcLectureExos`, utilisée par le **mail récap** et le **contexte IA**) : **toujours 3**. | `js/lecture-v3.js:441` vs `index.ts` `_rcLectureExos` (`pts.length >= 3`, `c0 === c1 === c2`) | Un débutant voit « bloqué » dans l'app mais pas dans le mail ; un avancé reçoit « bloqué » par mail alors que l'app ne le dit pas encore. Contradiction entre canaux. |
| **C2** | **L'alerte « Stagnation » mesure en fait une baisse.** Dans `alertes_centre`, « Stagnation » = **≥ 3 exercices dont la charge max de la semaine a baissé de plus de 3 %** vs la semaine d'avant (reps ignorées). Son action est un conseil générique (« plus d'intensité… repos 2-3 min… »). | `buildAlertesCentre` + `computeComparison.charge_details.down` | Une semaine volontairement plus légère en charge (plus de reps) = « Stagnation ». Libellé faux (baisse ≠ plateau) ; ne recoupe pas le diagnostic « bloqué ». |
| **C3** | **Prescription anti-stagnation générique encore affichée** (`_prescriptionStag`) dans Évolution ▸ exercice quand cet exercice figure dans l'alerte C2 : « +2,5 kg » codé en dur (ignore le pas de l'appareil, le RPE, le niveau), conseils génériques — alors que le diagnostic `_lv3Diag` existe pour le même exercice. Deux autres appels (alertes coach, alertes athlète) attendent le texte « : aucun progrès » produit seulement par l'**ancien** `calculerAlertes` (repli) → **pratiquement morts**. | `app.js` `_prescriptionStag` + appels l. ~10984, ~16590, ~25911 | Deux conseils différents pour le même exercice (ex. « monte de 2,5 kg » vs « garde ta charge, cause : repos raccourci »). |
| **C4** | **« Ta normale » : deux définitions proches mais pas identiques.** Front (`_beNormale`) : écart calculé dès **1** saisie récente. Serveur (`ressentiConcordant`, règle charge + ressenti) : **3** saisies récentes exigées. Le commentaire du front dit « même définition ». | `app.js` `_beNormale` (`slice(0, 3)` sans minimum) vs `index.ts` `serie()` (`rec.length >= 3`) | L'écran peut afficher « fatigue au-dessus de ta normale » sur une seule saisie alors que le moteur ne la compte pas → l'athlète voit un signal que le verdict ignore. |
| **C5** | **Pas de mémoire** : plan, leviers, cibles, recos recalculés à chaque affichage ; aucune table ne les conserve. `alertes_historique` existe en base mais **n'est jamais écrite** (seulement vidée à la suppression de compte). | grep schéma + `index.ts` (seule référence : `delete`) | Impossible de vérifier une décision, de montrer un historique, d'apprendre ce qui marche pour cet athlète. Un changement de règle **réécrit le passé** (le plan « de la semaine dernière » recalculé aujourd'hui n'est plus forcément celui affiché à l'époque). |
| **C6** | **Résultat = exécution, pas effet.** Le plan dit « fait » si l'action est réalisée (ex. une série 70-75 kg à 6 reps), mais ne regarde jamais si, ensuite, l'exercice a débloqué / la force estimée a monté. | `_lv3Plan` (bloc « Fait cette semaine ? ») | La promesse « vérifier si la décision a fonctionné » n'est pas tenue. |
| **C7** | **Charge muscu = tonnage** (fitness-fatigue et ACWR). Une séance lourde à peu de reps pèse moins qu'une séance légère à beaucoup de reps. | `calculerChargeSport('muscu')` | Proxy de volume, pas d'intensité ; déjà neutralisé en partie (charge seule n'alarme pas). À garder en tête, pas urgent. |
| **C8** | **Confiance : deux systèmes.** Verdict du jour : `confiance` 4 niveaux (jours d'historique, nb de bien-être). Diagnostics / forces : « sur N séances ». Pas de règle commune 🟢🟠🔴 par décision. | `evaluerEtatAthlete` vs `_lv3Diag.n` | Cohérent mais pas uniforme ; la mission demande une définition objective commune. |

## D. Décisions actuellement prises par le moteur

| Décision | Règle (résumé) | Où |
|---|---|---|
| Verdict du jour | Rouge = blessure / indispo / douleur forte · Vigilance = signal de forme (fatigue ≥ 4, sommeil ≤ 2, récup < 45, douleur ≥ 3, courbatures ≥ 4, retour progressif) ou alerte d'état · sinon Prêt. Nouvel athlète → Prêt (pas de fausse alerte). | `evaluerEtatAthlete` |
| Alléger | Charge en hausse **et** soutenue **et** ressenti dégradé (fatigue +1, sommeil −1 vs normale, RPE +1 à charge égale sur ≥ 2 exos, FC repos +5) → « allège 1 (ou 1-2) séance(s) ». | idem + `ressentiConcordant` |
| Sous-charge | Ratio fitness-fatigue < 0,80 pendant 14 j → message « volume bas depuis 2 semaines ». | `sousChargeSoutenue` |
| Prochaine séance | Double progression série par série (voir A). | `_progDecision` |
| Sous la fourchette | Petit pas ≈ −5 % ou charge sûre (meilleure force estimée récente, ≤ −12,5 %), au choix. | `_lv3Diag` (1), `_sousPetitPas`, `_sousAlt` |
| Levier d'un blocage | Première cause vraie parmi 10 ; sinon levier selon le niveau. | `_lv3Diag` |
| Plan de la semaine | ≤ 3 actions : charge (sous la fourchette) > séries (volume) > volume du programme > RPE > cible des exos en progrès. | `_lv3Plan` |
| Alertes coach | Mêmes `alertes_centre` que l'athlète + diagnostics « À décider ». | `buildAlertesCentre`, `renderCoachDecider` |

## E. Décisions améliorables

1. **« Stagnation »** (C2) : à remplacer par ce qu'elle mesure (« baisse de charge sur 3 exercices ») **ou** à brancher sur le
   vrai « bloqué » du classement — et faire disparaître la prescription générique (C3) au profit du diagnostic existant.
2. **Plan de la semaine** : ajouter le **critère de réussite** (déjà implicite dans `fait`) **et** un **résultat observé** à
   S+1 / S+2 (l'exercice est-il sorti de « bloqué » / « sous la fourchette » ? force estimée ?), formulé « résultat observé
   après la recommandation », jamais « grâce à ».
3. **Levier « aucune cause visible »** : aujourd'hui toujours le même texte pour un niveau donné ; avec une mémoire, on
   saurait si ce levier a déjà été proposé (et sans effet) → proposer le suivant au lieu de répéter.
4. **Alléger 1 séance** : aucune vérification ensuite (la fatigue est-elle revenue dans la normale ?).

## F. Informations manquantes

| Manque | Pourquoi c'est utile | Remarque |
|---|---|---|
| **Historique des décisions** (date, données d'entrée, décision, action proposée, critère de réussite, version de la règle) | Base de toute vérification et de la « mémoire de l'athlète ». | Nouvelle table nécessaire (circuit de migrations rodé). [D] |
| **Ce qui a été affiché / vu** | Distinguer « pas suivi » de « jamais vu ». | Optionnel au départ. |
| **Retour de l'athlète sur une proposition** (« je la suis », « pas pour moi ») | Respecte « c'est toi qui choisis » ; évite de reproposer ce qu'il a refusé. | Un seul tap. [D] |
| **Historique du programme** | Savoir si un résultat suit un changement de programme. | [?] le programme semble écrasé à chaque modification (non vérifié dans cet audit). |
| **Raison d'une séance manquée** | Différencier oubli / fatigue / contrainte. | Optionnel, plus tard. |

## G. Erreurs et risques d'interprétation

- **Causalité** : aucun texte actuel n'affirme « grâce à Novalyz » [V sur les fonctions lues] ; le futur journal devra garder
  « résultat observé après la recommandation ».
- **Une seule séance** suffit pour « record » / « progresse » (séance contre séance) : une bonne journée isolée passe en
  progrès. Atténué par la force estimée sur 6 semaines. [V]
- **RPE déclaratif** : base de plusieurs décisions (cible, effort en hausse, effort laissé en réserve). Fiable avec l'habitude
  (Zourdos) ; un athlète qui déclare toujours 8 neutralise des règles. Pas de détection de RPE « figé ». [V règle] [D risque]
- **« Ta normale »** = moyenne simple, écart fixe ±1 point, sans variabilité ni médiane : une semaine atypique dans la base la
  déplace. Acceptable vu le nombre de saisies ; la mission le note (§6). [V]
- **Tonnage comme charge** (C7) et **ACWR** (contesté, déjà relégué en repli et sans alerte seule). [V]
- **Volume indirect 0,5** : convention, pas une constante (déjà documenté dans `bases-scientifiques.md`). [V]
- **Recalcul du passé** (C5) : afficher un historique des plans **recalculé** serait trompeur dès qu'une règle change → il faut
  **enregistrer** au moment de la décision. [D]

---

## H. Améliorations classées

### P0 — impact très important, risque faible (corriger des incohérences existantes, pas de nouvelle fonction)

**P0-1 · Une seule règle « bloqué » partout (app, coach, mail, IA)**
- Problème : C1. Valeur : une seule vérité, crédibilité (le mail ne contredit plus l'app).
- Données / logique : identiques à l'app (`LV3_BLOQUE_N` par niveau, niveau effectif déjà envoyé par le serveur).
  Côté serveur, `_rcLectureExos` reprend le seuil par niveau.
- Résultat attendu : même liste « bloqué » dans l'app, le mail et le contexte IA pour un même jour.
- Difficulté : faible. Risque : le mail récap change pour les débutants (plus de « bloqué ») et les avancés (moins).
- Tests : cas débutant 2 séances, intermédiaire 3, avancé 3 (pas bloqué) / 4 (bloqué), app = serveur sur le même jeu.

**P0-2 · « Stagnation » : dire ce qui est mesuré, un seul conseil par exercice**
- Problème : C2 + C3. Valeur : plus de faux « Stagnation », plus de conseil générique contradictoire.
- Logique proposée (au choix du porteur) : (a) renommer en « Baisse de charge sur plusieurs exercices » avec reps prises en
  compte, ou (b) supprimer cette alerte et s'appuyer sur « bloqué / recule » du classement. Dans les deux cas, remplacer
  `_prescriptionStag` par le levier de `_lv3Diag` (déjà calculé), et retirer les deux appels morts.
- Résultat attendu : pour un exercice donné, un seul « pourquoi » et un seul levier, partout.
- Difficulté : faible. Risque : faible (le coach perd une alerte qui n'avait pas de sens).
- Tests : semaine plus légère en charge mais plus de reps → pas de « stagnation » ; Évolution affiche le levier du diagnostic.

**P0-3 · « Ta normale » : même définition à l'écran et dans le moteur**
- Problème : C4. Valeur : ce que l'athlète voit = ce que le moteur utilise.
- Logique : soit le front exige 3 saisies récentes comme le serveur, soit il affiche l'écart « indicatif (1 saisie) » sans orange.
- Difficulté : faible. Risque : moins d'indications orange en début de semaine (voulu).
- Tests : 1, 2, 3 saisies récentes ; égalité front / serveur sur le même jeu.

### P1 — fort impact, plus de travail (la boucle décision → résultat)

**P1-1 · Journal des décisions (mémoire)**
- Problème : C5. Valeur : prérequis à toute vérification, à l'historique et à la personnalisation.
- Données : ce que le moteur calcule déjà (plan de la semaine, diagnostics, verdict / reco du jour).
- Logique : **enregistrer** le plan au moment où il est calculé pour la semaine (une fois par athlète et par semaine) :
  actions, critère de réussite chiffré (celui de `fait`), données d'entrée résumées (charge × reps × RPE, volume, n séances),
  version de la règle. Le calcul ne change pas : on mémorise ce qu'il produit. Nouvelle table (migration préprod → prod).
- Résultat attendu : « Semaine du 03/11 : 3 actions proposées, 2 réalisées » consultable par l'athlète et le coach.
- Difficulté : moyenne (table, écriture idempotente côté serveur ou au premier affichage, droits — le test de droits couvre
  les nouvelles routes d'office). Risque : double écriture, écriture d'un plan recalculé avec des données incomplètes
  (hors-ligne) → écrire côté serveur.
- Tests : idempotence (2 affichages = 1 ligne), plan identique athlète / coach, droits (test permanent), changement de règle
  n'altère pas le passé.

**P1-2 · Résultat observé après la recommandation**
- Problème : C6. Valeur : tenir la promesse « vérifier si la décision a fonctionné ».
- Logique (déterministe, par type d'action, à S+1 et S+2) : charge (sous la fourchette) → revenu dans la fourchette ? ;
  séries (volume) → minimum atteint et tenu ? ; RPE → RPE redescendu à charge égale ? ; cible → atteinte ? ; levier d'un
  blocage → exercice sorti de « bloqué » dans les 2-3 séances ? Statuts : **objectif atteint / pas atteint / pas tenté / non
  évaluable (données insuffisantes)**. Texte : « résultat observé après la recommandation ».
- Résultat attendu : exemple de la mission (« maintenir 75 kg, viser RPE 9 → 75 × 5 RPE 9 → objectif atteint → décision
  maintenue »).
- Difficulté : moyenne. Risque : sur-interpréter (corrélation ≠ cause) → libellés imposés, « non évaluable » par défaut.
- Tests : un cas par statut et par type d'action ; aucune phrase causale.

**P1-3 · Niveau de confiance unique par décision (🟢🟠🔴)**
- Problème : C8. Logique documentée à partir de l'existant : 🟢 ≥ N séances comparables (seuil par type), 🟠 tendance ou
  historique limité, 🔴 données insuffisantes ; réutilise `n` / `sem` des diagnostics et `confiance` du verdict.
- Difficulté : faible à moyenne. Tests : seuils, affichage cohérent athlète / coach.

### P2 — intéressant, non urgent

- **« Ce qui a changé »** (Aujourd'hui / Analyses) : 📈 / ⚠️ / ⏸ / 🎯 → ce que ça signifie → ce que Novalyz propose,
  assemblé à partir des briques existantes (classement, verdict, plan, journal). Pas de nouveau calcul.
- **Vue coach « À surveiller aujourd'hui »** : relier « À décider » au journal (déjà proposé, déjà essayé, résultat).
- **Levier suivant si le précédent n'a rien donné** (E3), à partir du journal.
- **Fiabilisation liée** : `getCoachAthletes` rappelle `getAppData` complet pour **chaque** athlète (coût qui grandit avec
  l'équipe) [V] — à traiter dans la fiabilisation, pas dans ce chantier.

### P3 — idées futures

- Mémoire de l'athlète : « ce qui marche pour toi » (leviers qui ont donné un résultat observé), après plusieurs mois de journal.
- IA = couche d'explication branchée sur le journal (décision structurée → explication), sans nouveau chiffre.
- Détection de RPE « figé » (toujours la même valeur) pour pondérer les règles qui en dépendent.
- Base de connaissance Novalyz (capitalisation anonymisée), plus tard et avec consentement.

---

## Recommandation d'ordre

1. **P0-1, P0-2, P0-3** ensemble (petits, testables, aucune nouvelle donnée) → préprod → prod. Ils retirent des contradictions
   **avant** qu'on commence à mémoriser des décisions (sinon on mémoriserait des décisions incohérentes).
2. **P1-1 journal** (maquette de ce qui est enregistré et de son affichage d'abord), puis **P1-2 résultat observé**, puis P1-3.
3. P2 / P3 ensuite, selon les retours des testeurs.

Avant chaque étape (règle §15 de la mission) : tests de l'existant identifiés, nouveaux cas ajoutés, comparaison avant /
après sur un jeu de données réel (copie), préprod, validation du porteur, puis prod.

## Non couvert par cet audit
- Moteur **foot** (fiche joueur, suivi équipe) et **cardio** détaillé (audités les 29/10 et 01/11).
- Rejeu sur données réelles des incohérences C1-C4 (vérifiées dans le code ; leur **fréquence réelle** reste à mesurer sur une
  copie des données avant correction).
- Qualité réelle des réponses IA (IA non activée).
