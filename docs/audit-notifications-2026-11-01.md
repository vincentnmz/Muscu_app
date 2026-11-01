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
