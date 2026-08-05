import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  checkoutUrl,
  createAuthorizedMembershipPreapproval,
  createMembershipPreapproval,
} from "@/lib/mercadopago";
import {
  activateMembership,
  markSubscriptionStatus,
} from "@/lib/membership";

const bodySchema = z.object({
  cardTokenId: z.string().min(8).optional(),
  /** Si true y no hay token, usa redirect legacy a MP */
  redirect: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "El admin no necesita pagar." },
      { status: 400 }
    );
  }

  if (
    hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json(
      { error: "Ya tienes membresía activa." },
      { status: 400 }
    );
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor." },
      { status: 503 }
    );
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const cardTokenId = parsed.success ? parsed.data.cardTokenId : undefined;
  const forceRedirect = parsed.success && parsed.data.redirect === true;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    // Checkout API (en sitio): token de tarjeta → suscripción authorized
    if (cardTokenId && !forceRedirect) {
      const preapproval = await createAuthorizedMembershipPreapproval({
        userId: user.id,
        payerEmail: user.email,
        cardTokenId,
      });

      const status = (preapproval.status || "").toLowerCase();
      if (status === "authorized" || status === "active") {
        await activateMembership({
          userId: user.id,
          months: 1,
          mpPreapprovalId: preapproval.id,
          payment: {
            externalId: preapproval.id,
            status: "subscription_authorized",
            rawPayload: preapproval as object,
          },
        });
        return NextResponse.json({
          ok: true,
          activated: true,
          preapprovalId: preapproval.id,
          status: preapproval.status,
        });
      }

      await markSubscriptionStatus(user.id, "PENDING", {
        mpPreapprovalId: preapproval.id,
      });
      return NextResponse.json({
        ok: true,
        activated: false,
        pending: true,
        preapprovalId: preapproval.id,
        status: preapproval.status,
        message:
          "Pago en revisión. En unos segundos pulsa «Actualizar estado».",
      });
    }

    // Fallback: redirect a checkout de Mercado Pago
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
    const raw = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: friendlyMpError(raw) }, { status: 500 });
  }
}

/** Traduce los errores más comunes de Mercado Pago. */
function friendlyMpError(raw: string): string {
  if (!raw) return "No se pudo iniciar el pago.";
  if (
    raw.includes("same user") ||
    raw.includes("Payer and collector") ||
    raw.includes("del Vendedor")
  ) {
    return "El pagador de prueba es el mismo que el cobrador (Vendedor). En Coolify cambia MERCADOPAGO_TEST_PAYER_USER al TESTUSER del Comprador (Cuentas de prueba → Comprador), no el de «Datos de las credenciales».";
  }
  if (raw.includes("cardholder.document")) {
    return "El RUT no es válido. Usa uno con dígito verificador, por ejemplo 12345678-5 (no 123456789).";
  }
  if (raw.includes("without cvv validation")) {
    return "Falta el código de seguridad (CVV) de la tarjeta. Complétalo e intenta de nuevo.";
  }
  if (raw.includes("real or test users")) {
    return "El pagador y el cobrador deben ser ambos de prueba o ambos reales. Revisa MERCADOPAGO_MODE y las credenciales.";
  }
  if (raw.includes("Invalid card_token_id") || raw.includes("card_token")) {
    return "La tarjeta no se pudo validar. Verifica los datos e intenta nuevamente.";
  }
  return raw;
}
