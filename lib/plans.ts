import { MP_MIN_AMOUNT_CLP } from "@/lib/pricing";

export type PlanTier = "standard" | "premium" | "plus";
export type PlanPeriod = "monthly" | "semiannual" | "annual";

export type PlanFeatures = {
  canRequest: boolean;
  requestQuota: number;
  canDownload: boolean;
};

export type PlanTierDef = {
  id: PlanTier;
  name: string;
  maxProfiles: number;
  maxResolution: number;
  features: PlanFeatures;
  /** Precio CLP base mensual (antes de descuento de periodo) */
  priceMonthlyClp: number;
};

export type PlansCatalog = {
  tiers: PlanTierDef[];
  /** Descuento % sobre precio*meses del periodo */
  periodDiscounts: Record<PlanPeriod, number>;
  periodMonths: Record<PlanPeriod, number>;
};

export const PLAN_TIERS: PlanTier[] = ["standard", "premium", "plus"];
export const PLAN_PERIODS: PlanPeriod[] = ["monthly", "semiannual", "annual"];

export const DEFAULT_PLANS_CATALOG: PlansCatalog = {
  tiers: [
    {
      id: "standard",
      name: "Estándar",
      maxProfiles: 2,
      maxResolution: 720,
      features: { canRequest: false, requestQuota: 0, canDownload: true },
      priceMonthlyClp: 2990,
    },
    {
      id: "premium",
      name: "Premium",
      maxProfiles: 3,
      maxResolution: 1080,
      features: { canRequest: true, requestQuota: 10, canDownload: true },
      priceMonthlyClp: 3990,
    },
    {
      id: "plus",
      name: "Plus",
      maxProfiles: 5,
      maxResolution: 1080,
      features: { canRequest: true, requestQuota: 10, canDownload: true },
      priceMonthlyClp: 4990,
    },
  ],
  periodDiscounts: {
    monthly: 0,
    semiannual: 5,
    annual: 10,
  },
  periodMonths: {
    monthly: 1,
    semiannual: 6,
    annual: 12,
  },
};

export function periodLabel(period: PlanPeriod): string {
  switch (period) {
    case "semiannual":
      return "6 meses";
    case "annual":
      return "Anual";
    default:
      return "Mensual";
  }
}

export function isPlanTier(v: unknown): v is PlanTier {
  return v === "standard" || v === "premium" || v === "plus";
}

export function isPlanPeriod(v: unknown): v is PlanPeriod {
  return v === "monthly" || v === "semiannual" || v === "annual";
}

export function getTier(catalog: PlansCatalog, tier: PlanTier): PlanTierDef {
  return (
    catalog.tiers.find((t) => t.id === tier) ||
    catalog.tiers[0] ||
    DEFAULT_PLANS_CATALOG.tiers[0]
  );
}

/** Precio CLP a cobrar por el periodo completo (con descuento). */
export function priceClpForPeriod(
  catalog: PlansCatalog,
  tier: PlanTier,
  period: PlanPeriod
): number {
  const t = getTier(catalog, tier);
  const months = catalog.periodMonths[period] ?? 1;
  const discount = catalog.periodDiscounts[period] ?? 0;
  const raw = t.priceMonthlyClp * months;
  const discounted = Math.round(raw * (1 - discount / 100));
  return Math.max(MP_MIN_AMOUNT_CLP, discounted);
}

export function normalizePlansCatalog(raw: unknown): PlansCatalog {
  if (!raw || typeof raw !== "object") return DEFAULT_PLANS_CATALOG;
  const o = raw as Partial<PlansCatalog>;
  const base = DEFAULT_PLANS_CATALOG;

  const tiers: PlanTierDef[] = PLAN_TIERS.map((id) => {
    const def = base.tiers.find((t) => t.id === id)!;
    const incoming = (o.tiers || []).find((t) => t?.id === id);
    if (!incoming) return { ...def, features: { ...def.features } };
    return {
      id,
      name: String(incoming.name || def.name).slice(0, 40),
      maxProfiles: clampInt(incoming.maxProfiles, 1, 10, def.maxProfiles),
      maxResolution:
        incoming.maxResolution === 720 || incoming.maxResolution === 1080
          ? incoming.maxResolution
          : def.maxResolution,
      features: {
        canRequest: Boolean(
          incoming.features?.canRequest ?? def.features.canRequest
        ),
        requestQuota: clampInt(
          incoming.features?.requestQuota,
          0,
          10,
          def.features.requestQuota
        ),
        canDownload: Boolean(
          incoming.features?.canDownload ?? def.features.canDownload
        ),
      },
      priceMonthlyClp: clampInt(
        incoming.priceMonthlyClp,
        MP_MIN_AMOUNT_CLP,
        1_000_000,
        def.priceMonthlyClp
      ),
    };
  });

  return {
    tiers,
    periodDiscounts: {
      monthly: clampInt(o.periodDiscounts?.monthly, 0, 80, 0),
      semiannual: clampInt(
        o.periodDiscounts?.semiannual,
        0,
        80,
        base.periodDiscounts.semiannual
      ),
      annual: clampInt(
        o.periodDiscounts?.annual,
        0,
        80,
        base.periodDiscounts.annual
      ),
    },
    periodMonths: { ...base.periodMonths },
  };
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function planEntitlementSnapshot(
  catalog: PlansCatalog,
  tier: PlanTier
) {
  const t = getTier(catalog, tier);
  return {
    planTier: t.id,
    planMaxProfiles: t.maxProfiles,
    planMaxResolution: t.maxResolution,
    planFeatures: t.features,
  };
}

/** Meses reales del periodo vendido (fuente de verdad del catálogo). */
export function monthsForPeriod(
  catalog: PlansCatalog,
  period: PlanPeriod | string | null | undefined,
  fallbackMonths?: number | null
): number {
  if (isPlanPeriod(period)) {
    const m = catalog.periodMonths[period];
    if (m && m >= 1) return m;
  }
  const n = Number(fallbackMonths);
  if (Number.isFinite(n) && n >= 1) return Math.round(n);
  return 1;
}

export function periodFromMonths(months: number): PlanPeriod {
  if (months >= 12) return "annual";
  if (months >= 6) return "semiannual";
  return "monthly";
}
