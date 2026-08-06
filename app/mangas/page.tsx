import MangaCatalogClient from "@/components/MangaCatalogClient";
import { getMangaCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mangas | VeoTV",
  description: "Mangas populares en español — lectura en VeoTV",
};

export default async function MangasPage() {
  const { featured, rows } = await getMangaCatalog();

  return <MangaCatalogClient featured={featured} rows={rows} />;
}
