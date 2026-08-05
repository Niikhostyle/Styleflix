import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthToken } from "@/lib/auth-tokens";
import { isMailConfigured, sendPasswordReset } from "@/lib/mail";

const schema = z.object({
  email: z.string().email(),
});

/**
 * Siempre responde OK para no filtrar si el email existe.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  const generic = {
    ok: true,
    message:
      "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.",
  };

  if (!parsed.success) {
    return NextResponse.json(generic);
  }

  if (!isMailConfigured()) {
    return NextResponse.json(
      {
        error:
          "El restablecimiento por correo no está configurado. Contacta soporte.",
      },
      { status: 503 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    try {
      const { raw } = await issueAuthToken({
        userId: user.id,
        type: "PASSWORD_RESET",
        ttlHours: 1,
      });
      await sendPasswordReset({
        to: user.email,
        name: user.name,
        token: raw,
      });
    } catch (err) {
      console.error("[forgot-password]", err);
    }
  }

  return NextResponse.json(generic);
}
