import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  repairPlanEntitlements,
  syncMembershipFromMercadoPago,
} from "@/lib/membership";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** payment_id / collection_id que Mercado Pago agrega al volver del checkout */
  paymentId: z.string().min(1).optional(),
});

/**
 * Confirma con la API de Mercado Pago si el usuario tiene un pago approved
 * y solo entonces activa la membresía. Nunca confía solo en ?status=ok de la URL.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({
      ok: true,
      activated: true,
      alreadyActive: true,
      message: "Admin: membresía incluida.",
    });
  }

  const userId = session.user.id;
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      planTier: true,
      planPeriod: true,
      planMaxProfiles: true,
      planMaxResolution: true,
      planFeatures: true,
    },
  });

  if (
    hasActiveMembership({
      role: dbUser?.role || session.user.role,
      subscriptionStatus:
        dbUser?.subscriptionStatus || session.user.subscriptionStatus,
      currentPeriodEnd:
        dbUser?.currentPeriodEnd?.toISOString() ||
        session.user.currentPeriodEnd,
    })
  ) {
    // Ya activo: reparar perfiles/features si faltan (pagos viejos o sync incompleto)
    let u = dbUser;
    if (!u?.planMaxProfiles || !u?.planTier) {
      u = (await repairPlanEntitlements(userId)) as typeof dbUser;
    }
    return NextResponse.json({
      ok: true,
      activated: true,
      alreadyActive: true,
      message: "Ya tienes membresía activa.",
      planTier: u?.planTier ?? null,
      planPeriod: u?.planPeriod ?? null,
      planMaxProfiles: u?.planMaxProfiles ?? null,
      planMaxResolution: u?.planMaxResolution ?? null,
    });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const paymentId = parsed.success ? parsed.data.paymentId : undefined;

  try {
    const result = await syncMembershipFromMercadoPago({
      userId,
      paymentId,
    });

    if (!result.activated) {
      return NextResponse.json(
        {
          ok: false,
          activated: false,
          error: result.reason,
          status: result.status,
        },
        { status: 402 }
      );
    }

    return NextResponse.json({
      ok: true,
      activated: true,
      alreadyActive: Boolean(result.alreadyActive),
      paymentId: result.paymentId,
      planTier: result.planTier ?? null,
      planPeriod: result.planPeriod ?? null,
      planMaxProfiles: result.planMaxProfiles ?? null,
      planMaxResolution: result.planMaxResolution ?? null,
      message: result.alreadyActive
        ? "Pago ya registrado. Membresía activa."
        : "¡Pago confirmado! Membresía activada.",
    });
  } catch (err) {
    console.error("[billing/sync]", err);
    return NextResponse.json(
      { error: "No se pudo verificar el pago con Mercado Pago." },
      { status: 500 }
    );
  }
}
