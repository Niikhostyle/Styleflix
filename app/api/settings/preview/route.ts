import { NextResponse } from "next/server";
import { getPreviewMinutes } from "@/lib/settings";

/** Público: minutos de preview sin membresía (para el player). */
export async function GET() {
  const previewMinutes = await getPreviewMinutes();
  return NextResponse.json(
    { previewMinutes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
