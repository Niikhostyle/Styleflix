/**
 * Precios de membresía (tipos y helpers sync).
 *
 * Resolución efectiva en servidor (async): ver lib/settings.ts
 *   AppSetting (panel admin) → env MEMBERSHIP_PRICE_CLP / RESELLER_PRICE_CLP → defaults
 *
 * El cliente no lee env: recibe el precio vía PricingProvider / /api/pricing.
 */

export const DEFAULT_MEMBERSHIP_PRICE_CLP = 4990;
export const DEFAULT_RESELLER_PRICE_CLP = 2990;

/**
 * Mínimo real de Mercado Pago Chile para suscripciones (preapproval / MLC).
 * La API responde: "Cannot pay an amount lower than $ 950.00".
 * (El mínimo de medios de pago individuales puede ser menor; el de suscripciones no.)
 */
export const MP_MIN_AMOUNT_CLP = 950;

export type Pricing = {
  membershipPriceClp: number;
  resellerPriceClp: number;
};

export function parsePriceClp(raw: string | undefined, fallback: number): number {
  const value = Number((raw ?? "").trim());
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

/** Solo env (sin DB). Usado como fallback desde settings. */
export function envMembershipPriceClp(): number {
  return parsePriceClp(
    process.env.MEMBERSHIP_PRICE_CLP,
    DEFAULT_MEMBERSHIP_PRICE_CLP
  );
}

export function envResellerPriceClp(): number {
  return parsePriceClp(
    process.env.RESELLER_PRICE_CLP,
    DEFAULT_RESELLER_PRICE_CLP
  );
}

export function formatClp(amount: number): string {
  return amount.toLocaleString("es-CL");
}

export function membershipHint(membershipPriceClp: number): string {
  return `Elige tu plan y activa VeoTV desde $${formatClp(
    membershipPriceClp
  )}/mes. Cancela cuando quieras.`;
}
