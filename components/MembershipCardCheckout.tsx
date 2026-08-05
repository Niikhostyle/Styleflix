"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CardNumber,
  ExpirationDate,
  SecurityCode,
  createCardToken,
  initMercadoPago,
} from "@mercadopago/sdk-react";
import { MEMBERSHIP_PRICE_CLP } from "@/lib/access";

type Props = {
  onPaid: (result: { activated: boolean; message?: string }) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
};

const fieldStyle = {
  color: "#f5f5f5",
  "font-size": "16px",
  "placeholder-color": "#7a7a7a",
};

const fieldWrap =
  "h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-3 [&>iframe]:h-full [&>iframe]:w-full";

export default function MembershipCardCheckout({
  onPaid,
  onError,
  onBusy,
}: Props) {
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cardholderName, setCardholderName] = useState("");
  const [docNumber, setDocNumber] = useState("");

  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

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
        el servidor. Usa el pago por redirección.
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!cardholderName.trim() || !docNumber.trim()) {
      onError("Completa el nombre del titular y el RUT.");
      return;
    }

    setSubmitting(true);
    onBusy?.(true);
    onError("");

    try {
      const token = await createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: "RUT",
        identificationNumber: docNumber.trim(),
      });

      if (!token?.id) {
        onError(
          "No se pudo validar la tarjeta. Revisa número, vencimiento y CVV."
        );
        return;
      }

      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardTokenId: token.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.error || "No se pudo procesar el pago.");
        return;
      }

      onPaid({
        activated: Boolean(data.activated),
        message: data.message,
      });
    } catch (err) {
      console.error("[checkout]", err);
      onError(
        "No se pudo tokenizar la tarjeta. Verifica los datos e intenta de nuevo."
      );
    } finally {
      setSubmitting(false);
      onBusy?.(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5"
    >
      <div>
        <p className="text-sm font-semibold text-white">
          Pago seguro en VeoTV
        </p>
        <p className="text-xs text-neutral-400">
          ${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")} / mes · procesado por
          Mercado Pago
        </p>
      </div>

      {!ready ? (
        <p className="text-sm text-neutral-400">Cargando formulario…</p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Número de tarjeta
            </label>
            <div className={fieldWrap}>
              <CardNumber
                placeholder="1234 1234 1234 1234"
                style={fieldStyle}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Vencimiento
              </label>
              <div className={fieldWrap}>
                <ExpirationDate placeholder="MM/AA" style={fieldStyle} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                CVV
              </label>
              <div className={fieldWrap}>
                <SecurityCode
                  placeholder="123"
                  mode="mandatory"
                  style={fieldStyle}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Nombre del titular
            </label>
            <input
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="Como aparece en la tarjeta"
              autoComplete="cc-name"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-3 text-white outline-none ring-[#E50914] placeholder:text-neutral-500 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-neutral-300">RUT</label>
            <input
              value={docNumber}
              onChange={(e) => setDocNumber(e.target.value)}
              placeholder="12345678-5"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-3 text-white outline-none ring-[#E50914] placeholder:text-neutral-500 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#E50914] py-3 text-base font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
          >
            {submitting
              ? "Procesando…"
              : `Pagar $${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")}`}
          </button>

          <p className="text-center text-xs text-neutral-500">
            Tus datos de tarjeta viajan cifrados a Mercado Pago. VeoTV nunca los
            recibe.
          </p>
        </>
      )}
    </form>
  );
}
