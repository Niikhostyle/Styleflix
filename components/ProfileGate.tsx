"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const EXEMPT = [
  "/perfiles",
  "/login",
  "/registro",
  "/onboarding",
  "/membresia",
  "/cuenta",
  "/admin",
  "/recuperar",
  "/restablecer-clave",
  "/verificar-email",
  "/descargar",
];

/**
 * Obliga a elegir perfil antes de entrar al catálogo.
 */
export default function ProfileGate({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    const exempt = EXEMPT.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );

    if (status !== "authenticated" || exempt) {
      setReady(true);
      return;
    }

    const hasAccess =
      session?.user?.catalogAccess ||
      session?.user?.membershipActive ||
      session?.user?.role === "SUPER_ADMIN";

    if (!hasAccess) {
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/account/profiles/select", {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.profile?.id) {
          const next = encodeURIComponent(pathname || "/");
          router.replace(`/perfiles?next=${next}`);
          return;
        }
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pathname, session, router]);

  if (!ready && status === "authenticated") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/45">
        Cargando perfil…
      </div>
    );
  }

  return <>{children}</>;
}
