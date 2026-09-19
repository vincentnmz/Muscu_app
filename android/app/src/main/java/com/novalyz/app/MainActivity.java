package com.novalyz.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
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
