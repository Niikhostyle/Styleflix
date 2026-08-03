"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  IMAGE_POSTER_URL,
  getDisplayTitle,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  mediaType?: MediaType;
  /** Prioriza las primeras N imágenes (primera fila visible). */
  priorityCount?: number;
}

function resolveType(item: MediaItem, fallback?: MediaType): MediaType {
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
    <section className="group/row relative mb-9 px-4 md:mb-11 md:px-12">
      <h2 className="mb-3 text-lg font-semibold tracking-wide text-neutral-100 md:text-xl">
        {title}
      </h2>

      <div className="relative">
        <button
          type="button"
          aria-label="Anterior"
          tabIndex={-1}
          data-tv-ignore
          onClick={() => scroll("left")}
          className="tv-row-chevron absolute left-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-black/55 opacity-0 transition group-hover/row:opacity-100 hover:bg-black/75 md:w-12"
        >
          <ChevronLeft className="h-9 w-9 text-white" />
        </button>

        <div
          ref={rowRef}
          className="scrollbar-hide flex gap-2 overflow-x-auto scroll-smooth pb-1 md:gap-2.5"
        >
          {items.map((item, index) => {
            const type = resolveType(item, mediaType);
            const name = getDisplayTitle(item);
            const priority = index < priorityCount;

            return (
              <Link
                key={`${type}-${item.id}`}
                href={`/titulo/${type}/${item.id}`}
                data-tv-focus
                onFocus={(e) => {
                  e.currentTarget.scrollIntoView({
                    inline: "center",
                    block: "nearest",
                    behavior: "smooth",
                  });
                }}
                className="tv-card group/card relative aspect-[2/3] w-[110px] flex-shrink-0 overflow-hidden rounded-sm bg-zinc-900 transition duration-300 hover:z-10 hover:scale-105 focus-visible:z-10 md:w-[140px] lg:w-[160px]"
              >
                {item.poster_path ? (
                  <Image
                    src={`${IMAGE_POSTER_URL}${item.poster_path}`}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 110px, (max-width: 1024px) 140px, 160px"
                    className="object-cover"
                    priority={priority}
                    loading={priority ? "eager" : "lazy"}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 p-2 text-center text-xs text-neutral-400">
                    {name}
                  </div>
                )}
                <div className="tv-card-meta pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover/card:opacity-100" />
                <p className="tv-card-meta pointer-events-none absolute bottom-0 left-0 right-0 truncate px-2 pb-2 text-xs font-medium text-white opacity-0 transition group-hover/card:opacity-100">
                  {name}
                </p>
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
          className="tv-row-chevron absolute right-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-black/55 opacity-0 transition group-hover/row:opacity-100 hover:bg-black/75 md:w-12"
        >
          <ChevronRight className="h-9 w-9 text-white" />
        </button>
      </div>
    </section>
  );
}
