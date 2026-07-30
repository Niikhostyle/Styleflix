import CatalogClient from "@/components/CatalogClient";
import {
  getAiringTodaySeries,
  getCrimeSeries,
  getDramaSeries,
  getPopularSeries,
  getSciFiSeries,
  getTopRatedSeries,
  getTrendingSeries,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series | StyleFlix",
  description: "Descubre series populares y tendencias en StyleFlix",
};

export default async function SeriesPage() {
  const [
    trending,
    popular,
    topRated,
    airing,
    drama,
    crime,
    sciFi,
  ] = await Promise.all([
    getTrendingSeries(),
    getPopularSeries(),
    getTopRatedSeries(),
    getAiringTodaySeries(),
    getDramaSeries(),
    getCrimeSeries(),
    getSciFiSeries(),
  ]);

  return (
    <CatalogClient
      pageTitle="Series"
      subtitle="Historias para maratonear sin parar."
      featured={trending}
      defaultMediaType="tv"
      rows={[
        { title: "Tendencias", items: trending, mediaType: "tv" },
        { title: "Populares", items: popular, mediaType: "tv" },
        { title: "Se emiten hoy", items: airing, mediaType: "tv" },
        { title: "Mejor valoradas", items: topRated, mediaType: "tv" },
        { title: "Drama", items: drama, mediaType: "tv" },
        { title: "Crimen", items: crime, mediaType: "tv" },
        { title: "Sci-Fi & Fantasía", items: sciFi, mediaType: "tv" },
      ]}
    />
  );
}
