"use client";

import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import Footer from "@/components/Footer";
import PersonalizedRows from "@/components/PersonalizedRows";
import type { MediaItem } from "@/lib/tmdb";

interface HomeClientProps {
  featured: MediaItem;
  trendingMovies: MediaItem[];
  popularMovies: MediaItem[];
  topRatedMovies: MediaItem[];
  actionMovies: MediaItem[];
  trendingSeries: MediaItem[];
  popularSeries: MediaItem[];
  popularAnime: MediaItem[];
  animeMovies: MediaItem[];
}

export default function HomeClient({
  featured,
  trendingMovies,
  popularMovies,
  topRatedMovies,
  actionMovies,
  trendingSeries,
  popularSeries,
  popularAnime,
  animeMovies,
}: HomeClientProps) {
  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />

      <Hero item={featured} mediaType={featured.media_type ?? "movie"} />

      <main className="relative z-10 -mt-14 space-y-1 pb-8 md:-mt-20">
        <PersonalizedRows />
        <MediaRow
          title="Tendencias en películas"
          items={trendingMovies}
          mediaType="movie"
          priorityCount={8}
        />
        <MediaRow
          title="Series populares"
          items={popularSeries}
          mediaType="tv"
          priorityCount={4}
        />
        <MediaRow
          title="Animes en tendencia"
          items={popularAnime}
          mediaType="tv"
        />
        <MediaRow
          title="Películas populares"
          items={popularMovies}
          mediaType="movie"
        />
        <MediaRow
          title="Series en tendencia"
          items={trendingSeries}
          mediaType="tv"
        />
        <MediaRow
          title="Mejor valoradas"
          items={topRatedMovies}
          mediaType="movie"
        />
        <MediaRow title="Acción" items={actionMovies} mediaType="movie" />
        <MediaRow
          title="Películas de anime"
          items={animeMovies}
          mediaType="movie"
        />
      </main>

      <Footer />
    </div>
  );
}
