# Liste de contrôle — test sur téléphone (06/11/2026)

À faire avec l'**APK dev** (lien : https://github.com/vincentnmz/Muscu_app/releases/download/novalyz-apk-dev/app-debug.apk) après avoir redéployé `index.ts`.
Ce que les tests automatiques ne voient pas : vrai téléphone, vraie connexion, montre, notifications, clavier, gestes.

## Avant de commencer
- [ ] `index.ts` redéployé sur Supabase (dernière version : correction de la pause).
- [ ] APK dev installée par-dessus l'ancienne (pas besoin de désinstaller).

## Compte athlète (Vincent)
1. [ ] Connexion sans « session expirée ».
2. [ ] **Aujourd'hui** : état « Prêt », plan de la semaine 1/3, régularité 3/4.
3. [ ] **Entraînement ▸ Élévation latérale** (séance pec épaule 2, ou séance libre) : cibles **5 kg × 16 · 7,5 × 10 · 7,5 × 10**, message « Bloqué depuis 3 séances : pas de +1 rep forcé… » + levier.
4. [ ] Un exercice non bloqué (ex. Arrière épaule) : le +1 rep est toujours proposé.
5. [ ] **Analyses ▸ Résumé** : bloqué élévation latérale avec pourquoi / levier ; « Pas dans ton programme : Mollets, Abdominaux » (plus Fessier).
6. [ ] **Analyses ▸ Évolution ▸ Élévation latérale** : « Pourquoi ça bloque » avec volume épaule **13,8** et fréquence **1,5×** (mêmes chiffres que le Résumé).
7. [ ] **Analyses ▸ Tendances ▸ Exercices en progrès** (vue Mois) : « Sur cette semaine : 11 exercices en progrès sur 17… ». Puis vue **Semaine** : une courbe par séance.
8. [ ] **Forme** : montre (pas, sommeil, FC) à jour après ouverture de l'app.
9. [ ] Faire le questionnaire bien-être du jour : le verdict suit la réponse du jour.
10. [ ] Faire défiler chaque écran : rien de coupé, pas de défilement horizontal, barre du bas toujours visible.

## Compte coach
11. [ ] Connexion coach sans « session expirée ».
12. [ ] **Équipe ▸ Vincent ▸ Aperçu** : « Piste trouvée dans ses données… » sur l'élévation latérale ; « (9 séances en 5 sem.) ».
13. [ ] **Forme** (onglet de la fiche) : Pas **≈ 5 584 / jour (7 j)**, FC « (3 j) », Nutrition « Aucun repas saisi sur les 7 derniers jours (dernière saisie le 02/10) ».
14. [ ] **Analyses** de la fiche : phrases à la 3ᵉ personne (« sa série », « il pousse déjà »).
15. [ ] **Messages** : ouvrir une conversation, revenir → retour à la liste (pas à la fiche).
16. [ ] Notification push : envoyer un message athlète → coach, la notif arrive.

## Tablette (si tu en as une, sinon navigateur en mode tablette)
17. [ ] Portrait : mêmes écrans que le téléphone, rien de coupé.
18. [ ] Paysage : **Analyses équipe ▸ Assiduité** lisible sur une ligne propre (plus « un mot par ligne »).

## À me remonter
Pour chaque point en échec : l'écran, ce que tu vois (capture), ce que tu attendais.
