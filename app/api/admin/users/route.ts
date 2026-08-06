import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getResellerPriceClp } from "@/lib/settings";
import {
  canViewerSeeAdminUser,
  getOwnerAdminId,
  isOwnerAdminSession,
} from "@/lib/owner-admin";

const createUserSchema = z.object({
  name: z.string().min(2).max(60),
  email: z.string().email(),
  password: z.string().min(6).max(72),
  role: z.enum(["USER", "SUPER_ADMIN"]).default("USER"),
  /** Activación inmediata (bypass MP / regalo). */
  grantDays: z.number().int().min(0).max(365).optional(),
  /**
   * Cuenta revendedor ($2990): PREPAID.
   * Los días empiezan al primer login del cliente.
   */
  resellerPrepaid: z.boolean().optional(),
  prepaidDays: z.number().int().min(1).max(365).optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Datos inválidos. Revisa nombre, email y contraseña (mín. 6).",
        },
        { status: 400 }
      );
    }

    const viewerIsOwner = isOwnerAdminSession(session);
    if (parsed.data.role === "SUPER_ADMIN" && !viewerIsOwner) {
      return NextResponse.json(
        { error: "Solo el dueño puede crear otros administradores." },
        { status: 403 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email." },
        { status: 409 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 10);
    const now = new Date();
    const resellerPrepaid = Boolean(parsed.data.resellerPrepaid);
    const prepaidDays = parsed.data.prepaidDays ?? 30;
    const grantDays = parsed.data.grantDays ?? 0;
    const adminId = session.user.id;

    let membershipData: Record<string, unknown> = {
      planSource: "DIRECT",
    };

    if (resellerPrepaid && parsed.data.role === "USER") {
      membershipData = {
        subscriptionStatus: "PREPAID",
        planSource: "RESELLER",
        prepaidDays,
        currentPeriodEnd: null,
        membershipStartedAt: null,
      };
    } else if (grantDays > 0) {
      const end = new Date(now);
      end.setDate(end.getDate() + grantDays);
      membershipData = {
        subscriptionStatus: "ACTIVE",
        planSource: "DIRECT",
        membershipStartedAt: now,
        currentPeriodEnd: end,
        prepaidDays: null,
      };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash,
        role: parsed.data.role,
        emailVerified: now,
        grantedByUserId: adminId,
        ...membershipData,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        planSource: true,
        prepaidDays: true,
        grantedByUserId: true,
        createdAt: true,
      },
    });

    if (resellerPrepaid && user.role === "USER") {
      await prisma.payment.create({
        data: {
          userId: user.id,
          amount: await getResellerPriceClp(),
          currency: "CLP",
          status: "reseller_prepaid",
          paidAt: now,
          rawPayload: {
            prepaidDays,
            by: "admin",
            adminId,
            onCreate: true,
          },
        },
      });
    } else if (grantDays > 0) {
      await prisma.payment.create({
        data: {
          userId: user.id,
          amount: 0,
          currency: "CLP",
          status: "manual_grant",
          paidAt: now,
          rawPayload: { grantDays, by: "admin", adminId, onCreate: true },
        },
      });
    }

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo crear la cuenta." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";
  const viewerIsOwner = isOwnerAdminSession(session);
  const ownerId = await getOwnerAdminId();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
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
      grantedByUserId: true,
      createdAt: true,
      _count: { select: { payments: true } },
    },
  });

  const visible = users.filter((u) =>
    canViewerSeeAdminUser({
      viewerIsOwner,
      ownerId,
      target: u,
    })
  );

  const now = Date.now();
  const filtered = visible.filter((u) => {
    const active =
      u.role === "SUPER_ADMIN" ||
      ((u.subscriptionStatus === "ACTIVE" ||
        u.subscriptionStatus === "CANCELLED") &&
        u.currentPeriodEnd &&
        u.currentPeriodEnd.getTime() > now);

    switch (filter) {
      case "active":
        return Boolean(active) && u.role !== "SUPER_ADMIN";
      case "expired":
        return (
          u.role !== "SUPER_ADMIN" &&
          Boolean(u.currentPeriodEnd) &&
          (u.currentPeriodEnd as Date).getTime() <= now
        );
      case "none":
        return (
          u.role !== "SUPER_ADMIN" &&
          (u.subscriptionStatus === "NONE" ||
            (!u.currentPeriodEnd && u.subscriptionStatus !== "PREPAID"))
        );
      case "prepaid":
        return u.subscriptionStatus === "PREPAID";
      case "reseller":
        return u.planSource === "RESELLER";
      case "admin":
        return u.role === "SUPER_ADMIN";
      default:
        return true;
    }
  });

  const stats = {
    total: visible.filter((u) => u.role !== "SUPER_ADMIN").length,
    active: visible.filter((u) => {
      if (u.role === "SUPER_ADMIN") return false;
      return (
        (u.subscriptionStatus === "ACTIVE" ||
          u.subscriptionStatus === "CANCELLED") &&
        u.currentPeriodEnd &&
        u.currentPeriodEnd.getTime() > now
      );
    }).length,
    none: visible.filter(
      (u) =>
        u.role !== "SUPER_ADMIN" &&
        (u.subscriptionStatus === "NONE" ||
          (!u.currentPeriodEnd && u.subscriptionStatus !== "PREPAID"))
    ).length,
    pastDue: visible.filter((u) => u.subscriptionStatus === "PAST_DUE").length,
    prepaid: visible.filter((u) => u.subscriptionStatus === "PREPAID").length,
  };

  return NextResponse.json({
    users: filtered,
    stats,
    viewerIsOwner,
  });
}
