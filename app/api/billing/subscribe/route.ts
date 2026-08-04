import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  checkoutUrl,
  createMembershipPreapproval,
} from "@/lib/mercadopago";
import { markSubscriptionStatus } from "@/lib/membership";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "El admin no necesita pagar." }, { status: 400 });
  }

  if (
    hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json({ error: "Ya tienes membresía activa." }, { status: 400 });
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor." },
      { status: 503 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const preapproval = await createMembershipPreapproval({
      userId: user.id,
      payerEmail: user.email,
    });

    await markSubscriptionStatus(user.id, "PENDING", {
      mpPreapprovalId: preapproval.id,
    });

    const url = checkoutUrl(preapproval);
    if (!url) {
      return NextResponse.json(
        { error: "No se obtuvo URL de checkout de Mercado Pago." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      init_point: url,
      preapprovalId: preapproval.id,
    });
  } catch (err) {
    console.error("[billing/subscribe]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "No se pudo iniciar el pago.",
      },
      { status: 500 }
    );
  }
}
