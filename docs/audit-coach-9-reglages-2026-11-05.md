# Audit coach — écran 9 : Réglages coach, notifications, IA « bientôt » (05/11/2026)

Rendu réel des 5 onglets (Mon compte · Préférences · Équipe · Données · À propos), code (`ouvrirReglagesCoach`, `activerNotifsCoach`, `handleCronPushAlertes`, `notifyCoach`, `_coachIaEtat`) et base (lecture seule : `coachs`, `native_push_tokens`, `push_subscriptions`).

## Constats (vérifiés)

| # | Où | Constat |
|---|---|---|
| R1 | Mon compte | Ton compte coach **n'a pas d'e-mail** (base) → pas de récupération de mot de passe, pas de résumé d'équipe par e-mail. L'écran le dit, mais seulement ici. |
| R2 | Notifications | **Aucun téléphone coach enregistré** en base (aucun jeton `coach:1`) → tu ne reçois aujourd'hui aucune notification coach. Le bouton n'existe que dans l'app Android ; sur ordi / PWA : rien. |
| R3 | Notifications (serveur) | Le passage quotidien ne parcourt que les athlètes **qui ont eux-mêmes activé les notifications** : un athlète sans notif ne déclenche **jamais** d'alerte chez son coach. |
| R4 | Notifications | Une alerte « haute » active **re-notifie chaque jour** (athlète et coach), une notif par athlète : avec 20 athlètes = jusqu'à 20 notifs/jour. Aucun choix des types (messages / douleur / absence / séances), pas d'heures calmes. |
| R5 | Préférences ▸ Sport | Un menu change le sport de **tout l'espace coach** (Musculation → Football…) en un appui, sans confirmation. |
| R6 | Équipe | « Nom du club / Catégorie par défaut — pré-remplira la création de nouveaux joueurs (à venir) » : sans effet aujourd'hui pour un coach muscu. |
| R7 | — | Aucun réglage **par défaut pour les nouveaux athlètes** : propositions Novalyz (au coach / aussi à l'athlète), façon de compter la semaine, objectif de séances. |
| R8 | Données | Bilan d'un client (page imprimable / e-mail) : OK. Pas d'export de l'équipe, pas d'import d'historique (prévu au backlog). |
| R9 | À propos | « Contact » = ton adresse Gmail perso en dur dans l'app. |
| R10 | Fiche ▸ IA | Carte « BIENTÔT — Posera des questions sur les données de l'athlète. Pas encore activée. » : honnête ; aucun réglage IA côté coach. |

## Propositions

- **P1** : bandeau discret sur l'accueil coach tant qu'il n'y a pas d'e-mail (« Ajoute ton e-mail : récupération du mot de passe et résumé d'équipe »), comme côté athlète.
- **P2 / P3 (serveur, à redéployer)** : les alertes coach ne dépendent plus des notifs de l'athlète — le passage quotidien parcourt aussi les athlètes des coachs qui ont activé les notifications.
- **P4** : **Notifications coach** au choix : ☑ Messages (immédiat) · ☑ Douleur ≥ 3/5 (immédiat) · ☑ Résumé du matin (1 notif : « 2 à surveiller · 1 séance en retard · 1 message ») · ☐ Chaque alerte séparément ; heures calmes (22 h – 7 h). Par défaut : messages + douleur + résumé du matin → fini le spam d'une notif par athlète et par jour.
- **P5** : le sport déplacé dans Mon compte, avec confirmation (« Ton espace passe en vocabulaire Football »).
- **P6** : Équipe → **Groupes** utiles tout de suite : créer des groupes (« Prépa marathon », « U17 »…) et y ranger ses athlètes → filtre dans Aujourd'hui / Équipe / Analyses / Message à plusieurs. (Le champ « club » reste pour plus tard.)
- **P7** : **Par défaut pour mes nouveaux athlètes** : propositions Novalyz (au coach seulement / aussi à l'athlète), semaine (lundi → dimanche / 7 j glissants).
- **P8** : Données → « Exporter mon équipe (CSV) » (séances, volume, ressentis) ; « Importer l'historique d'un client » = entrée du chantier backlog (Excel / CSV).
- **P9** : contact → adresse Novalyz dédiée (à créer) ou formulaire de retour intégré qui t'arrive par e-mail sans exposer ton adresse.
- **P10** : rien à coder pour l'IA tant qu'elle n'est pas activée ; le jour de l'activation : un interrupteur « Novalyz IA » dans Préférences + rappel « répond uniquement à partir des données de l'athlète ».
