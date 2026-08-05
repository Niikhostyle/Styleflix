import { NextResponse } from "next/server";
import { getPricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPricing(), {
    headers: { "Cache-Control": "no-store" },
  });
}
