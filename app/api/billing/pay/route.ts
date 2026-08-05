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

    const amount = membershipAmount();
    const payerIn = (formData.payer || {}) as Record<string, unknown>;

    const payment = await createPayment({
      transaction_amount: amount,
      token,
      description: "VeoTV Mensual",
      installments: Number(formData.installments) || 1,
      payment_method_id: formData.payment_method_id,
      issuer_id: formData.issuer_id,
      external_reference: user.id,
      binary_mode: true,
      payer: {
        email: payerEmail,
        identification: payerIn.identification,
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
        error: `Pago ${payment.status || "rechazado"}: ${
          payment.status_detail || "intenta con otra tarjeta de prueba (titular APRO)."
        }`,
        paymentId: payment.id,
        status: payment.status,
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
