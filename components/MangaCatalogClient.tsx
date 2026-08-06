"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { CatalogItem, CatalogRow } from "@/lib/sources/types";
import { mediaImageUrl } from "@/lib/media-links";

type ContinueManga = {
  mangaSlug: string;
  title: string;
  poster: string | null;
  chapterNum: string;
  progressPct: number;
};

export default function MangaCatalogClient({
  featured,
  rows,
}: {
  featured: CatalogItem[];
  rows: CatalogRow[];
}) {
  const [continueReading, setContinueReading] = useState<ContinueManga[]>([]);
  const hero = featured[0] ?? rows[0]?.items?.[0] ?? null;
  const allItems = rows.flatMap((r) => r.items);

  useEffect(() => {
    void fetch("/api/manga/progress")
      .then((r) => r.json())
      .then((data) => setContinueReading(data.items || []))
      .catch(() => undefined);
  }, []);

  return (
    <div className="app-page relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(251,146,60,0.12),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.1),transparent_45%)]" />
      <Navbar />

      <section className="relative mx-auto max-w-[1400px] px-4 pb-6 pt-8 md:px-8 md:pt-12 lg:px-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300/90">
          Biblioteca · Español
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white md:text-6xl">
          Mangas
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55 md:text-base">
          Capítulos en español vía MangaDex. Lectura vertical, progreso guardado
          y catálogo pensado para leer — no para “reproducir”.
        </p>

        {hero && (
          <div className="mt-10 grid items-end gap-6 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
            <Link
              href={`/manga/${encodeURIComponent(hero.mangaSlug || "")}`}
              className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaImageUrl(hero.poster_path)}
                alt={hero.title || hero.name || "Manga"}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            </Link>
            <div className="pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-300/80">
                Destacado
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-white md:text-4xl">
                {hero.title || hero.name}
              </h2>
              {hero.overview ? (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 line-clamp-3">
                  {hero.overview}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/manga/${encodeURIComponent(hero.mangaSlug || "")}?play=1`}
                  className="brand-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
                >
                  <BookOpen className="h-4 w-4" />
                  Leer ahora
                </Link>
                <Link
                  href={`/manga/${encodeURIComponent(hero.mangaSlug || "")}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 hover:border-white/30 hover:text-white"
                >
                  Ver ficha
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {continueReading.length > 0 && (
        <section className="relative mx-auto max-w-[1400px] px-4 py-6 md:px-8 lg:px-12">
          <h2 className="mb-4 text-lg font-bold text-white">Seguir leyendo</h2>
          <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-2">
            {continueReading.map((m) => (
              <Link
                key={m.mangaSlug}
                href={`/manga/${encodeURIComponent(m.mangaSlug)}?play=1`}
                className="w-[120px] flex-shrink-0 md:w-[140px]"
              >
                <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[#101827]">
                  {m.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaImageUrl(m.poster)}
                      alt={m.title}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8">
                    <p className="truncate text-[10px] text-orange-200">
                      Cap. {m.chapterNum}
                    </p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-orange-300"
                        style={{
                          width: `${Math.min(100, Math.max(4, m.progressPct))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-white/75">{m.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-4 md:px-8 lg:px-12">
        <h2 className="mb-5 text-lg font-bold text-white">
          Catálogo en español
        </h2>
        {!allItems.length ? (
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-8 text-center text-sm text-amber-100">
            No se pudo cargar el catálogo MangaDex ahora. Reintenta en unos
            minutos o asegúrate de que{" "}
            <code className="text-orange-200">mangadex</code> no esté en{" "}
            <code className="text-orange-200">CATALOG_DISABLE</code>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {allItems.map((item) => {
              const title = item.title || item.name || "Manga";
              const href = item.mangaSlug
                ? `/manga/${encodeURIComponent(item.mangaSlug)}`
                : "#";
              return (
                <Link
                  key={`${item.id}-${item.mangaSlug}`}
                  href={href}
                  className="group"
                >
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0f172a] shadow-lg transition duration-300 group-hover:-translate-y-1 group-hover:border-orange-300/30">
                    {item.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaImageUrl(item.poster_path)}
                        alt={title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-3 text-center text-xs text-white/40">
                        {title}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/70 to-transparent px-2.5 pb-2.5 pt-10">
                      <p className="truncate text-xs font-semibold text-white">
                        {title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-orange-200/90">
                        <BookOpen className="h-3 w-3" />
                        Leer
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
