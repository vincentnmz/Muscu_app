# Audit coach — écran 2 : « Équipe » (03/11/2026)

Code : `renderCoachSynthese` (liste `rowsHtml`, filtres `coachEquipeSetFilter`), `computeMarqueursCoach`, bureau `renderCoachDesktop` (tableau Équipe). Données : comme l'écran 1 (Vincent, Alizé rejoués ; John, Yann simulés sur leurs vraies dates).
Captures : `mockups/audit-coach-equipe-avant.png`, `mockups/audit-coach-equipe-avant-desk.png`.

## Juste ✅ (vérifié)
- Les filtres se recoupent (1 + 0 + 3 = 4) ; la recherche filtre par nom ; vacances → carte « Vacances », hors alertes.
- Chiffres de Vincent conformes au serveur : RPE 7 j 8,4 (RPE moyen des séries), tonnage 7 j 12 t contre 20,2 t les 7 j d'avant (−41 %), 1/4 séances cette semaine, 6 semaines actives.
- « Lier un athlète » : audité le 31/10, rien de neuf.

## Constats
| # | Constat | Proposition |
|---|---|---|
| **E1** | **Accueil et Équipe ne disent pas la même chose.** Aujourd'hui : 4 athlètes à voir (Vincent pour sa gêne). Équipe : « À surveiller 0 », Vincent « Optimal », « Prêts 1 ». Les filtres viennent du statut moteur, l'accueil de la liste « à traiter ». | Filtres calculés sur la **même règle que l'accueil** : *Inactifs* = absence (ou aucune séance), *À surveiller* = autre raison de l'accueil, *Prêts* = rien à signaler. |
| **E2** | **Étiquette peu parlante** : John « ACTION », Alizé « SURVEILLANCE » — sans dire pourquoi ; 6 libellés différents (Action, Surveillance, Optimal, À programmer, À relancer, Inactif). | L'étiquette dit **la raison**, comme l'accueil : « 47 j sans séance » (rouge), « 27 j sans muscu » (orange), « Gêne légère », « Pas de programme » ; sinon « Prêt » (même mot que chez l'athlète) ou « Vigilance » si le moteur la signale. |
| **E3** | **4ᵉ chiffre qui change de sens** : « Progr. » pour l'un, « Sem. actives » (en orange, alors que c'est positif) pour un autre. « Progr. » compare 7 j contre 7 j, ancien calcul, alors que le plan v3 existe. | 4ᵉ chiffre fixe = **Plan x/n** (plan de la semaine, même calcul que l'accueil et l'athlète). Semaines actives retirées de la carte (restent dans la fiche). |
| **E4** | **Tonnage « 12t ▼ »** sans le % : la baisse vient surtout de 3 séances sur 7 j contre 4 avant. **RPE « 8.4 »** avec un point. **Régul. « 0/0 »** pour Yann (pas de programme). | « 12 t · −41 % », « 8,4 », « — » quand il n'y a pas de programme. |
| **E5** | **Bureau** : pas de filtres (recherche seule) ; « Dernière séance » = muscu seule (Alizé « il y a 27 j » alors que cardio il y a 9 j) ; pas de colonne Plan. | Mêmes filtres que le mobile ; colonne « Dernière activité » (« 27 j · cardio 9 j ») ; colonne « Plan x/n » ; même étiquette (E2). |
| **E6** | Carrés : initiales (mobile et bureau) via du code séparé. | Même carré que l'accueil (`_coachAv`) → la photo apparaîtra partout d'un coup quand elle existera. |
| **E7** | Bouton : « Lier un athlète » (mobile) / « + Inviter » (bureau). | Un seul mot : « + Lier un athlète » sur les deux. |

## Décisions porteur (03/11)
Validé : tout (E1-E7). Maquette : `mockups/coach-equipe-v2.html` (+ `-mobile.png`, `-desk.png`).
Précision : « Pas de programme » (aucune séance et aucun programme) remplace aussi « Aucune séance » sur l'accueil, pour garder le même mot partout.
Lier un athlète : audité le 30/10 (`docs/audit-lier-athlete-2026-10-30.md`, 6 défauts corrigés, 16 tests) ; seul le libellé change (E7).

## Réalisé (03/11)
- **E1/E2** Une seule règle (`_coachPrio`) pour l'accueil, la liste Équipe et le tableau bureau : filtres *Inactifs* (absence, pas de programme), *À surveiller* (gêne, alerte, intervention), *Prêts* ; l'étiquette dit la raison (« 47 j sans séance », « 27 j sans muscu », « Pas de programme », « Gêne légère · 02/11 »), sinon « Prêt ». Cas rare : moteur encore en vigilance alors que le coach a traité l'alerte → « Vigilance », filtre À surveiller (l'accueil ne le liste pas, comme avant).
- **E3** 4ᵉ chiffre = Plan x/n (même plan que l'accueil et l'athlète).
- **E4** « 8,4 », « 12 t · −41 % », « — » sans programme.
- **E5** Bureau : filtres, « Dernière activité » avec le cardio, colonne Plan, mêmes étiquettes.
- **E6** Carrés communs (`_coachAv`) mobile + bureau. **E7** « + Lier un athlète » partout (bouton visible dans Équipe mobile ; bureau ; texte d'aide mis à jour).
- Accueil : « Aucune séance » devient « Pas de programme » quand l'athlète n'a ni séance ni programme.
- Tests : `coach-accueil` (12 cas) ; 77 suites vertes. Captures relues : `mockups/coach-equipe-apres.png`, `mockups/coach-equipe-apres-desk.png` ; filtres bureau testés (À surveiller = Vincent ; Inactifs = John, Alizé, Yann).
