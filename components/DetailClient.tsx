"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Play,
  Plus,
  ThumbsUp,
  ArrowLeft,
  Volume2,
  VolumeX,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MediaRow from "@/components/MediaRow";
import ModalPlayer, { type SeasonMeta } from "@/components/ModalPlayer";
import {
  IMAGE_BASE_URL,
  IMAGE_BACKDROP_URL,
  formatRuntime,
  getBestTrailerKey,
  getDisplayTitle,
  getMatchPercentage,
  getReleaseYear,
  getYoutubeEmbedUrl,
  type EpisodeInfo,
  type MediaDetails,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

interface DetailClientProps {
  details: MediaDetails;
  similar: MediaItem[];
  mediaType: MediaType;
}

export default function DetailClient({
  details,
  similar,
  mediaType,
}: DetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [playing, setPlaying] = useState(false);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [hasProgress, setHasProgress] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeInfo[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [episodeCounts, setEpisodeCounts] = useState<Record<number, number>>(
    {}
  );
  const [trailerMuted, setTrailerMuted] = useState(true);
  const [trailerReady, setTrailerReady] = useState(false);

  const title = getDisplayTitle(details);
  const year = getReleaseYear(details);
  const match = getMatchPercentage(details.vote_average);
  const trailerKey = useMemo(() => getBestTrailerKey(details), [details]);
  const showTrailer = Boolean(trailerKey) && !playing;

  const seasonsMeta: SeasonMeta[] = useMemo(() => {
    const fromApi = (details.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        episodeCount: episodeCounts[s.season_number] ?? s.episode_count,
        name: s.name || `Temporada ${s.season_number}`,
      }));

    if (fromApi.length) return fromApi;

    const count = details.number_of_seasons ?? 1;
    return Array.from({ length: count }, (_, i) => ({
      seasonNumber: i + 1,
      // Evitar 1 por defecto: bloquearía "Siguiente" en E1
      episodeCount: episodeCounts[i + 1] ?? 50,
      name: `Temporada ${i + 1}`,
    }));
  }, [details.seasons, details.number_of_seasons, episodeCounts]);

  const runtime =
    mediaType === "movie"
      ? formatRuntime(details.runtime)
      : details.number_of_seasons
        ? `${details.number_of_seasons} temporada${details.number_of_seasons > 1 ? "s" : ""}`
        : null;

  const backdrop = details.backdrop_path
    ? `${IMAGE_BACKDROP_URL}${details.backdrop_path}`
    : details.poster_path
      ? `${IMAGE_BASE_URL}${details.poster_path}`
      : "";

  const cast = details.credits?.cast?.slice(0, 8) ?? [];
  const genres = details.genres ?? [];

  const openPlayer = useCallback(() => setPlaying(true), []);
  const closePlayer = useCallback(() => {
    setPlaying(false);
    if (searchParams.get("play") === "1") {
      router.replace(`/titulo/${mediaType}/${details.id}`, { scroll: false });
    }
  }, [searchParams, router, mediaType, details.id]);

  const playEpisode = useCallback((s: number, e: number) => {
    setSeason(s);
    setEpisode(e);
    setPlaying(true);
  }, []);

  const onSeasonEpisodeChange = useCallback((s: number, e: number) => {
    setSeason(s);
    setEpisode(e);
  }, []);

  useEffect(() => {
    if (searchParams.get("play") === "1") {
      setPlaying(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (status !== "authenticated") return;

    void fetch("/api/watch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaType, tmdbId: details.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        const p = data.progress;
        if (!p) return;
        setHasProgress(true);
        if (p.season) setSeason(p.season);
        if (p.episode) setEpisode(p.episode);
      })
      .catch(() => {});
  }, [status, mediaType, details.id]);

  useEffect(() => {
    if (mediaType !== "tv") return;

    setLoadingEps(true);
    void fetch(`/api/tv/${details.id}/season/${season}`)
      .then((r) => r.json())
      .then((data) => {
        const list: EpisodeInfo[] = data.episodes ?? [];
        setEpisodes(list);
        if (list.length) {
          setEpisodeCounts((prev) => ({ ...prev, [season]: list.length }));
        }
        if (list.length && episode > list.length) {
          setEpisode(1);
        }
      })
      .catch(() => setEpisodes([]))
      .finally(() => setLoadingEps(false));
  }, [mediaType, details.id, season]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTrailerMuted(true);
    setTrailerReady(false);
  }, [details.id, mediaType]);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />

      <section className="relative min-h-[70vh] w-full overflow-hidden md:min-h-[78vh]">
        {backdrop && (
          <div
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
              showTrailer && trailerReady ? "opacity-0" : "opacity-100"
            }`}
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}

        {showTrailer && trailerKey && (
          <div className="absolute inset-0 overflow-hidden">
            {/* Escala extra para recortar barra/controles de YouTube en los bordes */}
            <iframe
              key={`${trailerKey}-${trailerMuted ? "m" : "u"}`}
              src={getYoutubeEmbedUrl(trailerKey, trailerMuted)}
              title={`Tráiler de ${title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              tabIndex={-1}
              className={`pointer-events-none absolute left-1/2 top-1/2 aspect-video h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 scale-[1.45] border-0 transition-opacity duration-700 ${
                trailerReady ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setTrailerReady(true)}
            />
            {/* Bloquea clics al iframe para que no aparezcan pause / ±10s */}
            <div className="absolute inset-0 z-[1]" aria-hidden />
          </div>
        )}

        {/* Overlays más suaves cuando hay tráiler para que se vea bien */}
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r to-transparent md:w-[70%] ${
            showTrailer && trailerReady
              ? "from-[#141414]/95 via-[#141414]/35"
              : "from-[#141414] via-[#141414]/75"
          }`}
        />
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-[#141414] to-transparent ${
            showTrailer && trailerReady ? "via-[#141414]/25" : "via-[#141414]/50"
          }`}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/50 to-transparent" />

        <div className="relative z-10 px-4 pb-10 pt-24 md:px-12 md:pb-16 md:pt-28">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-8 flex items-center gap-2 text-sm text-neutral-300 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-end">
            {details.poster_path && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${IMAGE_BASE_URL}${details.poster_path}`}
                alt={title}
                className="hidden w-44 rounded shadow-2xl shadow-black/60 md:block lg:w-52"
              />
            )}

            <div className="max-w-3xl flex-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#E50914]">
                {mediaType === "movie" ? "Película" : "Serie"}
              </p>

              <h1 className="mb-4 text-4xl font-black leading-none md:text-6xl">
                {title}
              </h1>

              {details.tagline && (
                <p className="mb-4 text-base italic text-neutral-400">
                  {details.tagline}
                </p>
              )}

              <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
                {match !== null && (
                  <span className="font-semibold text-emerald-400">
                    {match}% de coincidencia
                  </span>
                )}
                {year && <span className="text-neutral-300">{year}</span>}
                {runtime && <span className="text-neutral-300">{runtime}</span>}
                <span className="rounded border border-neutral-500 px-1.5 py-0.5 text-[10px] uppercase text-neutral-300">
                  HD
                </span>
                {details.vote_average !== undefined && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-neutral-200">
                    ★ {details.vote_average.toFixed(1)}
                  </span>
                )}
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={openPlayer}
                  className="flex items-center gap-2 rounded bg-white px-7 py-2.5 text-sm font-bold text-black transition hover:bg-white/85 md:text-base"
                >
                  <Play className="h-5 w-5 fill-black" />
                  {hasProgress && mediaType === "tv"
                    ? `Continuar T${season} E${episode}`
                    : hasProgress
                      ? "Continuar"
                      : "Reproducir"}
                </button>

                <button
                  type="button"
                  aria-label="Agregar a mi lista"
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-400 text-white transition hover:border-white"
                >
                  <Plus className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  aria-label="Me gusta"
                  className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-400 text-white transition hover:border-white"
                >
                  <ThumbsUp className="h-5 w-5" />
                </button>

                {showTrailer && (
                  <button
                    type="button"
                    aria-label={trailerMuted ? "Activar sonido" : "Silenciar"}
                    onClick={() => setTrailerMuted((m) => !m)}
                    className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-400 text-white transition hover:border-white"
                  >
                    {trailerMuted ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                )}
              </div>

              {status !== "authenticated" && (
                <p className="mb-4 text-sm text-neutral-400">
                  Puedes ver todo sin cuenta.{" "}
                  <Link
                    href="/registro"
                    className="text-white underline hover:text-neutral-200"
                  >
                    Regístrate
                  </Link>{" "}
                  para guardar progreso y recomendaciones.
                </p>
              )}

              <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-200 md:text-base">
                {details.overview || "Sin descripción disponible."}
              </p>

              {genres.length > 0 && (
                <p className="text-sm text-neutral-400">
                  <span className="text-neutral-500">Géneros: </span>
                  {genres.map((g, i) => (
                    <span key={g.id}>
                      {g.name}
                      {i < genres.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="relative z-10 space-y-10 px-4 pb-8 md:px-12">
        {mediaType === "tv" && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold md:text-xl">Episodios</h2>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                Temporada
                <select
                  value={season}
                  onChange={(e) => {
                    setSeason(Number(e.target.value));
                    setEpisode(1);
                  }}
                  className="rounded border border-white/20 bg-black/60 px-3 py-2 text-white outline-none focus:border-white/50"
                >
                  {seasonsMeta.map((s) => (
                    <option key={s.seasonNumber} value={s.seasonNumber}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {hasProgress && status === "authenticated" && (
              <p className="mb-4 text-sm text-emerald-400">
                Dejaste en T{season} E{episode}
              </p>
            )}

            {loadingEps && (
              <p className="text-sm text-neutral-400">Cargando episodios...</p>
            )}

            <div className="space-y-2">
              {episodes.map((ep) => {
                const active =
                  ep.season_number === season &&
                  ep.episode_number === episode;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() =>
                      playEpisode(ep.season_number, ep.episode_number)
                    }
                    className={`flex w-full gap-3 rounded-md p-2 text-left transition md:gap-4 md:p-3 ${
                      active
                        ? "bg-white/12 ring-1 ring-white/25"
                        : "bg-white/[0.03] hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="relative h-[72px] w-[128px] shrink-0 overflow-hidden rounded bg-zinc-800 md:h-[90px] md:w-[160px]">
                      {ep.still_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${IMAGE_BASE_URL}${ep.still_path}`}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-neutral-500">
                          E{ep.episode_number}
                        </div>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/40 hover:opacity-100">
                        <Play className="h-8 w-8 fill-white text-white" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-sm font-semibold md:text-base">
                          {ep.episode_number}. {ep.name}
                        </p>
                        {ep.runtime ? (
                          <span className="text-xs text-neutral-500">
                            {ep.runtime} min
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-xs text-neutral-400 md:text-sm">
                        {ep.overview || "Sin descripción"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {cast.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold md:text-xl">Reparto</h2>
            <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-2">
              {cast.map((person) => (
                <div
                  key={person.id}
                  className="w-28 flex-shrink-0 text-center md:w-32"
                >
                  <div className="mb-2 aspect-square overflow-hidden rounded-full bg-zinc-800">
                    {person.profile_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${IMAGE_BASE_URL}${person.profile_path}`}
                        alt={person.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-neutral-600">
                        {person.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {person.character}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 rounded-lg bg-white/[0.03] p-5 md:grid-cols-3 md:p-6">
          <div>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Estado
            </h3>
            <p className="text-sm text-neutral-200">
              {details.status || "—"}
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Idioma original
            </h3>
            <p className="text-sm uppercase text-neutral-200">
              {details.original_language || "—"}
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">
              Tipo
            </h3>
            <p className="text-sm text-neutral-200">
              {mediaType === "movie" ? "Película" : "Serie de televisión"}
              {mediaType === "tv" && details.number_of_episodes
                ? ` · ${details.number_of_episodes} episodios`
                : ""}
            </p>
          </div>
        </section>

        <MediaRow
          title="Títulos similares"
          items={similar}
          mediaType={mediaType}
        />

        <div className="pb-4 text-sm text-neutral-500">
          <Link href="/" className="hover:text-neutral-300 hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </main>

      <Footer />

      <ModalPlayer
        open={playing}
        mediaId={details.id}
        mediaType={mediaType}
        title={title}
        posterPath={details.poster_path}
        backdropPath={details.backdrop_path}
        season={mediaType === "tv" ? season : null}
        episode={mediaType === "tv" ? episode : null}
        seasons={mediaType === "tv" ? seasonsMeta : []}
        onSeasonEpisodeChange={
          mediaType === "tv" ? onSeasonEpisodeChange : undefined
        }
        onClose={closePlayer}
        autoStart
      />
    </div>
  );
}
