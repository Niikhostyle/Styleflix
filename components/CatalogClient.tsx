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
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />

      {hero && (
        <Hero item={hero} mediaType={hero.media_type ?? defaultMediaType} />
      )}

      <main className="relative z-10 -mt-10 space-y-2 px-0 pb-10 md:-mt-16">
        <div className="px-4 pt-4 md:px-12">
          <h1 className="text-2xl font-bold md:text-3xl">{pageTitle}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
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
