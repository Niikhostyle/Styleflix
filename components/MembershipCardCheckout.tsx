"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MEMBERSHIP_PRICE_CLP } from "@/lib/access";

type Props = {
  onPaid: (result: { activated: boolean; message?: string }) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
};

type MpCardForm = {
  getCardFormData: () => {
    token?: string;
    paymentMethodId?: string;
    payment_method_id?: string;
  };
  unmount?: () => void;
  createCardToken?: () => Promise<{ id?: string } | undefined>;
};

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string }
    ) => {
      cardForm: (opts: Record<string, unknown>) => MpCardForm;
    };
  }
}

function loadMercadoPagoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mp-sdk="v2"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Mercado Pago SDK"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.mpSdk = "v2";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("No se pudo cargar Mercado Pago SDK"));
    document.body.appendChild(script);
  });
}

/** Normaliza RUT: quita puntos y asegura guión. */
function normalizeRut(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (!cleaned) return "";
  if (cleaned.includes("-")) return cleaned;
  if (cleaned.length < 2) return cleaned;
  return `${cleaned.slice(0, -1)}-${cleaned.slice(-1)}`;
}

export default function MembershipCardCheckout({
  onPaid,
  onError,
  onBusy,
}: Props) {
  const { data: session } = useSession();
  const formRef = useRef<HTMLFormElement>(null);
  const cardFormRef = useRef<MpCardForm | null>(null);
  const submittingRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";

  useEffect(() => {
    if (!publicKey || !formRef.current) return;
    let cancelled = false;

    void (async () => {
      try {
        await loadMercadoPagoSdk();
        if (cancelled || !window.MercadoPago || !formRef.current) return;

        const mp = new window.MercadoPago(publicKey, { locale: "es-CL" });
        const email =
          session?.user?.email?.trim() ||
          `buyer-${Date.now()}@veotv.cloud`;

        // Prellenar email oculto
        const emailInput = document.getElementById(
          "form-checkout__cardholderEmail"
        ) as HTMLInputElement | null;
        if (emailInput) emailInput.value = email;

        const cardForm = mp.cardForm({
          amount: String(MEMBERSHIP_PRICE_CLP),
          iframe: true,
          form: {
            id: "form-checkout",
            cardNumber: {
              id: "form-checkout__cardNumber",
              placeholder: "5416 7526 0258 2580",
            },
            expirationDate: {
              id: "form-checkout__expirationDate",
              placeholder: "MM/AA",
            },
            securityCode: {
              id: "form-checkout__securityCode",
              placeholder: "123",
            },
            cardholderName: {
              id: "form-checkout__cardholderName",
              placeholder: "APRO",
            },
            issuer: {
              id: "form-checkout__issuer",
              placeholder: "Banco emisor",
            },
            installments: {
              id: "form-checkout__installments",
              placeholder: "Cuotas",
            },
            identificationType: {
              id: "form-checkout__identificationType",
            },
            identificationNumber: {
              id: "form-checkout__identificationNumber",
              placeholder: "12345678-5",
            },
            cardholderEmail: {
              id: "form-checkout__cardholderEmail",
            },
          },
          callbacks: {
            onFormMounted: (error: unknown) => {
              if (cancelled) return;
              if (error) {
                console.error("[mp cardForm mount]", error);
                onError(
                  "No se pudo montar el formulario de Mercado Pago. Revisa la Public Key."
                );
                return;
              }
              setMounted(true);
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
              if (submittingRef.current) return;

              submittingRef.current = true;
              setSubmitting(true);
              onBusy?.(true);
              onError("");

              try {
                const idNumber = document.getElementById(
                  "form-checkout__identificationNumber"
                ) as HTMLInputElement | null;
                if (idNumber?.value) {
                  idNumber.value = normalizeRut(idNumber.value);
                }

                const data = cardForm.getCardFormData();
                const token = data?.token;
                if (!token) {
                  onError(
                    "No se generó el token. Completa todos los campos (tarjeta, CVV, vencimiento, nombre y RUT)."
                  );
                  return;
                }

                const res = await fetch("/api/billing/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ cardTokenId: token }),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                  onError(json.error || "No se pudo procesar el pago.");
                  return;
                }

                onPaid({
                  activated: Boolean(json.activated),
                  message: json.message,
                });
              } catch (err) {
                console.error("[mp subscribe]", err);
                onError(
                  err instanceof Error
                    ? err.message
                    : "Error al procesar el pago."
                );
              } finally {
                submittingRef.current = false;
                setSubmitting(false);
                onBusy?.(false);
              }
            },
            onFetching: (resource: string) => {
              console.log("[mp fetching]", resource);
            },
          },
        });

        cardFormRef.current = cardForm;
      } catch (err) {
        console.error("[mp init]", err);
        if (!cancelled) {
          onError(
            err instanceof Error
              ? err.message
              : "No se pudo iniciar Mercado Pago."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        cardFormRef.current?.unmount?.();
      } catch {
        /* ignore */
      }
      cardFormRef.current = null;
    };
    // Solo al montar / cambiar public key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
        Falta{" "}
        <code className="text-xs">NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</code>.
        Haz rebuild en Coolify con esa variable en Buildtime, o usa redirección.
      </p>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div>
        <p className="text-sm font-semibold text-white">
          Pago seguro en VeoTV
        </p>
        <p className="text-xs text-neutral-400">
          ${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")} / mes · Mercado Pago
          Card Form
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs leading-relaxed text-neutral-400">
        Datos de prueba Chile: tarjeta{" "}
        <span className="text-neutral-200">5416 7526 0258 2580</span>, CVV{" "}
        <span className="text-neutral-200">123</span>, vence{" "}
        <span className="text-neutral-200">11/30</span>, titular{" "}
        <span className="text-neutral-200">APRO</span>, RUT{" "}
        <span className="text-neutral-200">12345678-5</span>
      </div>

      {!mounted && (
        <p className="text-sm text-neutral-400">Cargando formulario seguro…</p>
      )}

      <form
        id="form-checkout"
        ref={formRef}
        className={`space-y-3 ${mounted ? "" : "invisible h-0 overflow-hidden"}`}
      >
        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Número de tarjeta
          </label>
          <div
            id="form-checkout__cardNumber"
            className="mp-field rounded-lg border border-white/10 bg-black/50 px-3"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Vencimiento
            </label>
            <div
              id="form-checkout__expirationDate"
              className="mp-field rounded-lg border border-white/10 bg-black/50 px-3"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">CVV</label>
            <div
              id="form-checkout__securityCode"
              className="mp-field rounded-lg border border-white/10 bg-black/50 px-3"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Nombre del titular
          </label>
          <input
            id="form-checkout__cardholderName"
            type="text"
            autoComplete="cc-name"
            className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-3 text-white outline-none ring-[#E50914] placeholder:text-neutral-500 focus:ring-2"
          />
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Tipo</label>
            <select
              id="form-checkout__identificationType"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-2 text-white outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">RUT</label>
            <input
              id="form-checkout__identificationNumber"
              type="text"
              placeholder="12345678-5"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-3 text-white outline-none ring-[#E50914] placeholder:text-neutral-500 focus:ring-2"
            />
          </div>
        </div>

        {/* Requeridos por CardForm; se rellenan solos */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Banco</label>
            <select
              id="form-checkout__issuer"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Cuotas</label>
            <select
              id="form-checkout__installments"
              className="h-[46px] w-full rounded-lg border border-white/10 bg-black/50 px-2 text-sm text-white"
            />
          </div>
        </div>

        <input
          id="form-checkout__cardholderEmail"
          type="email"
          className="hidden"
          readOnly
          defaultValue={session?.user?.email || ""}
        />

        <button
          type="submit"
          disabled={submitting || !mounted}
          className="w-full rounded-lg bg-[#E50914] py-3 text-base font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
        >
          {submitting
            ? "Procesando…"
            : `Pagar $${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")}`}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-500">
        Datos de tarjeta cifrados por Mercado Pago. VeoTV no los recibe.
      </p>
    </div>
  );
}
