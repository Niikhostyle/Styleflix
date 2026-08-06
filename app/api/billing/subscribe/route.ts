import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { hasActiveMembership } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  createMembershipPreference,
  preferenceCheckoutUrl,
} from "@/lib/mercadopago";
import { markSubscriptionStatus } from "@/lib/membership";
import { getPlanPriceClp, getPlansCatalog } from "@/lib/settings";
import {
  convertClpToLocal,
  countryFromRequest,
  getFxQuote,
  CHARGEABLE_CURRENCIES,
} from "@/lib/geo-fx";
import {
  getTier,
  isPlanPeriod,
  isPlanTier,
  periodLabel,
} from "@/lib/plans";

const bodySchema = z.object({
  planTier: z.enum(["standard", "premium", "plus"]),
  planPeriod: z.enum(["monthly", "semiannual", "annual"]),
  /** Forzar cobro en CLP */
  forceClp: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  if (session.user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "El admin no necesita pagar." },
      { status: 400 }
    );
  }

  if (
    hasActiveMembership({
      role: session.user.role,
      subscriptionStatus: session.user.subscriptionStatus,
      currentPeriodEnd: session.user.currentPeriodEnd,
    })
  ) {
    return NextResponse.json(
      { error: "Ya tienes membresía activa." },
      { status: 400 }
    );
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado en el servidor." },
      { status: 503 }
    );
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Elige un plan y un periodo válidos." },
      { status: 400 }
    );
  }

  const { planTier, planPeriod, forceClp } = parsed.data;
  if (!isPlanTier(planTier) || !isPlanPeriod(planPeriod)) {
    return NextResponse.json({ error: "Plan inválido." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    const catalog = await getPlansCatalog();
    const tier = getTier(catalog, planTier);
    const months = catalog.periodMonths[planPeriod];
    const amountClp = await getPlanPriceClp(planTier, planPeriod);

    const country = countryFromRequest(request);
    const fx = await getFxQuote(country);
    let currencyId = forceClp ? "CLP" : fx.currency;
    if (!CHARGEABLE_CURRENCIES.has(currencyId)) currencyId = "CLP";

    let amount =
      currencyId === "CLP"
        ? amountClp
        : convertClpToLocal(amountClp, fx.rateFromClp, currencyId);
    let usedFallback = false;

    const title = `VeoTV ${tier.name} · ${periodLabel(planPeriod)}`;

    async function createPref(cur: string, amt: number) {
      return createMembershipPreference({
        userId: user!.id,
        payerEmail: user!.email,
        title,
        amount: amt,
        currencyId: cur,
        amountClp,
        planTier,
        planPeriod,
        months,
        fxRate: fx.rateFromClp,
        country,
      });
    }

    let preference;
    try {
      preference = await createPref(currencyId, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (currencyId !== "CLP") {
        console.warn("[billing/subscribe] currency fail, fallback CLP", msg);
        currencyId = "CLP";
        amount = amountClp;
        usedFallback = true;
        preference = await createPref("CLP", amountClp);
      } else {
        throw err;
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "PENDING",
        planTier,
        planPeriod,
        // Snapshot anticipado: si el webhook llega sin metadata, igual hay tier
        planMaxProfiles: tier.maxProfiles,
        planMaxResolution: tier.maxResolution,
        planFeatures: tier.features,
      },
    });
    await markSubscriptionStatus(user.id, "PENDING");

    const url = preferenceCheckoutUrl(preference);
    if (!url) {
      return NextResponse.json(
        { error: "No se obtuvo URL de Checkout Pro." },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      init_point: url,
      preferenceId: preference.id,
      mode: "preference",
      currency: currencyId,
      amount,
      amountClp,
      usedClpFallback: usedFallback,
    });
  } catch (err) {
    console.error("[billing/subscribe]", err);
    const rawMsg = err instanceof Error ? err.message : "";
    return NextResponse.json({ error: friendlyMpError(rawMsg) }, { status: 500 });
  }
}

function friendlyMpError(raw: string): string {
  if (!raw) return "No se pudo iniciar el pago.";
  if (
    raw.includes("same user") ||
    raw.includes("Payer and collector") ||
    raw.includes("del Vendedor")
  ) {
    return "El pagador de prueba es el mismo que el cobrador (Vendedor).";
  }
  if (raw.includes("lower than") || /amount lower than/i.test(raw)) {
    return "Mercado Pago rechazó el monto: en Chile exigen mínimo $950 CLP. Sube el precio en Admin → Ajustes.";
  }
  if (/currency/i.test(raw) && /invalid|not supported/i.test(raw)) {
    return "Mercado Pago no aceptó esa moneda. Reintenta; cobraremos en CLP.";
  }
  return raw;
}
