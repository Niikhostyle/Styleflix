"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Clock } from "lucide-react";

/** Barra superior cuando la sesión es demo (sin membresía paga). */
export default function DemoBanner() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const expiresAt = session?.user?.demoExpiresAt;
  const isMember = Boolean(session?.user?.membershipActive);
  const demoActive = Boolean(session?.user?.demoActive);
  const handledExpireRef = useRef(false);

  const [now, setNow] = useState(() => Date.now());

  const remainingMs = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, new Date(expiresAt).getTime() - now);
  }, [expiresAt, now]);

  const showBanner = demoActive && !isMember && remainingMs > 0;

  useEffect(() => {
    if (!showBanner) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [showBanner]);

  // Al vencer: actualizar JWT una sola vez. Si ya estamos en planes, no recargar
  // (el reload infinito abortaba /api/pricing → "No se pudieron cargar los planes").
  useEffect(() => {
    if (isMember) return;
    if (!demoActive || !expiresAt) return;
    if (remainingMs > 0) return;
    if (handledExpireRef.current) return;
    handledExpireRef.current = true;

    const alreadyOnPlanes = pathname.startsWith("/onboarding/planes");

    void (async () => {
      try {
        await Promise.race([
          update({
            demoActive: false,
            catalogAccess: false,
            demoExpiresAt: expiresAt,
          }),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      } catch {
        /* ignore */
      }
      if (!alreadyOnPlanes) {
        window.location.replace("/onboarding/planes?demo=expired");
      }
    })();
  }, [remainingMs, demoActive, expiresAt, isMember, update, pathname]);

  if (!showBanner) return null;

  const totalSec = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const label = `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div className="sticky top-0 z-[60] border-b border-violet-400/20 bg-gradient-to-r from-cyan-500/15 via-[#0c1220]/95 to-violet-500/15 px-4 py-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 text-white/85">
          <Clock className="h-4 w-4 text-cyan-300" />
          Demo activa — te quedan{" "}
          <span className="font-semibold tabular-nums text-cyan-200">
            {label}
          </span>
        </p>
        <Link
          href="/onboarding/planes"
          className="brand-button rounded-lg px-3 py-1.5 text-xs font-bold"
        >
          Elegir plan
        </Link>
      </div>
    </div>
  );
}
