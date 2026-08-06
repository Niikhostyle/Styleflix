"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import OnboardingShell from "@/components/OnboardingShell";

export default function OnboardingListoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update, data: session } = useSession();
  const [message, setMessage] = useState("Verificando tu pago…");
  const [error, setError] = useState("");
  const ran = useRef(false);

  const paymentId =
    searchParams.get("payment_id") ||
    searchParams.get("collection_id") ||
    null;
  const status = searchParams.get("status");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function sync() {
      try {
        const res = await fetch("/api/billing/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(paymentId ? { paymentId } : {}),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(
            data.error ||
              "Aún no confirmamos el pago. Si acabas de pagar, espera e intenta actualizar."
          );
          setMessage("");
          return;
        }
        setMessage(data.message || "¡Membresía activada!");
        await update({
          membershipActive: true,
          catalogAccess: true,
          planTier: data.planTier ?? undefined,
          planMaxProfiles: data.planMaxProfiles ?? undefined,
          planMaxResolution: data.planMaxResolution ?? undefined,
        });
        window.setTimeout(() => router.replace("/perfiles"), 1200);
      } catch {
        setError("No se pudo verificar el pago.");
        setMessage("");
      }
    }

    if (status === "failure") {
      setError("El pago falló o fue cancelado.");
      setMessage("");
      return;
    }

    void sync();
  }, [paymentId, status, router, update]);

  return (
    <OnboardingShell
      step={4}
      title={session?.user?.membershipActive ? "¡Listo!" : "Confirmando pago"}
      subtitle="Solo activamos tu plan cuando Mercado Pago confirma el pago."
    >
      {message && (
        <p className="text-center text-sm text-emerald-300">{message}</p>
      )}
      {error && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => {
              ran.current = false;
              setError("");
              setMessage("Verificando…");
              window.location.reload();
            }}
            className="brand-button rounded-lg px-4 py-2 text-sm font-semibold"
          >
            Actualizar estado
          </button>
          <div>
            <Link
              href="/onboarding/planes"
              className="text-sm text-white/50 underline"
            >
              Volver a planes
            </Link>
          </div>
        </div>
      )}
    </OnboardingShell>
  );
}
