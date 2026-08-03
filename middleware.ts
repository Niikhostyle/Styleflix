import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth")) return true;
  return false;
}

/** Coolify/proxy sirve HTTPS al usuario pero el request interno puede ser http. */
function useSecureCookies(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  if ((process.env.AUTH_URL || "").startsWith("https")) return true;
  return request.nextUrl.protocol === "https:";
}

function authSecret() {
  // Acceso estático para Edge + quitar comillas si Coolify las pegó
  const raw =
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

async function readToken(request: NextRequest) {
  const secret = authSecret();
  const secureCookie = useSecureCookies(request);
  return getToken({
    req: request,
    secret,
    secureCookie,
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/registro")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicPath(pathname)) {
    if (pathname === "/login") {
      const token = await readToken(request);
      if (token) {
        const dest = request.nextUrl.searchParams.get("callbackUrl") || "/";
        return NextResponse.redirect(new URL(dest, request.url));
      }
    }
    return NextResponse.next();
  }

  const token = await readToken(request);

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith("/admin") && token.role !== "SUPER_ADMIN") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
