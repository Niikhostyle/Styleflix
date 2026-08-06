"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HlsVideoPlayer from "@/components/HlsVideoPlayer";
import { useSession } from "next-auth/react";
import { mediaImageUrl } from "@/lib/media-links";

export type AnimeAv1Detail = {
  id: number;
  title: string;
  slug: string;
  synopsis: string;
  poster: string | null;
  backdrop: string | null;
  statusText?: string;
  startDate?: string;
  episodesCount: number;
  score?: number;
  genres?: { name: string }[];
  episodes: { id: number; number: number }[];
};

type ServerOpt = {
  server: string;
  url: string;
  playKind?: "hls" | "iframe";
  streamUrl?: string;
};

/** Cache-bust sin romper #hash de UPNShare/Mega. */
function withCacheBust(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("_r", String(Date.now()));
    return u.toString();
  } catch {
    return url;
  }
}

export default function AnimeAv1DetailClient({
  anime,
}: {
  anime: AnimeAv1Detail;
}) {
  const { data: session, status } = useSession();
  const canPlay = Boolean(
    session?.user?.membershipActive || session?.user?.role === "SUPER_ADMIN"
  );

  const [episode, setEpisode] = useState(1);
  const [embedUrl, setEmbedUrl] = useState("");
  const [playKind, setPlayKind] = useState<"hls" | "iframe">("iframe");
  const [servers, setServers] = useState<ServerOpt[]>([]);
  const [activeServer, setActiveServer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const backdrop = mediaImageUrl(anime.backdrop || anime.poster, "backdrop");
  const poster = mediaImageUrl(anime.poster, "poster");
  const year = anime.startDate?.slice(0, 4) || "";

  const episodes = useMemo(() => {
    const list = [...(anime.episodes || [])].sort((a, b) => a.number - b.number);
    if (list.length) return list;
    return Array.from(
      { length: Math.max(1, anime.episodesCount || 1) },
      (_, i) => ({
        id: i + 1,
        number: i + 1,
      })
    );
  }, [anime.episodes, anime.episodesCount]);

  const epIndex = episodes.findIndex((e) => e.number === episode);
  const prevEp = epIndex > 0 ? episodes[epIndex - 1] : null;
  const nextEp =
    epIndex >= 0 && epIndex < episodes.length - 1
      ? episodes[epIndex + 1]
      : null;

  const applyServer = useCallback((opt: ServerOpt) => {
    const kind = opt.playKind === "hls" || Boolean(opt.streamUrl) ? "hls" : "iframe";
    const raw = kind === "hls" ? opt.streamUrl || opt.url : opt.url;
    setActiveServer(opt.server);
    setPlayKind(kind);
    setEmbedUrl(kind === "hls" ? raw : withCacheBust(raw));
    setError("");
  }, []);

  const loadEpisode = useCallback(
    async (ep: number, server?: string) => {
      if (!canPlay) {
        setError("Necesitas una membresía activa para reproducir.");
        return;
      }
      setLoading(true);
      setError("");
      setEmbedUrl("");
      try {
        const params = new URLSearchParams({
          slug: anime.slug,
          ep: String(ep),
        });
        if (server) params.set("server", server);
        const res = await fetch(`/api/play/animeav1?${params}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !(data.streamUrl || data.embedUrl)) {
          setError(data.error || "No se pudo cargar el episodio.");
          setServers([]);
          setActiveServer("");
          return;
        }
        const list: ServerOpt[] = Array.isArray(data.embeds)
          ? data.embeds.filter((e: ServerOpt) => e?.server && e?.url)
          : [];
        const serversList: ServerOpt[] = list.length
          ? list
          : [
              {
                server: data.server || "HLS",
                url: data.embedUrl as string,
                playKind: data.playKind === "hls" ? "hls" : "iframe",
                streamUrl: data.streamUrl as string | undefined,
              },
            ];

        // HLS primero (como AnimeAV1)
        const picked =
          (server
            ? serversList.find(
                (s) => s.server.toLowerCase() === server.toLowerCase()
              )
            : null) ||
          serversList.find(
            (s) =>
              s.server.toLowerCase() === "hls" ||
              s.playKind === "hls" ||
              Boolean(s.streamUrl)
          ) ||
          serversList[0];

        setServers(serversList);
        setEpisode(ep);
        applyServer(picked);
      } catch {
        setError("Error de red.");
      } finally {
        setLoading(false);
      }
    },
    [anime.slug, canPlay, applyServer]
  );

  useEffect(() => {
    if (status !== "authenticated" || !canPlay) return;
    void loadEpisode(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canPlay, anime.slug]);

  return (
    <div className="app-page min-h-screen bg-[#07090f]">
      <Navbar />

      <main className="mx-auto max-w-[1400px] px-3 pb-16 pt-24 sm:px-5 md:px-8">
        <Link
          href="/animes"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a animes
        </Link>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/[0.08] bg-black shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-white/50">
                  Cargando…
                </div>
              ) : error && !embedUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-red-300">{error}</p>
                  {!canPlay && (
                    <Link
                      href="/membresia"
                      className="brand-button rounded-lg px-4 py-2 text-sm font-bold"
                    >
                      Activar membresía
                    </Link>
                  )}
                </div>
              ) : embedUrl ? (
                playKind === "hls" ? (
                  <HlsVideoPlayer
                    key={`hls-${anime.slug}-${episode}-${activeServer}-${embedUrl}`}
                    src={embedUrl}
                    title={`${anime.title} episodio ${episode}`}
                  />
                ) : (
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title={`${anime.title} episodio ${episode}`}
                    className="absolute inset-0 h-full w-full border-0"
                    allowFullScreen
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                )
              ) : (
                <button
                  type="button"
                  onClick={() => void loadEpisode(episode)}
                  className="group relative flex h-full w-full items-center justify-center"
                >
                  {(backdrop || poster) && (
                    <Image
                      src={backdrop || poster}
                      alt=""
                      fill
                      className="object-cover opacity-40 transition group-hover:opacity-50"
                      unoptimized
                      priority
                    />
                  )}
                  <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-teal-400 text-black shadow-lg shadow-teal-400/30 transition group-hover:scale-105">
                    <Play className="h-7 w-7 fill-current pl-0.5" />
                  </span>
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!prevEp || loading || !canPlay}
                onClick={() => prevEp && void loadEpisode(prevEp.number)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:border-teal-300/35 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <button
                type="button"
                disabled={!nextEp || loading || !canPlay}
                onClick={() => nextEp && void loadEpisode(nextEp.number)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white/85 transition hover:border-teal-300/35 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {servers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5">
                {servers.map((s) => {
                  const active =
                    s.server.toLowerCase() === activeServer.toLowerCase();
                  return (
                    <button
                      key={s.server}
                      type="button"
                      disabled={loading}
                      onClick={() => applyServer(s)}
                      className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                        active
                          ? "bg-teal-400 text-black shadow-md shadow-teal-400/25"
                          : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1] hover:text-white"
                      }`}
                    >
                      {s.server}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-6">
              <p className="text-sm font-semibold text-teal-300">{anime.title}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                Episodio {episode}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
                <span>Anime</span>
                {year && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{year}</span>
                  </>
                )}
                {anime.statusText && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {anime.statusText}
                    </span>
                  </>
                )}
                {anime.score != null && anime.score > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>★ {anime.score.toFixed(1)}</span>
                  </>
                )}
              </div>
              {anime.genres && anime.genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {anime.genres.slice(0, 8).map((g) => (
                    <span
                      key={g.name}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/55 md:text-[15px]">
                {anime.synopsis || "Sin sinopsis."}
              </p>
              {error && embedUrl && (
                <p className="mt-3 text-sm text-red-300">{error}</p>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-white/[0.08] bg-[#0c1018] p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Estás viendo
            </p>
            <p className="mt-1 text-base font-bold text-white">
              Episodio {episode}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-4">
              {episodes.map((ep) => {
                const active = ep.number === episode;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    disabled={!canPlay || loading}
                    onClick={() => void loadEpisode(ep.number)}
                    className={`aspect-square rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
                      active
                        ? "border-2 border-teal-400 bg-teal-400/10 text-teal-200"
                        : "border border-transparent bg-white/[0.06] text-white/70 hover:bg-white/[0.1] hover:text-white"
                    }`}
                  >
                    {ep.number}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
