"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { useRefreshPricing } from "@/components/PricingProvider";
import { formatClp, MP_MIN_AMOUNT_CLP } from "@/lib/pricing";

export default function AdminSettingsClient() {
  const refreshPricing = useRefreshPricing();

  const [previewMinutes, setPreviewMinutes] = useState(5);
  const [previewDraft, setPreviewDraft] = useState(5);
  const [membershipPrice, setMembershipPrice] = useState(4990);
  const [membershipDraft, setMembershipDraft] = useState(4990);
  const [resellerPrice, setResellerPrice] = useState(2990);
  const [resellerDraft, setResellerDraft] = useState(2990);
  const [minPriceClp, setMinPriceClp] = useState(MP_MIN_AMOUNT_CLP);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [pricingMsg, setPricingMsg] = useState("");
  const [error, setError] = useState("");
  const [pricingError, setPricingError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los ajustes.");
        return;
      }
      if (data.previewMinutes) {
        setPreviewMinutes(data.previewMinutes);
        setPreviewDraft(data.previewMinutes);
      }
      if (typeof data.membershipPriceClp === "number") {
        setMembershipPrice(data.membershipPriceClp);
        setMembershipDraft(data.membershipPriceClp);
      }
      if (typeof data.resellerPriceClp === "number") {
        setResellerPrice(data.resellerPriceClp);
        setResellerDraft(data.resellerPriceClp);
      }
      if (typeof data.minPriceClp === "number") {
        setMinPriceClp(data.minPriceClp);
      }
    } catch {
      setError("No se pudieron cargar los ajustes.");
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function savePreviewMinutes(e: FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsMsg("");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewMinutes: previewDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        return;
      }
      setPreviewMinutes(data.previewMinutes);
      setPreviewDraft(data.previewMinutes);
      setSettingsMsg(`Guardado: ${data.previewMinutes} min de preview.`);
    } catch {
      setError("Error de red.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function savePricing(e: FormEvent) {
    e.preventDefault();
    setPricingBusy(true);
    setPricingMsg("");
    setPricingError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipPriceClp: membershipDraft,
          resellerPriceClp: resellerDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPricingError(data.error || "No se pudo guardar.");
        return;
      }
      setMembershipPrice(data.membershipPriceClp);
      setMembershipDraft(data.membershipPriceClp);
      setResellerPrice(data.resellerPriceClp);
      setResellerDraft(data.resellerPriceClp);
      await refreshPricing();
      setPricingMsg(
        `Precios guardados: membresía $${formatClp(data.membershipPriceClp)} · revendedor $${formatClp(data.resellerPriceClp)}.`
      );
    } catch {
      setPricingError("Error de red.");
    } finally {
      setPricingBusy(false);
    }
  }

  return (
    <AdminShell
      title="Ajustes"
      subtitle="Configuración global de la plataforma."
    >
      <div className="space-y-6">
        <form
          onSubmit={savePricing}
          className="surface-panel max-w-lg space-y-4 rounded-3xl p-6 md:p-7"
        >
          <h2 className="text-lg font-bold">Precios de membresía</h2>
          <p className="text-sm text-slate-400">
            Estos valores se usan en la página de membresía, el cobro de Mercado
            Pago y las cuentas revendedor. Vigentes ahora: membresía $
            {formatClp(membershipPrice)} · revendedor ${formatClp(resellerPrice)}
            . Mínimo Mercado Pago Chile (Visa): ${formatClp(minPriceClp)} CLP.
          </p>
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            Membresía directa (CLP / mes)
            <input
              type="number"
              min={minPriceClp}
              max={1000000}
              value={membershipDraft}
              onChange={(e) =>
                setMembershipDraft(Number(e.target.value) || minPriceClp)
              }
              className="w-32 rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
            />
          </label>
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            Precio revendedor (CLP)
            <input
              type="number"
              min={minPriceClp}
              max={1000000}
              value={resellerDraft}
              onChange={(e) =>
                setResellerDraft(Number(e.target.value) || minPriceClp)
              }
              className="w-32 rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
            />
          </label>
          {pricingError && (
            <p className="text-sm text-red-300">{pricingError}</p>
          )}
          {pricingMsg && (
            <p className="text-sm text-emerald-300">{pricingMsg}</p>
          )}
          <button
            type="submit"
            disabled={pricingBusy}
            className="brand-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {pricingBusy ? "Guardando…" : "Guardar precios"}
          </button>
        </form>

        <form
          onSubmit={savePreviewMinutes}
          className="surface-panel max-w-lg space-y-4 rounded-3xl p-6 md:p-7"
        >
          <h2 className="text-lg font-bold">Preview sin membresía</h2>
          <p className="text-sm text-slate-400">
            Minutos de prueba para cuentas sin plan activo (ahora:{" "}
            {previewMinutes} min).
          </p>
          <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            Minutos
            <input
              type="number"
              min={1}
              max={180}
              value={previewDraft}
              onChange={(e) => setPreviewDraft(Number(e.target.value) || 1)}
              className="w-24 rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          {settingsMsg && (
            <p className="text-sm text-emerald-300">{settingsMsg}</p>
          )}
          <button
            type="submit"
            disabled={settingsBusy}
            className="brand-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {settingsBusy ? "Guardando…" : "Guardar"}
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
