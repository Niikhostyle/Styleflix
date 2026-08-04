"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  MEMBERSHIP_PRICE_CLP,
  subscriptionLabel,
} from "@/lib/access";

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState(flash || "");

  const price = MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL");
  const ends = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  async function startCheckout() {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST" });
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
      setLoading(false);
    } catch {
      setError("Error de red al contactar Mercado Pago.");
      setLoading(false);
    }
  }

  async function cancelSub() {
    if (!confirm("¿Cancelar la renovación automática? Seguirás con acceso hasta el fin del periodo.")) {
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
      <div className="mx-auto max-w-lg px-4 py-24 text-white">
        <p className="text-2xl font-black tracking-tight text-[#E50914]">
          VeoTV
        </p>
        <h1 className="mt-3 text-3xl font-black">Membresía</h1>
        <p className="mt-3 text-neutral-300">
          Tu cuenta de Super Admin no requiere pago.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded bg-white px-5 py-2.5 text-sm font-bold text-black"
        >
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-white">
      <p className="text-2xl font-black tracking-tight text-[#E50914]">
        VeoTV
      </p>
      <h1 className="mt-3 text-3xl font-black">Membresía mensual</h1>
      <p className="mt-3 text-neutral-300">
        Acceso completo a películas, series y animes. Cobro automático cada mes
        con Mercado Pago.
      </p>

      <div className="mt-8 border border-white/15 bg-black/40 p-6">
        <p className="text-sm uppercase tracking-wider text-neutral-400">
          Plan
        </p>
        <p className="mt-1 text-2xl font-black">VeoTV Mensual</p>
        <p className="mt-2 text-3xl font-black text-white">
          ${price}
          <span className="text-base font-medium text-neutral-400"> / mes</span>
        </p>
        <p className="mt-4 text-sm text-neutral-300">
          Estado:{" "}
          <span className="font-semibold text-white">
            {subscriptionLabel(status)}
          </span>
        </p>
        {ends && (
          <p className="mt-1 text-sm text-neutral-400">
            {membershipActive ? "Vigente hasta" : "Venció el"} {ends}
          </p>
        )}
      </div>

      {message && (
        <p className="mt-4 rounded bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <div className="mt-4 rounded bg-red-500/15 px-3 py-2 text-sm text-red-300">
          <p>{error}</p>
          {(error.includes("real or test") ||
            error.includes("TEST_PAYER") ||
            error.includes("Modo test")) && (
            <p className="mt-2 text-red-200/90">
              En modo prueba el cobrador y el pagador deben ser cuentas TEST. En
              Coolify: token{" "}
              <code className="text-xs">APP_USR-…</code> (no APP_USER),{" "}
              <code className="text-xs">MERCADOPAGO_MODE=test</code> y{" "}
              <code className="text-xs">MERCADOPAGO_TEST_PAYER_EMAIL</code> del
              comprador de prueba. En el checkout de MP inicia sesión con ese
              comprador.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {!membershipActive && (
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={loading}
            className="rounded bg-[#E50914] py-3 text-base font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
          >
            {loading
              ? "Redirigiendo a Mercado Pago…"
              : status === "PENDING"
                ? "Continuar pago en Mercado Pago"
                : "Activar con Mercado Pago"}
          </button>
        )}

        {membershipActive && status === "ACTIVE" && (
          <button
            type="button"
            onClick={() => void cancelSub()}
            disabled={cancelling}
            className="rounded border border-white/25 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/5 disabled:opacity-60"
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
    </div>
  );
}
