package cl.mublackstar.styleflix;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * StyleFlix Capacitor + bloqueo de ads + foco D-pad para Android TV.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (this.bridge == null || this.bridge.getWebView() == null) return;

    WebView webView = this.bridge.getWebView();
    webView.setFocusable(true);
    webView.setFocusableInTouchMode(true);
    webView.requestFocus();

    WebSettings settings = webView.getSettings();
    String ua = settings.getUserAgentString();
    if (ua != null && !ua.contains("StyleFlixTV")) {
      settings.setUserAgentString(ua + " StyleFlixTV/1.0");
    }

    BridgeWebViewClient client =
        new BridgeWebViewClient(this.bridge) {
          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            String url = request.getUrl() != null ? request.getUrl().toString() : "";
            if (AdBlocker.shouldBlock(url)) {
              return AdBlocker.emptyResponse();
            }
            return super.shouldInterceptRequest(view, request);
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl() != null ? request.getUrl().toString() : "";
            if (AdBlocker.shouldBlock(url)) {
              return true;
            }
            return super.shouldOverrideUrlLoading(view, request);
          }
        };

    webView.setWebViewClient(client);
  }

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (this.bridge != null && this.bridge.getWebView() != null) {
      WebView webView = this.bridge.getWebView();
      if (!webView.hasFocus()) {
        webView.requestFocus();
      }
      if (webView.dispatchKeyEvent(event)) {
        return true;
      }
    }
    return super.dispatchKeyEvent(event);
  }
}
