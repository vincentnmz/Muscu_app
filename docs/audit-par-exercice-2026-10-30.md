# Audit Analyses ▸ Évolution ▸ « Par exercice » — 30 oct. 2026

> Méthode : vrai `index.ts` rejoué sur la copie de tes données (au 29/10), écran rendu par le vrai front (mobile),
> exercices contrôlés : Développé incliné Smith, Leg curl allongé, Pendulum, Belt squat, Tirage vertical prise serrée.

## Défauts trouvés

| # | Gravité | Défaut | Statut |
|---|---|---|---|
| 1 | **Élevée** | **Deux conseils différents pour le même exercice.** Le bloc « Charge à viser » (calcul en % de 1RM) donnait un conseil générique : « Monte les reps vers 12. À 12 partout → +2,5 kg ». Il le donnait à **tous** les exercices, y compris le Smith à 80 × 1 RPE 10, alors qu'Aujourd'hui et l'écran de saisie proposent un petit pas en dessous (77,5 kg). | **Corrigé** : remplacé par **« Ce que Novalyz vise la prochaine fois »**, le même calcul que la saisie et Aujourd'hui (Smith : 80 × 1 → 77,5 kg × 8, indicatif). |
| 2 | **Élevée** | Smith (Mois) : « **▲ +10** » en vert et « +10 kg sur la période » alors que la série la plus lourde passe de **70 × 5 à 80 × 1** et que le 1RM estimé baisse (88 → 85 → 83). Seule la charge était comparée. | **Corrigé** : « **+10 kg · −4 reps** », en gris quand l'un monte et l'autre baisse, en vert seulement si rien ne baisse, en rouge si rien ne monte. |
| 3 | Moyenne | Le même écran disait « **1RM pas encore fiable** » (Charge à viser) et affichait « **1RM estimé 83 kg** » juste en dessous. | **Corrigé** (le bloc #1 a disparu). |
| 4 | Moyenne | Aucun **statut** de l'exercice alors que la lecture Novalyz le classe (record / en progrès / bloqué / sous la fourchette). Leg curl : « bloqué depuis 4 séances » dans la lecture, rien ici. | **Corrigé** : le statut s'affiche sous le nom de l'exercice, avec le **même classement** que la lecture (ex. « ⏸ Bloqué à 35 kg × 8 depuis 4 séances », « ★ Record : 60 kg × 8 le 27/10 »). |
| 5 | Faible | Leg curl 35 × 8 → 35 × 8 : « **▲ +0** » en vert. | **Corrigé** : « = identique », en gris. |
| 6 | Faible | Mobile : l'onglet « Volume (toutes séries) » **chevauchait** « Par série ». | **Corrigé** : retour à la ligne. |

## À décider
- **Leg curl bloqué (4 séances à 35 × 8, RPE 9)** : la reco des Analyses dit « vise +1 rep par séance », mais « Ce que Novalyz vise » dit « RPE 9 → on consolide 35 × 8 ». Le calcul de la cible ne tient pas compte du blocage. Proposition : quand un exercice est **bloqué depuis 3 séances ou plus**, la cible propose un **autre levier** au lieu de « consolider » : +1 rep, ou une série en plus, ou un petit pas en dessous pour repartir. Lequel préfères-tu ?
- Période par défaut **Semaine** : la plupart des exercices n'y ont qu'**1 point** (« — 1 séance »). Proposition : passer « Par exercice » sur **Mois** par défaut.

## Vérifié juste
- Points du graphe = série la plus lourde du jour (Smith 70×5, 80×3, 80×2, 80×1 ; Pendulum 40×8, 40×10, 60×8).
- « Dernières séances » = toutes les séries du jour, conformes à la base (Smith 29/10 : 80×1 · 70×5 · 65×6).
- 1RM estimé (Epley) : 80×1 → 83, 80×3 → 88, 200×5 → 233 kg.
- « Meilleure série » sur la période = charge max puis reps (Smith Mois : 80×3) ; « record charge » = record à vie.
