import { NextResponse } from "next/server";
import { getDownloadsEnabled } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Flags públicos de la app (sin secretos). */
export async function GET() {
  const downloadsEnabled = await getDownloadsEnabled();
  return NextResponse.json(
    { previewMinutes: 0, downloadsEnabled },
    { headers: { "Cache-Control": "no-store" } }
  );
}
