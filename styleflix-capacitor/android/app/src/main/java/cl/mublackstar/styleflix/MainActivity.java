package cl.mublackstar.styleflix;

import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/**
 * StyleFlix Capacitor + bloqueo de ads en WebView (como Brave a nivel de red).
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (this.bridge == null || this.bridge.getWebView() == null) return;

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
              return true; // traga la navegación a landing de ads
            }
            return super.shouldOverrideUrlLoading(view, request);
          }
        };

    this.bridge.getWebView().setWebViewClient(client);
  }
}
