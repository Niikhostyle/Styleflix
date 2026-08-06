/**
 * Mercado Pago Subscriptions (preapproval) — Chile / CLP.
 * Docs: https://www.mercadopago.cl/developers/es/docs/subscriptions/overview
 *
 * Coolify / .env:
 *   MERCADOPAGO_ACCESS_TOKEN=APP_USR-...   (ojo: APP_USR, no APP_USER)
 *   NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-...
 *   MERCADOPAGO_MODE=test|production
 *   MERCADOPAGO_TEST_PAYER_USER=TESTUSER… (Comprador) — el panel no muestra email
 *   MERCADOPAGO_TEST_PAYER_EMAIL=opcional si ya conoces test_user_…@testuser.com
 *   MERCADOPAGO_WEBHOOK_SECRET=... (opcional)
 *   MEMBERSHIP_PRICE_CLP=5
 *   AUTH_URL=https://veotv.cloud
 */

import { createHmac } from "crypto";
import { getMembershipPriceClp } from "@/lib/settings";
import { MP_MIN_AMOUNT_CLP } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

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
  // Sin MODE explícito: si hay vars de test, asumimos sandbox
  return Boolean(
    process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() ||
      process.env.MERCADOPAGO_TEST_PAYER_USER?.trim()
  );
}

/**
 * El panel de MP solo muestra Usuario/clave; el email real es:
 *   TESTUSER1232723510 → test_user_1232723510@testuser.com
 */
export function testUserToEmail(usernameOrEmail: string): string {
  const raw = usernameOrEmail.trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();

  const upper = raw.toUpperCase();
  if (upper.startsWith("TESTUSER")) {
    const num = upper.slice("TESTUSER".length);
    if (num) return `test_user_${num}@testuser.com`;
  }
  if (/^\d+$/.test(raw)) {
    return `test_user_${raw}@testuser.com`;
  }
  return `${raw.toLowerCase()}@testuser.com`;
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

export async function membershipAmount(): Promise<number> {
  return getMembershipPriceClp();
}

/** Email que debe ir a MP: en test, el comprador de prueba (no el vendedor). */
export function resolvePayerEmail(accountEmail: string): string {
  if (isMercadoPagoTestMode()) {
    const explicit = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim();
    if (explicit) return testUserToEmail(explicit);

    const testUser = process.env.MERCADOPAGO_TEST_PAYER_USER?.trim();
    if (testUser) return testUserToEmail(testUser);

    throw new Error(
      "Modo test: el panel no muestra email. Pon MERCADOPAGO_TEST_PAYER_USER=TESTUSER… del Comprador (no del Vendedor)."
    );
  }
  return accountEmail.toLowerCase().trim();
}

/**
 * Evita el 400 "Payer and collector cannot be the same user".
 * El Access Token es del Vendedor; el pagador de prueba debe ser el Comprador.
 */
export async function assertPayerNotCollector(payerEmail: string) {
  const me = await mpFetch<{
    id: number;
    email?: string;
    nickname?: string;
  }>("/users/me");

  const payer = payerEmail.toLowerCase().trim();
  const collectorEmail = (me.email || "").toLowerCase().trim();
  const collectorNick = (me.nickname || "").toUpperCase().trim();
  const payerAsUser = process.env.MERCADOPAGO_TEST_PAYER_USER?.trim().toUpperCase();

  if (
    (collectorEmail && collectorEmail === payer) ||
    (collectorNick && payerAsUser && collectorNick === payerAsUser) ||
    (collectorNick &&
      payer === testUserToEmail(collectorNick).toLowerCase())
  ) {
    throw new Error(
      "Payer and collector cannot be the same user: MERCADOPAGO_TEST_PAYER_USER/EMAIL está usando el Vendedor. En Coolify pon el TESTUSER del Comprador (Cuentas de prueba → filtro Comprador), no el de las credenciales del Vendedor."
    );
  }
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

/** Crea suscripción mensual pendiente (checkout redirect legacy). */
export async function createMembershipPreapproval(opts: {
  userId: string;
  payerEmail: string;
}): Promise<MpPreapproval> {
  const amount = await membershipAmount();
  const backUrl = `${publicBaseUrl()}/membresia?status=ok`;
  const payerEmail = resolvePayerEmail(opts.payerEmail);
  await assertPayerNotCollector(payerEmail);

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

/**
 * Checkout API: suscripción autorizada en el sitio (sin redirección).
 * Requiere card_token_id generado con la Public Key (CardPayment / CardForm).
 */
export async function createAuthorizedMembershipPreapproval(opts: {
  userId: string;
  payerEmail: string;
  cardTokenId: string;
}): Promise<MpPreapproval> {
  const amount = await membershipAmount();
  const backUrl = `${publicBaseUrl()}/membresia?status=ok`;
  const payerEmail = resolvePayerEmail(opts.payerEmail);
  await assertPayerNotCollector(payerEmail);

  return mpFetch<MpPreapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "VeoTV Mensual",
      external_reference: opts.userId,
      payer_email: payerEmail,
      card_token_id: opts.cardTokenId,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "CLP",
      },
      back_url: backUrl,
      status: "authorized",
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

/**
 * Checkout Pro (preferencia) — alternativa cuando /preapproval falla con 500
 * en la cuenta (común si Suscripciones no está habilitada).
 * Soporta moneda local; si MP rechaza, el caller puede reintentar con CLP.
 */
export async function createMembershipPreference(opts: {
  userId: string;
  payerEmail: string;
  title?: string;
  amount: number;
  currencyId: string;
  amountClp: number;
  planTier: string;
  planPeriod: string;
  months: number;
  fxRate?: number;
  country?: string;
}): Promise<{ id: string; init_point?: string; sandbox_init_point?: string }> {
  const base = publicBaseUrl();
  const payerEmail = resolvePayerEmail(opts.payerEmail);
  const title = opts.title || "VeoTV Membresía";

  return mpFetch("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: `veotv-${opts.planTier}-${opts.planPeriod}`,
          title,
          quantity: 1,
          unit_price: opts.amount,
          currency_id: opts.currencyId,
        },
      ],
      payer: { email: payerEmail },
      external_reference: opts.userId,
      back_urls: {
        success: `${base}/onboarding/listo?status=ok`,
        failure: `${base}/onboarding/planes?status=failure`,
        pending: `${base}/onboarding/listo?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${base}/api/billing/webhook`,
      statement_descriptor: "VEOTV",
      metadata: {
        user_id: opts.userId,
        product: "veotv_plan",
        plan_tier: opts.planTier,
        plan_period: opts.planPeriod,
        months: opts.months,
        amount_clp: opts.amountClp,
        fx_rate: opts.fxRate ?? null,
        country: opts.country ?? null,
        charge_currency: opts.currencyId,
      },
    }),
  });
}

export function preferenceCheckoutUrl(pref: {
  init_point?: string;
  sandbox_init_point?: string;
}): string {
  if (isMercadoPagoTestMode()) {
    return pref.sandbox_init_point || pref.init_point || "";
  }
  return pref.init_point || pref.sandbox_init_point || "";
}

export type MpPaymentDetail = {
  id: number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  date_approved?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function getPayment(paymentId: string | number): Promise<MpPaymentDetail> {
  return mpFetch<MpPaymentDetail>(`/v1/payments/${paymentId}`);
}

/**
 * Busca el último pago aprobado de este usuario (external_reference = userId).
 * Usado al volver de Checkout Pro o al pulsar «Actualizar estado».
 */
export async function findLatestApprovedPaymentForUser(
  userId: string
): Promise<MpPaymentDetail | null> {
  const qs = new URLSearchParams({
    sort: "date_created",
    criteria: "desc",
    external_reference: userId,
    range: "date_created",
    begin_date: "NOW-30DAYS",
    end_date: "NOW",
  });

  const data = await mpFetch<{ results?: MpPaymentDetail[] }>(
    `/v1/payments/search?${qs.toString()}`
  );

  const approved = (data.results || []).find(
    (p) => (p.status || "").toLowerCase() === "approved"
  );
  if (!approved?.id) return null;

  // El search a menudo omite metadata (plan_tier/months) → reconsultar el pago
  try {
    return await getPayment(approved.id);
  } catch {
    return approved;
  }
}

/**
 * Valida que un pago de MP corresponde a este usuario y está aprobado.
 * Acepta cobro en moneda local (metadata.amount_clp) o CLP legacy.
 * Si falta metadata, usa planTier/planPeriod PENDING del usuario + catálogo.
 */
export async function assertApprovedMembershipPayment(opts: {
  payment: MpPaymentDetail;
  userId: string;
}): Promise<
  | {
      ok: true;
      amount: number;
      currency: string;
      planTier?: string;
      planPeriod?: string;
      months: number;
      amountClp?: number;
    }
  | { ok: false; reason: string }
> {
  const status = (opts.payment.status || "").toLowerCase();
  if (status !== "approved") {
    return {
      ok: false,
      reason: `El pago aún no está aprobado (estado: ${opts.payment.status || "desconocido"}).`,
    };
  }

  const ref = (opts.payment.external_reference || "").trim();
  const metaUserId =
    opts.payment.metadata &&
    typeof opts.payment.metadata === "object" &&
    "user_id" in opts.payment.metadata
      ? String(
          (opts.payment.metadata as { user_id?: unknown }).user_id || ""
        ).trim()
      : "";
  const belongsToUser =
    (ref && ref === opts.userId) ||
    (metaUserId && metaUserId === opts.userId);
  if (!belongsToUser) {
    return {
      ok: false,
      reason:
        "El pago no está vinculado a esta cuenta (falta o no coincide external_reference).",
    };
  }
  if (ref && ref !== opts.userId) {
    return { ok: false, reason: "El pago no corresponde a esta cuenta." };
  }

  const amount = Number(opts.payment.transaction_amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Monto de pago inválido." };
  }

  const meta = (opts.payment.metadata || {}) as Record<string, unknown>;
  const amountClpMeta = Number(meta.amount_clp);
  const monthsMeta = Number(meta.months);
  const currency = String(
    opts.payment.currency_id || meta.charge_currency || "CLP"
  ).toUpperCase();

  // Fallback: plan elegido al crear la preferencia (User PENDING)
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { planTier: true, planPeriod: true },
  });
  const { getPlansCatalog } = await import("@/lib/settings");
  const { isPlanPeriod, isPlanTier, monthsForPeriod } = await import(
    "@/lib/plans"
  );
  const catalog = await getPlansCatalog();

  const planTierRaw = meta.plan_tier
    ? String(meta.plan_tier)
    : user?.planTier || undefined;
  const planPeriodRaw = meta.plan_period
    ? String(meta.plan_period)
    : user?.planPeriod || undefined;
  const planTier = isPlanTier(planTierRaw) ? planTierRaw : undefined;
  const planPeriod = isPlanPeriod(planPeriodRaw) ? planPeriodRaw : undefined;
  const months = monthsForPeriod(
    catalog,
    planPeriod,
    Number.isFinite(monthsMeta) && monthsMeta >= 1 ? monthsMeta : null
  );

  if (Number.isFinite(amountClpMeta) && amountClpMeta > 0) {
    if (amount + 0.01 < amountClpMeta * 0.01 && currency === "CLP") {
      return {
        ok: false,
        reason: `El monto pagado ($${amount}) es menor al plan ($${amountClpMeta} CLP).`,
      };
    }
    return {
      ok: true,
      amount,
      currency,
      planTier,
      planPeriod,
      months,
      amountClp: amountClpMeta,
    };
  }

  const expected = await membershipAmount();
  if (currency === "CLP" && amount + 0.01 < Math.min(expected, MP_MIN_AMOUNT_CLP)) {
    return {
      ok: false,
      reason: `El monto pagado ($${amount}) es menor al mínimo de membresía.`,
    };
  }

  return {
    ok: true,
    amount,
    currency,
    planTier,
    planPeriod,
    months,
    amountClp: currency === "CLP" ? amount : undefined,
  };
}

export function checkoutUrl(preapproval: MpPreapproval): string {
  if (isMercadoPagoTestMode()) {
    return preapproval.sandbox_init_point || preapproval.init_point || "";
  }
  return preapproval.init_point || preapproval.sandbox_init_point || "";
}

/**
 * Webhooks nuevos envían x-signature. IPN legacy no.
 * Si hay firma, la validamos. Si no hay firma, aceptamos (IPN / prueba MP).
 */
export function verifyWebhookSignature(request: Request): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return true;

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";

  // IPN / tests sin firma: no bloquear (activación igual exige pago approved en API).
  if (!xSignature) return true;

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
  // Webhooks usan data.id; IPN usa id.
  const dataId =
    url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  return computed === hash;
}
