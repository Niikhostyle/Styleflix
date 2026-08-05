"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";

export default function AdminSettingsClient() {
  const [previewMinutes, setPreviewMinutes] = useState(5);
  const [previewDraft, setPreviewDraft] = useState(5);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok && data.previewMinutes) {
        setPreviewMinutes(data.previewMinutes);
        setPreviewDraft(data.previewMinutes);
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

  return (
    <AdminShell
      title="Ajustes"
      subtitle="Configuración global de la plataforma."
    >
      <form
        onSubmit={savePreviewMinutes}
        className="max-w-lg space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
      >
        <h2 className="text-lg font-bold">Preview sin membresía</h2>
        <p className="text-sm text-neutral-400">
          Minutos de prueba para cuentas sin plan activo (ahora:{" "}
          {previewMinutes} min).
        </p>
        <label className="flex flex-wrap items-center gap-3 text-sm text-neutral-300">
          Minutos
          <input
            type="number"
            min={1}
            max={180}
            value={previewDraft}
            onChange={(e) => setPreviewDraft(Number(e.target.value) || 1)}
            className="w-24 rounded-lg border border-white/15 bg-black/60 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {settingsMsg && (
          <p className="text-sm text-emerald-300">{settingsMsg}</p>
        )}
        <button
          type="submit"
          disabled={settingsBusy}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
        >
          {settingsBusy ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </AdminShell>
  );
}
