"use client";

import Script from "next/script";
import { getAdSenseConfig } from "@/lib/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Carga el script de AdSense una sola vez (layout). */
export default function GoogleAdSense() {
  const { clientId } = getAdSenseConfig();
  if (!clientId) return null;

  return (
    <Script
      id="adsense-init"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
