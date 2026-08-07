/**
 * Clasificación y contadores en Edge (middleware).
 * Sin Prisma: solo memoria del proceso + fetch al ingest.
 */

export type EdgeSignalType =
  | "SCAN"
  | "SCRAPE"
  | "SUSPICIOUS"
  | "RATE_LIMIT"
  | "INFO";

export const SCAN_PATH_RE =
  /(?:wp-admin|wp-login|xmlrpc\.php|\.env|phpmyadmin|adminer|\.git\/|actuator|\.aws|composer\.json|vendor\/phpunit|cgi-bin|shell\.php|eval-stdin|\.svn|\.hg|backup\.sql|wp-config|passwd|etc\/shadow)/i;

const SCRAPER_UA_RE =
  /(?:bot|spider|crawl|scrape|scrapy|httpclient|python-requests|curl\/|wget|go-http|libwww|aiohttp|puppeteer|playwright|headless|semrush|ahrefs|dataforseo|postman|insomnia|httpie|axios\/|node-fetch|okhttp)/i;

const LEGIT_BOT_RE =
  /(?:googlebot|bingbot|applebot|duckduckbot|yandexbot|facebookexternalhit|twitterbot|slackbot|discordbot)/i;

type IpBucket = {
  windowStart: number;
  hits: number;
  paths: Set<string>;
  lastSignalAt: number;
  infoLogged: number;
};

const buckets = new Map<string, IpBucket>();
const WINDOW_MS = 10 * 60_000;
const RATE_WINDOW_MS = 60_000;

/** Limpia buckets viejos ocasionalmente. */
function prune(now: number) {
  if (buckets.size < 400) return;
  for (const [ip, b] of buckets) {
    if (now - b.windowStart > WINDOW_MS * 2) buckets.delete(ip);
  }
}

function getBucket(ip: string, now: number): IpBucket {
  let b = buckets.get(ip);
  if (!b || now - b.windowStart > WINDOW_MS) {
    b = {
      windowStart: now,
      hits: 0,
      paths: new Set(),
      lastSignalAt: 0,
      infoLogged: 0,
    };
    buckets.set(ip, b);
  }
  return b;
}

export function classifyUserAgentEdge(ua: string | null): {
  type: EdgeSignalType;
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
      detail: `User-Agent de scraper/herramienta: ${ua.slice(0, 160)}`,
    };
  }
  return null;
}

export type EdgeSignal = {
  type: EdgeSignalType;
  severity: string;
  detail: string;
  meta?: Record<string, unknown>;
};

/**
 * Evalúa el request y decide qué señales emitir (0..N).
 * Contadores por IP en memoria del proceso Node/Edge.
 */
export function evaluateRequest(opts: {
  ip: string;
  path: string;
  method: string;
  ua: string | null;
  loggedIn: boolean;
  isAdminRole: boolean;
}): EdgeSignal[] {
  const now = Date.now();
  prune(now);
  const signals: EdgeSignal[] = [];
  const { ip, path, method, ua, loggedIn, isAdminRole } = opts;

  if (ip === "unknown" || !ip) return signals;

  const bucket = getBucket(ip, now);
  bucket.hits += 1;
  // Normalizar path (sin query)
  const clean = path.split("?")[0] || path;
  if (clean.length < 200) bucket.paths.add(clean);

  // Intentos a /admin sin ser SUPER_ADMIN
  if (clean.startsWith("/admin") && !isAdminRole) {
    if (now - bucket.lastSignalAt > 30_000) {
      bucket.lastSignalAt = now;
      signals.push({
        type: "SUSPICIOUS",
        severity: "high",
        detail: `Acceso a panel admin sin privilegios: ${clean}`,
        meta: { loggedIn },
      });
    }
  }

  const uaHit = classifyUserAgentEdge(ua);
  if (uaHit && now - bucket.lastSignalAt > 20_000) {
    bucket.lastSignalAt = now;
    signals.push(uaHit);
  }

  // Ráfaga: muchos hits en 1 minuto (aprox. hits en ventana 10m / proporción)
  // Mejor: contador corto en el mismo bucket con subventana
  const hitsPerMinApprox =
    bucket.hits / Math.max(1, (now - bucket.windowStart) / RATE_WINDOW_MS);
  if (hitsPerMinApprox >= 90 && now - bucket.lastSignalAt > 45_000) {
    bucket.lastSignalAt = now;
    signals.push({
      type: "RATE_LIMIT",
      severity: "high",
      detail: `Ráfaga: ~${Math.round(hitsPerMinApprox)} req/min desde ${ip}`,
      meta: { hits: bucket.hits, paths: bucket.paths.size },
    });
  }

  // Fan-out: muchas rutas distintas = posible audit/crawler
  if (bucket.paths.size >= 22 && now - bucket.lastSignalAt > 60_000) {
    bucket.lastSignalAt = now;
    signals.push({
      type: "SUSPICIOUS",
      severity: "high",
      detail: `Anomalía: ${bucket.paths.size} rutas distintas en 10 min (posible auditoría/escaneo)`,
      meta: {
        pathCount: bucket.paths.size,
        samplePaths: [...bucket.paths].slice(0, 25),
        hits: bucket.hits,
        loggedIn,
      },
    });
  }

  // Sample de tráfico normal para tener rastro de audits “suaves”
  // ~12% de páginas HTML + siempre primeras 3 rutas nuevas de la IP
  const isAsset = /\.(js|css|map|woff2?|ttf|ico)$/i.test(clean);
  const isApi = clean.startsWith("/api/");
  const shouldSample =
    !isAsset &&
    (bucket.infoLogged < 3 ||
      (isApi && bucket.hits % 7 === 0) ||
      (!isApi && bucket.hits % 8 === 0));

  if (shouldSample && signals.length === 0) {
    bucket.infoLogged += 1;
    signals.push({
      type: "INFO",
      severity: "low",
      detail: `Tráfico: ${method} ${clean}`,
      meta: {
        loggedIn,
        pathCount: bucket.paths.size,
        hits: bucket.hits,
      },
    });
  }

  return signals;
}

export function postSecuritySignals(
  origin: string,
  ingestToken: string,
  base: {
    ip: string;
    path: string;
    method: string;
    userAgent: string | null;
  },
  signals: EdgeSignal[]
) {
  for (const s of signals) {
    void fetch(`${origin}/api/internal/security-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-veotv-ingest": ingestToken,
      },
      body: JSON.stringify({
        type: s.type,
        severity: s.severity,
        ip: base.ip,
        path: base.path,
        method: base.method,
        userAgent: base.userAgent,
        detail: s.detail,
        meta: s.meta,
      }),
    }).catch(() => undefined);
  }
}
