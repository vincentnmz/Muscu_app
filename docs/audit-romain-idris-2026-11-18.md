# Audit des lectures de Romain et d'Idris (18/11/2026)

**Méthode.** Identique à celle de Vincent (`docs/audit-vincent-2026-11-18.md`) : base de prod lue sans rien modifier, vrai `index.ts` sur la copie, vraie app dans Chromium, texte de chaque écran relevé puis recalculé. Aucune erreur JavaScript, aucun appel refusé.
Les deux athlètes sont débutants (1 an) et inscrits depuis le 10/11 : Romain a fait 3 séances, Idris 4. La plupart des lectures sont donc marquées « indicatif » ou « en apprentissage », et c'est voulu.

## Corrigé (préprod, 18/11)
1. **Faux « progrès » chez Idris.** « Développé machine Hammer : même niveau à RPE 7 au lieu de 7,5 ». Le 10/11, il a fait 4 séries (RPE 6-7-8-9) ; le 13/11, il en a fait 3 (RPE 6-7-8). Les trois premières séries sont identiques : la moyenne baissait seulement parce que la série la plus dure avait disparu. Désormais, le RPE est comparé sur le même nombre de séries. Résultat après correction : Hammer n'est plus « en progrès », et Rowing machine reste en progrès avec des chiffres justes (8,3 contre 9, au lieu de 9,3).
2. **Romain : « Tu respectes ton programme : 8/8 » à côté de « 2 exercices sous la fourchette ».** La règle ne juge que la charge et le RPE (cible 9 ± 1, donc un RPE 10 compte comme conforme). La phrase devient : « Effort conforme à ton programme : charge / RPE dans la cible (±1) sur 8/8 exercices suivis — les reps sont jugées à part (fourchette). »
3. **« +1 rep (haut de fourchette : 12) » à côté de « 18 × 12 → 18 × 12 ».** Le +1 rep s'applique aux séries qui sont sous le haut de la fourchette, pas forcément à la série affichée (la plus lourde). Nouveau texte : « +1 rep sur les séries sous 12 reps (haut de ta fourchette) ». Ce correctif vaut pour tous les athlètes.

## À trancher (données ou réglages, rien de codé)
4. **Programme d'Idris : 1 seule séance « Push » de 23 exercices** (pecs, dos, jambes, épaules, bras), alors qu'il s'entraîne 4 jours d'affilée et enregistre chaque jour sous le nom « Push ». Conséquences vérifiées :
   - l'objectif est calculé à 1 séance par semaine (« 0/1, encore 1 pour tenir ton objectif ») ;
   - la « séance du jour » liste 23 exercices ;
   - Ma semaine et la régularité ne reflètent pas sa réalité (4 séances la semaine du 09/11).

   → Proposer de découper son programme en 4 séances (Push, Pull, Jambes, Épaules-bras) : c'est une modification de sa fiche, donc à faire avec son accord.
5. **Charges sans doute mal saisies chez Idris.** Pompe 77,5 kg × 20 et Crunch 87,5 kg × 15 le 10/11. Probablement son poids de corps tapé comme charge (le crunch est à 10 kg le 12/11). Conséquences : ce sont ses deux premiers « records personnels », et ils gonflent le tonnage du 10/11 (environ 8,6 t sur 16). Aucun contrôle de vraisemblance n'existe aujourd'hui. Il faut décider s'il faut lui demander de corriger, et s'il faut ajouter un garde-fou sur les exercices au poids du corps.
6. **Romain met RPE 10 (échec) sur presque toutes ses séries**, alors que sa cible est 9. C'est cohérent avec ce qu'il note, mais ça vaut un mot de son coach ou un message pédagogique sur le RPE.
7. **Durées de séance de Romain : 5 min et 3 min** (10 et 15/11) dans le bilan. Ces valeurs sont visiblement fausses et faussent la charge interne (RPE × durée) le jour où le modèle passera sur cette mesure.

## Mineurs
- « Ta normale arrive après 7 saisies (2 pour l'instant) » : ce sont les saisies *plus anciennes* que les 3 dernières qui comptent, et le texte ne le dit pas, alors que « Questionnaire 4/28 j » s'affiche ailleurs.
- Tendances ▸ Régularité « 1/12 sem. à l'objectif » alors que le compte existe depuis 2 semaines.
- Romain ▸ Ma semaine : « Aujourd'hui (mercredi) · ✓ faite » pour la séance Pull, alors qu'elle a été faite mardi (la séance prévue mercredi est bien cochée, mais le libellé prête à confusion).
- État : « Frais +56 % / +74 % — bon moment pour pousser » avec 9 jours d'historique. C'est marqué « indicatif », mais la consigne est un peu forte.

## Vérifié juste
- **Romain** : records du 17/11 (tirage horizontal 105 × 12, tirage vertical 100 × 10, extension lombaire 10 × 11), Développé couché haltère 80 × 7 et Curl barre 20 × 7 sous la fourchette, volume de la semaine (Dos 9, Biceps 7,5, Trapèze 3, Lombaires 3), 11,9 t, RPE 9,3, note de séance 5, cardio.
- **Idris** : records du 13/11 (Curl incliné 18 × 12, Curl marteau 18 × 12, Extension corde 35 × 10), cibles « +2 kg → 18 × 6 » (cohérentes avec ses catégories « lourd/moyen » 6-12), consignes RPE 10 → garder, échec 2 fois de suite → viser RPE 9.
