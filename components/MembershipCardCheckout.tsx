"use client";

import { useEffect, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { MEMBERSHIP_PRICE_CLP } from "@/lib/access";

type Props = {
  onPaid: (result: {
    activated: boolean;
    message?: string;
  }) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
};

export default function MembershipCardCheckout({
  onPaid,
  onError,
  onBusy,
}: Props) {
  const [ready, setReady] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: "es-CL" });
    setReady(true);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
        Falta{" "}
        <code className="text-xs">NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</code> en
        el servidor. Usa el pago por redirección o configura la Public Key.
      </p>
    );
  }

  if (!ready) {
    return (
      <p className="text-sm text-neutral-400">Cargando formulario de pago…</p>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white p-4 text-black shadow-xl">
      <p className="mb-3 text-sm font-semibold text-neutral-700">
        Paga en VeoTV · ${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")} / mes
      </p>
      <CardPayment
        initialization={{
          amount: MEMBERSHIP_PRICE_CLP,
        }}
        customization={{
          visual: {
            style: {
              theme: "default",
            },
          },
          paymentMethods: {
            maxInstallments: 1,
          },
        }}
        onSubmit={async (formData) => {
          onBusy?.(true);
          try {
            const token =
              (formData as { token?: string }).token ||
              (formData as { cardTokenId?: string }).cardTokenId;
            if (!token) {
              onError("No se generó el token de la tarjeta. Intenta de nuevo.");
              onBusy?.(false);
              return;
            }

            const res = await fetch("/api/billing/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardTokenId: token }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              onError(data.error || "No se pudo procesar el pago.");
              onBusy?.(false);
              return;
            }
            onPaid({
              activated: Boolean(data.activated),
              message: data.message,
            });
          } catch {
            onError("Error de red al procesar el pago.");
          } finally {
            onBusy?.(false);
          }
        }}
        onError={(err) => {
          console.error("[CardPayment]", err);
          onError("Error en el formulario de Mercado Pago.");
        }}
        onReady={() => {
          /* brick listo */
        }}
      />
    </div>
  );
}
