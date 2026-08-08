import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(254),
});

/**
 * ¿Existe ya una cuenta con este email?
 * Usado por landing / onboarding para mandar a login vs crear cuenta.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return NextResponse.json({ exists: Boolean(existing) });
  } catch (err) {
    console.error("[check-email]", err);
    return NextResponse.json(
      { error: "No se pudo verificar el email." },
      { status: 500 }
    );
  }
}
