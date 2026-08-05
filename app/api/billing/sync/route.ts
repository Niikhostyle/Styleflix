import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { syncMembershipFromMercadoPago } from "@/lib/membership";

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

  if (
    hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json({
      ok: true,
      activated: true,
      alreadyActive: true,
      message: "Ya tienes membresía activa.",
    });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const paymentId = parsed.success ? parsed.data.paymentId : undefined;

  try {
    const result = await syncMembershipFromMercadoPago({
      userId: session.user.id,
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
