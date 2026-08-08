import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPlatformMetrics, pruneOldPresence } from "@/lib/presence";

export type SecurityEventType =
  | "SCAN"
  | "SCRAPE"
  | "AUTH_FAIL"
  | "RATE_LIMIT"
  | "BLOCK"
  | "UNBLOCK"
  | "SUSPICIOUS"
  | "INFO";

const SCAN_PATH_RE =
  /(?:wp-admin|wp-login|xmlrpc\.php|\.env|phpmyadmin|adminer|\.git\/|actuator|\.aws|composer\.json|vendor\/phpunit|cgi-bin|shell\.php|eval-stdin)/i;

const SCRAPER_UA_RE =
  /(?:bot|spider|crawl|scrape|scrapy|httpclient|python-requests|curl\/|wget|go-http|libwww|aiohttp|puppeteer|headless|semrush|ahrefs|dataforseo)/i;

const LEGIT_BOT_RE = /(?:googlebot|bingbot|applebot|duckduckbot|yandexbot|facebookexternalhit|twitterbot|slackbot|discordbot)/i;

function isLoopbackIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost" ||
    ip === "::ffff:127.0.0.1"
  );
}

export function clientIpFromHeaders(
  h: Headers | { get(name: string): string | null }
): string {
  const xf = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  const cf = h.get("cf-connecting-ip")?.trim();
  return cf || real || xf || "unknown";
}

export async function getRequestIp(): Promise<string> {
  const h = await headers();
  return clientIpFromHeaders(h);
}

export function classifyPath(pathname: string): {
  type: SecurityEventType | null;
  severity: string;
  detail: string;
} | null {
  if (SCAN_PATH_RE.test(pathname)) {
    return {
      type: "SCAN",
      severity: "high",
      detail: `Ruta de escaneo detectada: ${pathname}`,
    };
  }
  return null;
}

export function classifyUserAgent(ua: string | null): {
  type: SecurityEventType;
  severity: string;
  detail: string;
} | null {
  if (!ua || ua.length < 8) {
    return {
      type: "SUSPICIOUS",
      severity: "medium",
      detail: "User-Agent vacío o demasiado corto",
    };
  }
  if (LEGIT_BOT_RE.test(ua)) return null;
  if (SCRAPER_UA_RE.test(ua)) {
    return {
      type: "SCRAPE",
      severity: "medium",
      detail: `User-Agent de scraper: ${ua.slice(0, 160)}`,
    };
  }
  return null;
}

export async function recordSecurityEvent(opts: {
  type: SecurityEventType;
  severity?: string;
  ip?: string | null;
  path?: string | null;
  method?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  detail?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    await prisma.securityEvent.create({
      data: {
        type: opts.type,
        severity: opts.severity || "low",
        ip: opts.ip || null,
        path: opts.path || null,
        method: opts.method || null,
        userAgent: opts.userAgent?.slice(0, 500) || null,
        userId: opts.userId || null,
        detail: opts.detail?.slice(0, 1000) || null,
        meta: (opts.meta as object | undefined) ?? undefined,
      },
    });
  } catch (err) {
    console.error("[security] recordEvent", err);
  }
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  if (isLoopbackIp(ip)) return false;
  try {
    const row = await prisma.blockedIp.findUnique({ where: { ip } });
    if (!row) return false;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      await prisma.blockedIp.delete({ where: { ip } }).catch(() => null);
      return false;
    }
    await prisma.blockedIp
      .update({ where: { ip }, data: { hits: { increment: 1 } } })
      .catch(() => null);
    return true;
  } catch {
    return false;
  }
}

export async function blockIp(opts: {
  ip: string;
  reason?: string;
  source?: string;
  ttlHours?: number | null;
}) {
  const ip = opts.ip.trim();
  if (!ip || ip === "unknown") throw new Error("IP inválida");
  if (isLoopbackIp(ip)) {
    throw new Error("No se puede bloquear localhost / loopback");
  }
  const expiresAt =
    opts.ttlHours != null && opts.ttlHours > 0
      ? new Date(Date.now() + opts.ttlHours * 3600_000)
      : null;
  const row = await prisma.blockedIp.upsert({
    where: { ip },
    create: {
      ip,
      reason: opts.reason || "Bloqueo manual",
      source: opts.source || "MANUAL",
      expiresAt,
    },
    update: {
      reason: opts.reason || "Bloqueo manual",
      source: opts.source || "MANUAL",
      expiresAt,
    },
  });
  await recordSecurityEvent({
    type: "BLOCK",
    severity: "high",
    ip,
    detail: opts.reason || "IP bloqueada",
    meta: { source: opts.source || "MANUAL" },
  });
  return row;
}

export async function unblockIp(ip: string) {
  await prisma.blockedIp.delete({ where: { ip } }).catch(() => null);
  await recordSecurityEvent({
    type: "UNBLOCK",
    severity: "info",
    ip,
    detail: "IP desbloqueada",
  });
}

/** Tras varios SCAN desde la misma IP en ventana corta → auto-bloqueo. */
export async function maybeAutoBlockFromScans(ip: string) {
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return;
  const since = new Date(Date.now() - 15 * 60_000);
  const count = await prisma.securityEvent.count({
    where: { ip, type: "SCAN", createdAt: { gte: since } },
  });
  if (count >= 8) {
    const existing = await prisma.blockedIp.findUnique({ where: { ip } });
    if (!existing) {
      await blockIp({
        ip,
        reason: `Auto-bloqueo: ${count} escaneos en 15 min`,
        source: "AUTO_SCAN",
        ttlHours: 24,
      });
    }
  }
}

export async function maybeAutoBlockFromAuthFails(ip: string) {
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return;
  const since = new Date(Date.now() - 15 * 60_000);
  const count = await prisma.securityEvent.count({
    where: { ip, type: "AUTH_FAIL", createdAt: { gte: since } },
  });
  if (count >= 12) {
    const existing = await prisma.blockedIp.findUnique({ where: { ip } });
    if (!existing) {
      await blockIp({
        ip,
        reason: `Auto-bloqueo: ${count} fallos de login en 15 min`,
        source: "AUTO_AUTH",
        ttlHours: 6,
      });
    }
  }
}

export async function maybeAutoBlockFromRateLimit(ip: string) {
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return;
  const since = new Date(Date.now() - 15 * 60_000);
  const count = await prisma.securityEvent.count({
    where: { ip, type: "RATE_LIMIT", createdAt: { gte: since } },
  });
  if (count >= 3) {
    const existing = await prisma.blockedIp.findUnique({ where: { ip } });
    if (!existing) {
      await blockIp({
        ip,
        reason: `Auto-bloqueo: ráfagas de tráfico (${count}) en 15 min`,
        source: "AUTO_RATE",
        ttlHours: 2,
      });
    }
  }
}

export async function maybeAutoBlockFromSuspicious(ip: string) {
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return;
  const since = new Date(Date.now() - 30 * 60_000);
  const count = await prisma.securityEvent.count({
    where: {
      ip,
      type: { in: ["SUSPICIOUS", "SCRAPE"] },
      createdAt: { gte: since },
    },
  });
  if (count >= 5) {
    const existing = await prisma.blockedIp.findUnique({ where: { ip } });
    if (!existing) {
      await blockIp({
        ip,
        reason: `Auto-bloqueo: ${count} señales sospechosas/scraper en 30 min`,
        source: "AUTO_SCAN",
        ttlHours: 12,
      });
    }
  }
}

export async function getSecurityDashboard(hours = 24) {
  const since = new Date(Date.now() - hours * 3600_000);
  void pruneOldPresence(45);

  const [
    events,
    eventsTotal,
    blocked,
    byType,
    bySeverity,
    topIps,
    metrics,
    anomalies,
    recentTraffic,
  ] = await Promise.all([
    prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: since },
        type: { not: "INFO" },
      },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.securityEvent.count({
      where: { createdAt: { gte: since } },
    }),
    prisma.blockedIp.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }),
    prisma.securityEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.securityEvent.groupBy({
      by: ["severity"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.securityEvent.groupBy({
      by: ["ip"],
      where: {
        createdAt: { gte: since },
        ip: { not: null },
        type: { not: "INFO" },
      },
      _count: { _all: true },
      orderBy: { _count: { ip: "desc" } },
      take: 15,
    }),
    getPlatformMetrics(hours),
    prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: since },
        type: { in: ["SUSPICIOUS", "RATE_LIMIT", "SCRAPE"] },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 2 * 3600_000) },
        type: "INFO",
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
  ]);

  return {
    since: since.toISOString(),
    hours,
    totals: {
      events: eventsTotal,
      blocked: blocked.length,
      scans: byType.find((t) => t.type === "SCAN")?._count._all || 0,
      scrapes: byType.find((t) => t.type === "SCRAPE")?._count._all || 0,
      authFails: byType.find((t) => t.type === "AUTH_FAIL")?._count._all || 0,
      suspicious:
        byType.find((t) => t.type === "SUSPICIOUS")?._count._all || 0,
      rateLimits:
        byType.find((t) => t.type === "RATE_LIMIT")?._count._all || 0,
      trafficSamples: byType.find((t) => t.type === "INFO")?._count._all || 0,
    },
    byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
    bySeverity: bySeverity.map((s) => ({
      severity: s.severity,
      count: s._count._all,
    })),
    topIps: topIps
      .filter((r) => r.ip)
      .map((r) => ({ ip: r.ip!, count: r._count._all })),
    events,
    anomalies,
    recentTraffic,
    blocked,
    metrics,
  };
}
