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
};

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
