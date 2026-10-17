# Audit du moteur d'analyse — « aide à la décision » (athlète + coach)

> But : vérifier, **en traçant dans le code**, ce que le moteur produit réellement
> face à la **boussole produit** (`vision-produit.md`) :
> **① comment s'entraîner · ② si c'est bien fait · ③ comment progresser (données + ressenti)**.
> Chaque ligne est notée **🟢 solide · 🟡 superficiel · 🔴 manquant**, avec le renvoi au code.
> Règle appliquée : on distingue *« vérifié contre le code »* de *« supposé »*. (CLAUDE.md §6bis)

Date : oct. 2026 · Sources : `supabase/functions/handler/index.ts`, `js/app.js`.

---

## 0. Constat de départ (honnête)

Le moteur **existe et reste la source de vérité** — il ne s'est pas dilué *dans le code*.
Ce qui a dérivé, c'est **l'allocation d'effort récente** (onboarding, récompenses, visite,
logistique Play) et la **mise en avant** de la valeur analytique, pas le moteur lui-même.

Deux faiblesses transverses, valables athlète **et** coach :
- **A. La pépite est diluée** : disponibilité + reco + alertes sont noyées dans beaucoup de cartes.
- **B. On s'arrête souvent au constat** : le moteur *décrit* (« vigilance », « stagnation »)
  plus qu'il ne *prescrit* (« baisse le volume de X % », « +2,5 kg ici », « remplace cet exo »).

---

## 1. Ce que le moteur calcule aujourd'hui (inventaire vérifié)

| Brique | Où (code) | État |
|---|---|---|
| Disponibilité du jour (Prêt/Vigilance/Repos) = ressenti × charge × contexte | `index.ts` moteur + `renderCoachHeroEtat` / `renderEtatDuJour` | 🟢 |
| ACWR aigu/chronique **avec fiabilité** (refuse de juger si données minces / reprise) | `calculerACWR` / `fiabiliteACWR` / `interpreterACWR` | 🟢 |
| Monotonie / strain | `computeGlobal` (l.241-254) | 🟢 (calculé) / 🟡 (peu exploité en reco) |
| Effets de contexte (deload, retour de vacances) sur surcharge/risque | `effetsContexte` / `CORE_CONTEXTES` | 🟢 |
| Volume par muscle vs cible (+ volume indirect ½ série) | `_maProgGrp` (front) + `volume_obti` | 🟢 |
| Progression par exercice (charge/reps/1RM) | `progression_par_exo`, `_maProgExo` | 🟢 (donnée) / 🟡 (décision) |
| Records | `computeGlobal.records` | 🟢 |
| Alertes qualifiées : irrégularité, fatigue, stagnation (seuil/niveau), fatigue RPE latente | `alertes.push` (l.589-634) | 🟢 (détection) / 🔴 (prescription) |
| Respect du programme (charge % 1RM & RPE dans la cible) | `buildRespectProgramme` (l.1381) | 🟡 |
| Reco priorisée par objectif (prise/maintien/recomp) | `buildSyntheseMuscu/Cardio/Croise` | 🟡 |

---

## 2. Boussole ① — « comment s'entraîner »

**Athlète**
- 🟢 Disponibilité du jour → oriente l'intensité (« garde la charge sans l'augmenter aujourd'hui »).
- 🟡 Programme : l'app **stocke** un programme et des cibles (% 1RM, RPE) mais ne **propose pas**
  l'ajustement de la *prochaine* séance à partir de l'état du jour. La reco est globale, pas « séance ».
- 🔴 **Prescription de charge concrète** : on dit « poursuis la surcharge » mais pas
  « +2,5 kg au développé couché » (le 1RM estimé existe pourtant → le calcul est faisable).

**Coach**
- 🟢 Triage « À surveiller » (statut action/vigilance) : qui a besoin de lui.
- 🟡 Reco par athlète = texte global. Pas de **« quoi changer dans son programme cette semaine »** actionnable.
- 🔴 Pas de **prochaine action unique** par athlète (« 1 décision / joueur »), ce qui ferait gagner du temps.

## 3. Boussole ② — « si c'est bien fait »

**Athlète**
- 🟡 `buildRespectProgramme` = le seul vrai « bien fait » : % d'exos dans la cible (charge/RPE).
  **Limites** : ne se déclenche que si des cibles existent ; binaire (±5 % charge, ±1 RPE) ; pas de verdict **par séance**.
- 🔴 Pas de **verdict de séance** juste après l'avoir faite (« séance conforme / trop légère / trop dure »),
  alors que les données (charge réalisée vs cible, RPE) sont là.

**Coach**
- 🟡 Voit l'assiduité, le respect global, les alertes. 🔴 Mais pas un **indicateur de qualité d'exécution**
  synthétique par athlète (ex. « 3/5 séances conformes ce mois »).

## 4. Boussole ③ — « comment progresser »

**Athlète**
- 🟢 Progression par exo (charge/reps/1RM), records, tendances tonnage/régularité.
- 🟡 Alerte **stagnation** (seuil par niveau) = bon signal… mais s'arrête au constat.
- 🔴 **Que faire** face à la stagnation : pas de piste (varier l'exo, monter les reps avant la charge,
  semaine de décharge). La donnée pour décider existe (historique, volume/muscle, monotonie).

**Coach**
- 🟢 Records / régression par exo (`renderCoachRecordsEtRegression`), volume/muscle.
- 🔴 Pas de **synthèse « ce qui progresse / ce qui bloque »** par athlète prête à lire en 5 s.

---

## 5. « Chiffre au lieu de décision » — points chauds

1. **Stagnation** : détectée, jamais suivie d'une piste d'action → *le* gisement n°1.
2. **ACWR / monotonie** : affichés comme ratio/valeur ; rarement traduits en consigne simple
   (« charge en hausse trop vite : lisse sur 2 semaines »).
3. **Volume par muscle** : barres vs cible 🟢, mais pas de reco « ajoute 2 séries dos / réduis pecs ».
4. **1RM estimé** : calculé partout, **jamais** utilisé pour proposer la charge de la prochaine série.
5. **Respect programme** : bon signal 🟡 mais invisible côté athlète hors synthèse.

---

## 6. Pistes à fort impact (proposées, à prioriser ensemble)

> Principe : **transformer un constat déjà calculé en décision**, sans réécrire le moteur
> (on branche sur les sorties existantes). IA = couche langage *plus tard*, pas de chiffre inventé.

**P1 — Verdict de séance (②, athlète)** 🔴→🟢
À la fin d'une séance : « Conforme / Trop légère / Trop dure » en comparant charge réalisée vs
cible (1RM × % déjà calculé) + RPE vs RPE cible. Données déjà présentes (`buildRespectProgramme`).

**P2 — Prescription anti-stagnation (③, athlète)** 🔴→🟡
Quand l'alerte stagnation tombe, ajouter **une** piste concrète selon le cas (reps avant charge,
varier l'exercice, micro-décharge). Règles déterministes branchées sur l'historique de l'exo.

**P3 — « Prochaine action » unique par athlète (①, coach)** 🔴→🟢
Sur la fiche + la liste coach : **une** phrase d'action priorisée (déjà quasi là via `reco` +
statut) remontée en tête, pour décider en 5 s « qui, pourquoi, quoi faire ».

**P4 — Prescription de charge (①, athlète)** 🟡→🟢
Proposer la charge de la prochaine série à partir du 1RM estimé + % cible (ex. « vise 72,5 kg »),
avec garde-fou de fiabilité (assez d'historique sur l'exo).

**P5 — Resserrer la mise en avant (A, les deux)** 
Hiérarchiser les écrans pour que **disponibilité + reco + alertes** soient le *premier* regard,
le détail en dessous. Pas de nouveau calcul : de la hiérarchie visuelle.

---

## 7. Ce qu'il NE faut pas casser (garde-fous)

- La **fiabilité** (ACWR qui se tait sur données minces) est un atout différenciant : toute
  prescription nouvelle doit hériter du même garde-fou (`fiabiliteACWR`, historique min).
- Le moteur **déterministe** reste la source de vérité ; une prescription = une **règle tracée**,
  jamais un chiffre « inventé ». (CLAUDE.md §5)
- Toute phrase affichée = **vérifiée contre le code** avant de dire « c'est fiable ». (§6bis)

---

## 8. Reco de priorisation (mon avis)

Ordre de valeur décroissante pour recentrer sur l'analyse : **P3 (coach) → P1 (athlète) → P2 → P4 → P5**.
P3 + P1 redonnent immédiatement le sentiment « outil d'aide à la décision » des deux côtés,
sans toucher au moteur, en branchant sur des sorties déjà calculées.
