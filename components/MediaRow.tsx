"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  getDisplayTitle,
  getReleaseYear,
  type MediaType,
} from "@/lib/tmdb";
import type { CatalogItem } from "@/lib/sources/types";
import { catalogItemHref, mediaImageUrl } from "@/lib/media-links";

interface MediaRowProps {
  title: string;
  items: CatalogItem[];
  mediaType?: MediaType;
  /** Prioriza las primeras N imágenes (primera fila visible). */
  priorityCount?: number;
}

function resolveType(item: CatalogItem, fallback?: MediaType): MediaType {
  return item.media_type ?? fallback ?? "movie";
}

export default function MediaRow({
  title,
  items,
  mediaType,
  priorityCount = 0,
}: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.85;
    rowRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  return (
    <section className="group/row relative mb-10 px-4 md:mb-14 md:px-8 lg:px-12">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_14px_rgba(94,234,212,0.9)]" />
        <h2 className="text-lg font-bold tracking-[-0.02em] text-slate-100 md:text-xl">
          {title}
        </h2>
        <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Anterior"
          tabIndex={-1}
          data-tv-ignore
          onClick={() => scroll("left")}
          className="tv-row-chevron glass-panel absolute -left-2 top-1/2 z-20 flex h-14 w-10 -translate-y-1/2 items-center justify-center rounded-xl opacity-0 transition group-hover/row:opacity-100 hover:border-teal-300/25 hover:text-teal-200 md:w-11"
        >
          <ChevronLeft className="h-9 w-9 text-white" />
        </button>

        <div
          ref={rowRef}
          className="scrollbar-hide flex gap-3 overflow-x-auto scroll-smooth pb-3 pt-1 md:gap-4"
        >
          {items.map((item, index) => {
            const type = resolveType(item, mediaType);
            const name = getDisplayTitle(item);
            const priority = index < priorityCount;
            const year = getReleaseYear(item);
            const score = item.vote_average
              ? item.vote_average.toFixed(1)
              : null;

            return (
              <Link
                key={`${type}-${item.id}-${item.animeAv1Slug || ""}`}
                href={catalogItemHref(item)}
                data-tv-focus
                onFocus={(e) => {
                  e.currentTarget.scrollIntoView({
                    inline: "center",
                    block: "nearest",
                    behavior: "smooth",
                  });
                }}
                className="tv-card group/card relative aspect-[2/3] w-[128px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101827] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition duration-300 hover:z-10 hover:-translate-y-1.5 hover:border-teal-200/25 hover:shadow-[0_20px_45px_rgba(0,0,0,0.38)] focus-visible:z-10 md:w-[158px] lg:w-[174px]"
              >
                {item.poster_path ? (
                  <Image
                    src={mediaImageUrl(item.poster_path, "poster")}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 128px, (max-width: 1024px) 158px, 174px"
                    className="object-cover transition duration-500 group-hover/card:scale-[1.04]"
                    priority={priority}
                    loading={priority ? "eager" : "lazy"}
                    unoptimized={/^https?:\/\//i.test(item.poster_path)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 p-2 text-center text-xs text-neutral-400">
                    {name}
                  </div>
                )}
                {item.playable === false && (
                  <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/75 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200 backdrop-blur-sm">
                    Ficha
                  </span>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07101d]/95 via-transparent to-transparent opacity-80 transition group-hover/card:opacity-100" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                  <p className="line-clamp-2 text-xs font-bold leading-4 text-white md:text-[13px]">
                    {name}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] font-medium text-slate-300">
                    {year && <span>{year}</span>}
                    {score && (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {score}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          aria-label="Siguiente"
          tabIndex={-1}
          data-tv-ignore
          onClick={() => scroll("right")}
          className="tv-row-chevron glass-panel absolute -right-2 top-1/2 z-20 flex h-14 w-10 -translate-y-1/2 items-center justify-center rounded-xl opacity-0 transition group-hover/row:opacity-100 hover:border-teal-300/25 hover:text-teal-200 md:w-11"
        >
          <ChevronRight className="h-9 w-9 text-white" />
        </button>
      </div>
    </section>
  );
}
