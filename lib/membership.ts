import { addDays, addMonths } from "@/lib/access";
import { getResellerPriceClp } from "@/lib/settings";
import {
  assertApprovedMembershipPayment,
  findLatestApprovedPaymentForUser,
  getPayment,
  membershipAmount,
  type MpPaymentDetail,
} from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function activateMembership(opts: {
  userId: string;
  months?: number;
  mpPreapprovalId?: string | null;
  payment?: {
    externalId?: string | null;
    status: string;
    amount?: number;
    rawPayload?: Prisma.InputJsonValue;
    paidAt?: Date | null;
  };
}) {
  const months = opts.months ?? 1;
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  if (!user) return null;

  // Idempotencia: si este pago MP ya activó, no duplicar ni extender de nuevo.
  if (opts.payment?.externalId) {
    const existing = await prisma.payment.findFirst({
      where: {
        externalId: opts.payment.externalId,
        status: { in: ["approved", "subscription_authorized"] },
      },
    });
    if (existing) {
      if (
        user.subscriptionStatus === "ACTIVE" &&
        user.currentPeriodEnd &&
        user.currentPeriodEnd > now
      ) {
        return user;
      }
      // Pago ya registrado pero membresía caída: reactivar sin nuevo payment row.
      return prisma.user.update({
        where: { id: opts.userId },
        data: {
          subscriptionStatus: "ACTIVE",
          currentPeriodEnd: addMonths(now, months),
          membershipStartedAt: user.membershipStartedAt ?? now,
          cancelledAt: null,
          planSource: user.planSource || "DIRECT",
          prepaidDays: null,
          ...(opts.mpPreapprovalId
            ? { mpPreapprovalId: opts.mpPreapprovalId }
            : {}),
        },
      });
    }
  }

  const base =
    user.currentPeriodEnd && user.currentPeriodEnd > now
      ? user.currentPeriodEnd
      : now;
  const currentPeriodEnd = addMonths(base, months);

  const updated = await prisma.user.update({
    where: { id: opts.userId },
    data: {
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd,
      membershipStartedAt: user.membershipStartedAt ?? now,
      cancelledAt: null,
      planSource: user.planSource || "DIRECT",
      prepaidDays: null,
      ...(opts.mpPreapprovalId
        ? { mpPreapprovalId: opts.mpPreapprovalId }
        : {}),
    },
  });

  if (opts.payment) {
    await prisma.payment.create({
      data: {
        userId: opts.userId,
        externalId: opts.payment.externalId ?? undefined,
        amount: opts.payment.amount ?? (await membershipAmount()),
        currency: "CLP",
        status: opts.payment.status,
        rawPayload: opts.payment.rawPayload,
        paidAt: opts.payment.paidAt ?? now,
      },
    });
  }

  return updated;
}

/**
 * Activa membresía solo si Mercado Pago confirma el pago como approved
 * y pertenece a este usuario.
 */
export async function activateFromMercadoPagoPayment(opts: {
  userId: string;
  payment: MpPaymentDetail;
}): Promise<
  | { activated: true; paymentId: string; alreadyActive?: boolean }
  | { activated: false; reason: string; status?: string }
> {
  const check = await assertApprovedMembershipPayment({
    payment: opts.payment,
    userId: opts.userId,
  });
  if (!check.ok) {
    return {
      activated: false,
      reason: check.reason,
      status: opts.payment.status,
    };
  }

  const externalId = String(opts.payment.id);
  const existing = await prisma.payment.findFirst({
    where: { externalId, status: "approved" },
  });

  await activateMembership({
    userId: opts.userId,
    months: 1,
    payment: {
      externalId,
      status: "approved",
      amount: check.amount,
      rawPayload: opts.payment as object,
      paidAt: opts.payment.date_approved
        ? new Date(opts.payment.date_approved)
        : new Date(),
    },
  });

  return {
    activated: true,
    paymentId: externalId,
    alreadyActive: Boolean(existing),
  };
}

/** Sincroniza membresía consultando la API de Mercado Pago (nunca confía solo en la URL). */
export async function syncMembershipFromMercadoPago(opts: {
  userId: string;
  paymentId?: string | null;
}): Promise<
  | { activated: true; paymentId: string; alreadyActive?: boolean }
  | { activated: false; reason: string; status?: string }
> {
  let payment: MpPaymentDetail | null = null;

  if (opts.paymentId?.trim()) {
    try {
      payment = await getPayment(opts.paymentId.trim());
    } catch (err) {
      console.warn("[sync] getPayment", err);
      return {
        activated: false,
        reason: "No se pudo consultar el pago en Mercado Pago.",
      };
    }
  } else {
    try {
      payment = await findLatestApprovedPaymentForUser(opts.userId);
    } catch (err) {
      console.warn("[sync] search payments", err);
      return {
        activated: false,
        reason: "No se pudo buscar pagos en Mercado Pago.",
      };
    }
  }

  if (!payment) {
    return {
      activated: false,
      reason:
        "Aún no hay un pago aprobado en Mercado Pago para tu cuenta. Si acabas de pagar, espera unos segundos e intenta de nuevo.",
    };
  }

  return activateFromMercadoPagoPayment({
    userId: opts.userId,
    payment,
  });
}

/**
 * Cuenta revendedor PREPAID: al primer uso arranca el reloj (prepaidDays).
 * Idempotente si ya no está en PREPAID.
 */
export async function activatePrepaidOnFirstUse(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.subscriptionStatus !== "PREPAID") return user;

  const days = user.prepaidDays && user.prepaidDays > 0 ? user.prepaidDays : 30;
  const now = new Date();
  const currentPeriodEnd = addDays(now, days);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: "ACTIVE",
      membershipStartedAt: now,
      currentPeriodEnd,
      cancelledAt: null,
      prepaidDays: null,
      planSource: "RESELLER",
    },
  });

  await prisma.payment.create({
    data: {
      userId,
      amount: await getResellerPriceClp(),
      currency: "CLP",
      status: "reseller_first_use",
      paidAt: now,
      rawPayload: { activatedDays: days, at: now.toISOString() },
    },
  });

  return updated;
}

/** Marca cuenta prepagada (revendedor): sin correr días hasta el primer login. */
export async function grantPrepaidReseller(opts: {
  userId: string;
  days: number;
}) {
  const days = Math.max(1, Math.min(365, opts.days));
  const now = new Date();

  const updated = await prisma.user.update({
    where: { id: opts.userId },
    data: {
      subscriptionStatus: "PREPAID",
      planSource: "RESELLER",
      prepaidDays: days,
      currentPeriodEnd: null,
      membershipStartedAt: null,
      cancelledAt: null,
    },
  });

  await prisma.payment.create({
    data: {
      userId: opts.userId,
      amount: await getResellerPriceClp(),
      currency: "CLP",
      status: "reseller_prepaid",
      paidAt: now,
      rawPayload: { prepaidDays: days, by: "admin" },
    },
  });

  return updated;
}

export async function markSubscriptionStatus(
  userId: string,
  status: "PENDING" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "NONE" | "PREPAID",
  extra?: { mpPreapprovalId?: string | null; clearPeriod?: boolean }
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: status,
      ...(extra?.mpPreapprovalId !== undefined
        ? { mpPreapprovalId: extra.mpPreapprovalId }
        : {}),
      ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
      ...(extra?.clearPeriod ? { currentPeriodEnd: null } : {}),
    },
  });
}
