import { NextResponse } from "next/server";
import { getPricing } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const pricing = await getPricing();
  return NextResponse.json(pricing, {
    headers: { "Cache-Control": "no-store" },
  });
}
