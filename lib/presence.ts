import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { hasActiveMembership } from "@/lib/access";

/** Ventana para considerar “en línea / activo ahora”. */
export const PRESENCE_ONLINE_MS = 15 * 60_000;

/** No escribir a DB más de una vez por este intervalo por sesión. */
export const PRESENCE_THROTTLE_MS = 45_000;

function uaHash(ua: string | null | undefined): string {
  const raw = (ua || "unknown").slice(0, 200);
  return createHash("sha1").update(raw).digest("hex").slice(0, 12);
}

export function presenceSessionKey(opts: {
  userId?: string | null;
  ip: string;
  userAgent?: string | null;
}): string {
  const ip = opts.ip || "unknown";
  const uah = uaHash(opts.userAgent);
  if (opts.userId) return `u:${opts.userId}|${ip}|${uah}`;
  return `g:${ip}|${uah}`;
}

export async function touchPresence(opts: {
  userId?: string | null;
  ip: string;
  userAgent?: string | null;
  path?: string | null;
  country?: string | null;
}): Promise<void> {
  const ip = (opts.ip || "unknown").trim();
  if (!ip || ip === "unknown") return;

  const sessionKey = presenceSessionKey({
    userId: opts.userId,
    ip,
    userAgent: opts.userAgent,
  });
  const now = new Date();
  const path = opts.path?.slice(0, 200) || null;
  const userAgent = opts.userAgent?.slice(0, 500) || null;
  const country = opts.country?.slice(0, 8) || null;

  try {
    const existing = await prisma.presenceSession.findUnique({
      where: { sessionKey },
      select: { id: true, lastSeenAt: true },
    });

    if (
      existing &&
      now.getTime() - existing.lastSeenAt.getTime() < PRESENCE_THROTTLE_MS
    ) {
      return;
    }

    if (existing) {
      await prisma.presenceSession.update({
        where: { sessionKey },
        data: {
          lastSeenAt: now,
          hits: { increment: 1 },
          path: path ?? undefined,
          userAgent: userAgent ?? undefined,
          country: country ?? undefined,
          userId: opts.userId || undefined,
        },
      });
    } else {
      await prisma.presenceSession.create({
        data: {
          sessionKey,
          userId: opts.userId || null,
          ip,
          userAgent,
          path,
          country,
          hits: 1,
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
    }

    if (opts.userId) {
      await prisma.user.update({
        where: { id: opts.userId },
        data: { lastSeenAt: now, lastIp: ip },
      });
    }
  } catch (err) {
    console.error("[presence] touch", err);
  }
}

function sinceDate(msAgo: number) {
  return new Date(Date.now() - msAgo);
}

function startOfTodaySantiago(): Date {
  // Medianoche aproximada Chile (UTC-4 / -3): usamos offset local del servidor
  // y también una ventana de 24h desde 00:00 America/Santiago via Intl.
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    // Interpretar medianoche Santiago como UTC+0 provisional; ajustamos con offset
    const guess = new Date(`${y}-${m}-${d}T04:00:00.000Z`); // ~00:00 CLT/CLST
    return guess;
  } catch {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
}

export async function getPlatformMetrics(hours = 24) {
  const now = Date.now();
  const onlineSince = sinceDate(PRESENCE_ONLINE_MS);
  const windowSince = sinceDate(hours * 3600_000);
  const daySince = sinceDate(24 * 3600_000);
  const todayStart = startOfTodaySantiago();

  const [
    onlineSessions,
    onlineUsersDistinct,
    activeIpsOnline,
    sessionsInWindow,
    ipsInWindow,
    usersSeenInWindow,
    usersLastSeen,
    membershipUsers,
    totalUsers,
    demoUsers,
    presenceRows,
    registrationsToday,
    ipsTodayRows,
    usersSeenCalendarToday,
  ] = await Promise.all([
    prisma.presenceSession.count({
      where: { lastSeenAt: { gte: onlineSince } },
    }),
    prisma.presenceSession.findMany({
      where: {
        lastSeenAt: { gte: onlineSince },
        userId: { not: null },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.presenceSession.findMany({
      where: { lastSeenAt: { gte: onlineSince } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.presenceSession.count({
      where: { lastSeenAt: { gte: windowSince } },
    }),
    prisma.presenceSession.findMany({
      where: { lastSeenAt: { gte: windowSince } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.user.count({
      where: { lastSeenAt: { gte: windowSince } },
    }),
    prisma.user.findMany({
      where: { lastSeenAt: { not: null } },
      orderBy: { lastSeenAt: "desc" },
      take: 40,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        lastSeenAt: true,
        lastIp: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: { not: "SUPER_ADMIN" },
        OR: [
          { subscriptionStatus: "ACTIVE" },
          { subscriptionStatus: "CANCELLED" },
        ],
        currentPeriodEnd: { gt: new Date() },
      },
      select: {
        id: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        role: true,
      },
    }),
    prisma.user.count({ where: { role: { not: "SUPER_ADMIN" } } }),
    prisma.user.count({
      where: {
        demoExpiresAt: { gt: new Date() },
        role: { not: "SUPER_ADMIN" },
      },
    }),
    prisma.presenceSession.findMany({
      where: { lastSeenAt: { gte: onlineSince } },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
      select: {
        id: true,
        ip: true,
        userId: true,
        userAgent: true,
        path: true,
        country: true,
        hits: true,
        firstSeenAt: true,
        lastSeenAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: {
        role: { not: "SUPER_ADMIN" },
        createdAt: { gte: todayStart },
      },
    }),
    prisma.presenceSession.findMany({
      where: { lastSeenAt: { gte: todayStart } },
      select: { ip: true },
      distinct: ["ip"],
    }),
    prisma.user.count({
      where: { lastSeenAt: { gte: todayStart } },
    }),
  ]);

  const membersActive = membershipUsers.filter((u) =>
    hasActiveMembership(u)
  ).length;

  // Buckets horarios de actividad (últimas `hours`, máx 24 barras)
  const bucketCount = Math.min(24, Math.max(6, hours));
  const bucketMs = (hours * 3600_000) / bucketCount;
  const bucketStart = now - hours * 3600_000;
  const recentPresence = await prisma.presenceSession.findMany({
    where: { lastSeenAt: { gte: windowSince } },
    select: { lastSeenAt: true, userId: true, ip: true },
  });

  const activityBuckets: Array<{
    label: string;
    users: number;
    ips: number;
    hits: number;
  }> = [];

  for (let i = 0; i < bucketCount; i++) {
    const from = bucketStart + i * bucketMs;
    const to = from + bucketMs;
    const inBucket = recentPresence.filter((p) => {
      const t = p.lastSeenAt.getTime();
      return t >= from && t < to;
    });
    const users = new Set(
      inBucket.map((p) => p.userId).filter(Boolean) as string[]
    ).size;
    const ips = new Set(inBucket.map((p) => p.ip)).size;
    activityBuckets.push({
      label: new Date(from).toLocaleTimeString("es-CL", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      users,
      ips,
      hits: inBucket.length,
    });
  }

  const usersSeenToday = await prisma.user.count({
    where: { lastSeenAt: { gte: daySince } },
  });

  return {
    generatedAt: new Date().toISOString(),
    onlineWindowMinutes: PRESENCE_ONLINE_MS / 60_000,
    hours,
    live: {
      sessions: onlineSessions,
      users: onlineUsersDistinct.length,
      ips: activeIpsOnline.length,
    },
    today: {
      registrations: registrationsToday,
      ips: ipsTodayRows.length,
      usersSeen: usersSeenCalendarToday,
    },
    window: {
      sessions: sessionsInWindow,
      users: usersSeenInWindow,
      ips: ipsInWindow.length,
      usersToday: usersSeenToday,
    },
    platform: {
      totalUsers,
      membersActive,
      demosActive: demoUsers,
    },
    recentConnections: usersLastSeen.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      subscriptionStatus: u.subscriptionStatus,
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      lastIp: u.lastIp,
      createdAt: u.createdAt.toISOString(),
      online:
        !!u.lastSeenAt &&
        now - u.lastSeenAt.getTime() <= PRESENCE_ONLINE_MS,
    })),
    liveSessions: presenceRows.map((s) => ({
      id: s.id,
      ip: s.ip,
      path: s.path,
      country: s.country,
      hits: s.hits,
      userAgent: s.userAgent,
      firstSeenAt: s.firstSeenAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      user: s.user
        ? {
            id: s.user.id,
            name: s.user.name,
            email: s.user.email,
            role: s.user.role,
          }
        : null,
    })),
    activityBuckets,
  };
}

/** Limpia sesiones muy viejas (opcional, llamado desde dashboard). */
export async function pruneOldPresence(days = 30) {
  const cutoff = sinceDate(days * 24 * 3600_000);
  await prisma.presenceSession
    .deleteMany({ where: { lastSeenAt: { lt: cutoff } } })
    .catch(() => null);
}
