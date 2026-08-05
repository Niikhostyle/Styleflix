"use client";

import { useEffect, useState } from "react";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { useSession } from "next-auth/react";
import {
  useMembershipPrice,
  usePricingReady,
} from "@/components/PricingProvider";
import { MP_MIN_AMOUNT_CLP } from "@/lib/pricing";

type Props = {
  onPaid: (result: { activated: boolean; message?: string }) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
};

function brickErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") {
    return "Error en el formulario de Mercado Pago.";
  }
  const e = err as {
    message?: string;
    cause?: string;
    type?: string;
  };
  const cause = (e.cause || "").toLowerCase();
  const msg = (e.message || "").toLowerCase();

  if (
    cause.includes("bin") ||
    cause.includes("payment_methods") ||
    msg.includes("información de pago") ||
    msg.includes("informacion de pago")
  ) {
    return `Mercado Pago no pudo leer la tarjeta. Revisa el precio (mín. $${MP_MIN_AMOUNT_CLP} CLP en suscripciones Chile) o prueba otra tarjeta.`;
  }
  if (msg.includes("lower than") || msg.includes("950")) {
    return `Mercado Pago exige mínimo $${MP_MIN_AMOUNT_CLP} CLP en suscripciones. Sube el precio en Admin → Ajustes.`;
  }
  if (e.message?.trim()) return e.message.trim();
  return "Error en el formulario de Mercado Pago.";
}

export default function MembershipCardCheckout({
  onPaid,
  onError,
  onBusy,
}: Props) {
  const { data: session } = useSession();
  const pricingReady = usePricingReady();
  const { clp: priceClp, label: priceLabel } = useMembershipPrice();
  const [sdkReady, setSdkReady] = useState(false);
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

  useEffect(() => {
    if (!publicKey) return;
    // locale es-CL = sitio Chile (MLC); sin locale el Brick puede fallar al resolver medios.
    initMercadoPago(publicKey, { locale: "es-CL" });
    setSdkReady(true);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
        Falta{" "}
        <code className="text-xs">NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</code>.
        Agrégala en Coolify (Build + Runtime) y haz rebuild.
      </p>
    );
  }

  if (!pricingReady || !sdkReady) {
    return (
      <p className="text-sm text-neutral-400">
        {pricingReady
          ? "Cargando Payment Brick…"
          : "Obteniendo precio de membresía…"}
      </p>
    );
  }

  if (priceClp < MP_MIN_AMOUNT_CLP) {
    return (
      <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
        El precio actual es ${priceLabel} CLP, pero las suscripciones de Mercado
        Pago Chile exigen al menos ${MP_MIN_AMOUNT_CLP} CLP. Sube el precio en{" "}
        <strong>Admin → Ajustes</strong> y vuelve a intentar.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-black shadow-xl">
      <div>
        <p className="text-sm font-bold text-slate-900">
          Pago seguro · Mercado Pago
        </p>
        <p className="text-xs text-slate-600">
          ${priceLabel} / mes · Payment Brick
        </p>
      </div>

      <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900">
        Pago real con Mercado Pago. Usa tu tarjeta; el cobro es de ${priceLabel}{" "}
        CLP al mes.
      </p>

      <Payment
        key={priceClp}
        initialization={{
          amount: Math.round(priceClp),
          payer: {
            email: session?.user?.email || undefined,
          },
        }}
        customization={{
          visual: {
            style: { theme: "default" },
          },
          paymentMethods: {
            // prepaidCard es obligatorio desde 2025; sin esto MP muestra
            // "No pudimos obtener la información de pago".
            creditCard: "all",
            debitCard: "all",
            prepaidCard: "all",
            maxInstallments: 1,
          },
        }}
        onSubmit={async ({ formData }) => {
          onBusy?.(true);
          onError("");
          try {
            const token =
              (formData as { token?: string }).token ||
              (formData as { card_token_id?: string }).card_token_id;

            if (!token) {
              onError("El Brick no devolvió token de tarjeta. Reintenta.");
              throw new Error("missing_token");
            }

            // Suscripción autorizada (preapproval) con card_token_id.
            const res = await fetch("/api/billing/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cardTokenId: token }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              onError(data.error || "No se pudo activar la membresía.");
              throw new Error(data.error || "subscribe_failed");
            }

            onPaid({
              activated: Boolean(data.activated),
              message: data.message,
            });
          } catch (err) {
            if (
              err instanceof Error &&
              !["missing_token", "subscribe_failed"].includes(err.message) &&
              !err.message.includes("Mercado Pago")
            ) {
              onError(err.message || "Error de red al pagar.");
            }
            throw err;
          } finally {
            onBusy?.(false);
          }
        }}
        onError={(err) => {
          console.error("[PaymentBrick]", err);
          onError(brickErrorMessage(err));
        }}
        onReady={() => {
          /* listo */
        }}
      />
    </div>
  );
}
