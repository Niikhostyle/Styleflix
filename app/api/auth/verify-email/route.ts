import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/auth-tokens";

const schema = z.object({
  token: z.string().min(20),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Token inválido." },
        { status: 400 }
      );
    }

    const user = await consumeAuthToken({
      raw: parsed.data.token,
      type: "EMAIL_VERIFY",
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "El enlace de confirmación no es válido o ya expiró. Regístrate de nuevo o solicita ayuda.",
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({
      ok: true,
      message: "Correo confirmado. Ya puedes iniciar sesión.",
      email: user.email,
    });
  } catch (err) {
    console.error("[verify-email]", err);
    return NextResponse.json(
      { error: "No se pudo verificar el correo." },
      { status: 500 }
    );
  }
}
