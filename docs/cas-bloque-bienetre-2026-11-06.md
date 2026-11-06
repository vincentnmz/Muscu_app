# Tableaux de cas — « bloqué » et « bien-être » (06/11/2026)

Données : base Supabase **à jour** (lecture seule, 06/11), compte Vincent — 317 séries, 32 exercices depuis le 20/09 ; réponses bien-être depuis le 15/10.
**Validé par le porteur le 06/11** (« oui pour tout », gêne comptée à partir de **3/5**). Codé et vérifié sur les données réelles :
- Élévation latérale → *Pourquoi* : « Possible : ta série à 5 kg est passée de 16 à 19 reps pendant que tes séries à 7,5 kg sont redescendues de 11 à 10 » ; *Levier* : « garde ta série à 5 kg au niveau d'avant (≈ 16 reps, sans aller au bout) pour arriver plus frais sur 7,5 kg » ; vérifiés pas en cause : volume, fréquence, repos (2 min stable), effort (RPE 9). La gêne d'épaule à 2/5 ne compte pas (seuil 3/5).
- Même levier partout (diagnostic, recos Analyses, message en séance). Tests : `tests/lecture-v3.test.js`, `tests/bienetre-jour.test.js` (8 cas du tableau B).

---

## A. Exercice « bloqué »

### A0. Qui est bloqué aujourd'hui (classement actuel de Novalyz, données à jour)
Seul exercice bloqué : **Élévation latérale uni à la poulie** (intermédiaire → « bloqué » après 3 séances sans mieux).
Tout le reste est en record ou en progrès ; aucun « recule », aucun « sous la fourchette ».

Séries réelles (fourchette 8-20, catégorie Léger) :

| Date | Série à 5 kg | Séries à 7,5 kg | Repos |
|---|---|---|---|
| 22/10 | 15 reps · RPE 8 | 9 · 9 reps · RPE 9 / 9 | 2 min |
| 26/10 | 16 · RPE 8 | 10 · 9 reps · RPE 8 / 9 | 2 min |
| 29/10 | 16 · RPE 8 | **11 · 11** reps · RPE 9 / 9 | 2 min |
| 02/11 | 17 · RPE 8 | 10 · 10 · RPE 9 / 9 | 2 min |
| 05/11 | **19 · RPE 7** | 10 · 10 · RPE 9 / 9 | 2 min |

Bien-être sur la même période : **gêne à l'épaule 2/5 le 26/10 (épaule gauche) et le 02/11 (épaule)**.

### A1. Ce que Novalyz vérifie (dans cet ordre) et ce qu'il dirait pour l'élévation latérale

| # | Vérification (sur les séries de travail = la charge du jour) | Règle | Élévation latérale | Statut |
|---|---|---|---|---|
| 1 | Charge trop lourde | reps < bas de fourchette à RPE ≥ 9 | 10 reps ≥ 8 | existe — pas en cause |
| 2 | Échec répété | RPE 10 sur 3 séances | RPE 9 | existe — pas en cause |
| 3 | Volume du muscle | séries/sem < minimum | épaules 13,8/sem, dans la zone | existe — pas en cause |
| 4 | Effort en hausse à charge égale | RPE +0,5 vs séance d'avant | 9 → 9 | existe — pas en cause |
| 5 | Fréquence | ≤ 1×/sem | 2×/sem | existe — pas en cause |
| 6 | Repos raccourci | dernière séance ≥ 30 s de moins que les précédentes | 2 min stable | **nouveau** — pas en cause |
| 7 | Effort laissé en réserve | RPE moyen des séries de travail < 8,5 | RPE 9 | **nouveau** — pas en cause |
| 8 | **Gêne sur la zone** | douleur ≥ 2/5 sur la zone du muscle pendant le plateau | épaule 2/5 le 26/10 et le 02/11 | **nouveau** — **possible** |
| 9 | **Série d'avant qui fatigue plus** | une série plus légère, avant les séries de travail, dont les reps montent (+3 ou plus) pendant que les séries de travail stagnent ou baissent | 5 kg : 16 → 19 reps ; 7,5 kg : 11 → 10 | **nouveau** — **possible** |
| 10 | Marche de charge trop grosse | marche ≥ 15 % **et** reps proches du haut (≥ haut − 2) | 10 reps sur 20 | **nouveau** — pas en cause (loin du haut) |

**Aujourd'hui l'app dit** : « aucune cause visible dans tes données — persiste en visant RPE 8-9 ; si ça dure 2 séances de plus, change de fourchette ou de variante. »

**Proposé** :
- *Pourquoi* : « Gêne à l'épaule signalée (2/5) le 26/10 et le 02/11 · ta série à 5 kg est passée de 16 à 19 reps pendant que tes séries à 7,5 kg sont redescendues de 11 à 10. »
- *Levier* : « Garde ta série à 5 kg au niveau d'avant (≈ 16 reps, sans aller au bout) pour arriver plus frais sur 7,5 kg ; et surveille l'épaule : si la gêne revient, garde la charge. »
- Vérifiés et « pas en cause » listés dessous (repos, effort, volume, fréquence) pour que tu voies ce qui a été regardé.

> ⚠️ Les causes 8 et 9 sont des **pistes tirées de tes données**, pas des certitudes : Novalyz les présente comme « possible », jamais comme un diagnostic.

### A2. Les autres situations (cas types, pour valider chaque règle)

| Cas | Données | Pourquoi (affiché) | Levier proposé |
|---|---|---|---|
| Repos raccourci | 80 kg × 8 bloqué ; repos 2 min → 1 min 30 la dernière fois | Repos raccourci : 2 min → 1 min 30 | Reviens à 2 min de repos (1 min 30 la dernière fois). |
| Effort en réserve | 60 kg × 10 sur 3 séances, RPE 7-8 | Séries arrêtées à RPE 7,5 (≈ 2-3 reps en réserve) | Sur ta dernière série, va jusqu'à RPE 9-10 à 60 kg. |
| Marche trop grosse, en haut de fourchette | 7,5 kg × 19-20 (fourchette 8-20), marche +2,5 kg | Marche suivante +2,5 kg = +33 % | Passe-la au plus petit cran possible, ou ajoute 1 série à 7,5 kg. |
| Charge trop lourde (existe) | 80 kg × 4 à RPE 10, fourchette 6-12 | Charge : 80 kg pour 4 reps | Petit pas (75 kg) ou charge sûre, puis +1 rep. |
| Volume bas (existe) | Ischios 4,3 séries/sem, minimum 10 | Volume ischios 4,3/sem | Monter le volume des ischios (tous exercices). |
| Aucune cause, RPE ≥ 8,5 (intermédiaire) | plateau, tout « pas en cause » | — | Garde ta charge ; si ça dure encore 2 séances, change de fourchette de reps 3-4 semaines. |
| Aucune cause, débutant | idem | — | Garde l'exercice et ta régularité avant de changer quoi que ce soit. |
| Aucune cause, avancé | idem | — | Plateau fréquent à ton niveau : change de fourchette (ou de variante) 3-4 semaines. |

« Change de variante » : **avancés seulement**, en dernier recours. Jamais « +1 rep » sur un exercice déjà bloqué.

### A3. Questions pour toi
1. Les causes 8 (gêne sur la zone) et 9 (série d'avant qui fatigue plus) te paraissent-elles justes pour ton élévation latérale ?
2. Une gêne **légère** (2/5) doit-elle compter comme cause possible, ou seulement à partir de 3/5 ?

---

## B. Questionnaire bien-être

### B0. Règle actuelle (vérifiée `index.ts`, fenêtre 7 jours)
- Athlète : fatigue = **moyenne 7 j**, sommeil = **moyenne 7 j**, douleur = **dernière réponse**.
- Coach / équipe : fatigue = **maximum 7 j**, sommeil = moyenne 7 j, douleur = dernière réponse.
- Seuils : fatigue ≥ 4/5, sommeil ≤ 2/5 → Vigilance ; en séance : « pas de progression aujourd'hui, mêmes charges ».

### B1. Règle proposée
- **La réponse d'aujourd'hui ou d'hier décide** (c'est la journée qui compte).
- Pas de réponse depuis 2 jours ou plus → seulement une **tendance** : au moins 2 réponses défavorables sur 7 j, ou moyenne 7 j défavorable ; sinon rien.
- Douleur : dernière réponse (inchangé).
- **Même règle pour l'athlète et le coach.**

### B2. Cas (Vigilance = orange ; « séance » = ce que la saisie propose)

| Cas | Réponses | Aujourd'hui (athlète) | Aujourd'hui (coach) | Proposé (les deux) |
|---|---|---|---|---|
| 1. Mauvaise nuit puis la pêche | lun sommeil 1 · mar sommeil 4 | mar : moyenne 2,5 → Prêt | mar : Prêt (moyenne 2,5) | mar : **Prêt** (réponse du jour) |
| 2. Journée fatiguée puis la pêche | lun fatigue 5 · mar fatigue 1 | mar : moyenne 3 → Prêt | **jusqu'au dimanche : « Fatigue élevée »** (max 5) | mar : **Prêt** partout |
| 3. Journée fatiguée, pas de réponse ensuite | lun fatigue 5 · rien jusqu'à vendredi | **Vigilance jusqu'au dimanche** (moyenne = 5) | Vigilance jusqu'au dimanche | lun + mar : Vigilance ; **mer → ven : Prêt** (une seule réponse, ancienne) |
| 4. Deux mauvaises nuits d'affilée | lun sommeil 1 · mar sommeil 2 · rien mer | mer : Vigilance (moyenne 1,5) | mer : Vigilance (moyenne 1,5) | mer : **Vigilance « sommeil dégradé »** (2 réponses défavorables) — jusqu'à une bonne réponse |
| 5. Fatigue 2 fois dans la semaine, bien aujourd'hui | lun 4 · mer 4 · jeu 2 | jeu : moyenne 3,3 → Prêt | jeu : « Fatigue élevée » (max 4) | jeu : **Prêt** (réponse du jour) ; info coach : « fatigue 4/5 lundi et mercredi » (sans alerte) |
| 6. Douleur passée | lun douleur 3 · mar douleur 1 | mar : Prêt | mar : Prêt | **inchangé** : Prêt |
| 7. Vieille réponse seule | une seule réponse il y a 6 j, fatigue 4 | Vigilance | Vigilance | **Prêt** (pas de réponse récente, 1 seule défavorable) |
| 8. **Ton cas réel** | 05/11 et 06/11 : sommeil 4, fatigue 1, douleur 1 | Prêt | Prêt | **Prêt** (inchangé) |

### B3. Questions pour toi
1. Cas 3 : Vigilance le jour même **et le lendemain** si pas de nouvelle réponse — ou seulement le jour même ?
2. Cas 4 : avec 2 mauvaises nuits, Vigilance tant qu'aucune bonne réponse n'arrive — d'accord ?
3. Cas 5 : le coach doit-il voir l'info « fatigue 4/5 lundi et mercredi » (sans alerte) ?
