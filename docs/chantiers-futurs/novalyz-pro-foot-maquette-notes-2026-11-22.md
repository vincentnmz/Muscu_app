# Novalyz Pro (foot, 4 rôles) — notes de maquette et décisions porteur · 22/11/2026

> **But : ne rien oublier** entre la maquette et le code. Maquettes : `mockups/multisport-foot-4-roles.html` (espaces métier)
> et `mockups/novalyz-pro-connexion.html` (connexion, 3 pistes) ; captures `mockups/multisport-foot-ecrans/`.
> Contexte, rôles, droits : Claude Doc « Novalyz multisport — rôles, objets communs et droits (foot) » ; architecture : `novalyz-pro-performance-data-2026-11.md`.
> **⏸ EN PAUSE (décision porteur 22/11) : on reprendra plus tard**, rien à coder d'ici là.
> Ordre fixé par le porteur : tableau validé → maquettes → **code rôle par rôle**, rien codé avant validation.

## Décidé
1. **Novalyz Pro** = entrée séparée (nouvelle connexion, nouvelle interface, design à choisir parmi les pistes A/B/C) ; **même serveur, même moteur** que la muscu.
2. **Connexion** : chacun se connecte avec ses identifiants et **atterrit directement dans son espace métier** (entraîneur, prépa physique, analyste vidéo, joueur). Les onglets de rôle de la maquette = démo uniquement. Comptes créés par **invitation du club** (code) ; création de l'espace club ; joueur mineur → autorisation parentale.
3. **Écrans par rôle** validés (voir Claude Doc, section « Écrans par rôle ») + **fiche joueur commune** vue selon la matrice des droits (analyste = disponibilité seulement, pas le bien-être ; entraîneur = pas le détail médical).
4. **Partage** de compos, documents, vidéos, photos → rôle / joueur / groupe / équipe ; arrive dans le fil de messages concerné + espace « Partages ».
   Limite technique : photos / PDF / compos OK (stockage Supabase) ; **vidéo lourde** → clips courts avec taille max **ou** liens externes (à trancher au moment de l'analyste).
5. **Tout modifiable et configurable** dans chaque onglet du staff : créer / modifier / supprimer (exercices, séances, tests, consignes, marqueurs, événements), ✎ par bloc, ⚙ Configurer par écran.
   Règle des droits (proposée, à confirmer) : **chacun modifie ce dont il est responsable** (entraîneur : compo, séances terrain, convocations ; prépa : statuts physiques, tests, programmation ; analyste : stats, clips) ; les autres voient / commentent / partagent ; le joueur ne modifie que ses saisies (questionnaire, RPE, présence).
6. **Composition** : joueurs déplaçables, choix du schéma, remplaçants échangeables, consignes.
7. **Calendrier commun du staff** : créer en cliquant un jour, modifier en cliquant un événement ; **couleur par rôle par défaut + choix libre de la couleur** à la création.
8. **Effectif avec photos des joueurs** (cartes avec photo, n° de maillot, poste, statut ; vue liste). Photo = photo de profil (l'upload existe déjà côté muscu) ; silhouette + initiales tant qu'il n'y en a pas.
9. **Codage vidéo : import seulement** (fichier du logiciel de codage → grille de marqueurs modifiable). Coder dans Novalyz / caméra connectée = **plus tard, à étudier** (étape possible sans caméra : boutons horodatés pendant le match, recalés sur la vidéo à l'import).

## À faire / à ne pas oublier
- [ ] **Créateur de graphiques** pour l'analyste ET le prépa (et l'entraîneur) : choisir les données (stats de match, charge, tests, GPS…), le type de graphique, la période, les joueurs → l'**envoyer / partager** aux autres (même flux que le partage). Chiffres = ceux du moteur, jamais inventés.
- [ ] **Contenu du bouton ⚙ Configurer écran par écran** (aujourd'hui générique dans la maquette : afficher / masquer / ordonner / ajouter un bloc) → définir pour chaque écran ce qu'on peut y régler.
- [ ] Choisir la piste de design de la connexion (A nuit de match · B clair écran partagé · C data), puis l'appliquer aux 4 espaces.
- [ ] Version **téléphone du joueur**.
- [ ] Confirmer la règle des droits de modification (point 5).
- [ ] Vidéo : clips intégrés (taille max) ou liens externes.
