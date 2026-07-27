import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  event: z.enum(["impression", "click", "complete", "skip"]),
  mediaId: z.number().optional(),
  mediaType: z.string().optional(),
  title: z.string().optional(),
  advertiser: z.string().optional(),
  url: z.string().optional(),
});

/**
 * Beacon de eventos de ads (impresión / click / complete / skip).
 * Por ahora solo registra en logs del servidor; luego se puede guardar en DB
 * o enviar a un ad-server.
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    console.info("[ads]", new Date().toISOString(), body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
}
