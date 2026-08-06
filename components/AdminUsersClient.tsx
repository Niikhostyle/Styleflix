"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { planSourceLabel, subscriptionLabel } from "@/lib/access";
import {
  useMembershipPrice,
  useResellerPrice,
} from "@/components/PricingProvider";

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
  const { label: membershipPrice } = useMembershipPrice();
  const { label: resellerPrice } = useResellerPrice();
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
  const [viewerIsOwner, setViewerIsOwner] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/users?filter=${filter}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setStats(data.stats ?? null);
      setViewerIsOwner(Boolean(data.viewerIsOwner));
    } catch {
      setUsers([]);
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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
        role: viewerIsOwner ? role : "USER",
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
        ? `Cuenta revendedor creada ($${resellerPrice}): se activa al primer login (${prepaidDays} días).`
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

  async function changeRole(userId: string, nextRole: "USER" | "SUPER_ADMIN") {
    setError("");
    setOk("");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_role", role: nextRole }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo cambiar el rol.");
      return;
    }
    setOk(`Rol actualizado a ${nextRole}. El usuario debe reiniciar sesión.`);
    void loadUsers();
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-CL");
  }

  return (
    <AdminShell
      title="Usuarios y membresías"
      subtitle={`Directo $${membershipPrice}/mes · Revendedor $${resellerPrice} (activación al primer uso)`}
    >
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
              className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent px-4 py-3"
            >
              <p className="text-xs text-neutral-400">{s.label}</p>
              <p className="text-2xl font-black">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mb-10 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
      >
        <h2 className="text-lg font-bold">Crear usuario</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
            className="rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
          />
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
          />
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
          />
          {viewerIsOwner ? (
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "USER" | "SUPER_ADMIN")
              }
              className="rounded-lg border border-white/15 bg-black/60 px-3 py-2"
            >
              <option value="USER">USER</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          ) : (
            <div className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-neutral-400">
              Rol: USER
            </div>
          )}
        </div>

        <label className="flex flex-wrap items-center gap-2 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={resellerPrepaid}
            onChange={(e) => {
              setResellerPrepaid(e.target.checked);
              if (e.target.checked) setGrantDays(0);
            }}
            className="accent-teal-300"
          />
          Cuenta revendedor (${resellerPrice}) — activar al primer login
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
          className="brand-button rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-60"
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
            className={`rounded-full px-3 py-1.5 text-sm transition ${
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
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-white/5 text-neutral-400">
              <tr>
                <th className="px-3 py-3 font-medium">Usuario</th>
                <th className="px-3 py-3 font-medium">Rol</th>
                <th className="px-3 py-3 font-medium">Origen</th>
                <th className="px-3 py-3 font-medium">Membresía</th>
                <th className="px-3 py-3 font-medium">Vence</th>
                <th className="px-3 py-3 font-medium">Alta</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-white/10 transition hover:bg-white/[0.03]"
                >
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-neutral-400">{u.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    {viewerIsOwner ? (
                      <select
                        value={
                          u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"
                        }
                        onChange={(e) => {
                          const next = e.target.value as
                            | "USER"
                            | "SUPER_ADMIN";
                          if (next === u.role) return;
                          void changeRole(u.id, next);
                        }}
                        className={`rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-xs outline-none focus:border-teal-300/50 ${
                          u.role === "SUPER_ADMIN"
                            ? "text-teal-200"
                            : "text-neutral-300"
                        }`}
                        title="Cambiar rol"
                      >
                        <option value="USER">USER</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    ) : (
                      <span
                        className={
                          u.role === "SUPER_ADMIN"
                            ? "text-teal-200"
                            : "text-neutral-300"
                        }
                      >
                        {u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-neutral-300">
                    {planSourceLabel(u.planSource)}
                    {u.subscriptionStatus === "PREPAID" && u.prepaidDays
                      ? ` · ${u.prepaidDays}d`
                      : ""}
                  </td>
                  <td className="px-3 py-3">
                    {subscriptionLabel(u.subscriptionStatus)}
                  </td>
                  <td className="px-3 py-3 text-neutral-300">
                    {u.subscriptionStatus === "PREPAID"
                      ? "Al 1er login"
                      : formatDate(u.currentPeriodEnd)}
                  </td>
                  <td className="px-3 py-3 text-neutral-400">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/admin/usuarios/${u.id}`}
                      className="text-teal-300 underline hover:text-teal-200"
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
    </AdminShell>
  );
}
