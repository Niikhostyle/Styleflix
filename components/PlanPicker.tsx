"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanPeriod, PlanTier } from "@/lib/plans";

type PlanOffer = {
  tier: PlanTier;
  period: PlanPeriod;
  periodLabel: string;
  name: string;
  months: number;
  discountPct: number;
  amountClp: number;
  amountLocal: number;
  currency: string;
  amountLocalLabel: string;
  amountClpLabel: string;
  maxProfiles: number;
  maxResolution: number;
  features: {
    canRequest: boolean;
    requestQuota: number;
    canDownload: boolean;
  };
};

type PricingPayload = {
  plans?: PlanOffer[];
  periodDiscounts?: Record<PlanPeriod, number>;
  geo?: { country: string; currency: string };
};

const PERIODS: { id: PlanPeriod; label: string }[] = [
  { id: "monthly", label: "Mensual" },
  { id: "semiannual", label: "6 Meses" },
  { id: "annual", label: "Anual" },
];

export default function PlanPicker({
  onCheckoutStart,
}: {
  onCheckoutStart?: () => void;
}) {
  const [period, setPeriod] = useState<PlanPeriod>("monthly");
  const [data, setData] = useState<PricingPayload | null>(null);
  const [loadingTier, setLoadingTier] = useState(true);
  const [busyTier, setBusyTier] = useState<PlanTier | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoadingTier(true);
    try {
      const res = await fetch("/api/pricing", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setError("No se pudieron cargar los planes.");
    } finally {
      setLoadingTier(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const offers = useMemo(() => {
    const all = data?.plans || [];
    return all.filter((p) => p.period === period);
  }, [data, period]);

  async function selectPlan(tier: PlanTier) {
    setError("");
    setBusyTier(tier);
    onCheckoutStart?.();
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: tier, planPeriod: period }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo iniciar el pago.");
        setBusyTier(null);
        return;
      }
      if (json.init_point) {
        window.location.href = json.init_point as string;
        return;
      }
      setError("No se recibió el enlace de Mercado Pago.");
    } catch {
      setError("Error de red.");
    } finally {
      setBusyTier(null);
    }
  }

  const discounts = data?.periodDiscounts;

  return (
    <div className="w-full">
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1">
        {PERIODS.map((p) => {
          const off = discounts?.[p.id];
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`relative rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {p.label}
              {!!off && off > 0 && (
                <span className="absolute -top-2 right-0 rounded bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                  {off}% OFF
                </span>
              )}
            </button>
          );
        })}
      </div>

      {data?.geo && (
        <p className="mt-4 text-center text-xs text-white/45">
          Precios en {data.geo.currency} según tu ubicación ({data.geo.country}
          ). El banco puede aplicar su propia conversión.
        </p>
      )}

      {loadingTier ? (
        <p className="mt-10 text-center text-sm text-white/50">Cargando planes…</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {offers.map((o) => (
            <article
              key={o.tier}
              className="flex flex-col rounded-2xl border border-white/10 bg-[#0c0c14]/90 p-5 shadow-xl backdrop-blur"
            >
              <h3 className="text-lg font-bold text-white">
                Plan {o.name}
              </h3>
              <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold text-fuchsia-300">
                {o.amountLocalLabel}
              </p>
              <p className="mt-1 text-xs text-white/45">
                / {o.months === 1 ? "30 días" : `${o.months} meses`}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Base {o.amountClpLabel} — tu banco hace la conversión final; el
                monto exacto puede variar.
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-white/75">
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                  {o.maxProfiles} perfil
                  {o.maxProfiles === 1 ? "" : "es"} simultáneo
                  {o.maxProfiles === 1 ? "" : "s"}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                  Resolución {o.maxResolution}p
                </li>
                <li className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                  Sin anuncios
                </li>
                {o.features.canRequest && (
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                    Solicitar películas y series
                    {o.features.requestQuota > 1
                      ? ` (x${o.features.requestQuota})`
                      : ""}
                  </li>
                )}
                {o.features.canDownload && (
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-fuchsia-400" />
                    Descargas para ver offline
                  </li>
                )}
              </ul>
              <button
                type="button"
                disabled={busyTier !== null}
                onClick={() => void selectPlan(o.tier)}
                className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-semibold text-white transition hover:bg-gradient-to-r hover:from-violet-600 hover:to-fuchsia-500 disabled:opacity-60"
              >
                {busyTier === o.tier ? "Redirigiendo…" : "Seleccionar"}
              </button>
            </article>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-center text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
