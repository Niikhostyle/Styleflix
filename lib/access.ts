import { prisma } from "@/lib/prisma";

export type Role = "USER" | "SUPER_ADMIN";

export type SubscriptionStatus =
  | "NONE"
  | "PREPAID"
  | "PENDING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "EXPIRED";

export type PlanSource = "DIRECT" | "RESELLER";

export type MembershipFields = {
  role?: string | null;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | string | null;
  demoExpiresAt?: Date | string | null;
};

/** Minutos de demo de catálogo — fallback; usar getDemoCatalogMinutes() en runtime. */
export const DEMO_CATALOG_MINUTES = 30;

/** SUPER_ADMIN siempre pasa. USER necesita ACTIVE/CANCELLED y periodo vigente. */
export function hasActiveMembership(user: MembershipFields | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;

  if (user.subscriptionStatus !== "ACTIVE" && user.subscriptionStatus !== "CANCELLED") {
    // PREPAID aún no cuenta: se activa en el primer login
    return false;
  }

  if (!user.currentPeriodEnd) return false;
  const end =
    user.currentPeriodEnd instanceof Date
      ? user.currentPeriodEnd
      : new Date(user.currentPeriodEnd);
  return end.getTime() > Date.now();
}

/** Demo de catálogo vigente (una vez por cuenta). */
export function hasActiveDemo(user: MembershipFields | null | undefined): boolean {
  if (!user?.demoExpiresAt) return false;
  if (user.role === "SUPER_ADMIN") return true;
  const end =
    user.demoExpiresAt instanceof Date
      ? user.demoExpiresAt
      : new Date(user.demoExpiresAt);
  return end.getTime() > Date.now();
}

/** Puede ver/reproducir catálogo: membresía o demo. */
export function hasCatalogAccess(user: MembershipFields | null | undefined): boolean {
  return hasActiveMembership(user) || hasActiveDemo(user);
}

/**
 * Acceso de catálogo leyendo la DB (no JWT stale).
 * Usar en APIs de play / billing críticas tras revoke admin.
 */
export async function requireLiveCatalogAccess(userId: string): Promise<
  | {
      ok: true;
      user: {
        id: string;
        role: string;
        subscriptionStatus: string;
        currentPeriodEnd: Date | null;
        demoExpiresAt: Date | null;
      };
    }
  | { ok: false; status: 401 | 403; error: string }
> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      demoExpiresAt: true,
    },
  });
  if (!user) {
    return { ok: false, status: 401, error: "No autorizado." };
  }
  if (!hasCatalogAccess(user)) {
    return {
      ok: false,
      status: 403,
      error: "Necesitas una membresía o demo activa.",
    };
  }
  return { ok: true, user };
}

export function demoMsRemaining(user: MembershipFields | null | undefined): number {
  if (!hasActiveDemo(user) || !user?.demoExpiresAt) return 0;
  const end =
    user.demoExpiresAt instanceof Date
      ? user.demoExpiresAt
      : new Date(user.demoExpiresAt);
  return Math.max(0, end.getTime() - Date.now());
}

export function addMonths(from: Date, months = 1): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function subscriptionLabel(status: string | null | undefined): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "PREPAID":
      return "Prepagada (sin activar)";
    case "PENDING":
      return "Pendiente";
    case "PAST_DUE":
      return "Pago atrasado";
    case "CANCELLED":
      return "Cancelada";
    case "EXPIRED":
      return "Vencida";
    default:
      return "Sin plan";
  }
}

export function planSourceLabel(source: string | null | undefined): string {
  return source === "RESELLER" ? "Revendedor" : "Directo";
}
