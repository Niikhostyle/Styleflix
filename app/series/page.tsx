import CatalogClient from "@/components/CatalogClient";
import { getVimeusSeries } from "@/lib/vimeus";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Series | StyleFlix",
  description: "Series disponibles para reproducir en StyleFlix",
};

export default async function SeriesPage() {
  const [page1, page2, page3] = await Promise.all([
    getVimeusSeries([1]),
    getVimeusSeries([2]),
    getVimeusSeries([3]),
  ]);

  const featured = [...page1, ...page2];

  return (
    <CatalogClient
      pageTitle="Series"
      subtitle="Solo series con stream disponible en Vimeus."
      featured={featured}
      defaultMediaType="tv"
      rows={[
        { title: "Recién sincronizadas", items: page1, mediaType: "tv" },
        { title: "Más series", items: page2, mediaType: "tv" },
        { title: "Seguir explorando", items: page3, mediaType: "tv" },
      ]}
    />
  );
}
