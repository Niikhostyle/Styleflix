"use client";

import Image from "next/image";
import Link from "next/link";
import { Play, Info, Sparkles } from "lucide-react";
import {
  getDisplayTitle,
  getMatchPercentage,
  getReleaseYear,
  type MediaType,
} from "@/lib/tmdb";
import type { CatalogItem } from "@/lib/sources/types";
import { catalogItemHref, mediaImageUrl } from "@/lib/media-links";

interface HeroProps {
  item: CatalogItem;
  mediaType?: MediaType;
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

export default function Hero({ item, mediaType = "movie" }: HeroProps) {
  const title = getDisplayTitle(item);
  const detailHref = catalogItemHref(item);
  const year = getReleaseYear(item);
  const match = getMatchPercentage(item.vote_average);

  const backdropPath = item.backdrop_path || item.poster_path;
  const backdrop = mediaImageUrl(
    backdropPath,
    item.backdrop_path ? "backdrop" : "poster"
  );

  return (
    <section className="relative h-[82vh] min-h-[620px] w-full overflow-hidden md:h-[88vh]">
      {backdrop && (
        <Image
          src={backdrop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-[1.01] object-cover object-center"
          unoptimized={/^https?:\/\//i.test(backdropPath || "")}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-[#07101d] via-[#07101d]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/10 to-[#07101d]/35" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_40%,transparent_0,rgba(7,11,20,0.08)_38%,rgba(7,11,20,0.62)_100%)]" />

      <div className="relative z-10 mx-auto flex h-full max-w-[1520px] items-end px-4 pb-28 pt-32 md:px-8 md:pb-28 lg:px-12">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            Selección VeoTV{item.animeAv1Slug ? " · AnimeAV1" : ""}
          </div>

          <h1 className="mb-5 max-w-xl text-5xl font-black leading-[0.92] tracking-[-0.055em] text-white drop-shadow-lg md:text-7xl lg:text-[5.25rem]">
            {title}
          </h1>

          <div className="mb-5 flex flex-wrap items-center gap-2.5 text-sm font-semibold">
            {match !== null && (
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-emerald-300">
                {match}% afinidad
              </span>
            )}
            {year && (
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-slate-200 backdrop-blur-md">
                {year}
              </span>
            )}
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] uppercase tracking-wide text-slate-200 backdrop-blur-md">
              Alta calidad
            </span>
          </div>

          {item.overview ? (
            <p className="mb-7 max-w-xl text-sm leading-7 text-slate-200/90 drop-shadow md:text-base">
              {truncate(item.overview, 180)}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Link
              href={`${detailHref}?play=1`}
              data-tv-autofocus
              data-tv-focus
              className="brand-button tv-cta focus-ring flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-extrabold transition md:px-7 md:text-base"
            >
              <Play className="h-5 w-5 fill-current" />
              Ver ahora
            </Link>

            <Link
              href={detailHref}
              data-tv-focus
              className="tv-cta focus-ring flex items-center gap-2 rounded-xl border border-white/12 bg-[#0b1424]/65 px-6 py-3 text-sm font-bold text-white backdrop-blur-xl transition hover:border-white/25 hover:bg-white/10 md:px-7 md:text-base"
            >
              <Info className="h-5 w-5" />
              Ver detalles
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
