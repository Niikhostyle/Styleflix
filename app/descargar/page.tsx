import { existsSync } from "node:fs";
import path from "node:path";
import DescargarAppsClient from "@/components/DescargarAppsClient";
import { getPopularCatalogPosters } from "@/lib/catalog";
import { getDownloadsEnabled } from "@/lib/settings";

export const metadata = {
  title: "Descargar app | VeoTV",
  description: "Instala VeoTV en celular Android o Android TV",
};

export const dynamic = "force-dynamic";

function apkExists(filename: string) {
  return existsSync(path.join(process.cwd(), "public", "downloads", filename));
}

export default async function DescargarPage() {
  const [enabled, posterUrls] = await Promise.all([
    getDownloadsEnabled(),
    getPopularCatalogPosters(28).catch(() => [] as string[]),
  ]);

  return (
    <DescargarAppsClient
      enabled={enabled}
      celularOk={apkExists("veotv-celular.apk")}
      tvOk={apkExists("veotv-tv.apk")}
      posterUrls={posterUrls}
      celularVersion="1.5.0"
      tvVersion="1.3.0"
    />
  );
}
