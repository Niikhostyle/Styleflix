"use client";

import { useEffect, useRef } from "react";
import { getAdSenseConfig } from "@/lib/adsense";

type Props = {
  slot: "home" | "detail" | string;
  className?: string;
  format?: string;
};

/**
 * Unidad display de AdSense.
 * Sin CLIENT_ID / SLOT muestra un placeholder (desarrollo).
 */
export default function AdSenseUnit({
  slot,
  className = "",
  format = "auto",
}: Props) {
  const { clientId, slotHome, slotDetail } = getAdSenseConfig();
  const pushed = useRef(false);

  const slotId =
    slot === "home" ? slotHome : slot === "detail" ? slotDetail : slot;

  useEffect(() => {
    if (!clientId || !slotId || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* ignore */
    }
  }, [clientId, slotId]);

  if (!clientId || !slotId) {
    return (
      <div
        className={`flex min-h-[90px] items-center justify-center rounded border border-dashed border-white/15 bg-white/[0.03] px-4 text-center text-xs text-neutral-500 ${className}`}
      >
        Espacio AdSense — configura NEXT_PUBLIC_ADSENSE_CLIENT_ID y el slot
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
