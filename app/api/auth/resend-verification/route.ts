import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthToken } from "@/lib/auth-tokens";
import { isMailConfigured, sendEmailVerification } from "@/lib/mail";

const schema = z.object({
  email: z.string().email(),
});

/** Reenvía correo de verificación (sin filtrar existencia en el mensaje). */
export async function POST(request: Request) {
  const generic = {
    ok: true,
    message:
      "Si la cuenta existe y aún no está verificada, enviamos un nuevo correo.",
  };

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json(generic);

  if (!isMailConfigured()) {
    return NextResponse.json(
      { error: "Correo no configurado en el servidor." },
      { status: 503 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    try {
      const { raw } = await issueAuthToken({
        userId: user.id,
        type: "EMAIL_VERIFY",
        ttlHours: 24,
      });
      await sendEmailVerification({
        to: user.email,
        name: user.name,
        token: raw,
      });
    } catch (err) {
      console.error("[resend-verification]", err);
    }
  }

  return NextResponse.json(generic);
}
