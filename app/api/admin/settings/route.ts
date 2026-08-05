import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  getPreviewMinutes,
  getPricing,
  setPreviewMinutes,
  setPricing,
} from "@/lib/settings";
import { MP_MIN_AMOUNT_CLP } from "@/lib/pricing";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const [previewMinutes, pricing] = await Promise.all([
    getPreviewMinutes(),
    getPricing(),
  ]);
  return NextResponse.json({
    previewMinutes,
    membershipPriceClp: pricing.membershipPriceClp,
    resellerPriceClp: pricing.resellerPriceClp,
    minPriceClp: MP_MIN_AMOUNT_CLP,
  });
}

const patchSchema = z
  .object({
    previewMinutes: z.number().int().min(1).max(180).optional(),
    membershipPriceClp: z
      .number()
      .int()
      .min(MP_MIN_AMOUNT_CLP)
      .max(1_000_000)
      .optional(),
    resellerPriceClp: z
      .number()
      .int()
      .min(MP_MIN_AMOUNT_CLP)
      .max(1_000_000)
      .optional(),
  })
  .refine(
    (d) =>
      d.previewMinutes != null ||
      d.membershipPriceClp != null ||
      d.resellerPriceClp != null,
    { message: "Sin cambios." }
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
        error: `Datos inválidos. Precios mínimos $${MP_MIN_AMOUNT_CLP} CLP (exigencia Visa Débito Mercado Pago Chile); minutos 1–180.`,
      },
      { status: 400 }
    );
  }

  let previewMinutes = await getPreviewMinutes();
  let pricing = await getPricing();

  if (parsed.data.previewMinutes != null) {
    previewMinutes = await setPreviewMinutes(parsed.data.previewMinutes);
  }

  if (
    parsed.data.membershipPriceClp != null ||
    parsed.data.resellerPriceClp != null
  ) {
    pricing = await setPricing({
      membershipPriceClp:
        parsed.data.membershipPriceClp ?? pricing.membershipPriceClp,
      resellerPriceClp:
        parsed.data.resellerPriceClp ?? pricing.resellerPriceClp,
    });
  }

  return NextResponse.json({
    ok: true,
    previewMinutes,
    membershipPriceClp: pricing.membershipPriceClp,
    resellerPriceClp: pricing.resellerPriceClp,
  });
}
