"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * "Volver" del onboarding. Si hay sesión sin plan, un Link a / o /login
 * rebota a /onboarding/planes por el middleware — hay que cerrar sesión.
 */
export default function OnboardingBackLink({
  href,
  signOutFirst = false,
  label = "Volver",
}: {
  href: string;
  signOutFirst?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  if (!signOutFirst) {
    return (
      <Link href={href} className="text-sm text-white/45 hover:text-white">
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await signOut({ callbackUrl: href, redirect: true });
        } catch {
          window.location.assign(href);
        }
      }}
      className="text-sm text-white/45 hover:text-white disabled:opacity-50"
    >
      {busy ? "Saliendo…" : label}
    </button>
  );
}
