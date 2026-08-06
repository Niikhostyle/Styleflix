"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  const [playing, setPlaying] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const backdrop = mediaImageUrl(anime.backdrop || anime.poster, "backdrop");
  const poster = mediaImageUrl(anime.poster, "poster");
  const year = anime.startDate?.slice(0, 4) || "";

  const episodes = useMemo(() => {
    const list = [...(anime.episodes || [])].sort((a, b) => a.number - b.number);
    if (list.length) return list;
    return Array.from({ length: Math.max(1, anime.episodesCount || 1) }, (_, i) => ({
      id: i + 1,
      number: i + 1,
    }));
  }, [anime.episodes, anime.episodesCount]);

  const loadEpisode = useCallback(
    async (ep: number) => {
      if (!canPlay) {
        setError("Necesitas una membresía activa para reproducir.");
        return;
      }
      setLoading(true);
      setError("");
      setEmbedUrl("");
      try {
        const res = await fetch(
          `/api/play/animeav1?slug=${encodeURIComponent(anime.slug)}&ep=${ep}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.embedUrl) {
          setError(data.error || "No se pudo cargar el episodio.");
          return;
        }
        const url = data.embedUrl as string;
        setEmbedUrl(`${url}${url.includes("?") ? "&" : "?"}_r=${Date.now()}`);
        setPlaying(true);
      } catch {
        setError("Error de red.");
      } finally {
        setLoading(false);
      }
    },
    [anime.slug, canPlay]
  );

  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  return (
    <div className="app-page">
      <Navbar />

      <section className="relative min-h-[70vh] w-full overflow-hidden">
        {backdrop && (
          <Image
            src={backdrop}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-50"
            unoptimized={/^https?:\/\//i.test(backdrop)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#06080f] via-[#06080f]/85 to-[#06080f]/40" />

        <div className="relative z-10 mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pb-16 pt-28 md:flex-row md:items-end md:px-8">
          {poster && (
            <div className="relative mx-auto aspect-[2/3] w-44 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl md:mx-0 md:w-52">
              <Image
                src={poster}
                alt={anime.title}
                fill
                className="object-cover"
                sizes="208px"
                unoptimized={/^https?:\/\//i.test(poster)}
              />
            </div>
          )}

          <div className="flex-1 text-center md:pb-2 md:text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              Anime
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white md:text-5xl">
              {anime.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-white/60 md:justify-start">
              {year && <span>{year}</span>}
              {anime.statusText && <span>· {anime.statusText}</span>}
              {anime.episodesCount > 0 && (
                <span>· {anime.episodesCount} episodios</span>
              )}
              {anime.score != null && anime.score > 0 && (
                <span>· ★ {anime.score.toFixed(1)}</span>
              )}
            </div>
            {anime.genres && anime.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
                {anime.genres.slice(0, 8).map((g) => (
                  <span
                    key={g.name}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 md:text-base">
              {anime.synopsis || "Sin sinopsis."}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
              {status === "authenticated" && canPlay ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setEpisode(1);
                    void loadEpisode(1);
                  }}
                  className="brand-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {loading ? "Cargando…" : "Reproducir"}
                </button>
              ) : (
                <Link
                  href="/membresia"
                  className="brand-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold"
                >
                  Activar membresía para ver
                </Link>
              )}
              <Link
                href="/animes"
                className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a animes
              </Link>
            </div>
            {error && !playing && (
              <p className="mt-3 text-sm text-red-300">{error}</p>
            )}
          </div>
        </div>
      </section>

      <main className="relative z-10 mx-auto max-w-[1200px] px-4 pb-20 md:px-8">
        <h2 className="mb-4 text-xl font-bold">Episodios</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {episodes.map((ep) => (
            <button
              key={ep.id}
              type="button"
              disabled={!canPlay || loading}
              onClick={() => {
                setEpisode(ep.number);
                void loadEpisode(ep.number);
              }}
              className={`rounded-lg border px-2 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${
                episode === ep.number && playing
                  ? "border-teal-300/50 bg-teal-300/15 text-teal-100"
                  : "border-white/10 bg-white/[0.04] text-white/80 hover:border-teal-300/30 hover:bg-teal-300/10"
              }`}
            >
              {ep.number}
            </button>
          ))}
        </div>
      </main>

      <Footer />

      {playing && (
        <div className="fixed inset-0 z-[100] bg-black">
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm md:left-6 md:top-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Volver
          </button>
          <p className="pointer-events-none absolute left-1/2 top-4 z-20 max-w-[70%] -translate-x-1/2 truncate text-center text-sm font-semibold text-white drop-shadow md:top-6">
            {anime.title} · Ep. {episode}
          </p>
          {error ? (
            <div className="flex h-full items-center justify-center text-red-300">
              {error}
            </div>
          ) : embedUrl ? (
            <iframe
              key={embedUrl}
              src={embedUrl}
              title={`${anime.title} episodio ${episode}`}
              className="absolute inset-0 h-full w-full border-0"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-white/60">
              Cargando…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
