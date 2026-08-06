"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Ban,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldOff,
  Activity,
  Radar,
  KeyRound,
} from "lucide-react";

type SecurityPayload = {
  hours: number;
  totals: {
    events: number;
    blocked: number;
    scans: number;
    scrapes: number;
    authFails: number;
  };
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  topIps: { ip: string; count: number }[];
  events: Array<{
    id: string;
    type: string;
    severity: string;
    ip: string | null;
    path: string | null;
    detail: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
  blocked: Array<{
    id: string;
    ip: string;
    reason: string | null;
    source: string;
    hits: number;
    expiresAt: string | null;
    createdAt: string;
  }>;
};

function sevClass(s: string) {
  switch (s) {
    case "critical":
      return "text-red-300 bg-red-500/15";
    case "high":
      return "text-orange-300 bg-orange-500/15";
    case "medium":
      return "text-amber-200 bg-amber-500/15";
    default:
      return "text-slate-300 bg-white/5";
  }
}

export default function AdminSecurityClient() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/security?hours=${hours}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "No se pudo cargar.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBlock(e: FormEvent) {
    e.preventDefault();
    if (!blockIp.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "block",
          ip: blockIp.trim(),
          reason: blockReason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "No se pudo bloquear.");
      } else {
        setBlockIp("");
        setBlockReason("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function onUnblock(ip: string) {
    setBusy(true);
    try {
      await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", ip }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const cards = [
    {
      label: "Escaneos",
      value: data?.totals.scans ?? 0,
      icon: Radar,
      hint: "wp-admin, .env, etc.",
    },
    {
      label: "Scrapers",
      value: data?.totals.scrapes ?? 0,
      icon: Activity,
      hint: "UA automatizados",
    },
    {
      label: "Auth fallida",
      value: data?.totals.authFails ?? 0,
      icon: KeyRound,
      hint: "Intentos de login",
    },
    {
      label: "IPs bloqueadas",
      value: data?.totals.blocked ?? 0,
      icon: Ban,
      hint: "Manual + auto",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-white/55">
          <Shield className="h-4 w-4 text-cyan-300" />
          Ventana
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-white"
          >
            <option value={6}>6 h</option>
            <option value={24}>24 h</option>
            <option value={72}>3 días</option>
            <option value={168}>7 días</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="brand-button-ghost inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="surface-panel rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-white/45">
                  {c.label}
                </p>
                <Icon className="h-4 w-4 text-violet-300" />
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
                {c.value}
              </p>
              <p className="mt-1 text-xs text-white/40">{c.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface-panel rounded-2xl p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4 text-cyan-300" />
            Bloquear IP
          </h3>
          <form onSubmit={onBlock} className="space-y-2">
            <input
              value={blockIp}
              onChange={(e) => setBlockIp(e.target.value)}
              placeholder="IP (ej. 203.0.113.10)"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-300/40"
            />
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-cyan-300/40"
            />
            <button
              type="submit"
              disabled={busy}
              className="brand-button rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
            >
              Bloquear
            </button>
          </form>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-white">
            Lista negra
          </h3>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {(data?.blocked || []).length === 0 && (
              <p className="text-sm text-white/40">Sin IPs bloqueadas.</p>
            )}
            {(data?.blocked || []).map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-cyan-100">{b.ip}</p>
                  <p className="text-xs text-white/45">
                    {b.source} · {b.hits} hits
                    {b.reason ? ` · ${b.reason}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onUnblock(b.ip)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                  title="Desbloquear"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-panel rounded-2xl p-4">
          <h3 className="mb-3 text-sm font-semibold text-white">Top IPs</h3>
          <div className="space-y-2">
            {(data?.topIps || []).length === 0 && (
              <p className="text-sm text-white/40">Sin actividad reciente.</p>
            )}
            {(data?.topIps || []).map((row) => (
              <div
                key={row.ip}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm"
              >
                <span className="font-mono text-white/85">{row.ip}</span>
                <span className="tabular-nums text-violet-200">{row.count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-panel rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          Eventos recientes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-2 py-2">Hora</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Sev.</th>
                <th className="px-2 py-2">IP</th>
                <th className="px-2 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {(data?.events || []).map((ev) => (
                <tr key={ev.id} className="border-t border-white/8">
                  <td className="px-2 py-2 whitespace-nowrap text-white/55">
                    {new Date(ev.createdAt).toLocaleString("es-CL")}
                  </td>
                  <td className="px-2 py-2 font-medium text-white/90">
                    {ev.type}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${sevClass(ev.severity)}`}
                    >
                      {ev.severity}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-cyan-100/90">
                    {ev.ip || "—"}
                  </td>
                  <td className="px-2 py-2 text-white/60">
                    <span className="line-clamp-2">
                      {ev.detail || ev.path || "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && (data?.events || []).length === 0 && (
            <p className="py-6 text-center text-sm text-white/40">
              Sin eventos en esta ventana. Los escaneos a rutas típicas (wp-admin,
              .env…) se registran automáticamente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
