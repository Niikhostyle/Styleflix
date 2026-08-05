"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { subscriptionLabel } from "@/lib/access";
import PlanPicker from "@/components/PlanPicker";

type Props = {
  status: string;
  currentPeriodEnd: string | null;
  membershipActive: boolean;
  isAdmin: boolean;
  flash?: string | null;
  returnPaymentId?: string | null;
};

export default function MembershipClient({
  status,
  currentPeriodEnd,
  membershipActive,
  isAdmin,
  flash,
  returnPaymentId = null,
}: Props) {
  const router = useRouter();
  const { update } = useSession();
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(flash || "");
  const autoSynced = useRef(false);

  useEffect(() => {
    if (isAdmin || membershipActive || autoSynced.current) return;
    if (!returnPaymentId && !flash?.includes("Verificando")) return;
    autoSynced.current = true;
    void syncPayment(returnPaymentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnPaymentId, membershipActive, isAdmin]);

  const ends = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  async function syncPayment(paymentId?: string | null) {
    setSyncing(true);
    setError("");
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
            "Aún no confirmamos un pago aprobado. Si acabas de pagar, espera e intenta de nuevo."
        );
        return;
      }
      setMessage(data.message || "¡Membresía activada!");
      await update();
      router.refresh();
    } catch {
      setError("No se pudo verificar el pago. Intenta «Actualizar estado».");
    } finally {
      setSyncing(false);
    }
  }

  async function cancelSub() {
    if (!confirm("¿Cancelar la renovación de tu membresía?")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cancelar.");
        return;
      }
      setMessage(data.message || "Suscripción cancelada.");
      await update();
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setCancelling(false);
    }
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-emerald-300">Admin: membresía incluida.</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Ir al catálogo
        </Link>
      </div>
    );
  }

  if (membershipActive) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          Tu membresía
        </h1>
        <p className="text-white/70">
          Estado: {subscriptionLabel(status)}
          {ends ? ` · vigente hasta ${ends}` : ""}
        </p>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold"
          >
            Ver catálogo
          </Link>
          <button
            type="button"
            onClick={() => void cancelSub()}
            disabled={cancelling}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70 disabled:opacity-60"
          >
            {cancelling ? "Cancelando…" : "Cancelar renovación"}
          </button>
        </div>
        <p className="text-sm text-white/45">
          ¿Quieres otro plan?{" "}
          <Link href="/onboarding/planes" className="underline">
            Ver planes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
      <h1 className="text-center font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight md:text-5xl">
        Elige tu plan
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-base text-white/55">
        La membresía solo se activa cuando Mercado Pago confirma el pago.
      </p>
      {message && (
        <p className="mt-4 text-center text-sm text-emerald-300">{message}</p>
      )}
      {error && <p className="mt-4 text-center text-sm text-red-300">{error}</p>}
      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={syncing}
          onClick={() => void syncPayment(returnPaymentId)}
          className="text-sm text-white/50 underline disabled:opacity-60"
        >
          {syncing ? "Verificando…" : "Actualizar estado"}
        </button>
      </div>
      <div className="mt-8">
        <PlanPicker />
      </div>
    </div>
  );
}
