"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
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
      <SimpleRow title="Recomendado para ti" items={recommended} />
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
    <section className="group/row relative mb-9 px-4 md:mb-11 md:px-12">
      <h2 className="mb-3 text-lg font-semibold tracking-wide text-neutral-100 md:text-xl">
        {title}
      </h2>
      <div className="relative">
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => scroll("left")}
          className="absolute left-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-black/55 opacity-0 transition group-hover/row:opacity-100 hover:bg-black/75 md:w-12"
        >
          <ChevronLeft className="h-9 w-9 text-white" />
        </button>
        <div
          ref={rowRef}
          className="scrollbar-hide flex gap-2 overflow-x-auto scroll-smooth pb-1 md:gap-2.5"
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
                className="group/card relative aspect-[2/3] w-[110px] flex-shrink-0 overflow-hidden rounded-sm bg-zinc-900 transition duration-300 hover:z-10 hover:scale-105 md:w-[140px] lg:w-[160px]"
              >
                {item.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${IMAGE_BASE_URL}${item.poster_path}`}
                    alt={name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800 p-2 text-center text-xs text-neutral-400">
                    {name}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-2 pt-8">
                  {epLabel && (
                    <p className="mb-1 text-[10px] font-semibold text-white md:text-xs">
                      {epLabel}
                    </p>
                  )}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full rounded-full bg-[#E50914]"
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
          onClick={() => scroll("right")}
          className="absolute right-0 top-0 z-20 flex h-full w-10 items-center justify-center bg-black/55 opacity-0 transition group-hover/row:opacity-100 hover:bg-black/75 md:w-12"
        >
          <ChevronRight className="h-9 w-9 text-white" />
        </button>
      </div>
    </section>
  );
}

function SimpleRow({ title, items }: { title: string; items: MediaItem[] }) {
  if (!items.length) return null;
  // Reuse MediaRow via dynamic import would be circular; inline thin wrapper
  return (
    <section className="mb-9 px-4 md:mb-11 md:px-12">
      <h2 className="mb-3 text-lg font-semibold tracking-wide text-neutral-100 md:text-xl">
        {title}
      </h2>
      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 md:gap-2.5">
        {items.map((item) => {
          const type = (item.media_type ?? "movie") as MediaType;
          const name = getDisplayTitle(item);
          return (
            <Link
              key={`${type}-${item.id}`}
              href={`/titulo/${type}/${item.id}`}
              className="relative aspect-[2/3] w-[110px] flex-shrink-0 overflow-hidden rounded-sm bg-zinc-900 transition duration-300 hover:scale-105 md:w-[140px] lg:w-[160px]"
            >
              {item.poster_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${IMAGE_BASE_URL}${item.poster_path}`}
                  alt={name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-neutral-400">
                  {name}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
