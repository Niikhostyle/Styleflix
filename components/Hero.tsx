"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Info } from "lucide-react";
import {
  IMAGE_BACKDROP_URL,
  IMAGE_POSTER_URL,
  getDisplayTitle,
  getMatchPercentage,
  getReleaseYear,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

interface HeroProps {
  item: MediaItem;
  mediaType?: MediaType;
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export default function Hero({ item, mediaType = "movie" }: HeroProps) {
  const type = item.media_type ?? mediaType;
  const title = getDisplayTitle(item);
  const detailHref = `/titulo/${type}/${item.id}`;
  const year = getReleaseYear(item);
  const match = getMatchPercentage(item.vote_average);

  const backdropPath = item.backdrop_path || item.poster_path;
  const backdrop = backdropPath
    ? `${item.backdrop_path ? IMAGE_BACKDROP_URL : IMAGE_POSTER_URL}${backdropPath}`
    : "";

  return (
    <section className="relative h-[78vh] min-h-[480px] w-full md:h-[85vh]">
      {backdrop && (
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-black/30" />

      <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end px-4 pb-24 md:px-12 md:pb-32">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#E50914]">
          Destacado
        </p>

        <h1 className="mb-3 text-4xl font-black leading-none drop-shadow-lg md:text-6xl lg:text-7xl">
          {title}
        </h1>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm font-medium">
          {match !== null && (
            <span className="text-emerald-400">{match}% de coincidencia</span>
          )}
          {year && <span className="text-neutral-300">{year}</span>}
          <span className="rounded border border-neutral-400 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-300">
            HD
          </span>
        </div>

        {item.overview ? (
          <p className="mb-6 max-w-xl text-sm leading-relaxed text-neutral-200 drop-shadow md:text-base">
            {truncate(item.overview, 180)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            href={`${detailHref}?play=1`}
            data-tv-autofocus
            data-tv-focus
            className="tv-cta flex items-center gap-2 rounded bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/85 md:px-8 md:text-base"
          >
            <Play className="h-5 w-5 fill-black" />
            Reproducir
          </Link>

          <Link
            href={detailHref}
            data-tv-focus
            className="tv-cta flex items-center gap-2 rounded bg-neutral-500/60 px-6 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-neutral-500/40 md:px-8 md:text-base"
          >
            <Info className="h-5 w-5" />
            Más información
          </Link>
        </div>
      </div>
    </section>
  );
}
