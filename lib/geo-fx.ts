/**
 * País (IP) → moneda MP + conversión desde CLP.
 * CF-IPCountry (Cloudflare) es la fuente principal en producción.
 */

export type FxQuote = {
  country: string;
  currency: string;
  /** Unidades de moneda local por 1 CLP */
  rateFromClp: number;
  source: string;
  fetchedAt: string;
};

const COUNTRY_CURRENCY: Record<string, string> = {
  CL: "CLP",
  AR: "ARS",
  MX: "MXN",
  UY: "UYU",
  PE: "PEN",
  CO: "COP",
  BR: "BRL",
  US: "USD",
  CA: "CAD",
  ES: "EUR",
  GB: "GBP",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
};

/** Monedas que intentamos cobrar en MP; si falla → fallback CLP. */
export const CHARGEABLE_CURRENCIES = new Set([
  "CLP",
  "ARS",
  "MXN",
  "UYU",
  "PEN",
  "COP",
  "BRL",
  "USD",
  "EUR",
]);

let fxCache: { at: number; ratesToClp: Record<string, number> } | null = null;
const FX_TTL_MS = 60 * 60 * 1000;

export function countryFromRequest(request: Request): string {
  const cf = request.headers.get("cf-ipcountry")?.trim().toUpperCase();
  if (cf && cf.length === 2 && cf !== "XX" && cf !== "T1") return cf;

  const al = request.headers.get("accept-language") || "";
  const m = al.match(/-([A-Za-z]{2})\b/);
  if (m?.[1]) return m[1].toUpperCase();

  return "CL";
}

export function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country.toUpperCase()] || "USD";
}

async function loadRatesToClp(): Promise<Record<string, number>> {
  const now = Date.now();
  if (fxCache && now - fxCache.at < FX_TTL_MS) return fxCache.ratesToClp;

  // frankfurter: EUR base → convertimos a “cuánto CLP vale 1 unidad de X”
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=CLP,ARS,MXN,UYU,PEN,COP,BRL,EUR,GBP,CAD",
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = (await res.json()) as {
        rates?: Record<string, number>;
      };
      const rates = data.rates || {};
      const usdToClp = rates.CLP;
      if (usdToClp && usdToClp > 0) {
        const toClp: Record<string, number> = { USD: usdToClp, CLP: 1 };
        for (const [code, usdRate] of Object.entries(rates)) {
          if (code === "CLP") continue;
          // 1 CODE = usdRate USD → CLP = usdRate * usdToClp
          toClp[code] = usdRate * usdToClp;
        }
        fxCache = { at: now, ratesToClp: toClp };
        return toClp;
      }
    }
  } catch (err) {
    console.warn("[geo-fx] frankfurter", err);
  }

  // Fallback estático aproximado (CLP por 1 unidad)
  const fallback: Record<string, number> = {
    CLP: 1,
    USD: 950,
    EUR: 1030,
    MXN: 48,
    ARS: 0.95,
    BRL: 170,
    COP: 0.23,
    PEN: 250,
    UYU: 23,
    GBP: 1200,
    CAD: 690,
  };
  fxCache = { at: now, ratesToClp: fallback };
  return fallback;
}

export async function getFxQuote(country: string): Promise<FxQuote> {
  const c = country.toUpperCase() || "CL";
  const currency = currencyForCountry(c);
  const rates = await loadRatesToClp();
  const clpPerUnit = rates[currency] ?? rates.USD ?? 950;
  const rateFromClp = currency === "CLP" ? 1 : 1 / clpPerUnit;

  return {
    country: c,
    currency,
    rateFromClp,
    source: fxCache?.ratesToClp === rates ? "cache-or-api" : "fallback",
    fetchedAt: new Date().toISOString(),
  };
}

export function convertClpToLocal(
  amountClp: number,
  rateFromClp: number,
  currency: string
): number {
  if (currency === "CLP") return Math.round(amountClp);
  const raw = amountClp * rateFromClp;
  // Monedas sin decimales habituales en MP LatAm
  if (currency === "CLP" || currency === "UYU" || currency === "COP") {
    return Math.max(1, Math.round(raw));
  }
  return Math.max(0.01, Math.round(raw * 100) / 100);
}

export function formatMoney(amount: number, currency: string, locale = "es"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" || currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
