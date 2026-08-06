import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlansCatalog } from "@/lib/settings";
import { getTier, isPlanTier, type PlanTier } from "@/lib/plans";

export const PROFILE_COOKIE = "veotv_profile";

/** Sin heartbeat en este tiempo → el lock se considera muerto y se puede tomar. */
export const PLAYBACK_LOCK_STALE_MS = 45_000;

export function newLockToken() {
  return randomBytes(24).toString("hex");
}

export async function getEffectiveMaxProfiles(user: {
  id: string;
  role?: string | null;
  planMaxProfiles?: number | null;
  planTier?: string | null;
}): Promise<number> {
  if (user.role === "SUPER_ADMIN") return 10;

  // Preferir cuota guardada en el usuario (activación de plan)
  if (user.planMaxProfiles && user.planMaxProfiles > 0) {
    return Math.min(10, Math.max(1, user.planMaxProfiles));
  }

  // Fallback: catálogo por tier (por si planMaxProfiles no se rellenó)
  if (user.planTier && isPlanTier(user.planTier)) {
    const catalog = await getPlansCatalog();
    return Math.min(
      10,
      Math.max(1, getTier(catalog, user.planTier as PlanTier).maxProfiles)
    );
  }

  // Demo / sin plan: 1 perfil
  return 1;
}

export async function ensurePrimaryProfile(opts: {
  userId: string;
  name: string;
  maxProfiles?: number | null;
}) {
  const count = await prisma.profile.count({ where: { userId: opts.userId } });
  if (count > 0) return;

  await prisma.profile.create({
    data: {
      userId: opts.userId,
      name: (opts.name || "Principal").slice(0, 40),
      avatarKey: "1",
      sortOrder: 0,
    },
  });
}

export async function listProfiles(userId: string) {
  return prisma.profile.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getSelectedProfileId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PROFILE_COOKIE)?.value || null;
}

export async function setSelectedProfileCookie(profileId: string) {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSelectedProfileCookie() {
  const jar = await cookies();
  jar.delete(PROFILE_COOKIE);
}

export async function resolveActiveProfile(userId: string) {
  const selectedId = await getSelectedProfileId();
  if (selectedId) {
    const p = await prisma.profile.findFirst({
      where: { id: selectedId, userId },
    });
    if (p) return p;
  }
  return null;
}
