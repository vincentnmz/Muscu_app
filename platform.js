/* Novalyz — couche d'abstraction de plateforme (Étape 2, Phase Adoption).
 *
 * BUT : permettre au reste de l'app de savoir s'il tourne en PWA web ou dans
 * l'enveloppe native Capacitor, SANS connaître Capacitor directement et SANS
 * dépendre d'un bundler (l'app se charge en <script> classique).
 *
 * Détection : le runtime natif Capacitor injecte un global `window.Capacitor`
 * exposant `isNativePlatform()`. En PWA web, ce global est absent → web.
 *
 * Ce module N'IMPLÉMENTE aucune fonctionnalité native. Il ne fait que répondre
 * « web ou natif ? ». Il est volontairement minimal (pas de grosse archi).
 *
 * Usage (à venir, Étape 3) :
 *   if (NovalyzPlatform.isNativeApp()) { …FCM… } else { …Web Push… }
 */
(function (global) {
  'use strict';

  function _cap() {
    try { return global.Capacitor; } catch (e) { return undefined; }
  }

  // true uniquement dans l'app Capacitor (Android/iOS), false en PWA web.
  function isNativeApp() {
    var c = _cap();
    if (!c) return false;
    try {
      if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
      // Repli défensif si une variante n'expose que getPlatform().
      if (typeof c.getPlatform === 'function') return c.getPlatform() !== 'web';
    } catch (e) {}
    return false;
  }

  function isWebApp() { return !isNativeApp(); }

  // 'web' | 'android' | 'ios' (retombe sur 'web' hors Capacitor).
  function getPlatform() {
    var c = _cap();
    if (c) {
      try { if (typeof c.getPlatform === 'function') return c.getPlatform(); } catch (e) {}
    }
    return 'web';
  }

  var api = { isNativeApp: isNativeApp, isWebApp: isWebApp, getPlatform: getPlatform };

  // Expose en global navigateur…
  global.NovalyzPlatform = api;
  // …et en CommonJS si chargé par les tests Node.
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
