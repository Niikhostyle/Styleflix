import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  activateMembership,
  grantPrepaidReseller,
  markSubscriptionStatus,
} from "@/lib/membership";
import { cancelPreapproval } from "@/lib/mercadopago";
import { sendPasswordChangedNotice } from "@/lib/mail";

const patchSchema = z.object({
  action: z.enum([
    "activate_manual",
    "extend_30",
    "revoke",
    "cancel_mp",
    "grant_prepaid",
    "set_password",
    "mark_email_verified",
  ]),
  days: z.number().int().min(1).max(365).optional(),
  password: z.string().min(6).max(72).optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      mpPreapprovalId: true,
      membershipStartedAt: true,
      cancelledAt: true,
      planSource: true,
      prepaidDays: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      payments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          provider: true,
          externalId: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const { action, days, password } = parsed.data;

  try {
    if (action === "set_password") {
      if (!password) {
        return NextResponse.json(
          { error: "Indica la nueva contraseña (mín. 6)." },
          { status: 400 }
        );
      }
      const passwordHash = await hash(password, 10);
      const updated = await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          emailVerified: user.emailVerified ?? new Date(),
        },
      });
      void sendPasswordChangedNotice({
        to: updated.email,
        name: updated.name,
      }).catch(() => null);
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "mark_email_verified") {
      const updated = await prisma.user.update({
        where: { id },
        data: { emailVerified: new Date() },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "activate_manual") {
      const grantDays = days ?? 30;
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + grantDays);
      const updated = await prisma.user.update({
        where: { id },
        data: {
          subscriptionStatus: "ACTIVE",
          membershipStartedAt: user.membershipStartedAt ?? now,
          currentPeriodEnd: end,
          cancelledAt: null,
          prepaidDays: null,
          planSource: user.planSource === "RESELLER" ? "RESELLER" : "DIRECT",
        },
      });
      await prisma.payment.create({
        data: {
          userId: id,
          amount: 0,
          currency: "CLP",
          status: "manual_grant",
          paidAt: now,
          rawPayload: { grantDays, by: "admin" },
        },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "grant_prepaid") {
      const updated = await grantPrepaidReseller({
        userId: id,
        days: days ?? 30,
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "extend_30") {
      const updated = await activateMembership({
        userId: id,
        months: 1,
        payment: {
          status: "manual_extend",
          amount: 0,
          rawPayload: { by: "admin", action: "extend_30" },
        },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "revoke") {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          subscriptionStatus: "EXPIRED",
          currentPeriodEnd: new Date(),
          cancelledAt: new Date(),
          prepaidDays: null,
        },
      });
      return NextResponse.json({ ok: true, user: updated });
    }

    if (action === "cancel_mp") {
      if (user.mpPreapprovalId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
        try {
          await cancelPreapproval(user.mpPreapprovalId);
        } catch (err) {
          console.warn("[admin cancel_mp]", err);
        }
      }
      const updated = await markSubscriptionStatus(id, "CANCELLED");
      return NextResponse.json({ ok: true, user: updated });
    }

    return NextResponse.json({ error: "Acción no soportada." }, { status: 400 });
  } catch (err) {
    console.error("[admin/users/id]", err);
    return NextResponse.json({ error: "No se pudo aplicar." }, { status: 500 });
  }
}
