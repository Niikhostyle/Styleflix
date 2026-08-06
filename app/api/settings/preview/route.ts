import { NextResponse } from "next/server";
import {
  formatDemoDuration,
  getDemoCatalogMinutes,
  getDownloadsEnabled,
} from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Flags públicos de la app (sin secretos). */
export async function GET() {
  const [downloadsEnabled, demoCatalogMinutes] = await Promise.all([
    getDownloadsEnabled(),
    getDemoCatalogMinutes(),
  ]);
  return NextResponse.json(
    {
      previewMinutes: 0,
      downloadsEnabled,
      demoCatalogMinutes,
      demoLabel: formatDemoDuration(demoCatalogMinutes),
      demoEnabled: demoCatalogMinutes > 0,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
