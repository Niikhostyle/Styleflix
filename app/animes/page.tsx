import CatalogClient from "@/components/CatalogClient";
import { enrichWithTmdb, getVimeusAnimes } from "@/lib/vimeus";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Animes | StyleFlix",
  description: "Animes disponibles para reproducir en StyleFlix",
};

export default async function AnimesPage() {
  const [page1, page2, page3] = await Promise.all([
    getVimeusAnimes([1]),
    getVimeusAnimes([2]),
    getVimeusAnimes([3]),
  ]);

  const featured = [...page1, ...page2];
  if (featured[0]) {
    featured[0] = await enrichWithTmdb(featured[0]);
  }

  return (
    <CatalogClient
      pageTitle="Animes"
      subtitle="Solo animes con stream disponible en Vimeus."
      featured={featured}
      defaultMediaType="tv"
      rows={[
        { title: "Recién sincronizados", items: page1, mediaType: "tv" },
        { title: "Más animes", items: page2, mediaType: "tv" },
        { title: "Seguir explorando", items: page3, mediaType: "tv" },
      ]}
    />
  );
}
