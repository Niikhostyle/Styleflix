import { prisma } from "@/lib/prisma";

/**
 * Dueño / creador de la app: ve todos los usuarios e historiales.
 * Otros SUPER_ADMIN no ven su cuenta ni a quienes él dio acceso.
 */
export const OWNER_ADMIN_EMAIL = (
  process.env.OWNER_ADMIN_EMAIL || "nfigueroa@gmail.com"
)
  .toLowerCase()
  .trim();

export function isOwnerAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === OWNER_ADMIN_EMAIL;
}

export function isOwnerAdminSession(session: {
  user?: { email?: string | null } | null;
} | null): boolean {
  return isOwnerAdminEmail(session?.user?.email);
}

export async function getOwnerAdminId(): Promise<string | null> {
  const owner = await prisma.user.findUnique({
    where: { email: OWNER_ADMIN_EMAIL },
    select: { id: true },
  });
  return owner?.id ?? null;
}

export type AdminVisibilityTarget = {
  id: string;
  email: string;
  grantedByUserId?: string | null;
};

/** Visibilidad en listado / detalle / historial de pagos. */
export function canViewerSeeAdminUser(opts: {
  viewerIsOwner: boolean;
  target: AdminVisibilityTarget;
  ownerId: string | null;
}): boolean {
  if (opts.viewerIsOwner) return true;

  if (isOwnerAdminEmail(opts.target.email)) return false;
  if (opts.ownerId && opts.target.id === opts.ownerId) return false;

  // Accesos otorgados por el dueño: solo él los ve
  if (
    opts.ownerId &&
    opts.target.grantedByUserId &&
    opts.target.grantedByUserId === opts.ownerId
  ) {
    return false;
  }

  return true;
}
