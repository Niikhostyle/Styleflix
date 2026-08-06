import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { animeAv1M3u8Url } from "@/lib/animeav1";
import {
  signAnimeAv1StreamToken,
  verifyAnimeAv1StreamToken,
} from "@/lib/animeav1-token";

/**
 * Página player estilo AnimeAV1: JWPlayer 8.30 + hlsjs sobre nuestro proxy Zilla.
 * Se usa en <iframe> igual que https://player.zilla-networks.com/play/{hash}
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

  const origin = new URL(request.url).origin;
  const m3u8 = animeAv1M3u8Url(
    `https://player.zilla-networks.com/m3u8/${hash}`
  );
  const streamUrl = `${origin}/api/play/animeav1-hls?t=${encodeURIComponent(t)}&u=${encodeURIComponent(m3u8)}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>VeoTV Player</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    #player { position: absolute; inset: 0; }
  </style>
  <script src="https://ssl.p.jwpcdn.com/player/v/8.30.0/jwplayer.js"></script>
</head>
<body>
  <div id="player"></div>
  <script>
    jwplayer.key = "uoW6qHjBL3KNudxKVnwa3rt5LlTakbko9e6aQ6VUyKQ=";
    jwplayer("player").setup({
      file: ${JSON.stringify(streamUrl)},
      width: "100%",
      height: "100%",
      autostart: true,
      mute: false,
      primary: "html5",
      hlshtml: true
    });
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
