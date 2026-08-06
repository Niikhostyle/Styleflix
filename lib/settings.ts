import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MEMBERSHIP_PRICE_CLP,
  DEFAULT_RESELLER_PRICE_CLP,
  envMembershipPriceClp,
  envResellerPriceClp,
  MP_MIN_AMOUNT_CLP,
  parsePriceClp,
  type Pricing,
} from "@/lib/pricing";
import {
  DEFAULT_PLANS_CATALOG,
  normalizePlansCatalog,
  priceClpForPeriod,
  type PlanPeriod,
  type PlansCatalog,
  type PlanTier,
} from "@/lib/plans";

export const PREVIEW_MINUTES_KEY = "previewMinutes";
export const MEMBERSHIP_PRICE_KEY = "membershipPriceClp";
export const RESELLER_PRICE_KEY = "resellerPriceClp";
export const PLANS_CATALOG_KEY = "plansCatalog";
/** Página /descargar y links de APK (off hasta que haya builds). */
export const DOWNLOADS_ENABLED_KEY = "downloadsEnabled";
/** Duración de la demo de catálogo (minutos enteros). 0 = demo desactivada. */
export const DEMO_CATALOG_MINUTES_KEY = "demoCatalogMinutes";

export const DEFAULT_PREVIEW_MINUTES = 0;
/** Por defecto off: aún no hay APKs publicados. */
export const DEFAULT_DOWNLOADS_ENABLED = false;
/** Fallback si no hay setting (30 min). */
export const DEFAULT_DEMO_CATALOG_MINUTES = 30;

const MIN_DEMO_MINUTES = 0;
const MAX_DEMO_MINUTES = 30 * 24 * 60; // 30 días

/** Alineado al mínimo de suscripciones Mercado Pago Chile ($950). */
const MIN_PRICE_CLP = MP_MIN_AMOUNT_CLP;
const MAX_PRICE_CLP = 1_000_000;

/** Preview desactivado (paywall duro). */
export async function getPreviewMinutes(): Promise<number> {
  return 0;
}

export async function setPreviewMinutes(_minutes: number): Promise<number> {
  return 0;
}

function clampPriceClp(n: number): number {
  return Math.min(MAX_PRICE_CLP, Math.max(MIN_PRICE_CLP, Math.round(n)));
}

async function readPriceSetting(
  key: string,
  fallback: number
): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    if (!row?.value?.trim()) return fallback;
    return parsePriceClp(row.value, fallback);
  } catch (err) {
    console.warn(`[settings] readPriceSetting(${key})`, err);
    return fallback;
  }
}

/** Precio legacy (premium mensual) — compat. */
export async function getMembershipPriceClp(): Promise<number> {
  const catalog = await getPlansCatalog();
  const premium = catalog.tiers.find((t) => t.id === "premium");
  if (premium) return premium.priceMonthlyClp;
  return readPriceSetting(MEMBERSHIP_PRICE_KEY, envMembershipPriceClp());
}

export async function getResellerPriceClp(): Promise<number> {
  return readPriceSetting(RESELLER_PRICE_KEY, envResellerPriceClp());
}

export async function getPricing(): Promise<Pricing> {
  const [membershipPriceClp, resellerPriceClp] = await Promise.all([
    getMembershipPriceClp(),
    getResellerPriceClp(),
  ]);
  return { membershipPriceClp, resellerPriceClp };
}

export async function setMembershipPriceClp(amount: number): Promise<number> {
  const value = clampPriceClp(amount);
  await prisma.appSetting.upsert({
    where: { key: MEMBERSHIP_PRICE_KEY },
    create: { key: MEMBERSHIP_PRICE_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}

export async function setResellerPriceClp(amount: number): Promise<number> {
  const value = clampPriceClp(amount);
  await prisma.appSetting.upsert({
    where: { key: RESELLER_PRICE_KEY },
    create: { key: RESELLER_PRICE_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}

export async function setPricing(input: {
  membershipPriceClp: number;
  resellerPriceClp: number;
}): Promise<Pricing> {
  const [membershipPriceClp, resellerPriceClp] = await Promise.all([
    setMembershipPriceClp(input.membershipPriceClp),
    setResellerPriceClp(input.resellerPriceClp),
  ]);
  return { membershipPriceClp, resellerPriceClp };
}

export async function getPlansCatalog(): Promise<PlansCatalog> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: PLANS_CATALOG_KEY },
    });
    if (!row?.value?.trim()) return DEFAULT_PLANS_CATALOG;
    return normalizePlansCatalog(JSON.parse(row.value));
  } catch (err) {
    console.warn("[settings] getPlansCatalog", err);
    return DEFAULT_PLANS_CATALOG;
  }
}

export async function setPlansCatalog(
  input: unknown
): Promise<PlansCatalog> {
  const catalog = normalizePlansCatalog(input);
  await prisma.appSetting.upsert({
    where: { key: PLANS_CATALOG_KEY },
    create: {
      key: PLANS_CATALOG_KEY,
      value: JSON.stringify(catalog),
    },
    update: { value: JSON.stringify(catalog) },
  });
  // Mantener membershipPriceClp legacy alineado al premium mensual
  const premium = catalog.tiers.find((t) => t.id === "premium");
  if (premium) {
    await setMembershipPriceClp(premium.priceMonthlyClp);
  }
  return catalog;
}

export async function getPlanPriceClp(
  tier: PlanTier,
  period: PlanPeriod
): Promise<number> {
  const catalog = await getPlansCatalog();
  return priceClpForPeriod(catalog, tier, period);
}

export async function getDownloadsEnabled(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: DOWNLOADS_ENABLED_KEY },
    });
    if (!row?.value?.trim()) return DEFAULT_DOWNLOADS_ENABLED;
    const v = row.value.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes" || v === "on";
  } catch (err) {
    console.warn("[settings] getDownloadsEnabled", err);
    return DEFAULT_DOWNLOADS_ENABLED;
  }
}

export async function setDownloadsEnabled(enabled: boolean): Promise<boolean> {
  const value = enabled ? "true" : "false";
  await prisma.appSetting.upsert({
    where: { key: DOWNLOADS_ENABLED_KEY },
    create: { key: DOWNLOADS_ENABLED_KEY, value },
    update: { value },
  });
  return enabled;
}

function clampDemoMinutes(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_DEMO_CATALOG_MINUTES;
  return Math.min(MAX_DEMO_MINUTES, Math.max(MIN_DEMO_MINUTES, Math.round(n)));
}

/** Minutos de demo configurados en admin (0 = off). */
export async function getDemoCatalogMinutes(): Promise<number> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: DEMO_CATALOG_MINUTES_KEY },
    });
    if (!row?.value?.trim()) return DEFAULT_DEMO_CATALOG_MINUTES;
    const n = Number(row.value);
    if (!Number.isFinite(n)) return DEFAULT_DEMO_CATALOG_MINUTES;
    return clampDemoMinutes(n);
  } catch (err) {
    console.warn("[settings] getDemoCatalogMinutes", err);
    return DEFAULT_DEMO_CATALOG_MINUTES;
  }
}

export async function setDemoCatalogMinutes(minutes: number): Promise<number> {
  const value = clampDemoMinutes(minutes);
  await prisma.appSetting.upsert({
    where: { key: DEMO_CATALOG_MINUTES_KEY },
    create: { key: DEMO_CATALOG_MINUTES_KEY, value: String(value) },
    update: { value: String(value) },
  });
  return value;
}

/** Etiqueta legible: "30 min" | "2 h" | "3 días". */
export function formatDemoDuration(minutes: number): string {
  const m = clampDemoMinutes(minutes);
  if (m <= 0) return "desactivada";
  if (m % (24 * 60) === 0) {
    const d = m / (24 * 60);
    return `${d} día${d === 1 ? "" : "s"}`;
  }
  if (m % 60 === 0) {
    const h = m / 60;
    return `${h} h`;
  }
  return `${m} min`;
}

export const PRICING_CODE_DEFAULTS = {
  membershipPriceClp: DEFAULT_MEMBERSHIP_PRICE_CLP,
  resellerPriceClp: DEFAULT_RESELLER_PRICE_CLP,
} as const;
