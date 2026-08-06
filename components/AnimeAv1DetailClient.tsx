"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ArrowLeft, ExternalLink } from "lucide-react";
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
  const [notice, setNotice] = useState("");
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
      setNotice("");
      try {
        const res = await fetch(
          `/api/play/animeav1?slug=${encodeURIComponent(anime.slug)}&ep=${ep}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.embedUrl) {
          setError(data.error || "No se pudo cargar el episodio.");
          setEmbedUrl("");
          return;
        }
        setEmbedUrl(
          `${data.embedUrl}${data.embedUrl.includes("?") ? "&" : "?"}_r=${Date.now()}`
        );
        setNotice(
          data.notice ||
            data.credit ||
            "Reproducción vía AnimeAV1 · animeav1.com"
        );
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
              Anime · AnimeAV1
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
              <a
                href={`https://animeav1.com/media/${encodeURIComponent(anime.slug)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm text-white/70 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en AnimeAV1
              </a>
              <Link
                href="/animes"
                className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver a animes
              </Link>
            </div>
            <p className="mt-4 text-xs text-white/40">
              Catálogo y reproducción con créditos a{" "}
              <a
                href="https://animeav1.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-300/80 underline"
              >
                AnimeAV1
              </a>
              .
            </p>
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
        <div className="fixed inset-0 z-[80] bg-black">
          <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 py-4">
            <button
              type="button"
              onClick={() => setPlaying(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-sm font-semibold text-white">
                {anime.title} · Ep. {episode}
              </p>
              {notice && (
                <p className="truncate text-xs text-teal-200/80">{notice}</p>
              )}
            </div>
            <div className="w-24" />
          </div>
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
