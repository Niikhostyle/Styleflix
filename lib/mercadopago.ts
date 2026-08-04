/**
 * Mercado Pago Subscriptions (preapproval) — Chile / CLP.
 * Docs: https://www.mercadopago.cl/developers/es/docs/subscriptions/overview
 *
 * Coolify / .env:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   (ojo: APP_USR, no APP_USER)
 *   NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
 *   MERCADOPAGO_MODE=test|production
 *   MERCADOPAGO_TEST_PAYER_EMAIL=email del comprador de prueba (obligatorio en test)
 *   MERCADOPAGO_WEBHOOK_SECRET=... (opcional)
 *   MEMBERSHIP_PRICE_CLP=4990
 *   AUTH_URL=https://veotv.cloud
 */

import { createHmac } from "crypto";
import { MEMBERSHIP_PRICE_CLP } from "@/lib/access";

const MP_API = "https://api.mercadopago.com";

export type MpPreapproval = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
  status?: string;
  external_reference?: string;
  payer_id?: number;
  next_payment_date?: string;
  auto_recurring?: {
    transaction_amount?: number;
    currency_id?: string;
    frequency?: number;
    frequency_type?: string;
  };
};

/** Corrige typo frecuente APP_USER → APP_USR */
export function normalizeMpAccessToken(raw?: string | null): string {
  const t = (raw || "").trim();
  if (!t) return "";
  if (t.startsWith("APP_USER-")) {
    console.warn(
      "[mercadopago] Token empieza con APP_USER-; se corrige a APP_USR-."
    );
    return `APP_USR-${t.slice("APP_USER-".length)}`;
  }
  return t;
}

export function isMercadoPagoTestMode(): boolean {
  const mode = (process.env.MERCADOPAGO_MODE || "").trim().toLowerCase();
  if (mode === "production" || mode === "prod") return false;
  if (mode === "test" || mode === "sandbox") return true;
  return Boolean(process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim());
}

function accessToken() {
  const t = normalizeMpAccessToken(process.env.MERCADOPAGO_ACCESS_TOKEN);
  if (!t) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN");
  return t;
}

function publicBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function membershipAmount(): number {
  return MEMBERSHIP_PRICE_CLP;
}

/** Email que debe ir a MP: en test, el comprador de prueba. */
export function resolvePayerEmail(accountEmail: string): string {
  if (isMercadoPagoTestMode()) {
    const testEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim();
    if (!testEmail) {
      throw new Error(
        "Modo test: configura MERCADOPAGO_TEST_PAYER_EMAIL con el email del comprador de prueba (Cuentas de prueba → Comprador)."
      );
    }
    return testEmail.toLowerCase();
  }
  return accountEmail.toLowerCase().trim();
}

async function mpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
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
    throw new Error(`Mercado Pago ${res.status}: ${msg}`);
  }

  return data as T;
}

/** Crea suscripción mensual y devuelve URL de checkout. */
export async function createMembershipPreapproval(opts: {
  userId: string;
  payerEmail: string;
}): Promise<MpPreapproval> {
  const amount = membershipAmount();
  const backUrl = `${publicBaseUrl()}/membresia?status=ok`;
  const payerEmail = resolvePayerEmail(opts.payerEmail);

  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "VeoTV Mensual",
      external_reference: opts.userId,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "CLP",
      },
      back_url: backUrl,
      status: "pending",
    }),
  });
}

export async function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`);
}

export async function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: "PUT",
    body: JSON.stringify({ status: "cancelled" }),
  });
}

export function checkoutUrl(preapproval: MpPreapproval): string {
  if (isMercadoPagoTestMode()) {
    return preapproval.sandbox_init_point || preapproval.init_point || "";
  }
  return preapproval.init_point || preapproval.sandbox_init_point || "";
}

/** Validación básica de webhook (si hay secret configurado). */
export function verifyWebhookSignature(request: Request): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  if (!xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k.trim(), (v || "").trim()];
    })
  );
  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") || "";
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  return computed === hash;
}
