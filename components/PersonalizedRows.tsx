"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import MediaRow from "@/components/MediaRow";
import {
  IMAGE_BASE_URL,
  getDisplayTitle,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

type ContinueItem = MediaItem & {
  season?: number | null;
  episode?: number | null;
  progressPct?: number;
};

export default function PersonalizedRows() {
  const { status } = useSession();
  const [continueWatching, setContinueWatching] = useState<ContinueItem[]>([]);
  const [recommended, setRecommended] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (status !== "authenticated") {
      setContinueWatching([]);
      setRecommended([]);
      return;
    }

    void Promise.all([
      fetch("/api/watch").then((r) => r.json()),
      fetch("/api/recommendations").then((r) => r.json()),
    ]).then(([watch, recs]) => {
      setContinueWatching(watch.items ?? []);
      setRecommended(recs.items ?? []);
    });
  }, [status]);

  if (status !== "authenticated") return null;

  return (
    <>
      <ProgressRow title="Continuar viendo" items={continueWatching} />
      <MediaRow title="Recomendado para ti" items={recommended} />
    </>
  );
}

function ProgressRow({
  title,
  items,
}: {
  title: string;
  items: ContinueItem[];
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const scroll = (direction: "left" | "right") => {
    if (!rowRef.current) return;
    const amount = rowRef.current.clientWidth * 0.85;
    rowRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

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
          {items.map((item) => {
            const type = (item.media_type ?? "movie") as MediaType;
            const name = getDisplayTitle(item);
            const epLabel =
              type === "tv" && item.season && item.episode
                ? `T${item.season} E${item.episode}`
                : null;
            const pct = Math.min(100, Math.max(0, item.progressPct ?? 10));

            return (
              <Link
                key={`${type}-${item.id}`}
                href={`/titulo/${type}/${item.id}?play=1`}
                data-tv-focus
                className="tv-card group/card relative aspect-[2/3] w-[128px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101827] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition duration-300 hover:z-10 hover:-translate-y-1.5 hover:border-teal-200/25 md:w-[158px] lg:w-[174px]"
              >
                {item.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMAGE_BASE_URL}${item.poster_path}`}
                    alt={name}
                    className="h-full w-full object-cover transition duration-500 group-hover/card:scale-[1.04]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800 p-2 text-center text-xs text-slate-400">
                    {name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07101d] via-[#07101d]/80 to-transparent px-3 pb-3 pt-10">
                  {epLabel && (
                    <p className="mb-1.5 text-[10px] font-semibold text-teal-200 md:text-xs">
                      {epLabel}
                    </p>
                  )}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-teal-300"
                      style={{ width: `${pct}%` }}
                    />
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
