import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueAuthToken } from "@/lib/auth-tokens";
import { isMailConfigured, sendEmailVerification } from "@/lib/mail";

const registerSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Datos inválidos. Nombre (mín. 2), email y contraseña (mín. 6).",
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 10);
    const mailReady = isMailConfigured();

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        role: "USER",
        subscriptionStatus: "NONE",
        planSource: "DIRECT",
        emailVerified: mailReady ? null : new Date(),
      },
      select: { id: true, email: true, name: true },
    });

    if (mailReady) {
      const { raw } = await issueAuthToken({
        userId: user.id,
        type: "EMAIL_VERIFY",
        ttlHours: 24,
      });
      const mail = await sendEmailVerification({
        to: user.email,
        name: user.name,
        token: raw,
      });
      if (!mail.ok) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
        return NextResponse.json(
          {
            error:
              "No se pudo enviar el correo de confirmación. Intenta de nuevo en unos minutos.",
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        {
          ok: true,
          needsVerification: true,
          message:
            "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja y spam.",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        needsVerification: false,
        message: "Cuenta creada. Ya puedes iniciar sesión.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta." },
      { status: 500 }
    );
  }
}
