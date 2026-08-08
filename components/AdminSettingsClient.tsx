"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useRefreshPricing } from "@/components/PricingProvider";
import { formatClp, MP_MIN_AMOUNT_CLP } from "@/lib/pricing";
import {
  DEFAULT_PLANS_CATALOG,
  type PlansCatalog,
  type PlanTierDef,
} from "@/lib/plans";
import { formatDemoDuration } from "@/lib/demo-format";

export default function AdminSettingsClient() {
  const refreshPricing = useRefreshPricing();

  const [catalog, setCatalog] = useState<PlansCatalog>(DEFAULT_PLANS_CATALOG);
  const [resellerPrice, setResellerPrice] = useState(2990);
  const [resellerDraft, setResellerDraft] = useState(2990);
  const [minPriceClp, setMinPriceClp] = useState(MP_MIN_AMOUNT_CLP);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);
  const [downloadsBusy, setDownloadsBusy] = useState(false);
  const [demoMinutes, setDemoMinutes] = useState(30);
  const [demoAmount, setDemoAmount] = useState(30);
  const [demoUnit, setDemoUnit] = useState<"minutes" | "hours" | "days">(
    "minutes"
  );
  const [demoBusy, setDemoBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los ajustes.");
        return;
      }
      if (data.catalog) setCatalog(data.catalog);
      if (typeof data.resellerPriceClp === "number") {
        setResellerPrice(data.resellerPriceClp);
        setResellerDraft(data.resellerPriceClp);
      }
      if (typeof data.minPriceClp === "number") {
        setMinPriceClp(data.minPriceClp);
      }
      if (typeof data.downloadsEnabled === "boolean") {
        setDownloadsEnabled(data.downloadsEnabled);
      }
      if (typeof data.demoCatalogMinutes === "number") {
        const m = data.demoCatalogMinutes;
        setDemoMinutes(m);
        if (m > 0 && m % (24 * 60) === 0) {
          setDemoAmount(m / (24 * 60));
          setDemoUnit("days");
        } else if (m > 0 && m % 60 === 0) {
          setDemoAmount(m / 60);
          setDemoUnit("hours");
        } else {
          setDemoAmount(m);
          setDemoUnit("minutes");
        }
      }
    } catch {
      setError("No se pudieron cargar los ajustes.");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateTier(id: string, patch: Partial<PlanTierDef>) {
    setCatalog((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalog: {
            tiers: catalog.tiers,
            periodDiscounts: catalog.periodDiscounts,
          },
          resellerPriceClp: resellerDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        return;
      }
      if (data.catalog) setCatalog(data.catalog);
      setResellerPrice(data.resellerPriceClp);
      setResellerDraft(data.resellerPriceClp);
      await refreshPricing();
      setMsg("Planes y precios guardados.");
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDownloads() {
    const next = !downloadsEnabled;
    setDownloadsBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadsEnabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo actualizar descargas.");
        return;
      }
      setDownloadsEnabled(Boolean(data.downloadsEnabled));
      setMsg(
        data.downloadsEnabled
          ? "Descargas de APK activadas (/descargar visible)."
          : "Descargas de APK desactivadas."
      );
    } catch {
      setError("Error de red.");
    } finally {
      setDownloadsBusy(false);
    }
  }

  function draftToMinutes(): number {
    const n = Math.max(0, Number(demoAmount) || 0);
    if (demoUnit === "days") return Math.round(n * 24 * 60);
    if (demoUnit === "hours") return Math.round(n * 60);
    return Math.round(n);
  }

  function formatDemoLabel(m: number): string {
    return formatDemoDuration(m);
  }

  async function saveDemo() {
    const minutes = draftToMinutes();
    if (minutes > 30 * 24 * 60) {
      setError("Máximo 30 días de demo.");
      return;
    }
    setDemoBusy(true);
    setMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demoCatalogMinutes: minutes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar la demo.");
        return;
      }
      const m = Number(data.demoCatalogMinutes) || 0;
      setDemoMinutes(m);
      setMsg(
        m <= 0
          ? "Demo desactivada. Los nuevos usuarios no podrán probar gratis."
          : `Demo configurada: ${formatDemoLabel(m)}.`
      );
    } catch {
      setError("Error de red.");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <AdminShell
      title="Ajustes"
      subtitle="Planes, precios CLP y límites reales por tier."
    >
      <div className="surface-panel mb-6 flex flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between md:p-7">
        <div>
          <h2 className="text-lg font-bold">Apps Android (/descargar)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Activa o desactiva la página{" "}
            <a href="/descargar" className="text-teal-300 underline">
              /descargar
            </a>{" "}
            y los links del login/footer. Subí los APK a{" "}
            <code className="text-slate-300">/public/downloads/</code>.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Estado actual:{" "}
            <span
              className={
                downloadsEnabled ? "text-emerald-300" : "text-amber-200"
              }
            >
              {downloadsEnabled ? "Activado" : "Desactivado"}
            </span>
          </p>
        </div>
        <button
          type="button"
          disabled={downloadsBusy}
          onClick={() => void toggleDownloads()}
          className={
            downloadsEnabled
              ? "rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
              : "brand-button rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          }
        >
          {downloadsBusy
            ? "Guardando…"
            : downloadsEnabled
              ? "Desactivar descargas"
              : "Activar descargas"}
        </button>
      </div>

      <div className="surface-panel mb-6 space-y-4 rounded-3xl p-6 md:p-7">
        <div>
          <h2 className="text-lg font-bold">Demo de catálogo</h2>
          <p className="mt-1 text-sm text-slate-400">
            Duración de la prueba gratis al crear cuenta (una sola vez por
            usuario). Poné <strong className="text-slate-300">0</strong> para
            desactivar la demo.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Vigente:{" "}
            <span className="text-teal-200">
              {formatDemoLabel(demoMinutes)}
            </span>
            {demoMinutes > 0 ? ` (${demoMinutes} min)` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm text-slate-300">
            Cantidad
            <input
              type="number"
              min={0}
              step={1}
              value={demoAmount}
              onChange={(e) => setDemoAmount(Number(e.target.value) || 0)}
              className="mt-1 w-28 rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-400/40"
            />
          </label>
          <label className="block text-sm text-slate-300">
            Unidad
            <select
              value={demoUnit}
              onChange={(e) =>
                setDemoUnit(e.target.value as "minutes" | "hours" | "days")
              }
              className="mt-1 block rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-400/40"
            >
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Días</option>
            </select>
          </label>
          <button
            type="button"
            disabled={demoBusy}
            onClick={() => void saveDemo()}
            className="brand-button rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {demoBusy ? "Guardando…" : "Guardar demo"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "30 min", amount: 30, unit: "minutes" as const },
            { label: "1 h", amount: 1, unit: "hours" as const },
            { label: "2 h", amount: 2, unit: "hours" as const },
            { label: "1 día", amount: 1, unit: "days" as const },
            { label: "Off", amount: 0, unit: "minutes" as const },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setDemoAmount(p.amount);
                setDemoUnit(p.unit);
              }}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-white/55 hover:border-teal-300/40 hover:text-teal-100"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div className="surface-panel space-y-4 rounded-3xl p-6 md:p-7">
          <h2 className="text-lg font-bold">Catálogo de planes (CLP / mes)</h2>
          <p className="text-sm text-slate-400">
            El cobro convierte según la IP del usuario. Mínimo Mercado Pago
            Chile: ${formatClp(minPriceClp)} CLP.
          </p>

          <div className="grid gap-4 lg:grid-cols-3">
            {catalog.tiers.map((t) => (
              <div
                key={t.id}
                className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-300">
                  {t.id}
                </p>
                <label className="block text-sm text-slate-300">
                  Nombre
                  <input
                    value={t.name}
                    onChange={(e) => updateTier(t.id, { name: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Precio mensual CLP
                  <input
                    type="number"
                    min={minPriceClp}
                    value={t.priceMonthlyClp}
                    onChange={(e) =>
                      updateTier(t.id, {
                        priceMonthlyClp: Number(e.target.value) || minPriceClp,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-fuchsia-400/40"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Perfiles máx.
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={t.maxProfiles}
                    onChange={(e) =>
                      updateTier(t.id, {
                        maxProfiles: Number(e.target.value) || 1,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-slate-300">
                  Resolución
                  <select
                    value={t.maxResolution}
                    onChange={(e) =>
                      updateTier(t.id, {
                        maxResolution: Number(e.target.value) as 720 | 1080,
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2"
                  >
                    <option value={720}>720p</option>
                    <option value={1080}>1080p</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={t.features.canRequest}
                    onChange={(e) =>
                      updateTier(t.id, {
                        features: {
                          ...t.features,
                          canRequest: e.target.checked,
                        },
                      })
                    }
                  />
                  Solicitar títulos
                </label>
                <label className="block text-sm text-slate-300">
                  Cupo solicitudes
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={t.features.requestQuota}
                    onChange={(e) =>
                      updateTier(t.id, {
                        features: {
                          ...t.features,
                          requestQuota: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={t.features.canDownload}
                    onChange={(e) =>
                      updateTier(t.id, {
                        features: {
                          ...t.features,
                          canDownload: e.target.checked,
                        },
                      })
                    }
                  />
                  Descargas
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="text-sm text-slate-300">
              Desc. 6 meses %
              <input
                type="number"
                min={0}
                max={80}
                value={catalog.periodDiscounts.semiannual}
                onChange={(e) =>
                  setCatalog((c) => ({
                    ...c,
                    periodDiscounts: {
                      ...c.periodDiscounts,
                      semiannual: Number(e.target.value) || 0,
                    },
                  }))
                }
                className="ml-2 w-20 rounded-xl border border-white/10 bg-[#08101d]/70 px-2 py-1.5"
              />
            </label>
            <label className="text-sm text-slate-300">
              Desc. anual %
              <input
                type="number"
                min={0}
                max={80}
                value={catalog.periodDiscounts.annual}
                onChange={(e) =>
                  setCatalog((c) => ({
                    ...c,
                    periodDiscounts: {
                      ...c.periodDiscounts,
                      annual: Number(e.target.value) || 0,
                    },
                  }))
                }
                className="ml-2 w-20 rounded-xl border border-white/10 bg-[#08101d]/70 px-2 py-1.5"
              />
            </label>
          </div>
        </div>

        <div className="surface-panel max-w-lg space-y-4 rounded-3xl p-6 md:p-7">
          <h2 className="text-lg font-bold">Revendedor</h2>
          <p className="text-sm text-slate-400">
            Precio de referencia para cuentas prepaid (ahora $
            {formatClp(resellerPrice)}).
          </p>
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            Precio revendedor (CLP)
            <input
              type="number"
              min={minPriceClp}
              value={resellerDraft}
              onChange={(e) =>
                setResellerDraft(Number(e.target.value) || minPriceClp)
              }
              className="w-32 rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {msg && <p className="text-sm text-emerald-300">{msg}</p>}

        <button
          type="submit"
          disabled={busy}
          className="brand-button rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar ajustes"}
        </button>
      </form>
    </AdminShell>
  );
}
