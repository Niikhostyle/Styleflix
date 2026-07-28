"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";

function isNgrokHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.includes("ngrok");
}

/** Evita la página HTML de aviso de ngrok en fetch/RSC (causa Unexpected token '<'). */
function NgrokFetchPatch({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isNgrokHost()) return;
    if ((window as unknown as { __sfNgrokPatched?: boolean }).__sfNgrokPatched) {
      return;
    }
    (window as unknown as { __sfNgrokPatched?: boolean }).__sfNgrokPatched = true;

    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      headers.set("ngrok-skip-browser-warning", "1");
      return originalFetch(input, { ...init, headers });
    };
  }, []);

  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NgrokFetchPatch>{children}</NgrokFetchPatch>
    </SessionProvider>
  );
}
