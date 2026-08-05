import { NextResponse } from "next/server";
import { getPlansCatalog, getPricing } from "@/lib/settings";
import {
  convertClpToLocal,
  countryFromRequest,
  formatMoney,
  getFxQuote,
} from "@/lib/geo-fx";
import {
  PLAN_PERIODS,
  PLAN_TIERS,
  periodLabel,
  priceClpForPeriod,
  type PlanPeriod,
  type PlanTier,
} from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [pricing, catalog] = await Promise.all([
    getPricing(),
    getPlansCatalog(),
  ]);

  const country = countryFromRequest(request);
  const fx = await getFxQuote(country);

  const plans = PLAN_TIERS.flatMap((tier) =>
    PLAN_PERIODS.map((period) => {
      const amountClp = priceClpForPeriod(catalog, tier, period);
      const amountLocal = convertClpToLocal(
        amountClp,
        fx.rateFromClp,
        fx.currency
      );
      const t = catalog.tiers.find((x) => x.id === tier)!;
      return {
        tier,
        period,
        periodLabel: periodLabel(period),
        name: t.name,
        months: catalog.periodMonths[period],
        discountPct: catalog.periodDiscounts[period],
        amountClp,
        amountLocal,
        currency: fx.currency,
        amountLocalLabel: formatMoney(amountLocal, fx.currency),
        amountClpLabel: formatMoney(amountClp, "CLP", "es-CL"),
        maxProfiles: t.maxProfiles,
        maxResolution: t.maxResolution,
        features: t.features,
      };
    })
  );

  return NextResponse.json(
    {
      ...pricing,
      catalog,
      geo: {
        country: fx.country,
        currency: fx.currency,
        rateFromClp: fx.rateFromClp,
        fetchedAt: fx.fetchedAt,
      },
      plans,
      periodDiscounts: catalog.periodDiscounts,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export type PublicPlanOffer = {
  tier: PlanTier;
  period: PlanPeriod;
  amountClp: number;
  amountLocal: number;
  currency: string;
};
