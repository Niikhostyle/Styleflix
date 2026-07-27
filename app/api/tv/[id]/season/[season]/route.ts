import { NextResponse } from "next/server";
import { getTVSeason } from "@/lib/tmdb";

interface RouteParams {
  params: Promise<{ id: string; season: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id, season } = await params;
  const tvId = Number(id);
  const seasonNumber = Number(season);

  if (!tvId || !seasonNumber || seasonNumber < 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const data = await getTVSeason(tvId, seasonNumber);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la temporada", episodes: [] },
      { status: 500 }
    );
  }
}
