import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";
import {
  getActionMovies,
  getAnimeMovies,
  getPopularAnime,
  getPopularMovies,
  getPopularSeries,
  getTopRatedMovies,
  getTrendingMovies,
  getTrendingSeries,
} from "@/lib/tmdb";

/** Filas críticas: hero + lo que se ve al entrar. */
async function getCriticalCatalog() {
  const [trendingMovies, popularMovies, popularSeries, popularAnime] =
    await Promise.all([
      getTrendingMovies(),
      getPopularMovies(),
      getPopularSeries(),
      getPopularAnime(),
    ]);
  return { trendingMovies, popularMovies, popularSeries, popularAnime };
}

/** Filas secundarias: se hidratan en paralelo sin bloquear el primer paint. */
async function getSecondaryCatalog() {
  const [topRatedMovies, actionMovies, trendingSeries, animeMovies] =
    await Promise.all([
      getTopRatedMovies(),
      getActionMovies(),
      getTrendingSeries(),
      getAnimeMovies(),
    ]);
  return { topRatedMovies, actionMovies, trendingSeries, animeMovies };
}

async function HomeShell() {
  const critical = await getCriticalCatalog();
  const featured =
    critical.trendingMovies[0] ??
    critical.popularMovies[0] ??
    critical.popularSeries[0];

  if (!featured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414] text-white">
        No hay títulos para mostrar.
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <HomeClient
          featured={featured}
          trendingMovies={critical.trendingMovies}
          popularMovies={critical.popularMovies}
          popularSeries={critical.popularSeries}
          popularAnime={critical.popularAnime}
          topRatedMovies={[]}
          actionMovies={[]}
          trendingSeries={[]}
          animeMovies={[]}
        />
      }
    >
      <HomeWithSecondary critical={critical} featured={featured} />
    </Suspense>
  );
}

async function HomeWithSecondary({
  critical,
  featured,
}: {
  critical: Awaited<ReturnType<typeof getCriticalCatalog>>;
  featured: NonNullable<
    Awaited<ReturnType<typeof getCriticalCatalog>>["trendingMovies"][0]
  >;
}) {
  const secondary = await getSecondaryCatalog();

  return (
    <HomeClient
      featured={featured}
      trendingMovies={critical.trendingMovies}
      popularMovies={critical.popularMovies}
      popularSeries={critical.popularSeries}
      popularAnime={critical.popularAnime}
      topRatedMovies={secondary.topRatedMovies}
      actionMovies={secondary.actionMovies}
      trendingSeries={secondary.trendingSeries}
      animeMovies={secondary.animeMovies}
    />
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#141414] text-neutral-400">
          Cargando StyleFlix…
        </div>
      }
    >
      <HomeShell />
    </Suspense>
  );
}
