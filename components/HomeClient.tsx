"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import Footer from "@/components/Footer";
import PersonalizedRows from "@/components/PersonalizedRows";
import SourceLegend from "@/components/SourceLegend";
import type { CatalogItem, CatalogRow, SourceId } from "@/lib/sources/types";

interface HomeClientProps {
  featured: CatalogItem;
  rows: CatalogRow[];
  activeSources?: SourceId[];
}

export default function HomeClient({
  featured,
  rows,
  activeSources = [],
}: HomeClientProps) {
  return (
    <div className="app-page">
      <Navbar />

      <Hero item={featured} mediaType={featured.media_type ?? "movie"} />

      <main className="relative z-10 -mt-16 space-y-1 pb-10 md:-mt-24">
        <PersonalizedRows />

        {rows.map((row, index) => (
          <MediaRow
            key={`${row.title}-${index}`}
            title={row.title}
            items={row.items}
            mediaType={row.mediaType}
            priorityCount={index === 0 ? 8 : index === 1 ? 4 : 0}
          />
        ))}

        <SourceLegend sources={activeSources} />
      </main>

      <Footer />
    </div>
  );
}
