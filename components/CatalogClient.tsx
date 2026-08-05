"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import Footer from "@/components/Footer";
import type { MediaItem, MediaType } from "@/lib/tmdb";

export interface CatalogRow {
  title: string;
  items: MediaItem[];
  mediaType?: MediaType;
}

interface CatalogClientProps {
  pageTitle: string;
  subtitle?: string;
  featured: MediaItem[];
  rows: CatalogRow[];
  defaultMediaType?: MediaType;
}

export default function CatalogClient({
  pageTitle,
  subtitle,
  featured,
  rows,
  defaultMediaType = "movie",
}: CatalogClientProps) {
  const hero = featured[0] ?? null;

  return (
    <div className="app-page">
      <Navbar />

      {hero && (
        <Hero item={hero} mediaType={hero.media_type ?? defaultMediaType} />
      )}

      <main className="relative z-10 -mt-14 space-y-2 px-0 pb-10 md:-mt-20">
        <div className="mx-4 mb-7 rounded-2xl border border-white/[0.08] bg-[#0b1424]/70 px-5 py-5 backdrop-blur-xl md:mx-8 md:px-6 lg:mx-12">
          <p className="eyebrow mb-2">Explora el catálogo</p>
          <h1 className="text-3xl font-black tracking-[-0.04em] md:text-4xl">
            {pageTitle}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {subtitle}
            </p>
          )}
        </div>

        {rows.map((row, index) => (
          <MediaRow
            key={row.title}
            title={row.title}
            items={row.items}
            mediaType={row.mediaType ?? defaultMediaType}
            priorityCount={index === 0 ? 6 : 0}
          />
        ))}
      </main>

      <Footer />
    </div>
  );
}
