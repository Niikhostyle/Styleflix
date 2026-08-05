import { addDays, addMonths } from "@/lib/access";
import { getResellerPriceClp } from "@/lib/settings";
import { membershipAmount } from "@/lib/mercadopago";
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
