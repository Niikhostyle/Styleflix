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

export const DEFAULT_PREVIEW_MINUTES = 0;

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

export const PRICING_CODE_DEFAULTS = {
  membershipPriceClp: DEFAULT_MEMBERSHIP_PRICE_CLP,
  resellerPriceClp: DEFAULT_RESELLER_PRICE_CLP,
} as const;
