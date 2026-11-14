# Boucle « résultat → décision suivante » — spécification (14/11/2026, à valider, AUCUN CODE)

> Demande du porteur (14/11). Prolonge `moteur-decision-mission-2026-11.md` (§8 boucle décision → résultat, §9 mémoire)
> et l'audit `docs/audit-moteur-decision-2026-11-13.md` (P1-1 journal, P1-2 résultat observé : en prod).
> **Rien n'est codé tant que cette spec, puis son contrôle de fiabilité (§7), ne sont pas validés.** Implémentation
> prévue **après le point du 23/11 et les premiers retours testeurs** (décision du 13/11 : on observe d'abord).
> Légende : **[V]** vérifié dans le code au 14/11 · **[P]** proposition à valider.

## 1. Ce qu'on veut

Novalyz doit pouvoir dire, pour chaque action de son plan :
**« voilà ce que je t'ai proposé → voilà ce qui s'est passé → donc voilà ce que je te propose maintenant »**,
sans jamais affirmer une cause (« résultat observé après la recommandation », pas « grâce à »).

## 2. Ce qui existe déjà [V]

| Brique | Où | Ce qu'elle fait |
|---|---|---|
| Plan de la semaine | `_lv3Plan` (js/lecture-v3.js) | ≤ 3 actions, calculées sur les séances **avant lundi** (stable toute la semaine). Types : `charge` (revenir dans la fourchette), `series` (volume d'un muscle), `rpe` (garder la charge, viser RPE 8), `cible` (pousser un exercice en progrès), `reprise`. |
| Journal | table `decisions`, `enregistrerPlan` / `getDecisions` | Fige la **première version valide** du plan de chaque semaine : type, clé (exercice ou muscle), texte, raison, **critère de réussite**, données d'entrée, version de règle. Ajout seul. |
| Statut de la semaine | `_lv3JournalEvaluer` (même règle que la coche « fait ») | `atteint` · `pas_atteint` (tenté, critère pas atteint) · `pas_tente` (exercice / muscle pas fait) · `non_evaluable`. |
| Résultat observé ensuite | `_lv3JournalSuite` | Sur les 1 à 2 semaines suivantes, avec le critère enregistré : `confirme` · `non_confirme` (≥ 2 séances) · `trop_tot` · `pas_refait`. |
| Leviers possibles | `_lv3Diag` | Pour un exercice qui coince, plusieurs causes testées (volume, effort, repos, gêne, série légère d'avant, marche de charge…) ; **seule la 1re donne le levier**, les autres restent dans le « Pourquoi ». |

**Le manque [V]** : `_lv3Plan` **ne lit pas le journal**. Une action « pas atteinte » peut être reproposée à l'identique la
semaine suivante, puis la suivante, sans que Novalyz le dise ni change d'approche. La boucle est ouverte à cet endroit.

## 3. Historique d'une action [P]

- **Même action** = même `type_action` + même `cle` (l'exercice, ou le muscle pour `series`) — c'est déjà la clé unique du journal.
- **Issue d'une semaine** (à partir des deux évaluations existantes, rien de nouveau à calculer) :

| Issue | Condition | Ce que ça veut dire |
|---|---|---|
| **Réussie** | statut `atteint` | le critère fixé à l'avance a été atteint |
| **Échec tenté** | statut `pas_atteint` (l'exercice / le muscle a été fait) | l'action a été essayée et n'a pas marché cette semaine |
| **Non tentée** | statut `pas_tente` | l'athlète ne l'a pas faite : ce n'est **pas** une preuve que le levier est mauvais |
| **Inconnue** | `non_evaluable`, semaine en cours, données manquantes | ne compte pas |

- **Mémoire** : les **6 dernières semaines** du journal ; un succès **remet à zéro** le compteur d'échecs de cette action.

## 4. Règles de décision [P] (déterministes, appliquées au calcul du plan de la semaine W, avec le journal des semaines < W)

| # | Situation | Décision |
|---|---|---|
| **R0** | Gêne active, pause, déload, reprise | Les garde-fous existants passent **avant** la boucle (inchangés). |
| **R1** | Dernière issue = réussie | Le moteur propose la suite normale (ex. nouvelle cible). Une ligne le rappelle : « Semaine du 09/11 : objectif atteint (75 kg × 6). » |
| **R2** | **2 échecs tentés de suite** (2 semaines distinctes) pour la même action | **Ne pas la reproposer telle quelle.** Prendre le **levier suivant** du diagnostic (2e cause trouvée). S'il n'y en a pas : levier de repli selon le niveau (changer de fourchette ou de variante 3-4 semaines — leviers déjà écrits dans `_lv3Diag`). S'il n'y en a aucun : pas d'action, et le dire (« déjà proposé 2 fois sans résultat : change d'approche, ou vois-le avec ton coach »). |
| **R3** | **2 non tentées de suite** | Ne **pas** changer de levier (rien ne dit qu'il est mauvais). L'action reste, mais passe **en dernier** et le texte le reconnaît : « proposé 2 semaines, pas fait : garde-la seulement si elle te semble faisable ». |
| **R4** | 1 seul échec, ou issues inconnues | **Aucun changement** (une semaine ratée = bruit possible : la performance varie de ±3 à 6 % d'une séance à l'autre, mesuré le 13/11). |
| **R5** | Coach a coupé les propositions | Rien ne change pour l'athlète (pas de plan affiché). Le coach voit l'historique (« Déjà proposé », maquette `mockups/journal-decisions.html`). |

**Pourquoi 2 et pas 1** : avec un seul échec, Novalyz changerait d'avis sur du bruit. 2 est le minimum ; le contrôle (§7)
dira si 2 suffit ou s'il faut 3.

## 5. Ce que l'athlète lit [P] (gabarits, pas de cause)

- R1 : « Semaine du 09/11 : objectif atteint (75 kg × 6). On continue : vise 75 kg × 8. »
- R2 : « Déjà proposé les semaines du 02/11 et du 09/11 (« garde 40 kg, vise RPE 8 ») sans résultat (RPE 9 puis 9,5).
  Novalyz propose autre chose : reviens à 2 min de repos. » — le nouveau levier garde son propre « Pourquoi ».
- R3 : « Proposé 2 semaines, pas fait. Garde-le seulement s'il te semble faisable. »
- Toujours : « Résultat observé après la recommandation — d'autres facteurs peuvent jouer. »

## 6. Contraintes techniques [P]

1. **Le plan doit lire le journal** : aujourd'hui le journal est chargé à part (`getDecisions`, asynchrone). Règle : le plan
   n'est **enregistré** dans le journal qu'**après** le chargement du journal (sinon la première version figée de la
   semaine serait calculée sans la boucle). Journal indisponible → plan sans boucle, **pas d'enregistrement**.
2. **Stabilité** : le plan de la semaine W n'utilise que les décisions des semaines < W et les séances avant lundi
   (comme aujourd'hui) → identique toute la semaine, sur tous les appareils.
3. **Version de règle** du plan incrémentée (le journal sait quelle règle a produit chaque plan).
4. Rien côté serveur pour la boucle elle-même (le plan est calculé dans l'app) ; le mail récap n'utilise pas le plan.
5. Pas de nouvelle table : tout vient du journal existant + des séances.

## 7. Contrôle de fiabilité AVANT code [P] (même méthode que sommeil → performance)

Simulation fixée à l'avance, puis seulement ensuite le code :
- Athlètes simulés, chaque semaine l'action **réussit avec une probabilité p** : levier qui marche (p = 0,7), levier
  moyen (p = 0,4), levier qui ne marche pas (p = 0,1) ; adhérence variable (non tentée 0 à 40 % des semaines).
- Mesures : **abandon à tort** d'un levier qui marche (sur 6 semaines) · **délai** pour changer un levier qui ne marche
  pas · nombre de changements d'avis par athlète et par mois.
- Critères proposés (à fixer avant de lancer) : abandon à tort ≤ 10 % (p = 0,7) ; changement en ≤ 3 semaines dans
  ≥ 80 % des cas (p = 0,1) ; ≤ 1 changement de levier par action et par mois en moyenne.
- Comparer N = 2 et N = 3 échecs ; retenir le plus petit N qui respecte les critères.
- **Limite** : on n'a pas encore de vraies probabilités de réussite par type d'action (3 décisions en prod au 13/11).
  Les retours du journal d'ici fin novembre serviront à calibrer p.

## 8. Tests prévus [P]

Unitaires (R0-R5, mémoire de 6 semaines, remise à zéro après un succès, journal absent → pas d'enregistrement) ·
profils de banc : « échec répété », « non tentée », « succès puis suite » · comparaison avant / après sur le banc
(aucun changement pour les profils sans historique de journal).

## 9. Hors périmètre

Objectif → trajectoire (chantier suivant) · IA · apprentissage automatique · toute affirmation de cause · changement du
calcul des statuts existants (`_lv3JournalEvaluer`, `_lv3JournalSuite`) · vue coach (lecture de l'historique : existe).

## 10. Décisions attendues du porteur

1. Règles R1 à R5 (en particulier **R3** : garder l'action non tentée en dernier, ou la retirer ?).
2. Mémoire de **6 semaines**, remise à zéro après un succès.
3. Textes du §5.
4. Lancer le **contrôle de fiabilité (§7)** maintenant (sans code app), le code après le 23/11.
