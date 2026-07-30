import CatalogClient from "@/components/CatalogClient";
import {
  getActionAnime,
  getAnimeMovies,
  getPopularAnime,
  getTopRatedAnime,
  getTrendingAnime,
} from "@/lib/tmdb";

/** Evita prerender en build de Vercel sin vars / fallos TMDB. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Animes | StyleFlix",
  description: "Animes y películas de animación japonesa en StyleFlix",
};

export default async function AnimesPage() {
  const [popular, topRated, trending, action, movies] = await Promise.all([
    getPopularAnime(),
    getTopRatedAnime(),
    getTrendingAnime(),
    getActionAnime(),
    getAnimeMovies(),
  ]);

  return (
    <CatalogClient
      pageTitle="Animes"
      subtitle="Lo mejor de la animación japonesa."
      featured={popular}
      defaultMediaType="tv"
      rows={[
        { title: "Populares", items: popular, mediaType: "tv" },
        { title: "Novedades", items: trending, mediaType: "tv" },
        { title: "Mejor valorados", items: topRated, mediaType: "tv" },
        { title: "Acción y aventura", items: action, mediaType: "tv" },
        { title: "Películas de anime", items: movies, mediaType: "movie" },
      ]}
    />
  );
}
