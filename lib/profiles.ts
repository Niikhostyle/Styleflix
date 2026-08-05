import { prisma } from "@/lib/prisma";

/** Crea el perfil principal si el usuario aún no tiene perfiles. */
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
