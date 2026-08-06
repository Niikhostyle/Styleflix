"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Clock, CreditCard, Sparkles } from "lucide-react";
import OnboardingShell from "@/components/OnboardingShell";
import { DEMO_CATALOG_MINUTES } from "@/lib/access";

export default function OnboardingBienvenidaClient() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState<"demo" | "pay" | null>(null);
  const [error, setError] = useState("");

  async function startDemo() {
    setError("");
    setLoading("demo");
    try {
      const res = await fetch("/api/account/start-demo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar la demo.");
        setLoading(null);
        return;
      }

      if (data.alreadyMember) {
        window.location.assign("/");
        return;
      }

      // update() a veces no resuelve en Auth.js — no bloquear la entrada al catálogo
      try {
        await Promise.race([
          update({
            demoExpiresAt: data.demoExpiresAt ?? null,
            demoActive: true,
            catalogAccess: true,
          }),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      } catch {
        /* ignore */
      }

      // Navegación dura para que middleware lea el JWT nuevo
      window.location.assign("/");
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(null);
    }
  }

  function goPay() {
    setLoading("pay");
    router.replace("/onboarding/planes");
  }

  return (
    <OnboardingShell
      step={1}
      title="¿Cómo quieres empezar?"
      subtitle="La demo es opcional. Puedes ir directo al plan cuando quieras."
      backHref="/onboarding/cuenta"
    >
      <div className="space-y-3">
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void startDemo()}
          className="brand-button flex w-full items-start gap-3 rounded-xl px-4 py-4 text-left disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/15">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold">
              {loading === "demo"
                ? "Activando demo…"
                : `Probar catálogo ${DEMO_CATALOG_MINUTES} min`}
            </span>
            <span className="mt-1 block text-xs font-medium opacity-80">
              Explora series, películas y animes. Luego te pediremos el plan.
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={loading !== null}
          onClick={goPay}
          className="brand-button-ghost flex w-full items-start gap-3 rounded-xl px-4 py-4 text-left disabled:opacity-60"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
            <CreditCard className="h-5 w-5 text-violet-200" />
          </span>
          <span>
            <span className="block text-sm font-bold text-white">
              {loading === "pay" ? "Redirigiendo…" : "Crear cuenta y pagar"}
            </span>
            <span className="mt-1 block text-xs text-white/55">
              Elige tu plan ahora y activa VeoTV sin pasar por la demo.
            </span>
          </span>
        </button>
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-white/45">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        La demo es una sola vez por cuenta. Al terminar verás la pantalla de pago.
      </p>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </OnboardingShell>
  );
}
