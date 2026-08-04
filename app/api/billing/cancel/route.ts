import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cancelPreapproval } from "@/lib/mercadopago";
import { markSubscriptionStatus } from "@/lib/membership";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  try {
    if (user.mpPreapprovalId && process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
      try {
        await cancelPreapproval(user.mpPreapprovalId);
      } catch (err) {
        console.warn("[billing/cancel] MP cancel failed", err);
      }
    }

    // Conserva currentPeriodEnd: acceso hasta fin de ciclo
    await markSubscriptionStatus(user.id, "CANCELLED");

    return NextResponse.json({
      ok: true,
      message:
        "Suscripción cancelada. Conservas el acceso hasta el fin del periodo pagado.",
      currentPeriodEnd: user.currentPeriodEnd,
    });
  } catch (err) {
    console.error("[billing/cancel]", err);
    return NextResponse.json(
      { error: "No se pudo cancelar la suscripción." },
      { status: 500 }
    );
  }
}
