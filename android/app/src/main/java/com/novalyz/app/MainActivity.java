package com.novalyz.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // 15/11/2026 : EdgeToEdge.enable() RETIRÉ (version 23). Appelé avant super.onCreate(), il figeait la fenêtre
    // avec le thème de lancement (AppTheme.NoActionBarLaunch) avant que BridgeActivity ne passe au thème sans barre
    // → barre de titre Android « Novalyz » + image de splash écrasée en haut de l'app. Les encarts système restent
    // gérés par SystemBars de Capacitor 8 (comme en version 21). Ne pas le réintroduire avant super.onCreate().
    super.onCreate(savedInstanceState);
    // Les fichiers web (index.html/app.js/css) sont EMBARQUÉS dans l'APK et servis
    // en local. On désactive le cache HTTP de la WebView pour qu'après une mise à
    // jour de l'APK, la WebView relise toujours les fichiers à jour du bundle et ne
    // ressorte jamais une ancienne version depuis son cache disque
    // (bug « je rouvre l'appli et l'ancienne version revient »).
    try {
      WebView webView = this.bridge.getWebView();
      if (webView != null) {
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
      }
    } catch (Exception e) {
      // Sans blocage : au pire on garde le comportement par défaut.
    }
  }
}
