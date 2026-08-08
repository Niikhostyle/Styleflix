import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  SCAN_PATH_RE,
  evaluateRequest,
  postSecuritySignals,
} from "@/lib/security-edge";

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/login") return true;
  if (pathname === "/registro") return true;
  if (pathname === "/recuperar") return true;
  if (pathname === "/restablecer-clave") return true;
  if (pathname === "/verificar-email") return true;
  if (pathname === "/descargar") return true;
  if (pathname.startsWith("/downloads/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/billing/webhook") return true;
  if (pathname === "/api/pricing") return true;
  if (pathname === "/api/health") return true;
  if (pathname === "/api/settings/preview") return true;
  if (pathname === "/api/internal/security-ingest") return true;
  // HLS Zilla: auth por token firmado (si middleware redirige a /login, hls.js rompe)
  if (pathname === "/api/play/animeav1-hls") return true;
  if (pathname === "/api/play/animeav1-embed") return true;
  // Portadas/páginas MangaDex: host allowlist en la route (img no manda bien auth)
  if (pathname === "/api/manga/image") return true;
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname === "/perfiles") return true;
  return false;
}

/** Rutas que exigen sesión pero no membresía/demo (pago / cuenta). */
function isMembershipExempt(pathname: string) {
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname === "/perfiles") return true;
  if (pathname.startsWith("/membresia")) return true;
  if (pathname.startsWith("/cuenta")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/billing")) return true;
  if (pathname.startsWith("/api/account")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/playback")) return true;
  if (pathname === "/api/requests") return true;
  if (pathname === "/api/pricing") return true;
  if (pathname === "/api/presence/heartbeat") return true;
  return false;
}

function authSecret() {
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

async function readToken(request: NextRequest) {
  const secret = authSecret();
  if (!secret) return null;

  const secure = await getToken({
    req: request,
    secret,
    secureCookie: true,
  });
  if (secure) return secure;

  return getToken({
    req: request,
    secret,
    secureCookie: false,
  });
}

function isLoggedIn(token: Awaited<ReturnType<typeof readToken>>) {
  // Solo token JWT válido (cookie sola sin payload = sesión muerta)
  return Boolean(token?.sub || token?.id);
}

function hasAccess(
  token: Awaited<ReturnType<typeof readToken>>
): boolean {
  if (!token) return false;
  if (token.role === "SUPER_ADMIN") return true;

  // Membresía: evaluar fecha de vencimiento (no confiar solo en membershipActive stale)
  const periodEnd = token.currentPeriodEnd as string | null | undefined;
  if (periodEnd && new Date(periodEnd).getTime() > Date.now()) {
    const status = String(token.subscriptionStatus || "");
    if (status === "ACTIVE" || status === "CANCELLED" || token.membershipActive) {
      return true;
    }
  }

  const exp = token.demoExpiresAt as string | null | undefined;
  if (exp && new Date(exp).getTime() > Date.now()) return true;
  return false;
}

function destinationWithoutAccess(
  token: Awaited<ReturnType<typeof readToken>>
): string {
  const exp = token?.demoExpiresAt as string | null | undefined;
  if (exp) return "/onboarding/planes?demo=expired";
  return "/onboarding/bienvenida";
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Paywall + señales de seguridad (scans, scrapers, ráfagas, fan-out de rutas).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = clientIp(request);
  const ua = request.headers.get("user-agent");
  const origin = request.nextUrl.origin;
  const secret =
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  const ingestToken = secret.slice(0, 32);

  // Señal de escaneo clásico → bloqueo inmediato
  if (SCAN_PATH_RE.test(pathname)) {
    if (ingestToken) {
      postSecuritySignals(
        origin,
        ingestToken,
        {
          ip,
          path: pathname,
          method: request.method,
          userAgent: ua,
        },
        [
          {
            type: "SCAN",
            severity: "high",
            detail: `Escaneo detectado: ${pathname}`,
          },
        ]
      );
    }
    return new NextResponse("Forbidden", { status: 403 });
  }

  const token = await readToken(request);
  const loggedIn = isLoggedIn(token);
  const catalogAccess = hasAccess(token);
  const isAdminRole = token?.role === "SUPER_ADMIN";

  // Anomalías / muestreo (no bloquea; solo registra).
  // /api/health = Docker/Coolify HEALTHCHECK (curl a 127.0.0.1) → no clasificar.
  if (
    ingestToken &&
    !pathname.startsWith("/api/internal/") &&
    pathname !== "/api/health"
  ) {
    const signals = evaluateRequest({
      ip,
      path: pathname,
      method: request.method,
      ua,
      loggedIn,
      isAdminRole: Boolean(isAdminRole),
    });
    if (signals.length) {
      postSecuritySignals(
        origin,
        ingestToken,
        {
          ip,
          path: pathname,
          method: request.method,
          userAgent: ua,
        },
        signals
      );
    }
  }

  if (pathname === "/") {
    if (loggedIn && !catalogAccess) {
      return NextResponse.redirect(
        new URL(destinationWithoutAccess(token), request.url)
      );
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    if (
      (pathname === "/login" ||
        pathname === "/registro" ||
        pathname === "/recuperar" ||
        pathname === "/restablecer-clave") &&
      loggedIn
    ) {
      const dest = catalogAccess ? "/" : destinationWithoutAccess(token);
      const callback = request.nextUrl.searchParams.get("callbackUrl");
      const safe =
        callback && callback.startsWith("/") && !callback.startsWith("//")
          ? callback
          : dest;
      if (
        !catalogAccess &&
        !safe.startsWith("/onboarding") &&
        safe !== "/membresia" &&
        !safe.startsWith("/cuenta")
      ) {
        return NextResponse.redirect(
          new URL(destinationWithoutAccess(token), request.url)
        );
      }
      return NextResponse.redirect(new URL(safe, request.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (
    pathname.startsWith("/admin") &&
    token &&
    token.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!catalogAccess && !isMembershipExempt(pathname)) {
    return NextResponse.redirect(
      new URL(destinationWithoutAccess(token), request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/billing/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
