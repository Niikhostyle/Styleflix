"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { subscriptionLabel } from "@/lib/access";
import { useMembershipPrice } from "@/components/PricingProvider";
import { Check, ShieldCheck, Sparkles } from "lucide-react";

const MembershipCardCheckout = dynamic(
  () => import("@/components/MembershipCardCheckout"),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-neutral-400">Cargando checkout…</p>
    ),
  }
);

type Props = {
  status: string;
  currentPeriodEnd: string | null;
  membershipActive: boolean;
  isAdmin: boolean;
  flash?: string | null;
};

export default function MembershipClient({
  status,
  currentPeriodEnd,
  membershipActive,
  isAdmin,
  flash,
}: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(flash || "");

  const { label: price } = useMembershipPrice();
  const ends = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;
  const hasPublicKey = Boolean(
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim()
  );

  async function startRedirectCheckout() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redirect: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      if (data.init_point) {
        window.location.href = data.init_point as string;
        return;
      }
      setError("No se recibió el enlace de Mercado Pago.");
    } catch {
      setError("Error de red al contactar Mercado Pago.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelSub() {
    if (
      !confirm(
        "¿Cancelar la renovación automática? Seguirás con acceso hasta el fin del periodo."
      )
    ) {
      return;
    }
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cancelar.");
        setCancelling(false);
        return;
      }
      setMessage(data.message || "Suscripción cancelada.");
      await update();
      router.refresh();
    } catch {
      setError("Error al cancelar.");
    } finally {
      setCancelling(false);
    }
  }

  async function refreshStatus() {
    await update();
    router.refresh();
    setMessage("Estado actualizado.");
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-32 text-white">
        <p className="eyebrow">Acceso total</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.045em]">
          Membresía incluida
        </h1>
        <p className="mt-3 text-slate-300">
          Tu cuenta de Super Admin no requiere pago.
        </p>
        <Link
          href="/"
          className="brand-button mt-8 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-32 text-white md:px-8">
      <div className="mb-10 max-w-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200/20 bg-teal-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-teal-200">
          <Sparkles className="h-3.5 w-3.5" />
          Una sola membresía
        </div>
        <h1 className="text-4xl font-black tracking-[-0.055em] md:text-6xl">
          Todo VeoTV, sin límites.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
          Películas, series y anime con renovación mensual segura a través de
          Mercado Pago.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
        <section className="surface-panel rounded-3xl p-6 md:p-8">
          <p className="eyebrow">Incluye</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">
            Tu entretenimiento, en un solo lugar
          </h2>
          <div className="mt-6 space-y-4">
            {[
              "Acceso completo al catálogo",
              "Películas, series y anime",
              "Progreso y recomendaciones personales",
              "Cancelación cuando quieras",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-300/10 text-teal-300">
                  <Check className="h-4 w-4" />
                </span>
                {feature}
              </div>
            ))}
          </div>
          <div className="mt-7 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <ShieldCheck className="h-5 w-5 text-teal-300" />
            <p className="text-xs leading-5 text-slate-400">
              Pago protegido por Mercado Pago. Tus datos de tarjeta no se
              almacenan en VeoTV.
            </p>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-teal-200/20 bg-gradient-to-br from-teal-300/[0.13] via-[#111b2e] to-violet-500/[0.12] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] md:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-teal-300/10 blur-3xl" />
          <p className="eyebrow">Plan mensual</p>
          <p className="mt-2 text-2xl font-black">VeoTV Completo</p>
          <p className="mt-5 text-5xl font-black tracking-[-0.055em] text-white">
            ${price}
            <span className="ml-2 text-base font-medium tracking-normal text-slate-400">
              CLP / mes
            </span>
          </p>
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/15 p-4 text-sm text-slate-300">
            Estado:{" "}
            <span className="font-semibold text-white">
              {subscriptionLabel(status)}
            </span>
            {ends && (
              <p className="mt-1 text-xs text-slate-500">
                {membershipActive ? "Vigente hasta" : "Venció el"} {ends}
              </p>
            )}
          </div>
          {message && (
            <p className="mt-4 rounded-xl bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
              {message}
            </p>
          )}
          {error && (
            <div className="mt-4 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-300">
              <p>{error}</p>
            </div>
          )}

        <div className="mt-6 flex flex-col gap-3">
        {!membershipActive && (
          <>
            {hasPublicKey ? (
              <>
                {!showCheckout ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckout(true);
                      setError("");
                    }}
                    className="brand-button rounded-xl py-3.5 text-base font-extrabold transition"
                  >
                    Activar membresía
                  </button>
                ) : (
                  <MembershipCardCheckout
                    onBusy={setLoading}
                    onError={(msg) => setError(msg)}
                    onPaid={async ({ activated, message: msg }) => {
                      if (activated) {
                        setMessage("¡Membresía activada!");
                        setShowCheckout(false);
                        await update();
                        router.refresh();
                      } else {
                        setMessage(
                          msg ||
                            "Pago recibido. Pulsa «Actualizar estado» en unos segundos."
                        );
                        await update();
                        router.refresh();
                      }
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => void startRedirectCheckout()}
                  disabled={loading}
                  className="text-sm text-neutral-400 underline hover:text-neutral-200 disabled:opacity-60"
                >
                  Preferir pagar en Mercado Pago (redirección)
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startRedirectCheckout()}
                disabled={loading}
                className="brand-button rounded-xl py-3.5 text-base font-extrabold transition disabled:opacity-60"
              >
                {loading
                  ? "Redirigiendo a Mercado Pago…"
                  : "Activar con Mercado Pago"}
              </button>
            )}
          </>
        )}

        {membershipActive && status === "ACTIVE" && (
          <button
            type="button"
            onClick={() => void cancelSub()}
            disabled={cancelling}
            className="rounded-lg border border-white/25 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/5 disabled:opacity-60"
          >
            {cancelling ? "Cancelando…" : "Cancelar renovación automática"}
          </button>
        )}

        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Actualizar estado
        </button>

        {membershipActive && (
          <Link
            href="/"
            className="mt-2 text-center text-sm font-semibold text-white underline"
          >
            Ir a VeoTV
          </Link>
        )}
        </div>
        </section>
      </div>
    </div>
  );
}
