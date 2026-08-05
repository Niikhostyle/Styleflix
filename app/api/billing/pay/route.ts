import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  assertPayerNotCollector,
  membershipAmount,
  normalizeMpAccessToken,
  resolvePayerEmail,
} from "@/lib/mercadopago";
import { activateMembership } from "@/lib/membership";

const MP_API = "https://api.mercadopago.com";

type MpPayment = {
  id: number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string;
};

function friendlyStatusDetail(detail: string | undefined): string {
  switch ((detail || "").toLowerCase()) {
    case "cc_rejected_high_risk":
      return "Mercado Pago rechazó el pago por seguridad (alto riesgo). Espera unos minutos, usa otra tarjeta o paga con la redirección a Mercado Pago. No reintentes enseguida con los mismos datos.";
    case "cc_rejected_insufficient_amount":
      return "Fondos insuficientes en la tarjeta.";
    case "cc_rejected_bad_filled_security_code":
      return "El código de seguridad (CVV) es incorrecto.";
    case "cc_rejected_bad_filled_date":
      return "La fecha de vencimiento es incorrecta.";
    case "cc_rejected_bad_filled_other":
      return "Revisa los datos de la tarjeta e intenta de nuevo.";
    case "cc_rejected_call_for_authorize":
      return "Debes autorizar el pago con tu banco e intentar de nuevo.";
    case "cc_rejected_duplicated_payment":
      return "Pago duplicado. Revisa si el cobro ya se hizo antes de reintentar.";
    case "cc_rejected_blacklist":
      return "La tarjeta no puede usarse en este comercio. Prueba otro medio de pago.";
    case "cc_rejected_other_reason":
      return "El banco rechazó el pago. Prueba otra tarjeta o contacta a tu banco.";
    case "cc_rejected_max_attempts":
      return "Demasiados intentos con esta tarjeta. Espera o usa otra.";
    default:
      return detail
        ? `Pago rechazado (${detail}). Prueba otra tarjeta o el pago por redirección.`
        : "Pago rechazado. Prueba otra tarjeta o el pago por redirección.";
  }
}

async function createPayment(body: Record<string, unknown>): Promise<MpPayment> {
  const token = normalizeMpAccessToken(process.env.MERCADOPAGO_ACCESS_TOKEN);
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN");

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : text || res.statusText;
    const causes =
      typeof data === "object" &&
      data &&
      "cause" in data &&
      Array.isArray((data as { cause: unknown }).cause)
        ? (data as { cause: Array<{ description?: string }> }).cause
            .map((c) => c.description)
            .filter(Boolean)
            .join("; ")
        : "";
    throw new Error(
      `Mercado Pago ${res.status}: ${msg}${causes ? ` (${causes})` : ""}`
    );
  }

  return data as MpPayment;
}

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

  const formData = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!formData || typeof formData !== "object") {
    return NextResponse.json({ error: "Datos de pago inválidos." }, { status: 400 });
  }

  const token = formData.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Falta el token de la tarjeta. Reintenta el pago." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    const payerEmail = resolvePayerEmail(user.email);
    await assertPayerNotCollector(payerEmail);

    const amount = await membershipAmount();
    const payerIn = (formData.payer || {}) as Record<string, unknown>;
    const nameParts = (user.name || "").trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || undefined;
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined;

    const payment = await createPayment({
      transaction_amount: amount,
      token,
      description: "VeoTV Mensual — acceso 30 días",
      statement_descriptor: "VEOTV",
      installments: Number(formData.installments) || 1,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      external_reference: user.id,
      binary_mode: true,
      capture: true,
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: payerIn.identification,
      },
      additional_info: {
        items: [
          {
            id: "veotv-mensual",
            title: "VeoTV Mensual",
            description: "Membresía streaming VeoTV 30 días",
            category_id: "services",
            quantity: 1,
            unit_price: amount,
          },
        ],
        payer: {
          first_name: firstName,
          last_name: lastName,
        },
      },
      metadata: {
        user_id: user.id,
        product: "veotv_mensual",
      },
    });

    const status = (payment.status || "").toLowerCase();

    if (status === "approved") {
      await activateMembership({
        userId: user.id,
        months: 1,
        payment: {
          externalId: String(payment.id),
          status: "approved",
          amount: payment.transaction_amount ?? amount,
          rawPayload: payment as object,
        },
      });
      return NextResponse.json({
        ok: true,
        activated: true,
        paymentId: payment.id,
        status: payment.status,
      });
    }

    if (status === "in_process" || status === "pending") {
      return NextResponse.json({
        ok: true,
        activated: false,
        pending: true,
        paymentId: payment.id,
        status: payment.status,
        message: "Pago en revisión. Pulsa «Actualizar estado» en unos segundos.",
      });
    }

    return NextResponse.json(
      {
        error: friendlyStatusDetail(payment.status_detail),
        paymentId: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
      },
      { status: 402 }
    );
  } catch (err) {
    console.error("[billing/pay]", err);
    const raw = err instanceof Error ? err.message : "No se pudo procesar el pago.";
    let msg = raw;
    if (raw.includes("same user") || raw.includes("Vendedor")) {
      msg =
        "MERCADOPAGO_TEST_PAYER_USER debe ser el Comprador (TESTUSER7529…), no el Vendedor (TESTUSER1232…).";
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
