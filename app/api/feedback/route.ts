import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendFeedbackNotice } from "@/lib/mail";

const bodySchema = z.object({
  category: z.enum(["DUDA", "QUEJA", "SUGERENCIA", "OTRO"]),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  message: z.string().trim().min(10).max(2000),
});

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Revisa los datos del formulario.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const session = await auth();
  const ip = clientIp(request);
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const recent = await prisma.feedback.count({
    where: {
      createdAt: { gte: since },
      OR: [
        ...(session?.user?.id ? [{ userId: session.user.id }] : []),
        { email: parsed.data.email.toLowerCase() },
        ...(ip ? [{ ip }] : []),
      ],
    },
  });

  if (recent >= 5) {
    return NextResponse.json(
      { error: "Ya enviaste varios mensajes. Espera un rato e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  try {
    const row = await prisma.feedback.create({
      data: {
        category: parsed.data.category,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        message: parsed.data.message,
        userId: session?.user?.id || null,
        ip,
      },
    });

    const adminEmail =
      process.env.FEEDBACK_NOTIFY_EMAIL ||
      process.env.ADMIN_NOTIFY_EMAIL ||
      process.env.SMTP_FROM ||
      "";
    if (adminEmail.includes("@")) {
      void sendFeedbackNotice({
        to: adminEmail,
        name: row.name,
        email: row.email,
        category: row.category,
        message: row.message,
      }).catch((err) => console.error("[feedback] mail", err));
    }

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("[feedback] create", err);
    return NextResponse.json(
      { error: "No se pudo guardar el mensaje. Inténtalo más tarde." },
      { status: 500 }
    );
  }
}
