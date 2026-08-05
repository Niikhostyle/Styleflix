import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
  if (pathname === "/api/settings/preview") return true;
  if (pathname.startsWith("/onboarding")) return true;
  return false;
}

/** Rutas que exigen sesión pero no membresía (pago / cuenta). */
function isMembershipExempt(pathname: string) {
  if (pathname.startsWith("/onboarding")) return true;
  if (pathname.startsWith("/membresia")) return true;
  if (pathname.startsWith("/cuenta")) return true;
  if (pathname.startsWith("/admin")) return true;
  if (pathname.startsWith("/api/billing")) return true;
  if (pathname.startsWith("/api/account")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname === "/api/requests") return true;
  if (pathname === "/api/pricing") return true;
  return false;
}

function authSecret() {
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

function hasSessionCookie(request: NextRequest) {
  for (const c of request.cookies.getAll()) {
    const n = c.name.toLowerCase();
    if (
      n.includes("authjs.session-token") ||
      n.includes("next-auth.session-token")
    ) {
      return true;
    }
  }
  return false;
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

function isLoggedIn(
  token: Awaited<ReturnType<typeof readToken>>,
  request: NextRequest
) {
  return Boolean(token) || hasSessionCookie(request);
}

/**
 * Paywall duro: catálogo requiere sesión + membresía activa.
 * Landing `/` pública; sin plan → onboarding.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await readToken(request);
  const loggedIn = isLoggedIn(token, request);
  const membershipActive = Boolean(
    token?.membershipActive || token?.role === "SUPER_ADMIN"
  );

  if (pathname === "/") {
    if (loggedIn && !membershipActive) {
      return NextResponse.redirect(new URL("/onboarding/planes", request.url));
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
      const dest = membershipActive ? "/" : "/onboarding/planes";
      const callback = request.nextUrl.searchParams.get("callbackUrl");
      const safe =
        callback && callback.startsWith("/") && !callback.startsWith("//")
          ? callback
          : dest;
      if (!membershipActive && !safe.startsWith("/onboarding") && safe !== "/membresia" && !safe.startsWith("/cuenta")) {
        return NextResponse.redirect(new URL("/onboarding/planes", request.url));
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

  if (!membershipActive && !isMembershipExempt(pathname)) {
    return NextResponse.redirect(new URL("/onboarding/planes", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/billing/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
