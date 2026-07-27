import CatalogClient from "@/components/CatalogClient";
import {
  getActionMovies,
  getComedyMovies,
  getDramaMovies,
  getHorrorMovies,
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
  getUpcomingMovies,
} from "@/lib/tmdb";

export const metadata = {
  title: "Películas | StyleFlix",
  description: "Explora películas populares, tendencias y géneros en StyleFlix",
};

export default async function PeliculasPage() {
  const [
    trending,
    popular,
    topRated,
    nowPlaying,
    upcoming,
    action,
    comedy,
    drama,
    horror,
  ] = await Promise.all([
    getTrendingMovies(),
    getPopularMovies(),
    getTopRatedMovies(),
    getNowPlayingMovies(),
    getUpcomingMovies(),
    getActionMovies(),
    getComedyMovies(),
    getDramaMovies(),
    getHorrorMovies(),
  ]);

  return (
    <CatalogClient
      pageTitle="Películas"
      subtitle="Estrenos, clásicos y lo más visto del momento."
      featured={trending}
      defaultMediaType="movie"
      rows={[
        { title: "Tendencias de la semana", items: trending },
        { title: "Populares en StyleFlix", items: popular },
        { title: "En cartelera", items: nowPlaying },
        { title: "Mejor valoradas", items: topRated },
        { title: "Próximamente", items: upcoming },
        { title: "Acción", items: action },
        { title: "Comedia", items: comedy },
        { title: "Drama", items: drama },
        { title: "Terror", items: horror },
      ]}
    />
  );
}
