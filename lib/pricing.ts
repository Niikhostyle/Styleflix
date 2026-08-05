/**
 * Precios de membresía.
 *
 * MEMBERSHIP_PRICE_CLP / RESELLER_PRICE_CLP son variables de servidor: no existen
 * en el bundle del navegador. Por eso se leen aquí en cada request y se envían al
 * cliente vía PricingProvider / /api/pricing en lugar de importar una constante.
 */

export const DEFAULT_MEMBERSHIP_PRICE_CLP = 4990;
export const DEFAULT_RESELLER_PRICE_CLP = 2990;

export type Pricing = {
  membershipPriceClp: number;
  resellerPriceClp: number;
};

function parsePriceClp(raw: string | undefined, fallback: number): number {
  const value = Number((raw ?? "").trim());
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.round(value);
}

export function getMembershipPriceClp(): number {
  return parsePriceClp(
    process.env.MEMBERSHIP_PRICE_CLP,
    DEFAULT_MEMBERSHIP_PRICE_CLP
  );
}

export function getResellerPriceClp(): number {
  return parsePriceClp(
    process.env.RESELLER_PRICE_CLP,
    DEFAULT_RESELLER_PRICE_CLP
  );
}

export function getPricing(): Pricing {
  return {
    membershipPriceClp: getMembershipPriceClp(),
    resellerPriceClp: getResellerPriceClp(),
  };
}

export function formatClp(amount: number): string {
  return amount.toLocaleString("es-CL");
}

export function membershipHint(membershipPriceClp: number): string {
  return `Sin membresía puedes ver una prueba corta del contenido. Plan completo $${formatClp(
    membershipPriceClp
  )}/mes.`;
}
