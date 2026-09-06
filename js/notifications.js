/* Novalyz — façade d'aiguillage des notifications (Étapes 2-3, Phase Adoption).
 *
 * RÔLE : router les notifications selon la plateforme, SANS dupliquer la
 * logique métier ni casser le Web Push existant :
 *
 *                 NovalyzNotifications
 *                        │
 *              ┌─────────┴──────────┐
 *             WEB                 ANDROID
 *              │                    │
 *          Web Push               FCM
 *      (VAPID + Service        (Capacitor Push
 *       Worker, INCHANGÉ)       Notifications)
 *              │                    │
 *              └─────────┬──────────┘
 *                    Backend Supabase
 *
 * ─── WEB ─────────────────────────────────────────────────────────────────
 * Le canal web délègue EXACTEMENT au flux existant de js/app.js
 * (`activerNotifications` : Notification.requestPermission → pushManager
 * .subscribe → action 'savePushSub'). Rien n'est réimplémenté ni modifié.
 *
 * ─── ANDROID (FCM) ───────────────────────────────────────────────────────
 * Le canal natif utilise le plugin officiel @capacitor/push-notifications,
 * accédé via le global `window.Capacitor.Plugins.PushNotifications` (l'app se
 * charge en <script> classique, sans bundler). Flux :
 *   checkPermissions → requestPermissions (Android 13+ POST_NOTIFICATIONS)
 *   → register() → événement 'registration' (token FCM) → POST backend.
 * Le token FCM est une chaîne OPAQUE : il ne transite JAMAIS par web-push et
 * n'est jamais affiché. Aucune credential Firebase n'est présente ici.
 *
 * ─── CONTRAT DE DONNÉES ──────────────────────────────────────────────────
 * Web  : table `push_subscriptions { athlete_id, endpoint, p256dh, auth }`.
 * Natif: token FCM opaque (pas d'endpoint/p256dh/auth) → stockage SÉPARÉ côté
 *        backend (route 'saveNativePushToken'), pour ne pas contaminer la
 *        boucle d'envoi web-push. L'utilisateur reste identifié par
 *        `athlete_id` ; seul le TRANSPORT diffère. Voir le rapport Étape 3
 *        pour le schéma backend proposé (non encore appliqué).
 */
(function (global) {
  'use strict';

  var CANAL_WEB = 'web-push';
  var CANAL_NATIVE = 'native-fcm';

  // Noms d'actions backend (le natif est préparé côté client ; la route backend
  // correspondante est proposée dans le rapport Étape 3, pas encore déployée).
  var ACTION_SAVE_NATIF = 'saveNativePushToken';
  var ACTION_DELETE_NATIF = 'deleteNativePushToken';

  // État natif (module) : garde-fous contre les doubles enregistrements.
  var _natif = { listeners: false, dernierTokenEnvoye: null, derniereErreur: null };

  function _platform() {
    var p = global.NovalyzPlatform;
    return (p && typeof p.isNativeApp === 'function') ? p : null;
  }
  function _estNatif() { var p = _platform(); return !!(p && p.isNativeApp()); }
  function _nomPlateforme() { var p = _platform(); return p ? p.getPlatform() : 'web'; }

  function _pluginPush() {
    try {
      var c = global.Capacitor;
      return (c && c.Plugins && c.Plugins.PushNotifications) || null;
    } catch (e) { return null; }
  }

  function _athleteIdCourant() {
    try { return (global.athlete && global.athlete.athlete_id) || null; } catch (e) { return null; }
  }

  // Quel canal ce contexte doit-il utiliser ?
  function canalNotification() {
    return _estNatif() ? CANAL_NATIVE : CANAL_WEB;
  }

  /* ── Transport du token FCM vers le backend (stockage séparé) ──────────── */
  async function _envoyerTokenBackend(token, opts) {
    if (!token) return { ok: false, raison: 'token-vide' };
    // Dédoublonnage : 'registration' peut refirer avec le même token → 1 envoi.
    if (token === _natif.dernierTokenEnvoye) return { ok: true, raison: 'token-inchange' };
    var athleteId = (opts && opts.athleteId != null) ? opts.athleteId : _athleteIdCourant();
    var scriptUrl = (opts && opts.scriptUrl) || global.SCRIPT_URL;
    var f = (opts && opts.fetchImpl) || global.fetch;
    if (!athleteId) return { ok: false, raison: 'non-connecte' };
    if (!scriptUrl || !f) return { ok: false, raison: 'backend-indisponible' };
    try {
      await f(scriptUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: ACTION_SAVE_NATIF, athlete_id: athleteId, token: token, platform: _nomPlateforme() }),
      });
      _natif.dernierTokenEnvoye = token;
      return { ok: true, raison: 'envoye' };
    } catch (e) { return { ok: false, raison: 'erreur-reseau' }; }
  }

  // Installe les écouteurs FCM UNE SEULE FOIS (évite les doubles inscriptions).
  function _installerListeners(P, opts) {
    if (_natif.listeners) return;
    _natif.listeners = true;
    try {
      // 'registration' porte le token, et refire au CHANGEMENT de token.
      P.addListener('registration', function (t) { _envoyerTokenBackend(t && t.value, opts); });
      P.addListener('registrationError', function (e) { _natif.derniereErreur = e; });
    } catch (e) { _natif.listeners = false; }
  }

  async function _activerNatif(opts) {
    opts = opts || {};
    var P = opts.plugin || _pluginPush();
    if (!P) return { canal: CANAL_NATIVE, ok: false, raison: 'plugin-indisponible' };
    var athleteId = (opts.athleteId != null) ? opts.athleteId : _athleteIdCourant();
    if (!athleteId) return { canal: CANAL_NATIVE, ok: false, raison: 'non-connecte' };

    // Permission (Android 13+ : POST_NOTIFICATIONS).
    var etat;
    try {
      var perm = await P.checkPermissions();
      etat = perm && perm.receive;
    } catch (e) { return { canal: CANAL_NATIVE, ok: false, raison: 'permission-indisponible' }; }

    if (etat === 'prompt' || etat === 'prompt-with-rationale') {
      try { var r = await P.requestPermissions(); etat = r && r.receive; }
      catch (e) { return { canal: CANAL_NATIVE, ok: false, raison: 'permission-erreur' }; }
    }
    if (etat !== 'granted') return { canal: CANAL_NATIVE, ok: false, raison: 'permission-refusee', etat: etat };

    // Écouteurs (idempotent) PUIS enregistrement auprès du service push.
    _installerListeners(P, opts);
    try { await P.register(); }
    catch (e) { return { canal: CANAL_NATIVE, ok: false, raison: 'registration-erreur' }; }

    return { canal: CANAL_NATIVE, ok: true, raison: 'enregistrement-demande' };
  }

  async function _desactiverNatif(opts) {
    opts = opts || {};
    var token = _natif.dernierTokenEnvoye;
    var athleteId = (opts.athleteId != null) ? opts.athleteId : _athleteIdCourant();
    var scriptUrl = opts.scriptUrl || global.SCRIPT_URL;
    var f = opts.fetchImpl || global.fetch;
    var envoye = false;
    if (token && athleteId && scriptUrl && f) {
      try {
        await f(scriptUrl, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: ACTION_DELETE_NATIF, athlete_id: athleteId, token: token }),
        });
        envoye = true;
      } catch (e) {}
    }
    _natif.dernierTokenEnvoye = null;
    return { canal: CANAL_NATIVE, ok: true, desassocie: envoye };
  }

  /* ── API publique ──────────────────────────────────────────────────────
   * activer()/desactiver() renvoient une Promise sur les deux canaux (contrat
   * homogène). Le canal web DÉLÈGUE au flux existant sans le modifier. */
  async function activer(opts) {
    if (canalNotification() === CANAL_NATIVE) return _activerNatif(opts);
    if (typeof global.activerNotifications === 'function') {
      global.activerNotifications();
      return { canal: CANAL_WEB, ok: true, delegated: 'activerNotifications' };
    }
    return { canal: CANAL_WEB, ok: true, delegated: null };
  }

  async function desactiver(opts) {
    if (canalNotification() === CANAL_NATIVE) return _desactiverNatif(opts);
    if (typeof global.desactiverNotifications === 'function') {
      global.desactiverNotifications();
      return { canal: CANAL_WEB, ok: true, delegated: 'desactiverNotifications' };
    }
    return { canal: CANAL_WEB, ok: true, delegated: null };
  }

  // Réinitialise l'état natif (utile pour les tests et une future déconnexion).
  function _reset() { _natif = { listeners: false, dernierTokenEnvoye: null, derniereErreur: null }; }

  var api = {
    CANAL_WEB: CANAL_WEB,
    CANAL_NATIVE: CANAL_NATIVE,
    canalNotification: canalNotification,
    activer: activer,
    desactiver: desactiver,
    _reset: _reset,
  };

  global.NovalyzNotifications = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
