package com.novalyz.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.EdgeToEdge;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Play Console (15/11/2026) : à partir d'Android 15 (SDK 35+, on cible 36) l'affichage est « de bord à bord »
    // par défaut. On l'active aussi sur les versions antérieures (rétrocompatibilité recommandée par Google) ;
    // les encarts (barre d'état / navigation / encoche) sont gérés par SystemBars de Capacitor 8, qui décale la
    // vue web de leur hauteur (la page n'utilise pas viewport-fit=cover) → aucun contenu sous les barres système.
    EdgeToEdge.enable(this);
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
