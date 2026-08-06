import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { animeAv1M3u8Url } from "@/lib/animeav1";
import {
  signAnimeAv1StreamToken,
  verifyAnimeAv1StreamToken,
} from "@/lib/animeav1-token";

/**
 * Página player HLS (hls.js) sobre proxy Zilla.
 * Fallback iframe; el cliente React prefiere HlsVideoPlayer directo.
 * GET /api/play/animeav1-embed?hash=...&t=...
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hash = (searchParams.get("hash") || "").trim().toLowerCase();
  const token = searchParams.get("t");

  if (!/^[a-f0-9]{32}$/.test(hash)) {
    return new NextResponse("hash inválido", { status: 400 });
  }

  let userId = "";
  const checked = verifyAnimeAv1StreamToken(token, hash);
  if (checked.ok) {
    userId = checked.userId;
  } else {
    const session = await auth();
    if (
      !session?.user?.id ||
      !hasActiveMembership({
        role: session.user.role,
        subscriptionStatus: session.user.subscriptionStatus,
        currentPeriodEnd: session.user.currentPeriodEnd,
      })
    ) {
      return new NextResponse("No autorizado", { status: 401 });
    }
    userId = session.user.id;
  }

  const t =
    token && verifyAnimeAv1StreamToken(token, hash).ok
      ? token!
      : signAnimeAv1StreamToken({ hash, userId });

  const m3u8 = animeAv1M3u8Url(
    `https://player.zilla-networks.com/m3u8/${hash}`
  );
  const streamPath = `/api/play/animeav1-hls?t=${encodeURIComponent(t)}&u=${encodeURIComponent(m3u8)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>VeoTV Player</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    video { position: absolute; inset: 0; width: 100%; height: 100%; background: #000; }
    #err { display:none; color:#fca5a5; font:14px/1.4 system-ui,sans-serif;
      position:absolute; inset:0; align-items:center; justify-content:center; padding:24px; text-align:center; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
</head>
<body>
  <video id="v" controls playsinline autoplay></video>
  <div id="err"></div>
  <script>
    (function () {
      var path = ${JSON.stringify(streamPath)};
      var src = new URL(path, window.location.origin).href;
      var video = document.getElementById("v");
      var err = document.getElementById("err");
      function fail(msg) {
        err.style.display = "flex";
        err.textContent = msg || "No se pudo reproducir el video.";
      }
      if (window.Hls && Hls.isSupported()) {
        var hls = new Hls({ enableWorker: true, xhrSetup: function (xhr) { xhr.withCredentials = true; } });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
        hls.on(Hls.Events.ERROR, function (_e, data) {
          if (data && data.fatal) fail("Error HLS (" + (data.type || "") + ")");
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.play().catch(function () {});
      } else {
        fail("Tu navegador no soporta HLS.");
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
