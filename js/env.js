/* =============================================================================
 * Novalyz — environnement : PROD ou PRÉPROD (09/11/2026)
 * Chargé AVANT tous les autres scripts (index.html).
 *
 * Règle (par défaut = PROD, toujours) :
 *   - site web servi sous un chemin « /dev/ » (app.novalyz.fr/dev/,
 *     vincentnmz.github.io/Muscu_app/dev/)          → PRÉPROD
 *   - APK « Novalyz Dev » : le workflow build-apk-dev.yml remplace le marqueur
 *     __NVZ_ENV__ ci-dessous par « preprod »         → PRÉPROD
 *   - tout le reste (site principal, app Play Store, AAB) → PROD
 * La préprod = projet Supabase séparé (données de DÉMO uniquement) : un test
 * en préprod ne peut plus toucher aux vraies données.
 *
 * Web : /dev/ et le site principal partagent le même stockage du navigateur
 * (même domaine). En préprod, les clés localStorage sont donc préfixées
 * (« nvzpp: ») pour ne jamais mélanger session, file hors-ligne et caches
 * avec ceux de la prod.
 * ========================================================================== */
(function () {
  var PROD = 'https://jhbrvgguybynzeceeceu.supabase.co/functions/v1/smooth-service';
  var PREPROD = 'https://vqxkeqjaqkkmtzxvqvhi.supabase.co/functions/v1/smooth-service';
  var FORCE = '__NVZ_ENV__';   // remplacé par « preprod » uniquement dans le build APK Dev
  var chemin = '';
  try { chemin = String((window.location && window.location.pathname) || ''); } catch (e) {}
  var pre = FORCE === 'preprod' || /\/dev\//.test(chemin);

  window.NVZ_ENV = pre ? 'preprod' : 'prod';
  window.NVZ_SCRIPT_URL = pre ? PREPROD : PROD;
  if (!pre) return;

  // Préfixe des clés localStorage en préprod (sessionStorage non concerné).
  try {
    var LS = window.localStorage, P = 'nvzpp:', S = window.Storage && window.Storage.prototype;
    if (LS && S && !S.__nvzPrefixe) {
      var g = S.getItem, s = S.setItem, r = S.removeItem;
      S.getItem = function (k) { return g.call(this, this === LS ? P + k : k); };
      S.setItem = function (k, v) { return s.call(this, this === LS ? P + k : k, v); };
      S.removeItem = function (k) { return r.call(this, this === LS ? P + k : k); };
      S.__nvzPrefixe = true;
    }
  } catch (e) {}

  // Repère visuel discret : on sait toujours qu'on est en préprod.
  function bandeau() {
    try {
      if (!document.body || document.getElementById('nvz-env-badge')) return;
      var b = document.createElement('div');
      b.id = 'nvz-env-badge';
      b.textContent = 'PRÉPROD';
      b.setAttribute('aria-hidden', 'true');
      b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483000;pointer-events:none;'
        + 'background:#E8792B;color:#fff;font:700 10px/1 system-ui,sans-serif;letter-spacing:.08em;'
        + 'padding:4px 7px;border-radius:6px;opacity:.85;box-shadow:0 1px 4px rgba(0,0,0,.25)';
      document.body.appendChild(b);
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bandeau);
  else bandeau();
})();
