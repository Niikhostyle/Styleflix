import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/api/auth");
}

function authSecret() {
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

/** Detecta cookie de sesión aunque getToken falle tras el proxy HTTPS. */
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

  // Probar ambas variantes: Coolify puede mentir con el esquema http/https
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/registro")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = await readToken(request);
  const loggedIn = isLoggedIn(token, request);

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && loggedIn) {
      const dest = request.nextUrl.searchParams.get("callbackUrl") || "/";
      // Evitar open redirect
      const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
      return NextResponse.redirect(new URL(safe, request.url));
    }
    return NextResponse.next();
  }

  if (!loggedIn) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Rol: si tenemos JWT lo validamos; si solo hay cookie, la página /admin usa auth()
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
