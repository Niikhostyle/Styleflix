"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  Ban,
  Clock,
  Globe2,
  KeyRound,
  Network,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldOff,
  Users,
  Wifi,
} from "lucide-react";

type Metrics = {
  generatedAt: string;
  onlineWindowMinutes: number;
  hours: number;
  live: { sessions: number; users: number; ips: number };
  window: {
    sessions: number;
    users: number;
    ips: number;
    usersToday: number;
  };
  platform: {
    totalUsers: number;
    membersActive: number;
    demosActive: number;
  };
  recentConnections: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    subscriptionStatus: string;
    lastSeenAt: string | null;
    lastIp: string | null;
    createdAt: string;
    online: boolean;
  }>;
  liveSessions: Array<{
    id: string;
    ip: string;
    path: string | null;
    country: string | null;
    hits: number;
    userAgent: string | null;
    firstSeenAt: string;
    lastSeenAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  }>;
  activityBuckets: Array<{
    label: string;
    users: number;
    ips: number;
    hits: number;
  }>;
};

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
  metrics?: Metrics;
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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function relativeAgo(iso: string | null | undefined) {
  if (!iso) return "Sin registro";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "hace segundos";
  if (ms < 3600_000) return `hace ${Math.floor(ms / 60_000)} min`;
  if (ms < 86400_000) return `hace ${Math.floor(ms / 3600_000)} h`;
  return `hace ${Math.floor(ms / 86400_000)} d`;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "text-cyan-300",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="surface-panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-white/40">{hint}</p>
    </div>
  );
}

function ActivityChart({
  buckets,
}: {
  buckets: Metrics["activityBuckets"];
}) {
  const max = useMemo(
    () => Math.max(1, ...buckets.map((b) => Math.max(b.users, b.ips))),
    [buckets]
  );

  if (!buckets.length) {
    return (
      <p className="py-8 text-center text-sm text-white/40">
        Sin datos de actividad aún. Aparecen cuando hay usuarios conectados.
      </p>
    );
  }

  return (
    <div className="flex h-40 items-end gap-1.5">
      {buckets.map((b) => {
        const hUsers = Math.round((b.users / max) * 100);
        const hIps = Math.round((b.ips / max) * 100);
        return (
          <div
            key={b.label}
            className="group relative flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
            title={`${b.label}: ${b.users} usuarios · ${b.ips} IPs`}
          >
            <div
              className="w-full rounded-t bg-violet-400/70 transition group-hover:bg-violet-300"
              style={{ height: `${Math.max(b.ips ? 4 : 0, hIps)}%` }}
            />
            <div
              className="w-full rounded-t bg-cyan-400/80 transition group-hover:bg-cyan-300"
              style={{ height: `${Math.max(b.users ? 4 : 0, hUsers)}%` }}
            />
            <span className="mt-1 hidden text-[9px] text-white/35 sm:block">
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminSecurityClient() {
  const [hours, setHours] = useState(24);
  const [data, setData] = useState<SecurityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [blockIp, setBlockIp] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"metrics" | "threats">("metrics");

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
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
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

  const m = data?.metrics;
  const onlineMin = m?.onlineWindowMinutes ?? 15;

  const threatCards = [
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-black/30 p-1 text-sm">
            <button
              type="button"
              onClick={() => setTab("metrics")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "metrics"
                  ? "bg-cyan-400/20 text-cyan-100"
                  : "text-white/55 hover:text-white"
              }`}
            >
              Métricas
            </button>
            <button
              type="button"
              onClick={() => setTab("threats")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "threats"
                  ? "bg-violet-400/20 text-violet-100"
                  : "text-white/55 hover:text-white"
              }`}
            >
              Amenazas
            </button>
          </div>
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

      {tab === "metrics" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Usuarios en línea"
              value={m?.live.users ?? 0}
              hint={`Activos últimos ${onlineMin} min`}
              icon={Wifi}
              accent="text-emerald-300"
            />
            <MetricCard
              label="IPs activas"
              value={m?.live.ips ?? 0}
              hint={`Sesiones en vivo: ${m?.live.sessions ?? 0}`}
              icon={Network}
              accent="text-cyan-300"
            />
            <MetricCard
              label="Usuarios activos (ventana)"
              value={m?.window.users ?? 0}
              hint={`${m?.window.usersToday ?? 0} vistos hoy · ${m?.window.ips ?? 0} IPs`}
              icon={Users}
              accent="text-violet-300"
            />
            <MetricCard
              label="Membresías activas"
              value={m?.platform.membersActive ?? 0}
              hint={`${m?.platform.demosActive ?? 0} demos · ${m?.platform.totalUsers ?? 0} cuentas`}
              icon={Globe2}
              accent="text-teal-300"
            />
          </div>

          <section className="surface-panel rounded-2xl p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Actividad en el tiempo
              </h3>
              <p className="text-xs text-white/40">
                <span className="mr-3 inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> Usuarios
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-violet-400" /> IPs
                </span>
              </p>
            </div>
            <ActivityChart buckets={m?.activityBuckets || []} />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface-panel rounded-2xl p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Wifi className="h-4 w-4 text-emerald-300" />
                Sesiones en vivo
              </h3>
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {(m?.liveSessions || []).length === 0 && (
                  <p className="text-sm text-white/40">
                    Nadie en línea ahora. Los latidos empiezan cuando un usuario
                    autenticado navega la app.
                  </p>
                )}
                {(m?.liveSessions || []).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {s.user?.name || "Invitado / sin cuenta"}
                        </p>
                        <p className="truncate text-xs text-white/45">
                          {s.user?.email || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200">
                        online
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/50">
                      <span className="font-mono text-cyan-100/90">{s.ip}</span>
                      {s.country && <span>{s.country}</span>}
                      <span>{relativeAgo(s.lastSeenAt)}</span>
                      {s.path && (
                        <span className="truncate text-white/35">{s.path}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="surface-panel rounded-2xl p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Clock className="h-4 w-4 text-cyan-300" />
                Últimas conexiones
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-2 py-2">Usuario</th>
                      <th className="px-2 py-2">IP</th>
                      <th className="px-2 py-2">Última conexión</th>
                      <th className="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(m?.recentConnections || []).map((u) => (
                      <tr key={u.id} className="border-t border-white/8">
                        <td className="px-2 py-2">
                          <p className="font-medium text-white/90">{u.name}</p>
                          <p className="text-xs text-white/40">{u.email}</p>
                        </td>
                        <td className="px-2 py-2 font-mono text-xs text-cyan-100/90">
                          {u.lastIp || "—"}
                        </td>
                        <td className="px-2 py-2 text-white/55">
                          <p>{fmtDate(u.lastSeenAt)}</p>
                          <p className="text-xs text-white/35">
                            {relativeAgo(u.lastSeenAt)}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          {u.online ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200">
                              En línea
                            </span>
                          ) : (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/45">
                              Offline
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && (m?.recentConnections || []).length === 0 && (
                  <p className="py-6 text-center text-sm text-white/40">
                    Aún no hay historial de conexiones. Se llena con cada login y
                    heartbeat.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {tab === "threats" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {threatCards.map((c) => {
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
              <h3 className="mb-3 text-sm font-semibold text-white">
                Top IPs (amenazas)
              </h3>
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
                    <span className="tabular-nums text-violet-200">
                      {row.count}
                    </span>
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
                      <td className="whitespace-nowrap px-2 py-2 text-white/55">
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
                  Sin eventos en esta ventana.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
