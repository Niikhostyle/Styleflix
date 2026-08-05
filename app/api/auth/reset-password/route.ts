import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { sendPasswordChangedNotice } from "@/lib/mail";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(6).max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Token o contraseña inválidos (mín. 6 caracteres)." },
        { status: 400 }
      );
    }

    const user = await consumeAuthToken({
      raw: parsed.data.token,
      type: "PASSWORD_RESET",
    });

    if (!user) {
      return NextResponse.json(
        { error: "El enlace no es válido o ya expiró. Solicita uno nuevo." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Si restablece, también marcamos el correo como verificado
        emailVerified: user.emailVerified ?? new Date(),
      },
    });

    void sendPasswordChangedNotice({
      to: user.email,
      name: user.name,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      message: "Contraseña actualizada. Ya puedes iniciar sesión.",
    });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { error: "No se pudo restablecer la contraseña." },
      { status: 500 }
    );
  }
}
