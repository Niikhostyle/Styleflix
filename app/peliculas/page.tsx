import CatalogClient from "@/components/CatalogClient";
import { getVimeusMovies } from "@/lib/vimeus";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Películas | StyleFlix",
  description: "Películas disponibles para reproducir en StyleFlix",
};

export default async function PeliculasPage() {
  const [page1, page2, page3] = await Promise.all([
    getVimeusMovies([1]),
    getVimeusMovies([2]),
    getVimeusMovies([3]),
  ]);

  const featured = [...page1, ...page2];

  return (
    <CatalogClient
      pageTitle="Películas"
      subtitle="Solo títulos con stream disponible en Vimeus."
      featured={featured}
      defaultMediaType="movie"
      rows={[
        { title: "Recién sincronizadas", items: page1 },
        { title: "Más películas", items: page2 },
        { title: "Seguir explorando", items: page3 },
      ]}
    />
  );
}
