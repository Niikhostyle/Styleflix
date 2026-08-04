import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { hasActiveMembership } from "@/lib/access";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname === "/descargar") return true;
  if (pathname.startsWith("/downloads/")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname === "/api/billing/webhook") return true;
  return false;
}

/** Autenticado pero sin membresía: puede pagar / ver estado. */
function isMembershipPath(pathname: string) {
  if (pathname === "/membresia" || pathname.startsWith("/membresia/")) {
    return true;
  }
  if (pathname.startsWith("/api/billing/")) return true;
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

function tokenHasMembership(token: Awaited<ReturnType<typeof readToken>>) {
  if (!token) return false;
  if (token.membershipActive === true) return true;
  return hasActiveMembership({
    role: token.role as string | undefined,
    subscriptionStatus: token.subscriptionStatus as string | undefined,
    currentPeriodEnd: token.currentPeriodEnd as string | null | undefined,
  });
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
      const dest = tokenHasMembership(token) ? "/" : "/membresia";
      const callback = request.nextUrl.searchParams.get("callbackUrl");
      if (callback && tokenHasMembership(token)) {
        const safe =
          callback.startsWith("/") && !callback.startsWith("//")
            ? callback
            : dest;
        return NextResponse.redirect(new URL(safe, request.url));
      }
      return NextResponse.redirect(new URL(dest, request.url));
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

  // Paywall: sin membresía solo /membresia y billing APIs
  if (!tokenHasMembership(token) && !isMembershipPath(pathname)) {
    if (token?.role === "SUPER_ADMIN") {
      return NextResponse.next();
    }
    // Si solo hay cookie sin JWT legible, dejar pasar a membresía por seguridad
    if (!token && hasSessionCookie(request) && !isMembershipPath(pathname)) {
      return NextResponse.redirect(new URL("/membresia", request.url));
    }
    if (token) {
      return NextResponse.redirect(new URL("/membresia", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
