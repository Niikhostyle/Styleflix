"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const INTERVAL_MS = 60_000;

/** Envía latidos de presencia para métricas del panel de seguridad. */
export default function PresenceHeartbeat() {
  const { status } = useSession();
  const pathname = usePathname();
  const lastSent = useRef(0);

  useEffect(() => {
    if (status !== "authenticated") return;

    const send = () => {
      const now = Date.now();
      if (now - lastSent.current < 20_000) return;
      lastSent.current = now;
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname || "/" }),
        keepalive: true,
      }).catch(() => undefined);
    };

    send();
    const id = window.setInterval(send, INTERVAL_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [status, pathname]);

  return null;
}
