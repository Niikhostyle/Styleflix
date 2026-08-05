import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Preview desactivado (paywall duro). */
export async function GET() {
  return NextResponse.json(
    { previewMinutes: 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
