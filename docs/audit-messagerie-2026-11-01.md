# Audit — Messagerie athlète ↔ coach (01/11/2026)

Méthode : code (backend `handleSaveCommentaire`, `handleGetCommentaires`, `handleSupprimerCommentaire`, `handleMarquerCommentairesLus`, médias `handleMediaUploadUrl` / `handleEnvoyerMediaCoach` ; droits `authCheck` / `ROW_OWNED` ; front fil coach côté athlète et côté coach) + **base réelle** (`commentaires`, réglages des espaces de stockage).
Légende : ✅ vérifié · ❌ défaut · 🟠 à décider.

## Juste ✅
- Médias (photo / vidéo athlète → coach) : espace de stockage **privé**, liens de lecture signés valables 2 h, formats limités (jpg/png/webp, mp4/mov/webm) **et** limite de taille côté stockage (75 Mo), chemin vérifié (un athlète ne peut envoyer que dans son dossier), consentement obligatoire, fichier supprimé avec le message.
- Un athlète ne peut écrire qu'à **son** coach ; un coach seulement à **ses** athlètes (vérifié dans `authCheck`).
- Notifications dans les deux sens (depuis l'audit Notifications N2).
- « Lu » : chacun marque les messages de l'autre (pas les siens).

## Défauts

| # | Constat (vérifié) | Correctif proposé |
|---|---|---|
| **M1** ❌ | **Heure des messages fausse** : enregistrée en heure UTC. Base réelle : dernier message du coach affiché « 19:25 », envoyé à **21:25** heure de Paris (−2 h l'été, −1 h l'hiver). | Heure de Paris (fuseau Europe/Paris). |
| **M2** ❌ confidentialité | **Un nouveau coach lit toute la conversation avec l'ancien** : les messages sont chargés par athlète, sans filtre sur le coach. Et les messages de l'athlète sont enregistrés **sans coach** (15 sur 16 dans la base) → impossible de savoir à qui ils étaient adressés. | Chaque message porte le coach du moment (lu en base) ; chaque fil ne montre que la conversation avec **ce** coach. 🟠 Les 15 anciens messages sans coach : les rattacher au coach actuel de l'athlète (approximation). |
| **M3** ❌ sécurité | **L'auteur est déclaré par l'app** : une session athlète peut envoyer un message marqué « coach » (et inversement), avec un nom inventé — et déclencher la notification correspondante. | Auteur déduit de la **session** (athlète ou coach), noms lus en base. |
| **M4** ❌ | **Suppression** : en mode « Sélectionner », l'athlète peut cocher et supprimer **les messages du coach** ; le serveur accepte n'importe quel message de la conversation. | Chacun ne supprime **que ses propres messages** (écran + serveur). |
| **M5** ❌ | **Doublons** : aucun verrou d'envoi, le champ n'est vidé qu'après la réponse → touche Entrée maintenue = envois en rafale. Base réelle : **6 copies du même message en 56 ms** (12/09) + 2 autres paires. | Verrou d'envoi + champ vidé tout de suite ; le serveur ignore le même message du même auteur reçu dans les 5 s. 🟠 Nettoyer les doublons existants (garder 1 exemplaire). |
| **M6** | Longueur de message illimitée. | 4 000 caractères maximum. |
| **M7** | Seuls les **200 derniers** messages sont chargés (tous athlètes confondus côté requête coach) : les plus anciens disparaissent sans le dire. | Charger la conversation complète (lecture paginée, comme pour les séances). |

## Réalisé (02/11, validé porteur : tout, M2 rattachement au coach actuel, doublons supprimés)
- **Base** : 7 doublons supprimés (même auteur, même texte, < 60 s, sans média) ; 11 messages sans coach rattachés au coach actuel de l'athlète ; heure recalculée en heure de Paris sur les 26 messages. Contrôle final : 26 messages, 0 sans coach, 0 heure fausse.
- **M1** Heure enregistrée en heure de Paris (heure d'été / d'hiver gérées par le fuseau Europe/Paris), messages et médias.
- **M2** Chaque message porte le coach du moment (lu en base) ; l'athlète ne voit que la conversation avec son coach actuel, un coach ne lit que la sienne.
- **M3** Auteur déduit de la session vérifiée (athlète / coach) ; noms lus en base ; les valeurs envoyées par l'app sont ignorées.
- **M4** Suppression : seulement ses propres messages (serveur + écran — cases seulement sur ses messages, vérifié en capture).
- **M5** Verrou d'envoi + champ vidé tout de suite ; le serveur ignore le même message du même auteur reçu dans les 5 s.
- **M6** 4 000 caractères maximum (serveur). **M7** Conversation chargée en entier (lecture paginée), triée à la milliseconde.
- Tests : `messagerie` (9 cas, vrai backend). 70 suites vertes.
