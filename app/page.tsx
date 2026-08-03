import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";
import { enrichWithTmdb, getVimeusHomeCatalog } from "@/lib/vimeus";

export const dynamic = "force-dynamic";

async function HomeShell() {
  const catalog = await getVimeusHomeCatalog();
  const featuredRaw =
    catalog.movies[0] ?? catalog.series[0] ?? catalog.animes[0];

  if (!featuredRaw) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#141414] px-6 text-center text-white">
        <p className="text-lg font-semibold">No hay títulos de Vimeus</p>
        <p className="max-w-md text-sm text-neutral-400">
          Revisa <code className="text-neutral-200">VIMEUS_API_KEY</code> en
          Coolify (runtime) y vuelve a desplegar.
        </p>
      </div>
    );
  }

  const featured = await enrichWithTmdb(featuredRaw);

  return (
    <HomeClient
      featured={featured}
      trendingMovies={catalog.movies}
      popularMovies={catalog.moreMovies}
      popularSeries={catalog.series}
      popularAnime={catalog.animes}
      topRatedMovies={catalog.moreMovies}
      actionMovies={[]}
      trendingSeries={catalog.moreSeries}
      animeMovies={[]}
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
