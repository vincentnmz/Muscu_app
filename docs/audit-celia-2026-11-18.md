# Audit des séances d'une athlète débutante (Célia, 18/11/2026) + points restants des audits du jour

**Méthode.** La base de prod a été lue sans rien modifier : 54 séries du 10 au 18/11, 3 séances, 4 questionnaires, 18 lignes de programme, réglage « 7 derniers jours glissants ». Le vrai `index.ts` a tourné sur cette copie et la vraie app a été ouverte dans Chromium : Aujourd'hui, Entraînement, Analyses (5 onglets et 16 exercices), État. Chaque chiffre a été recalculé à part. Aucune erreur JavaScript.

## Faux (corrigé en préprod)
1. **Volume par muscle avec la semaine glissante.** L'app affichait « Quadriceps 0/9, Fessier 0/9 séries cette semaine (2/3 séances faites) ». Les séances étaient comptées sur 7 jours glissants (13 et 18/11), mais les séries depuis lundi seulement. La séance du 13/11 (presse, hip thrust, RDL) disparaissait donc. Désormais, les séries et les séances sont comptées sur la même fenêtre. Recalculé : Quadriceps 3, Fessier 6, Ischios 4,5, Pectoraux 21, Triceps 16,5. L'IA reçoit le même libellé de fenêtre.
2. **Force estimée : deux chiffres pour la même séance.** Pour l'Extension dos à la poulie corde, la tuile affichait 12 kg et le tableau 11 kg. Le tableau ne regardait que la série la plus lourde, sans tenir compte du RPE. Il prend maintenant la meilleure série du jour, comme la tuile.
3. **Date des records.** Un record égalé prenait la date de la répétition. Hip thrust machine 80 × 10 était daté du 13/11, alors qu'il avait été atteint le 10/11. Chez Vincent, la même erreur touchait Belt squat (17/11 au lieu de 05/11) et Tirage serré (13/11 au lieu de 23/10). La date retenue est maintenant la première fois. Test ajouté.
4. **« Aucune douleur ni blessure signalée »**, alors qu'une douleur au fessier à 3/5 a été notée le 13/11. L'app affiche désormais « Douleur fessier 3/5 le 13/11 · plus signalée depuis ».

## Peu clair (corrigé)
5. **« Ta normale arrive après 7 saisies (1 pour l'instant) »**, alors que Célia avait 4 questionnaires. Les 3 derniers servent à l'état « maintenant » ; la normale demande 7 autres saisies. Nouveau texte : « ta normale arrive dans 6 questionnaires (il en faut 10 sur 5 semaines, tu en as 4) ».
6. **Régularité** : les 10 semaines avant sa première séance s'affichaient en rouge (« semaine vide »). Elles sont maintenant grises, avec la légende « gris = avant ta 1re séance ».
7. **« 1 progrès sur 17 exercices faits »** : Célia a fait 16 exercices différents, dont un deux fois. Le texte précise maintenant « un exercice compte à chaque séance où tu le fais ».
8. **Format** : « Record charge 12.5 kg » devient « 12,5 kg » et « Ischio 4.5 » devient « 4,5 ».

## Vérifié juste
- Classement : Hip thrust machine en progrès (80 × 10, puis 3 séries à 10 au lieu d'une) ; Développé couché barre sous la fourchette (30 × 6 à RPE 10, proposé 25 kg × 8).
- Cibles de la prochaine séance : garder charge et reps quand toutes les séries étaient à RPE 10 (Hammer, Incliné haltère, Presse, Leg extension, Hack squat) ; +1 rep pour Barre au front et Smith incliné.
- « Effort conforme au programme 3/3 » (RPE cible 9 ±1 sur Hip thrust machine et RDL barre, rattachés à Full Body C).
- État du jour « Prêt », fraîcheur « pas encore calculable » (moins de 28 jours), poids 67 kg (une seule pesée), répartition d'intensité 4 / 83 / 13 %.

## À savoir (pas un bug de calcul)
- **RPE 10 sur presque toutes les séries** (moyenne 9,4 sur la dernière séance) : avec un an de pratique, c'est probablement une note « ça brûle » plutôt qu'un vrai échec. Le moteur lui dit à chaque fois de garder la charge. Un message sur l'échelle RPE pourrait l'aider (comme pour Romain).
- **Barre au front : 1 kg × 6** en première série (mise en route, ou faute de saisie).
- **Pectoraux 21 séries en 7 jours** pour un optimum de 12 : rien ne le signale comme excès.
- **Exercices faits ≠ programme** : Hammer au lieu du Développé couché barre, Écarté poulie au lieu d'Écarté machine, Extension poulie barre au lieu de corde. Les cibles du programme ne s'appliquent donc pas.
- **Tonnage par semaine** : la semaine en cours (une séance) apparaît comme une chute de 14,5 à 2,4 t.

## Points restants des audits du jour (corrigés)
- **Équipe coach « 20,6 t · +49 % »** : la référence est maintenant écrite (« vs 7 j d'avant (13,8 t) »), dans la liste, le tableau et la fiche.
- **Mail : levier de blocage générique.** Il est retiré, car il pouvait contredire celui de l'app. Le constat est daté du dernier jour de la période (ex. « au 15/11, fin de la période ») et renvoie à Analyses ▸ Évolution.
- **Ma semaine (Romain)** : une séance prévue mercredi et faite mardi affiche maintenant « Aujourd'hui · ✓ faite mardi ».
- **Pas** : la journée en cours de synchro (3 040 pas à 9 h 49) n'entre plus dans la moyenne. La mention « hors journée en cours de synchro » est affichée.
- **Poids** : au-delà de 30 jours, l'app affiche « dernière pesée le 15/09 (il y a 64 j) ».
