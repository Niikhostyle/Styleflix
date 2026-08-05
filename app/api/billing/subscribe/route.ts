import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createAuthorizedMembershipPreapproval,
  createMembershipPreference,
  preferenceCheckoutUrl,
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
      try {
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
      } catch (preErr) {
        const msg = preErr instanceof Error ? preErr.message : "";
        // Suscripciones (/preapproval) a menudo responde 500 en cuentas sin el
        // producto habilitado. El Brick debe usar /api/billing/pay.
        if (msg.includes("500") || /Internal server error/i.test(msg)) {
          return NextResponse.json(
            {
              error:
                "Las suscripciones automáticas de Mercado Pago no están disponibles en esta cuenta. Usa el formulario de tarjeta (pago mensual) o contacta soporte MP.",
            },
            { status: 502 }
          );
        }
        throw preErr;
      }
    }

    // Redirect Checkout Pro (preferencia). Evitamos /preapproval: en esta cuenta
    // responde 500 Internal server error de forma consistente.
    const preference = await createMembershipPreference({
      userId: user.id,
      payerEmail: user.email,
    });
    await markSubscriptionStatus(user.id, "PENDING");
    const url = preferenceCheckoutUrl(preference);
    if (!url) {
      return NextResponse.json(
        { error: "No se obtuvo URL de Checkout Pro." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      init_point: url,
      preferenceId: preference.id,
      mode: "preference",
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
  if (raw.includes("lower than") || /amount lower than/i.test(raw)) {
    return "Mercado Pago rechazó el monto: en Chile exigen mínimo $950 CLP. Sube el precio en Admin → Ajustes.";
  }
  if (/Internal server error/i.test(raw) || raw.includes("500")) {
    return "Mercado Pago no pudo crear la suscripción (error interno). Prueba el pago con tarjeta en el sitio o Checkout Pro.";
  }
  return raw;
}
