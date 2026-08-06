"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CreditCard, Sparkles } from "lucide-react";
import OnboardingShell from "@/components/OnboardingShell";

export default function OnboardingBienvenidaClient() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState<"demo" | "pay" | null>(null);
  const [error, setError] = useState("");
  const [demoLabel, setDemoLabel] = useState("30 min");
  const [demoEnabled, setDemoEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/preview", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data.demoEnabled === "boolean") {
          setDemoEnabled(data.demoEnabled);
        }
        if (typeof data.demoLabel === "string" && data.demoLabel) {
          setDemoLabel(data.demoLabel);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
      subtitle={
        demoEnabled
          ? "La demo es opcional. Puedes ir directo al plan cuando quieras."
          : "Elige un plan para acceder al catálogo."
      }
      backHref="/onboarding/cuenta"
    >
      <div className="space-y-3">
        {demoEnabled && (
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
                  : `Probar catálogo ${demoLabel}`}
              </span>
              <span className="mt-1 block text-xs font-medium opacity-80">
                Explora series, películas y animes. Luego te pediremos el plan.
              </span>
            </span>
          </button>
        )}

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
            <span className="mt-1 block text-xs font-medium text-white/55">
              Acceso completo según el plan que elijas.
            </span>
          </span>
        </button>

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </OnboardingShell>
  );
}
