import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  DEMO_CATALOG_MINUTES,
  hasActiveDemo,
  hasActiveMembership,
} from "@/lib/access";
import { prisma } from "@/lib/prisma";

/** Inicia (una sola vez) la demo de catálogo de 30 minutos. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (
    hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json({ ok: true, alreadyMember: true });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { demoExpiresAt: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  if (user.demoExpiresAt) {
    if (hasActiveDemo({ demoExpiresAt: user.demoExpiresAt, role: user.role })) {
      return NextResponse.json({
        ok: true,
        demoExpiresAt: user.demoExpiresAt.toISOString(),
        alreadyActive: true,
      });
    }
    return NextResponse.json(
      {
        error:
          "Ya usaste la demo gratuita. Elige un plan para seguir viendo VeoTV.",
      },
      { status: 403 }
    );
  }

  const demoExpiresAt = new Date(
    Date.now() + DEMO_CATALOG_MINUTES * 60_000
  );
  await prisma.user.update({
    where: { id: session.user.id },
    data: { demoExpiresAt },
  });

  return NextResponse.json({
    ok: true,
    demoExpiresAt: demoExpiresAt.toISOString(),
    minutes: DEMO_CATALOG_MINUTES,
  });
}
