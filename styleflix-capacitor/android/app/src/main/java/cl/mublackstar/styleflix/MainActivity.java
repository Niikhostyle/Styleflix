package cl.mublackstar.styleflix;

import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * StyleFlix móvil (Capacitor) + bloqueo de ads en WebView.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (this.bridge == null || this.bridge.getWebView() == null) return;

    WebView webView = this.bridge.getWebView();
    webView.setFocusable(true);
    webView.setFocusableInTouchMode(true);

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
      if (webView.dispatchKeyEvent(event)) {
        return true;
      }
    }
    return super.dispatchKeyEvent(event);
  }
}
