/* Novalyz — façade d'orientation des notifications (Étape 2, Phase Adoption).
 *
 * RÔLE : dire QUEL canal de notification utiliser selon la plateforme, pour
 * préparer le futur aiguillage sans dupliquer la logique métier :
 *
 *                 notification
 *                      │
 *              ┌───────┴────────┐
 *             WEB             NATIVE
 *              │                │
 *          Web Push            FCM
 *          (VAPID + SW)     (Capacitor Push)
 *              │                │
 *              └───────┬────────┘
 *                   Backend Supabase
 *                 (push_subscriptions)
 *
 * ⚠️ Cette façade N'IMPLÉMENTE PAS FCM (voir Étape 3). Elle ne remplace pas le
 * flux Web Push existant : sur le web, l'implémentation reste EXACTEMENT
 * `activerNotifications()` / `desactiverNotifications()` de js/app.js
 * (Notification.requestPermission → pushManager.subscribe → savePushSub).
 * Ici on ne fait qu'orienter ; le câblage runtime viendra à l'Étape 3.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CONTRAT DE DONNÉES FUTUR (Étape 3 — DOCUMENTATION SEULEMENT, aucune migration
 * dans cette étape) :
 *
 *   Aujourd'hui, table `push_subscriptions` (Web Push) :
 *     { athlete_id, endpoint, p256dh, auth, user_agent, created_at }
 *
 *   Le natif ajoutera un token d'un autre type (jeton FCM opaque, pas de
 *   endpoint/p256dh/auth). Deux options non tranchées, à décider à l'Étape 3 :
 *     A) colonne discriminante `canal` ('web' | 'native') + `native_token`
 *        (nullable) dans la MÊME table ;
 *     B) table dédiée `native_push_tokens { athlete_id, fcm_token, platform,
 *        created_at }`, l'envoi backend choisissant la source selon le canal.
 *
 *   Invariant conservé dans les deux cas : l'utilisateur reste identifié par
 *   `athlete_id`, et l'envoi métier (« quoi/quand notifier ») ne change pas —
 *   seul le TRANSPORT diffère (Web Push VAPID vs FCM).
 * ─────────────────────────────────────────────────────────────────────────
 */
(function (global) {
  'use strict';

  var CANAL_WEB = 'web-push';
  var CANAL_NATIVE = 'native-fcm';

  function _plateforme() {
    var p = global.NovalyzPlatform;
    return (p && typeof p.isNativeApp === 'function') ? p : null;
  }

  // Quel canal ce contexte doit-il utiliser ? 'web-push' en PWA, 'native-fcm'
  // dans l'app Capacitor. (Ne déclenche aucun abonnement, simple aiguillage.)
  function canalNotification() {
    var p = _plateforme();
    return (p && p.isNativeApp()) ? CANAL_NATIVE : CANAL_WEB;
  }

  // Point d'entrée unique préparé pour l'Étape 3. Ne réimplémente RIEN :
  //  - web    → délègue au flux existant (activerNotifications de app.js) si
  //             présent dans le global ; sinon renvoie un descripteur.
  //  - native → emplacement FCM NON IMPLÉMENTÉ (Étape 3).
  function activer() {
    if (canalNotification() === CANAL_NATIVE) {
      return { canal: CANAL_NATIVE, implemented: false, todo: 'Étape 3 — Capacitor Push + FCM' };
    }
    if (typeof global.activerNotifications === 'function') {
      global.activerNotifications();
      return { canal: CANAL_WEB, implemented: true, delegated: 'activerNotifications' };
    }
    return { canal: CANAL_WEB, implemented: true, delegated: null };
  }

  function desactiver() {
    if (canalNotification() === CANAL_NATIVE) {
      return { canal: CANAL_NATIVE, implemented: false, todo: 'Étape 3 — Capacitor Push + FCM' };
    }
    if (typeof global.desactiverNotifications === 'function') {
      global.desactiverNotifications();
      return { canal: CANAL_WEB, implemented: true, delegated: 'desactiverNotifications' };
    }
    return { canal: CANAL_WEB, implemented: true, delegated: null };
  }

  var api = {
    CANAL_WEB: CANAL_WEB,
    CANAL_NATIVE: CANAL_NATIVE,
    canalNotification: canalNotification,
    activer: activer,
    desactiver: desactiver,
  };

  global.NovalyzNotifications = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
