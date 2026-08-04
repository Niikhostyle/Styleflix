/**
 * Mercado Pago Subscriptions (preapproval) — Chile / CLP.
 * Docs: https://www.mercadopago.cl/developers/es/docs/subscriptions/overview
 *
 * Coolify / .env:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
 *   MERCADOPAGO_WEBHOOK_SECRET=... (opcional, validación x-signature)
 *   MEMBERSHIP_PRICE_CLP=4990
 *   RESELLER_PRICE_CLP=2990  (cuentas admin; no pasa por este checkout)
 *   AUTH_URL=https://streaming.mublackstar.cl
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

function accessToken() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
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

  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "VeoTV Mensual",
      external_reference: opts.userId,
      payer_email: opts.payerEmail,
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
  const isProd = Boolean(
    process.env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("APP_USR-")
  );
  if (!isProd && preapproval.sandbox_init_point) {
    return preapproval.sandbox_init_point;
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
