import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendTitleRequestNotice } from "@/lib/mail";

const bodySchema = z.object({
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.coerce.number().int().positive(),
  title: z.string().min(1).max(200),
  year: z
    .union([z.coerce.number().int().min(1900).max(2100), z.null(), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null || Number.isNaN(v as number) ? null : Number(v))),
  note: z.string().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // Entitlement desde DB (el JWT puede estar desfasado tras cambiar de plan)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, planFeatures: true },
  });
  const features =
    dbUser?.planFeatures &&
    typeof dbUser.planFeatures === "object" &&
    !Array.isArray(dbUser.planFeatures)
      ? (dbUser.planFeatures as { canRequest?: boolean })
      : null;
  const canRequest =
    dbUser?.role === "SUPER_ADMIN" ||
    session.user.role === "SUPER_ADMIN" ||
    Boolean(features?.canRequest) ||
    Boolean(session.user.planCanRequest);
  if (!canRequest) {
    return NextResponse.json(
      { error: "Tu plan no permite solicitar títulos. Actualiza a Premium o Plus." },
      { status: 403 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Datos inválidos.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const row = await prisma.titleRequest.upsert({
      where: {
        userId_mediaType_tmdbId: {
          userId: session.user.id,
          mediaType: data.mediaType,
          tmdbId: data.tmdbId,
        },
      },
      create: {
        userId: session.user.id,
        mediaType: data.mediaType,
        tmdbId: data.tmdbId,
        title: data.title.trim(),
        year: data.year ?? null,
        note: data.note?.trim() || null,
        status: "PENDING",
      },
      update: {
        title: data.title.trim(),
        year: data.year ?? null,
        note: data.note?.trim() || null,
        status: "PENDING",
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { email: true },
      take: 10,
    });
    const notifyExtra = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    const recipients = new Set(
      admins.map((a) => a.email.toLowerCase()).filter(Boolean)
    );
    if (notifyExtra) recipients.add(notifyExtra.toLowerCase());

    await Promise.all(
      [...recipients].map((to) =>
        sendTitleRequestNotice({
          to,
          requesterName: session.user.name || "Usuario",
          requesterEmail: session.user.email || "",
          title: data.title.trim(),
          mediaType: data.mediaType,
          tmdbId: data.tmdbId,
          year: data.year,
        }).catch((err) => {
          console.error("[title-request mail]", to, err);
        })
      )
    );

    return NextResponse.json({
      ok: true,
      item: row,
      message:
        "Solicitud enviada. El equipo la verá en Solicitudes del panel admin" +
        (process.env.SMTP_HOST ? " y por correo." : "."),
    });
  } catch (err) {
    console.error("[api/requests]", err);
    const msg = String(err);
    if (
      msg.includes("TitleRequest") ||
      msg.includes("does not exist") ||
      msg.includes("P2021")
    ) {
      return NextResponse.json(
        {
          error:
            "La tabla de solicitudes aún no está creada. Redeploy / prisma db push en el servidor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "No se pudo registrar la solicitud." },
      { status: 500 }
    );
  }
}
