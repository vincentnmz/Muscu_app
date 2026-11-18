# Audit des vues coach et du mail récapitulatif (18/11/2026)

**Méthode.** Le compte coach 9999 et ses athlètes réels (Vincent, Alizé, Yann vide) ont été lus en prod sans rien modifier. Le vrai `index.ts` tourne sur la copie, l'espace coach est ouvert dans Chromium et le texte de chaque écran est relevé : Aujourd'hui, Équipe, Analyses, et la fiche de chaque athlète (Aperçu, Analyses, Séances, Programme, Forme). Le mail récapitulatif de Vincent est généré par le vrai code (semaine et mois). Aucune erreur JavaScript.

## Corrigé (préprod)
1. **Blessure ignorée par la vue coach.** Alizé a déclaré une blessure sévère aux hanches (14/11, en cours) et un contexte « retour de blessure » (13/11 → 08/12). Avant correction :
   - Équipe la classait « Inactive · 14 j sans muscu » ;
   - Aujourd'hui la plaçait en priorité pour « 14 j sans muscu », sans parler de la blessure ;
   - sa fiche proposait « Relancer l'athlète ».

   Désormais, la blessure en cours est la raison affichée (« Blessure : Hanches (sévère) · retour de blessure jusqu'au 08/12 »), dans le filtre « À surveiller », et la relance n'est plus proposée. Test ajouté.
2. **Journal des décisions** : une semaine couverte par une blessure ou un « retour de blessure » n'est plus jugée « Pas tenté » (même règle que les vacances).
3. **Fiche coach ▸ Forme : deux chiffres pour la même mesure.** On lisait 5 790 pas au-dessus et 5 429 dans la carte « Ma montre », et 6 h 58 de sommeil contre 7 h 20. La carte prenait 8 jours, ou les 7 dernières valeurs quelle que soit leur date. Les deux blocs utilisent maintenant les 7 derniers jours ; la FC affichée est indiquée comme « dernière » mesure.
4. **« +4 »** dans la progression de l'équipe devient « +4 autres ».
5. **Mail récapitulatif** :
   - la consigne du moment (« charge en hausse… ») apparaissait dans le bilan d'octobre et dans celui de la semaine de vacances, comme si elle venait de la période. Elle est maintenant datée « Aujourd'hui — » ;
   - la semaine de vacances est indiquée : « dont 5 jours de vacances (mode pause) ».

## Vérifié juste
- **Vincent côté coach** : identique à sa vue athlète (Prêt, 2/4 séances, 4 records + 7 en progrès + 1 bloqué), séries des 7 derniers jours (Pectoraux 15, Dos 13, Épaules 15), historique des propositions, séances avec durées.
- **Alizé** : 1 séance sur 4 en 4 semaines, douleur hanche 2/5 le 13/11, contexte retour de blessure, 2 sorties cardio sur 7 jours.
- **Mail** : régularité du mois (14 séances, 1 semaine à l'objectif sur 3 complètes), records d'octobre, volumes, équilibres musculaires, cardio.

## Reste à noter
- Équipe affiche le tonnage de Vincent à « 20,6 t · +49 % » (par rapport à la semaine précédente, qui était sa semaine de vacances), alors que l'app athlète compare à la moyenne sur 4 semaines (+24 %). La référence n'est pas écrite à côté du chiffre.
- Mail : le levier proposé pour un exercice bloqué est générique alors que l'app donne le levier tiré du diagnostic.
- Le classement de l'exercice bloqué est figé à la fin de la période dans le mail (Tirage trapèze « 50 × 7 depuis 3 séances ») et pas dans l'app aujourd'hui (« 50 × 8 depuis 4 séances »). C'est voulu, mais ce n'est pas expliqué.
