import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  getDownloadsEnabled,
  getPlansCatalog,
  getPricing,
  setDownloadsEnabled,
  setPlansCatalog,
  setResellerPriceClp,
} from "@/lib/settings";
import { MP_MIN_AMOUNT_CLP } from "@/lib/pricing";
import { normalizePlansCatalog } from "@/lib/plans";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const [pricing, catalog, downloadsEnabled] = await Promise.all([
    getPricing(),
    getPlansCatalog(),
    getDownloadsEnabled(),
  ]);
  return NextResponse.json({
    membershipPriceClp: pricing.membershipPriceClp,
    resellerPriceClp: pricing.resellerPriceClp,
    minPriceClp: MP_MIN_AMOUNT_CLP,
    catalog,
    downloadsEnabled,
    previewMinutes: 0,
  });
}

const tierSchema = z.object({
  id: z.enum(["standard", "premium", "plus"]),
  name: z.string().min(1).max(40),
  maxProfiles: z.number().int().min(1).max(10),
  maxResolution: z.union([z.literal(720), z.literal(1080)]),
  features: z.object({
    canRequest: z.boolean(),
    requestQuota: z.number().int().min(0).max(10),
    canDownload: z.boolean(),
  }),
  priceMonthlyClp: z.number().int().min(MP_MIN_AMOUNT_CLP).max(1_000_000),
});

const patchSchema = z
  .object({
    resellerPriceClp: z
      .number()
      .int()
      .min(MP_MIN_AMOUNT_CLP)
      .max(1_000_000)
      .optional(),
    downloadsEnabled: z.boolean().optional(),
    catalog: z
      .object({
        tiers: z.array(tierSchema).min(1),
        periodDiscounts: z.object({
          monthly: z.number().min(0).max(80),
          semiannual: z.number().min(0).max(80),
          annual: z.number().min(0).max(80),
        }),
      })
      .optional(),
  })
  .refine(
    (d) =>
      d.resellerPriceClp != null ||
      d.catalog != null ||
      d.downloadsEnabled != null,
    {
      message: "Sin cambios.",
    }
  );

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Datos inválidos. Precios mínimos $${MP_MIN_AMOUNT_CLP} CLP.`,
      },
      { status: 400 }
    );
  }

  let pricing = await getPricing();
  let catalog = await getPlansCatalog();
  let downloadsEnabled = await getDownloadsEnabled();

  if (parsed.data.catalog) {
    catalog = await setPlansCatalog(
      normalizePlansCatalog({
        ...parsed.data.catalog,
        periodMonths: catalog.periodMonths,
      })
    );
    pricing = await getPricing();
  }

  if (parsed.data.resellerPriceClp != null) {
    const resellerPriceClp = await setResellerPriceClp(
      parsed.data.resellerPriceClp
    );
    pricing = { ...pricing, resellerPriceClp };
  }

  if (parsed.data.downloadsEnabled != null) {
    downloadsEnabled = await setDownloadsEnabled(parsed.data.downloadsEnabled);
  }

  return NextResponse.json({
    ok: true,
    previewMinutes: 0,
    membershipPriceClp: pricing.membershipPriceClp,
    resellerPriceClp: pricing.resellerPriceClp,
    catalog,
    downloadsEnabled,
  });
}
