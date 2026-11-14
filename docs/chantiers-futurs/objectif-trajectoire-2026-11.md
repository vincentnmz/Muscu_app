# Objectif → trajectoire — spécification (14/11/2026, à valider, AUCUN CODE)

> Demande du porteur (14/11) : classée « très haute » (ton classement : objectif → trajectoire). Prépare la décision du
> 23/11 avec la boucle « résultat → décision » (`boucle-resultat-decision-2026-11.md`). **Descriptif, jamais prédictif.**
> Légende : **[V]** vérifié (code ou base, agrégats seulement) · **[P]** proposition à valider · **[?]** à vérifier.

## 1. Ce qu'on veut

Répondre à **« est-ce que mon entraînement va dans le sens de mon objectif ? »** — en décrivant les dernières semaines,
pas en prédisant une date (« tu atteindras X le 1er mars » est interdit : promesse intenable en musculation).

## 2. Ce qui existe [V]

| Brique | Où | Ce qu'elle fait |
|---|---|---|
| Objectif de l'athlète | table `objectif` (`objectif` texte, `seances_semaine`, `poids_kg`, `date_poids`) ; `saveObjectif` | 6 objectifs : **Prise de masse · Sèche · Prise de masse + sèche · Maintien · Force · Tonification** (`OBJECTIFS`, `js/app.js`). |
| Cadrage de la lecture | `buildSyntheseMuscu` (`index.ts`) | L'objectif **oriente déjà les phrases** (baisse de volume « attention » en sèche, « inutile de forcer » en maintien, reco protéines en prise de masse…). Pas de notion de **progrès vers** l'objectif. |
| « Ce que ça change pour toi » | écran Objectif | Texte fixe par objectif (programme type, focus, ce que Novalyz surveille). |
| Mesures disponibles | `historique` | force estimée par exercice (6 sem.), volume par muscle vs cibles, régularité vs `seances_semaine`, poids (`poids_historique`), questionnaire. |

**Ce qui manque [V]** : aucun indicateur ne compare les **dernières semaines** à **ce que l'objectif demande**.

## 3. Constat bloquant en base [V] (prod, 14/11, vrais comptes seulement, agrégats)

| Mesure | Valeur |
|---|---|
| Athlètes réels | 14 |
| **Avec un objectif réglé** | **2** (tous deux « Prise de masse + sèche ») |
| Avec un nombre de séances / semaine réglé | 2 |
| Se sont déjà pesés | 4 |
| **≥ 4 pesées en 6 semaines** | **0** (max 6 pesées au total) |

L'objectif n'est demandé que dans **un** des 3 parcours d'inscription (« Novalyz me le construit ») [V].
**Conséquence** : une trajectoire fondée sur le **poids** n'aurait **aucune donnée** aujourd'hui ; et 12 athlètes sur 14
n'ont pas d'objectif → **rien à comparer**. La trajectoire doit d'abord s'appuyer sur les **séances** (que tout le monde a),
et le **réglage de l'objectif** est un prérequis produit.

## 4. Trajectoire par objectif [P] (signaux tirés des séances d'abord, poids seulement s'il est mesuré)

Fenêtre : **6 dernières semaines terminées** (comme la force estimée), comparée à la direction attendue.

| Objectif | Signal principal (séances) | Signal secondaire | Poids (seulement si ≥ 4 pesées en 6 sem.) |
|---|---|---|---|
| Prise de masse | volume par muscle : part des muscles du programme **au-dessus du minimum** | force estimée : tendance des exercices suivis | en hausse lente |
| Sèche | force estimée **maintenue** (pas de baisse marquée) | volume maintenu | en baisse lente |
| Prise de masse + sèche | force estimée **en hausse** | volume au minimum | stable |
| Maintien | **régularité** vs `seances_semaine` | force estimée stable | stable |
| Force | force estimée **en hausse** sur les exercices lourds (catégorie « gros ») | régularité | — |
| Tonification | volume (séries) au minimum + séries dans les fourchettes hautes | régularité | — |

Chaque signal est classé **dans le sens de l'objectif / à surveiller / pas assez de données** — trois états, **pas de
score**. Le résultat affiché est une phrase par signal, jamais une note globale.

Exemples de phrases (gabarits) :
- « Sur 6 semaines, ta force estimée progresse sur 5 exercices sur 7 : dans le sens de ton objectif (force). »
- « Volume : 3 muscles sur 6 au-dessus de leur minimum. Pour ta prise de masse, c'est le point à travailler. »
- « Poids : pas assez de pesées pour le suivre (pèse-toi au moins une fois par semaine). »
- Toujours : « Lecture des 6 dernières semaines, pas une prévision. »

## 5. Garde-fous [P]

1. **Pas d'objectif réglé → pas de trajectoire** : à la place, une invitation à le choisir (1 tap, écran Objectif).
2. **Seuils = bruit mesuré** : un signal n'est « à surveiller » que si l'écart dépasse la variation normale de l'athlète
   (même principe que sommeil → performance : ±3 à 6 % séance à séance, mesuré le 13/11).
3. **Hystérésis** : un état ne change qu'après **2 semaines consécutives** dans le nouvel état (anti-nervosité,
   même exigence que le test de stabilité de la boucle).
4. **R0** : pause, déload, reprise, gêne → la trajectoire de la période est marquée « contexte particulier », pas jugée.
5. **Poids** : jamais d'interprétation avec moins de 4 pesées en 6 semaines ; jamais de conseil nutritionnel chiffré
   au-delà de ce qui existe déjà.
6. Le moteur reste la source de vérité ; aucune IA ne calcule une trajectoire.

## 6. Contrôle de fiabilité avant code [P] (même méthode)

Protocole à figer avant de lancer : athlètes simulés sur 12 semaines avec une **vraie** tendance connue (force +1 %/sem,
0 %, −1 %/sem ; volume au-dessus / au-dessous du minimum) + le bruit mesuré (±3 % et ±6 % par séance).
Critères proposés : **faux « à surveiller »** quand la tendance va dans le bon sens ≤ 10 % ; **détection** d'une vraie
dérive (−1 %/sem) en ≤ 4 semaines dans ≥ 80 % des cas ; **≤ 1 changement d'état par mois** quand rien ne change.

## 7. Décisions attendues du porteur

1. **Prérequis** : faire choisir l'objectif à **tous** les athlètes (les 3 parcours d'inscription + une invitation pour
   les 12 comptes actuels sans objectif) ? C'est la condition pour que la trajectoire existe.
2. Les signaux du §4 par objectif (en particulier : force estimée comme signal principal pour Force et Recomposition).
3. Trois états sans score, une phrase par signal.
4. Hystérésis de 2 semaines.
5. Lancer la simulation (§6) avant le 23/11, code après.

---

## 8. Décisions du porteur (14/11)

| Point | Décision |
|---|---|
| Prérequis | 🟢 **Demander l'objectif à tous** : les 3 parcours d'inscription + une invitation (1 tap) aux comptes sans objectif. Sans objectif : pas de trajectoire, seulement l'invitation. |
| Signaux | 🟢 Tels quels (§4) : séances d'abord ; poids seulement si ≥ 4 pesées en 6 semaines. |
| Affichage | 🟢 3 états par signal, une phrase par signal, **pas de score global**. |
| Anti-nervosité | 🟢 Un état ne change qu'après **2 semaines consécutives** dans le nouvel état. |
| Simulation | 🟢 Maintenant, sans code ; code après le 23/11. |

## 9. Protocole de simulation (FIGÉ AVANT LANCEMENT — rien ne change après avoir vu les résultats)

**Règles simulées (ce que l'app ferait)** — évaluées chaque semaine, sur les 6 dernières semaines terminées :
- **Force estimée** (Force, Recomposition, Sèche, signal secondaire ailleurs) : score de séance = écart de force en % ;
  pente par moindres carrés (en % par semaine) et son erreur type **SE** sur les séances de la fenêtre. Moins de 6 séances →
  « pas assez de données ». **« À surveiller » si la force baisse nettement : pente + 1,28 × SE < 0.** Sinon « dans le sens
  de l'objectif ».
- **Volume** (Prise de masse ; Tonification) : moyenne des séries par semaine sur les **4** dernières semaines, pour chaque
  muscle du programme (4 muscles, minimum 10). **« À surveiller » si au moins la moitié des muscles sont sous minimum − 1.**
- **Anti-nervosité** : l'état affiché ne change qu'après 2 évaluations hebdomadaires consécutives dans le nouvel état.

**Modèle** (10 000 tirages par scénario, graine fixe, 6 semaines d'historique avant la 1re évaluation, puis 12 semaines) :
- Force : 3 séances / semaine, score = tendance vraie + bruit gaussien d'écart-type **σ = 3,3 %** (récent mesuré) ou **5,7 %**
  (long mesuré) ; 10 % des séances manquées au hasard.
- Volume : séries / semaine par muscle = arrondi d'une loi normale (moyenne m, écart-type 2), jamais < 0.

**Scénarios**
- F+ : force +1 %/sem tout du long · F0 : 0 %/sem · F− : +0,5 %/sem 6 semaines puis **−1 %/sem** (bascule en semaine 7 des 12).
- V+ : volume m = 12 (au-dessus du minimum) tout du long · V− : m = 12 puis **7** à partir de la semaine 7.

**Critères (fixés avant)**
- **T1 faux « à surveiller »** quand la tendance va dans le bon sens (F+, V+) : part des tirages qui affichent au moins une
  fois « à surveiller » sur les 12 semaines **≤ 10 %**.
- **T2 détection** d'une vraie dérive (F−, V−) : « à surveiller » affiché **≤ 4 semaines** après la bascule dans **≥ 80 %**.
- **T3 stabilité** (F+, F0, V+) : **≤ 1 changement d'état par mois** en moyenne.
- Rapporté sans critère : F0 (stagnation : ce qui est affiché), effet de σ = 5,7 %, délai médian de détection.
- **Si un critère échoue : on le dit tel quel**, retour au porteur, pas d'ajustement silencieux.

## 10. Résultats (14/11, protocole §9 inchangé — `scripts/simulation-trajectoire/sim.js`)

| Critère | Force σ 3,3 % | Force σ 5,7 % | Volume |
|---|---|---|---|
| **T1** faux « à surveiller » quand ça va dans le bon sens (≤ 10 %) | ✅ 0,1 % | ✅ 1,5 % | ✅ 0,0 % |
| **T2** dérive affichée ≤ 4 sem. après la bascule (≥ 80 %) | ❌ 6,5 % (médiane 6 sem.) | ❌ 8,1 % (médiane 5 sem.) | ❌ 28,7 % (médiane 5 sem.) |
| **T3** changements d'état / mois (≤ 1) | ✅ 0 (F+) · 0,19 (F0) | ✅ 0,01 · 0,20 | ✅ 0 |
| Rapporté : fausse alerte avant la bascule (F−) | 1,9 % | 5,9 % | — |
| Rapporté : stagnation (F0) affichée « à surveiller » au moins une fois sur 12 sem. | **34,9 %** | **35,8 %** | — |

**Verdict** : T1 et T3 passent largement (la règle est **calme et ne crie pas au loup**) ; **T2 échoue partout**.

**Pourquoi T2 échoue — délai sans aucun bruit (hors protocole, même règle)** : 1re alerte affichée **5 semaines** après la
bascule pour la force comme pour le volume (4 sans l'anti-nervosité). La fenêtre (6 ou 4 semaines terminées) met ~3-4
semaines à « voir » la baisse, puis l'anti-nervosité ajoute 1 semaine. **T2 (≤ 4 semaines) est donc inatteignable par
construction** avec les choix validés (fenêtre de 6 semaines, 2 semaines d'anti-nervosité) — même nature que C2 dans la
boucle. Rien n'a été ajusté.

**Point à trancher révélé par F0** : avec une force **stable**, la règle « baisse nette » s'affiche « à surveiller » au
moins une fois sur 12 semaines dans **≈ 35 %** des cas. Pour **Force / Recomposition**, une stagnation de 12 semaines
mérite peut-être d'être signalée ; pour la **Sèche** (objectif : maintenir), une force stable est un **succès** → ces
35 % seraient de **fausses alertes**. La règle de la Sèche doit donc être distincte (ex. tolérance avant « baisse »).

## 11. Décisions du porteur après la simulation (14/11)

| Point | Décision |
|---|---|
| Force : fenêtre 6 semaines, règle telle que simulée | 🟢 Validé — délai ≈ 5 semaines **assumé** ; ne jamais promettre une détection en 4 semaines. |
| Raccourcir la fenêtre pour tenir T2 | 🔴 Refusé (faux positifs ≤ 1,5 %, stable : on garde une conclusion fiable plutôt qu'une alerte rapide). |
| Phrase en cas de baisse | « Ta progression est en baisse sur les dernières semaines. » + « Lecture des 6 dernières semaines. » — **jamais** « ton objectif est compromis » (pas de trajectoire prédictive). |
| Sèche | 🟠 Règle séparée, **simulation dédiée avant tout code** ; seuils fixés **avant** de voir les résultats. Scénarios demandés : poids ↓ + force stable ; poids ↓ + petite baisse de force acceptable ; poids ↓ + forte baisse de force ; poids stable + force stable ; bruit normal ; reprise / déload. |

## 12. Protocole Sèche — PROPOSITION à valider (rien n'est lancé ; figé seulement après accord du porteur)

**Règle candidate** (évaluée chaque semaine, 6 dernières semaines terminées, même anti-nervosité de 2 semaines) :
- **Force** : même pente + erreur type que §9, mais avec une **tolérance** : « à surveiller » seulement si la force baisse
  **plus que T %/semaine** de façon nette : pente + 1,28 × SE < **−T**. Proposition : **T = 0,5 %/sem** (≈ −3 % sur 6 semaines,
  ordre de grandeur d'une baisse « acceptable » en déficit) — **c'est le seuil à valider**.
- **Poids** : lu seulement si ≥ 4 pesées en 6 semaines ; pente des pesées (kg/sem). Le poids ne déclenche **jamais** seul une
  alerte : il sert à dire si la sèche « avance » (pente < 0) ou non (« poids stable »), en phrase descriptive.
- **R0** : semaines marquées reprise / déload exclues de la fenêtre (pas jugées).
- Phrases : « Force maintenue pendant ta sèche » · « Ta force baisse plus que prévu sur les dernières semaines » ·
  « Poids stable sur 6 semaines » / « Poids en baisse » / « Pas assez de pesées ». Jamais « sèche ratée ».

**Scénarios** (10 000 tirages, bruit σ 3,3 % et 5,7 % comme §9 ; poids : bruit 0,4 kg par pesée, 1 à 2 pesées/sem.) :
| Id | Vérité | Ce qu'on attend |
|---|---|---|
| S1 | poids −0,5 kg/sem, force 0 %/sem | « maintenue » (succès) |
| S2 | poids −0,5 kg/sem, force −0,3 %/sem (petite baisse acceptable) | « maintenue » |
| S3 | poids −0,5 kg/sem, force −1,5 %/sem (forte baisse) | « à surveiller » |
| S4 | poids stable, force stable | force « maintenue » + « poids stable » (descriptif, pas d'alerte) |
| S5 | S1 avec 2 semaines de reprise / déload (force −5 % ces semaines-là) | pas d'alerte due au déload |

**Critères proposés** :
- **K1 fausse alerte** (S1, S2, S4, S5) : « à surveiller » au moins une fois sur 12 semaines **≤ 10 %**.
- **K2 détection** (S3) : « à surveiller » affiché dans **≥ 80 %** des tirages, délai **≤ 6 semaines** (on assume déjà ≈ 5 sem.).
- **K3 stabilité** : ≤ 1 changement d'état par mois.
- **K4 poids** : S1 lu « en baisse » et S4 lu « stable » dans ≥ 80 % des tirages quand il y a assez de pesées.
- Rapporté : sensibilité au choix de T (0,3 / 0,5 / 0,8 %/sem) — **uniquement en rapport**, le T retenu est celui validé avant.

**À valider** : le seuil T, les 5 scénarios (dont la valeur « −0,3 %/sem acceptable » et « −1,5 %/sem forte baisse »), les critères.

## 13. Protocole Sèche v2 — À VALIDER (remplace la proposition du §12 ; rien n'est lancé, aucun code)

Retour porteur (14/11) : ne pas valider −0,5 %/sem avant la simulation ; tester explicitement 7 situations ; critères fixés
**avant**. Donc le seuil n'est **pas choisi à l'avance** : la simulation en teste plusieurs, et la **règle de choix** est écrite
ici, avant de voir les résultats.

**Règle simulée** (identique au §9 sauf la tolérance) : chaque semaine, sur les 6 dernières semaines terminées, pente de la
force estimée (%/sem) + erreur type SE ; moins de 6 séances → « pas assez de données ». « À surveiller » si
**pente + 1,28 × SE < −T**. Anti-nervosité : 2 semaines. Semaines déclarées reprise / déload exclues (R0).
**Poids** : lecture **descriptive seulement** (« en baisse » si pente des pesées < −0,1 kg/sem nettement, sinon « stable » ;
« pas assez de pesées » sous 4 pesées / 6 sem.) ; il **ne déclenche ni n'annule** l'alerte de force.
**Seuils candidats T** : 0,3 · 0,5 · 0,8 · 1,0 %/sem.

**Scénarios** (10 000 tirages chacun, 6 sem. d'historique + 12 évaluées, 3 séances/sem, 10 % manquées ; bruit de force
σ = 3,3 % et 5,7 % ; poids : 1 à 2 pesées/sem, bruit 0,4 kg) — vérité de force en %/sem :
| Id | Situation demandée | Force | Poids | Attendu |
|---|---|---|---|---|
| R1 | Sèche réussie, force globalement conservée | −0,3 | −0,5 kg/sem | pas d'alerte |
| R2 | Perte de poids sans baisse réelle de performance | 0 | −0,5 kg/sem | pas d'alerte |
| R3 | Fluctuations ponctuelles | 0, + 2 séances isolées à −8 % | −0,5 kg/sem | pas d'alerte |
| R4 | Reprise / déload (déclaré) | 0, 2 sem. à −5 % marquées R0 | −0,5 kg/sem | pas d'alerte |
| I1 | Cas intermédiaire | −0,7 | −0,5 kg/sem | **zone grise : rapporté, sans critère** |
| B1 | Sèche problématique : forte baisse | 0 puis **−1,5 dès la sem. 7** | −0,5 kg/sem | alerte |
| B2 | Baisse réelle de perf. sans perte de poids suffisante | 0 puis **−1,5 dès la sem. 7** | stable | alerte (poids lu « stable ») |

**Critères (fixés avant)** — pour un T donné :
- **K1 fausses alertes** (R1, R2, R3, R4) : « à surveiller » au moins une fois sur 12 semaines **≤ 10 %**, à σ 3,3 % **et** 5,7 %.
- **K2 détection** (B1, B2) : « à surveiller » affiché **≤ 6 semaines** après la bascule dans **≥ 80 %** des tirages (σ 3,3 %) ;
  à σ 5,7 % : rapporté.
- **K3 stabilité** (R1, R2) : ≤ 1 changement d'état par mois.
- **K4 poids** : R1/R2 lus « en baisse » et B2 lu « stable » dans ≥ 80 % des tirages (pesées suffisantes).

**Règle de choix du seuil (écrite avant)** : on retient le **plus petit T qui passe K1 à K4** (le plus sensible parmi les
fiables). Si aucun T ne passe tout : **on le dit tel quel**, pas d'ajustement, retour au porteur. I1 et σ 5,7 % sur K2 : rapportés
pour éclairer la décision, jamais pour changer le choix après coup.

**À valider par le porteur** : les 7 scénarios et leurs valeurs, les critères K1-K4 (dont « ≤ 6 semaines » pour K2), la grille
de T, la règle de choix. Puis : figer (commit) → lancer → rapporter.

### 13 bis. Décision du porteur (14/11) et précisions d'implémentation — FIGÉ AVANT LANCEMENT

🟢 Scénarios, critères K1-K4, grille T = 0,3 / 0,5 / 0,8 / 1,0 %/sem, règle « plus petit T passant tout ; aucun → on ne force
pas », I1 hors calibrage, poids qui ne déclenche ni n'annule l'alerte, aucun ajustement après les résultats.

Précisions (écrites avant de lancer, `scripts/simulation-seche/sim.js`) :
- Bascule B1/B2 en semaine 7 des 12 évaluées ; détection = 1re semaine affichée « à surveiller » à partir de la bascule,
  délai compté comme au §9 (≤ 6 → dans les 6 évaluations qui suivent).
- R3 : 2 séances tirées au hasard parmi toutes les séances (18 semaines), score − 8 points.
- R4 : semaines 9 et 10 des 12 évaluées à − 5 points, déclarées déload → exclues de la fenêtre de calcul.
- Poids : 80 kg au départ, 1 ou 2 pesées par semaine (jours au hasard), bruit gaussien 0,4 kg ; fenêtre = 6 dernières
  semaines terminées ; « en baisse » si pente + 1,28 × SE < − 0,1 kg/sem ; < 4 pesées → « pas assez de pesées ». Pas
  d'anti-nervosité sur le poids (lecture descriptive). **K4 lu à la dernière évaluation** de chaque tirage.
- K3 = changements d'état de force affichés sur 12 semaines / 3 (mois), moyenne des tirages, R1 et R2, aux deux σ.
- Graine fixe 20261114, 10 000 tirages par scénario × σ × T.

