# Audit — Notifications (01/11/2026)

Méthode : code (backend `handleCronPushAlertes`, `notifyAthlete` / `notifyCoach`, FCM, Web Push ; front `js/notifications.js`, `_promptNotifNatif*`, `NovalyzOnNotifEvent`, `sw.js`) + **base réelle** : jetons enregistrés, tâches planifiées (`cron.job`), historique des notifications envoyées (`indicateurs` `alerte_push` / `alerte_push_coach`) et des alertes « lues ».
Légende : ✅ vérifié · ❌ défaut (vérifié contre code + données) · 🟠 à décider · 🔍 à vérifier sur téléphone.

## Juste ✅
- Tâches planifiées actives : alertes chaque jour à 07:00 UTC (8 h en hiver, 9 h en été), récap e-mail à 07:10 UTC.
- Notifications envoyées : absence prolongée (John, Alizé), volume trop bas (toi, 21/10). Une seule par jour et par athlète (la plus grave).
- Absence : rappel à J7 puis tous les 3 jours — appliqué depuis ~27/10 (John : 27/10 → 30/10). Avant, c'était chaque jour (John 12 → 23/10, Alizé 19 → 26/10).
- « Marquer comme lue » coupe les rappels de cette alerte jusqu'au lundi (Alizé a lu l'alerte le 26/10 → plus de rappel cette semaine-là).
- Jetons morts purgés automatiquement (FCM « UNREGISTERED », Web Push 404/410).
- Notifiés à l'athlète : message du coach, séance saisie par le coach, demande de suivi. Notifié au coach : suivi accepté.
- Toucher la notif : « message » → ouvre la conversation, « alerte » → Aujourd'hui.

## Défauts

| # | Constat (base réelle) | Correctif proposé |
|---|---|---|
| **N1** ❌ | **Le coach ne reçoit aucune notification** : aucun appareil n'est enregistré en coach (0 jeton `coach:1`). Le cron écrit pourtant « notif coach envoyée » chaque jour (compteur faux). Causes : un téléphone n'a qu'un jeton, qui appartient au **dernier rôle** (ton téléphone = athlète 1) ; et l'app ne renvoie pas le jeton si seul le rôle change dans la même session. | 🟠 (a) **Recommandé** : un même téléphone peut recevoir **les deux rôles** (jeton enregistré pour l'athlète ET le coach — petit changement de table) ; (b) garder « dernier rôle » mais corriger le renvoi du jeton. Dans les deux cas : ne compter « envoyée » que si au moins un appareil l'a reçue. |
| **N2** ❌ | Un **message de l'athlète au coach** ne déclenche **aucune** notification (seul le sens coach → athlète existe). | Notifier le coach (« 💬 Prénom : aperçu »). |
| **N3** 🟠 | Absence : rappel tous les 3 jours **sans fin**. John, sans séance depuis le 17/09 : 14 notifications (+ autant pour le coach). | J7, J10, J14, puis 1 par semaine, arrêt après 4 semaines (l'alerte reste visible dans l'app). |
| **N4** 🟠 | L'absence ne regarde que la **muscu** : une semaine de vélo / course / Hyrox sans muscu → « Aucune séance depuis 7 jours ». | Compter aussi les séances cardio (hors marche) comme activité. |
| **N5** ❌ | « Volume trop bas » (sous-charge) re-notifie **chaque jour** tant qu'il dure (pas de rythme 3 jours comme l'absence). | Même rythme que l'absence. |
| **N6** | Toucher une alerte **coach** n'ouvre rien de précis (cible « coach » non gérée). | Ouvrir l'écran Aujourd'hui du coach. |
| 🔍 **N7** | Notification reçue **app ouverte** (Android) : le code rafraîchit les messages mais ne montre rien ; la doc Capacitor ne dit pas clairement si Android l'affiche. | À vérifier sur ton téléphone. |
| 🔍 N8 | John n'a reçu aucun rappel les 24-26/10 alors qu'il était absent ; cause non retrouvée (journaux du serveur expirés). | Surveiller les prochains jours (rythme attendu J+3). |

## Demande d'autorisation au 1er lancement (question du porteur, 01/11)
- **Athlète, app Android** : oui, demande système une fois au 1ᵉʳ lancement connecté ; si refusée, plus redemandée, réactivable dans Réglages ▸ Notifications.
- **Coach, app Android** : demande système une fois à l'ouverture de l'espace coach ; désormais aussi un bouton **Réglages coach ▸ Préférences ▸ Notifications** (avant : aucun moyen de rattraper un refus).
- **Navigateur (web)** : pas de demande automatique (bouton dans les Réglages athlète) ; coach : notifications sur l'app Android uniquement.

## Réalisé (01/11, validé porteur : N1 a — même téléphone, N3, N4, reste OK)
- **N1** Un téléphone reçoit les notifs **athlète ET coach** : jeton enregistré par (jeton, rôle) — `supabase/native_push_tokens_v2.sql` **appliquée le 01/11** après le redéploiement (clé (token, athlete_id) vérifiée en base) ; la façade renvoie le jeton quand le rôle change ; désactiver un rôle ne coupe pas l'autre ; « envoyée » comptée seulement si un appareil l'a reçue ; carte Notifications dans les Réglages coach.
- **N2** Message athlète → notification au coach (« 💬 Prénom : aperçu », coach lu en base) ; toucher → messagerie coach.
- **N3** Absence : rappels à **J7, J10, J14, J21, J28** puis arrêt (jalons fixes : un jour de cron manqué est rattrapé le lendemain sans décaler la suite).
- **N4** Absence = ni muscu ni cardio **hors marche** depuis 7 jours (vérifié sur le vrai backend : vélo le 05/11 → pas d'absence au 09/11 ; marche → absence).
- **N5** Volume trop bas : au plus un rappel tous les 3 jours. **N6** Toucher une alerte coach → Aujourd'hui du coach.
- Tests : `notif-roles-rythme` (8 cas) ; `fcm-notifications`, `natif-push-wiring` inchangés et verts.
