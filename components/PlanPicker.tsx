"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MonitorPlay, Download, Sparkles, Users } from "lucide-react";
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

const PERIODS: { id: PlanPeriod; label: string; hint: string }[] = [
  { id: "monthly", label: "Mensual", hint: "Flexibilidad" },
  { id: "semiannual", label: "6 meses", hint: "Ahorra" },
  { id: "annual", label: "Anual", hint: "Mejor precio" },
];

const TIER_META: Record<
  PlanTier,
  { blurb: string; popular?: boolean; accent: string }
> = {
  standard: {
    blurb: "Ideal para ver solo o en pareja ocasional.",
    accent: "from-slate-500/20 to-transparent",
  },
  premium: {
    blurb: "El equilibrio perfecto para el hogar.",
    popular: true,
    accent: "from-teal-400/25 to-transparent",
  },
  plus: {
    blurb: "Máximo para familias y pantallas simultáneas.",
    accent: "from-fuchsia-500/20 to-transparent",
  },
};

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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1 sm:rounded-2xl sm:border sm:border-white/10 sm:bg-black/50 sm:p-1.5">
        {PERIODS.map((p) => {
          const off = discounts?.[p.id];
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`relative flex flex-1 flex-col items-center rounded-xl px-4 py-3.5 text-center transition sm:py-4 ${
                active
                  ? "bg-gradient-to-b from-teal-300 to-teal-400 text-[#07111d] shadow-lg shadow-teal-950/40"
                  : "border border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:text-white sm:border-0 sm:bg-transparent"
              }`}
            >
              <span className="text-base font-bold tracking-tight sm:text-lg">
                {p.label}
              </span>
              <span
                className={`mt-0.5 text-xs ${
                  active ? "text-[#07111d]/70" : "text-white/40"
                }`}
              >
                {p.hint}
                {!!off && off > 0 ? ` · −${off}%` : ""}
              </span>
              {!!off && off > 0 && (
                <span
                  className={`absolute -right-1 -top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    active
                      ? "bg-[#07111d] text-teal-300"
                      : "bg-emerald-500 text-white"
                  }`}
                >
                  −{off}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {data?.geo && (
        <p className="mt-5 text-center text-sm text-white/50">
          Precios en{" "}
          <span className="font-semibold text-teal-200/90">
            {data.geo.currency}
          </span>{" "}
          según tu ubicación ({data.geo.country}). Tu banco puede aplicar su
          propia conversión.
        </p>
      )}

      {loadingTier ? (
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[28rem] animate-pulse rounded-3xl border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:gap-6">
          {offers.map((o) => {
            const meta = TIER_META[o.tier];
            const popular = Boolean(meta?.popular);
            const perMonth =
              o.months > 1
                ? Math.round(o.amountLocal / o.months)
                : o.amountLocal;
            const perMonthLabel = new Intl.NumberFormat("es-CL", {
              style: "currency",
              currency: o.currency || "CLP",
              maximumFractionDigits: 0,
            }).format(perMonth);

            return (
              <article
                key={o.tier}
                className={`relative flex flex-col overflow-hidden rounded-3xl border p-6 md:p-7 ${
                  popular
                    ? "border-teal-300/50 bg-[#0a1620] shadow-[0_0_0_1px_rgba(45,212,191,0.25),0_28px_80px_rgba(0,0,0,0.45)] lg:scale-[1.03] lg:z-10"
                    : "border-white/10 bg-[#0b1018]/95"
                }`}
              >
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${meta.accent}`}
                />

                {popular && (
                  <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-teal-300 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#07111d]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Más popular
                  </div>
                )}

                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
                    Plan
                  </p>
                  <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white md:text-4xl">
                    {o.name}
                  </h3>
                  <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/55">
                    {meta.blurb}
                  </p>

                  <div className="mt-6">
                    <p className="font-[family-name:var(--font-display)] text-4xl font-black tracking-tight text-white md:text-5xl">
                      {o.amountLocalLabel}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {o.months === 1
                        ? "cada 30 días"
                        : `por ${o.months} meses`}
                      {o.months > 1 && (
                        <span className="text-white/40">
                          {" "}
                          · ≈ {perMonthLabel}/mes
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-white/35">
                      Referencia {o.amountClpLabel} CLP. El banco confirma el
                      monto final.
                    </p>
                  </div>

                  <ul className="mt-7 space-y-3.5 text-[15px] text-white/80">
                    <li className="flex items-start gap-3">
                      <Users className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                      <span>
                        <strong className="text-white">{o.maxProfiles}</strong>{" "}
                        perfil{o.maxProfiles === 1 ? "" : "es"}
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <MonitorPlay className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                      <span>
                        Hasta{" "}
                        <strong className="text-white">
                          {o.maxResolution}p
                        </strong>
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                      <span>Sin anuncios · cancela cuando quieras</span>
                    </li>
                    {o.features.canRequest ? (
                      <li className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                        <span>
                          Solicitar títulos
                          {o.features.requestQuota > 1
                            ? ` (hasta ${o.features.requestQuota}×)`
                            : ""}
                        </span>
                      </li>
                    ) : (
                      <li className="flex items-start gap-3 text-white/35">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 opacity-30" />
                        <span>Sin solicitudes de títulos</span>
                      </li>
                    )}
                    {o.features.canDownload ? (
                      <li className="flex items-start gap-3">
                        <Download className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                        <span>Descargas para ver offline</span>
                      </li>
                    ) : (
                      <li className="flex items-start gap-3 text-white/35">
                        <Download className="mt-0.5 h-5 w-5 shrink-0 opacity-30" />
                        <span>Sin descargas offline</span>
                      </li>
                    )}
                  </ul>

                  <button
                    type="button"
                    disabled={busyTier !== null}
                    onClick={() => void selectPlan(o.tier)}
                    className={`mt-8 w-full rounded-2xl py-4 text-base font-bold transition disabled:opacity-60 ${
                      popular
                        ? "bg-gradient-to-r from-teal-300 to-teal-400 text-[#07111d] shadow-lg shadow-teal-950/40 hover:brightness-110"
                        : "border border-white/15 bg-white/5 text-white hover:border-teal-300/40 hover:bg-teal-300/10"
                    }`}
                  >
                    {busyTier === o.tier
                      ? "Redirigiendo a Mercado Pago…"
                      : `Elegir ${o.name}`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-6 text-center text-sm text-red-300">{error}</p>
      )}
    </div>
  );
}
