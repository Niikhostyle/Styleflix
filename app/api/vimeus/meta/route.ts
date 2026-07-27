import { NextResponse } from "next/server";

/**
 * Obtiene metadata del embed Vimeus (lista de servidores / episodio).
 * GET /api/vimeus/meta?tmdb=60625&se=2&ep=1
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdb = searchParams.get("tmdb");
  const se = searchParams.get("se") ?? "1";
  const ep = searchParams.get("ep") ?? "1";
  const viewKey =
    searchParams.get("view_key") ||
    process.env.NEXT_PUBLIC_VIMEUS_VIEW_KEY ||
    "";

  if (!tmdb || !viewKey) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  const url = `https://vimeus.com/e/serie?tmdb=${encodeURIComponent(tmdb)}&se=${encodeURIComponent(se)}&ep=${encodeURIComponent(ep)}&view_key=${encodeURIComponent(viewKey)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Vimeus ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const match = html.match(
      /<script[^>]*id="data"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (!match?.[1]) {
      return NextResponse.json(
        { error: "Sin metadata", embeds: [] },
        { status: 404 }
      );
    }

    const data = JSON.parse(match[1].trim());
    const embeds = Array.isArray(data.embeds) ? data.embeds : [];

    return NextResponse.json({
      title: data.title,
      tmdb_id: data.tmdb_id,
      season: data.season,
      episode: data.episode,
      poster: data.poster,
      embeds: embeds.map(
        (e: { url?: string; server?: string; lang?: string; quality?: string }) => ({
          url: e.url,
          server: e.server,
          lang: e.lang,
          quality: e.quality,
        })
      ),
    });
  } catch {
    return NextResponse.json({ error: "Error al consultar Vimeus" }, { status: 500 });
  }
}
