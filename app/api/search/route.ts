import { NextResponse } from "next/server";
import { searchMulti } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await searchMulti(q);
    return NextResponse.json({ items: items.slice(0, 24) });
  } catch {
    return NextResponse.json(
      { error: "No se pudo buscar", items: [] },
      { status: 500 }
    );
  }
}
