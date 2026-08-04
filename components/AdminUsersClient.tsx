"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import {
  MEMBERSHIP_PRICE_CLP,
  RESELLER_PRICE_CLP,
  planSourceLabel,
  subscriptionLabel,
} from "@/lib/access";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  mpPreapprovalId: string | null;
  planSource?: string;
  prepaidDays?: number | null;
  createdAt: string;
  _count?: { payments: number };
};

type Stats = {
  total: number;
  active: number;
  none: number;
  pastDue: number;
  prepaid?: number;
};

const filters = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "prepaid", label: "Prepagadas" },
  { id: "reseller", label: "Revendedor" },
  { id: "expired", label: "Vencidos" },
  { id: "none", label: "Sin plan" },
  { id: "admin", label: "Admins" },
] as const;

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"USER" | "SUPER_ADMIN">("USER");
  const [grantDays, setGrantDays] = useState(0);
  const [resellerPrepaid, setResellerPrepaid] = useState(false);
  const [prepaidDays, setPrepaidDays] = useState(30);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [previewMinutes, setPreviewMinutes] = useState(5);
  const [previewDraft, setPreviewDraft] = useState(5);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState("");

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/users?filter=${filter}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setStats(data.stats ?? null);
    } catch {
      setUsers([]);
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (res.ok && data.previewMinutes) {
        setPreviewMinutes(data.previewMinutes);
        setPreviewDraft(data.previewMinutes);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function savePreviewMinutes(e: FormEvent) {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsMsg("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewMinutes: previewDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsMsg(data.error || "No se pudo guardar.");
        setSettingsBusy(false);
        return;
      }
      setPreviewMinutes(data.previewMinutes);
      setPreviewDraft(data.previewMinutes);
      setSettingsMsg(`Guardado: ${data.previewMinutes} min de preview.`);
    } catch {
      setSettingsMsg("Error de red.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        resellerPrepaid: resellerPrepaid || undefined,
        prepaidDays: resellerPrepaid ? prepaidDays : undefined,
        grantDays:
          !resellerPrepaid && grantDays > 0 ? grantDays : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "No se pudo crear el usuario.");
      return;
    }

    setOk(
      resellerPrepaid
        ? `Cuenta revendedor creada ($${RESELLER_PRICE_CLP.toLocaleString("es-CL")}): se activa al primer login (${prepaidDays} días).`
        : `Cuenta creada: ${data.user?.email}`
    );
    setName("");
    setEmail("");
    setPassword("");
    setRole("USER");
    setGrantDays(0);
    setResellerPrepaid(false);
    setPrepaidDays(30);
    void loadUsers();
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CL");
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 md:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#E50914]">
            Super Admin
          </p>
          <h1 className="text-3xl font-black">Membresías y usuarios</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Directo ${MEMBERSHIP_PRICE_CLP.toLocaleString("es-CL")}/mes ·
            Revendedor ${RESELLER_PRICE_CLP.toLocaleString("es-CL")} (activación
            al primer uso)
          </p>
        </div>

        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: "Usuarios", value: stats.total },
              { label: "Activos", value: stats.active },
              { label: "Prepagadas", value: stats.prepaid ?? 0 },
              { label: "Sin plan", value: stats.none },
              { label: "Atrasados", value: stats.pastDue },
            ].map((s) => (
              <div
                key={s.label}
                className="border border-white/10 bg-black/40 px-4 py-3"
              >
                <p className="text-xs text-neutral-400">{s.label}</p>
                <p className="text-2xl font-black">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={savePreviewMinutes}
          className="mb-10 space-y-3 border border-white/10 bg-black/40 p-5"
        >
          <h2 className="text-lg font-bold">Configuración · Preview</h2>
          <p className="text-sm text-neutral-400">
            Minutos de prueba para cuentas sin membresía activa (ahora:{" "}
            {previewMinutes} min).
          </p>
          <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
            Minutos:
            <input
              type="number"
              min={1}
              max={180}
              value={previewDraft}
              onChange={(e) =>
                setPreviewDraft(Number(e.target.value) || 1)
              }
              className="w-24 rounded border border-white/15 bg-black/60 px-2 py-1"
            />
            <button
              type="submit"
              disabled={settingsBusy}
              className="rounded bg-white px-3 py-1.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {settingsBusy ? "Guardando…" : "Guardar"}
            </button>
          </label>
          {settingsMsg && (
            <p className="text-sm text-emerald-300">{settingsMsg}</p>
          )}
        </form>

        <form
          onSubmit={onSubmit}
          className="mb-10 space-y-3 border border-white/10 bg-black/40 p-5"
        >
          <h2 className="text-lg font-bold">Crear usuario</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="rounded border border-white/15 bg-black/60 px-3 py-2 outline-none focus:ring-2 focus:ring-[#E50914]"
            />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded border border-white/15 bg-black/60 px-3 py-2 outline-none focus:ring-2 focus:ring-[#E50914]"
            />
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="rounded border border-white/15 bg-black/60 px-3 py-2 outline-none focus:ring-2 focus:ring-[#E50914]"
            />
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "USER" | "SUPER_ADMIN")
              }
              className="rounded border border-white/15 bg-black/60 px-3 py-2"
            >
              <option value="USER">USER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={resellerPrepaid}
              onChange={(e) => {
                setResellerPrepaid(e.target.checked);
                if (e.target.checked) setGrantDays(0);
              }}
              className="accent-[#E50914]"
            />
            Cuenta revendedor (${RESELLER_PRICE_CLP.toLocaleString("es-CL")}) —
            activar al primer login
            {resellerPrepaid && (
              <>
                <span className="text-neutral-500">Días:</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={prepaidDays}
                  onChange={(e) =>
                    setPrepaidDays(Number(e.target.value) || 30)
                  }
                  className="w-20 rounded border border-white/15 bg-black/60 px-2 py-1"
                />
              </>
            )}
          </label>

          {!resellerPrepaid && (
            <label className="flex items-center gap-2 text-sm text-neutral-300">
              Activar membresía manual ya (días):
              <input
                type="number"
                min={0}
                max={365}
                value={grantDays}
                onChange={(e) => setGrantDays(Number(e.target.value) || 0)}
                className="w-20 rounded border border-white/15 bg-black/60 px-2 py-1"
              />
              <span className="text-neutral-500">(0 = sin plan)</span>
            </label>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}
          {ok && <p className="text-sm text-emerald-300">{ok}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-[#E50914] px-4 py-2 text-sm font-bold disabled:opacity-60"
          >
            {loading ? "Creando…" : "Crear cuenta"}
          </button>
        </form>

        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded px-3 py-1.5 text-sm ${
                filter === f.id
                  ? "bg-white text-black"
                  : "bg-white/10 text-neutral-300 hover:bg-white/15"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loadingList ? (
          <p className="text-neutral-400">Cargando…</p>
        ) : (
          <div className="overflow-x-auto border border-white/10">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-white/5 text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Usuario</th>
                  <th className="px-3 py-2 font-medium">Rol</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                  <th className="px-3 py-2 font-medium">Membresía</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                  <th className="px-3 py-2 font-medium">Alta</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-white/10">
                    <td className="px-3 py-2">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-neutral-400">{u.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          u.role === "SUPER_ADMIN"
                            ? "bg-[#E50914]/30 text-red-200"
                            : "bg-white/10 text-neutral-300"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-300">
                      {planSourceLabel(u.planSource)}
                      {u.subscriptionStatus === "PREPAID" && u.prepaidDays
                        ? ` · ${u.prepaidDays}d`
                        : ""}
                    </td>
                    <td className="px-3 py-2">
                      {subscriptionLabel(u.subscriptionStatus)}
                    </td>
                    <td className="px-3 py-2 text-neutral-300">
                      {u.subscriptionStatus === "PREPAID"
                        ? "Al 1er login"
                        : formatDate(u.currentPeriodEnd)}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/usuarios/${u.id}`}
                        className="text-[#E50914] underline hover:text-red-300"
                      >
                        Detalle
                      </Link>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-neutral-500"
                    >
                      Sin resultados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
