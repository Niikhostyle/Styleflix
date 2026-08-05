import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname === "/registro") return true;
  if (pathname === "/recuperar") return true;
  if (pathname === "/restablecer-clave") return true;
  if (pathname === "/verificar-email") return true;
  if (pathname === "/descargar") return true;
  if (pathname.startsWith("/downloads/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/billing/webhook") return true;
  // El precio se muestra en login/registro, antes de tener sesión
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
 * Soft paywall: login obligatorio para catálogo.
 * Sin membresía se puede navegar y ver 5 min (límite en el player).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await readToken(request);
  const loggedIn = isLoggedIn(token, request);

  if (isPublicPath(pathname)) {
    if (
      (pathname === "/login" ||
        pathname === "/registro" ||
        pathname === "/recuperar" ||
        pathname === "/restablecer-clave") &&
      loggedIn
    ) {
      const callback = request.nextUrl.searchParams.get("callbackUrl");
      const safe =
        callback && callback.startsWith("/") && !callback.startsWith("//")
          ? callback
          : "/";
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
