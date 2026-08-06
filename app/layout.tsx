import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { headers } from "next/headers";
import Providers from "@/components/Providers";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { getPricing } from "@/lib/settings";
import {
  clientIpFromHeaders,
  isIpBlocked,
  recordSecurityEvent,
} from "@/lib/security";
import "./globals.css";

/** Precio y sesión deben leerse en cada request (admin puede cambiar precios). */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: `${APP_NAME} — ${APP_TAGLINE}`,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  if (await isIpBlocked(ip)) {
    await recordSecurityEvent({
      type: "BLOCK",
      severity: "high",
      ip,
      detail: "Acceso denegado: IP en lista negra",
    });
    return (
      <html lang="es">
        <body className="flex min-h-screen items-center justify-center bg-[#06080f] text-white">
          <div className="max-w-md px-6 text-center">
            <p className="text-lg font-semibold">Acceso restringido</p>
            <p className="mt-2 text-sm text-white/55">
              Tu conexión fue bloqueada por seguridad. Si crees que es un error,
              contacta a soporte.
            </p>
          </div>
        </body>
      </html>
    );
  }

  const pricing = await getPricing();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#070b14] text-white antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!/ngrok/i.test(location.hostname))return;var f=window.fetch.bind(window);window.fetch=function(i,n){n=n||{};var h=new Headers(n.headers||(i&&i.headers)||{});h.set("ngrok-skip-browser-warning","1");n.headers=h;return f(i,n);};}catch(e){}})();`,
          }}
        />
        <Providers pricing={pricing}>{children}</Providers>
      </body>
    </html>
  );
}
