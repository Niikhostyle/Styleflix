import { NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "vimeos.net",
  "www.vimeos.net",
  "s13.vimeos.net",
  "goodstream.one",
  "www.goodstream.one",
  "hlswish.com",
  "www.hlswish.com",
  "voe.sx",
  "www.voe.sx",
  "jigsaw.wovza.com",
]);

const INJECT = `
<script data-styleflix-bridge="1">
(function () {
  var sent = false;
  function notify(reason) {
    if (sent) return;
    sent = true;
    try {
      parent.postMessage({ source: "styleflix", event: "ended", reason: reason || "complete" }, "*");
    } catch (e) {}
  }

  function hookJw() {
    try {
      var p = null;
      if (typeof jwplayer === "function") {
        try { p = jwplayer(); } catch (e1) {}
        try { if (!p && jwplayer("vplayer")) p = jwplayer("vplayer"); } catch (e2) {}
      }
      if (!p && window.playerInstance) p = window.playerInstance;
      if (p && typeof p.on === "function") {
        p.on("complete", function () { notify("jw-complete"); });
        p.on("playlistComplete", function () { notify("jw-playlist"); });
        return true;
      }
    } catch (e) {}
    return false;
  }

  var tries = 0;
  var hookId = setInterval(function () {
    if (hookJw() || ++tries > 80) clearInterval(hookId);
  }, 400);

  setInterval(function () {
    try {
      document.querySelectorAll("video").forEach(function (v) {
        if (!v || !isFinite(v.duration) || v.duration < 20) return;
        if (v.ended) notify("video-ended");
        else if (v.currentTime > 0 && v.currentTime >= v.duration - 1.5) notify("video-near-end");
      });
    } catch (e) {}
  }, 800);
})();
</script>
`;

function isAllowed(urlStr: string) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    if (ALLOWED_HOSTS.has(u.hostname)) return true;
    // subdominios de hosts conocidos
    return [...ALLOWED_HOSTS].some(
      (h) => u.hostname === h || u.hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

/**
 * Proxy same-origin del embed interno para poder detectar fin de reproducción.
 * GET /api/embed-frame?src=https://vimeos.net/embed-xxx.html
 */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get("src");
  if (!src || !isAllowed(src)) {
    return new NextResponse("URL no permitida", { status: 400 });
  }

  try {
    const upstream = await fetch(src, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://vimeus.com/",
      },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }

    let html = await upstream.text();
    const base = new URL(src);
    const baseHref = `${base.origin}/`;

    if (!/<base\s/i.test(html)) {
      html = html.replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${baseHref}">`
      );
    }

    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${INJECT}</body>`);
    } else {
      html += INJECT;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=120",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return new NextResponse("Error proxy", { status: 500 });
  }
}
