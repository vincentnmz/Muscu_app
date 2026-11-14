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
