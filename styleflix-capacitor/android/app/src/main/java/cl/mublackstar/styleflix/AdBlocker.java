package cl.mublackstar.styleflix;

import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Bloqueo de redes de ads/trackers a nivel WebView (equivalente práctico a Brave).
 * No toca vimeus.com / TMDB / el propio VeoTV.
 */
public final class AdBlocker {
  private AdBlocker() {}

  private static final Set<String> BLOCKED_HOST_FRAGMENTS =
      new HashSet<>(
          Arrays.asList(
              // Google Ads / IMA / DoubleClick (pre-roll habitual)
              "doubleclick.net",
              "googlesyndication.com",
              "googleadservices.com",
              "googletagservices.com",
              "googletagmanager.com",
              "pagead2.googlesyndication.com",
              "adservice.google",
              "imasdk.googleapis.com",
              "fundingchoicesmessages.google.com",
              "tpc.googlesyndication.com",
              "partner.googleadservices.com",
              // Otras redes VAST / display
              "amazon-adsystem.com",
              "adsystem.amazon",
              "ads.yahoo.com",
              "advertising.com",
              "adnxs.com",
              "adsrvr.org",
              "adform.net",
              "adsafeprotected.com",
              "moatads.com",
              "scorecardresearch.com",
              "pubmatic.com",
              "rubiconproject.com",
              "openx.net",
              "criteo.com",
              "taboola.com",
              "outbrain.com",
              "exoclick.com",
              "juicyads.com",
              "popads.net",
              "propellerads.com",
              "adsterra.com",
              "mgid.com",
              "bidswitch.net",
              "smartadserver.com",
              "serve.popads.net",
              "hilltopads.com",
              "trafficjunky.net",
              "tsyndicate.com",
              "adskeeper.com",
              "yandexadexchange.net",
              // Trackers frecuentes en players
              "hotjar.com",
              "clarity.ms",
              "facebook.net/tr",
              "connect.facebook.net"));

  private static final String[] BLOCKED_PATH_HINTS =
      new String[] {
        "/ads?",
        "/ad?",
        "/vast",
        "/vmap",
        "/adsense",
        "/pagead/",
        "/pc/osd",
        "get_midroll",
        "ima3.js",
        "ima3_debug",
        "ads.js",
        "ad-manager",
        "preroll",
        "midroll"
      };

  public static boolean shouldBlock(String url) {
    if (url == null || url.isEmpty()) return false;
    String lower = url.toLowerCase(Locale.US);

    // Nunca bloquear el origen del catálogo / player host
    if (lower.contains("vimeus.com")
        || lower.contains("cloudmusic.cl")
        || lower.contains("mublackstar.cl")
        || lower.contains("themoviedb.org")
        || lower.contains("image.tmdb.org")
        || lower.contains("youtube.com")
        || lower.contains("ytimg.com")
        || lower.contains("googleapis.com/youtube")) {
      // imasdk.googleapis.com SÍ se bloquea (está en la lista); youtube APIs no
      if (lower.contains("imasdk.googleapis.com")) return true;
      return false;
    }

    try {
      Uri uri = Uri.parse(url);
      String host = uri.getHost();
      if (host != null) {
        String h = host.toLowerCase(Locale.US);
        for (String frag : BLOCKED_HOST_FRAGMENTS) {
          if (h.contains(frag) || frag.contains(h)) return true;
        }
      }
    } catch (Exception ignored) {
      // fall through to path hints
    }

    for (String hint : BLOCKED_PATH_HINTS) {
      if (lower.contains(hint)) return true;
    }
    return false;
  }

  public static WebResourceResponse emptyResponse() {
    byte[] empty = new byte[0];
    return new WebResourceResponse(
        "text/plain",
        StandardCharsets.UTF_8.name(),
        new ByteArrayInputStream(empty));
  }
}
