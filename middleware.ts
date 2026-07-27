import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/registro");

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/cuenta") && !token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/registro", "/cuenta/:path*"],
};
