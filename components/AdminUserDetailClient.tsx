"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import {
  RESELLER_PRICE_CLP,
  planSourceLabel,
  subscriptionLabel,
} from "@/lib/access";

type PaymentRow = {
  id: string;
  provider: string;
  externalId: string | null;
  amount: string | number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  mpPreapprovalId: string | null;
  membershipStartedAt: string | null;
  cancelledAt: string | null;
  planSource?: string;
  prepaidDays?: number | null;
  emailVerified?: string | null;
  createdAt: string;
  payments: PaymentRow[];
};

export default function AdminUserDetailClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo cargar.");
      return;
    }
    setUser(data.user);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    action: string,
    extra?: { days?: number; password?: string }
  ) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Falló la acción.");
        setBusy(false);
        return;
      }
      setOk("Acción aplicada.");
      setNewPassword("");
      await load();
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    await runAction("set_password", { password: newPassword });
  }

  function fmt(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL");
  }

  return (
    <AdminShell
      title={user?.name || "Usuario"}
      subtitle={user?.email || "Detalle de cuenta"}
    >
      {!user ? (
        <p className="text-neutral-400">{error || "Cargando…"}</p>
      ) : (
        <>
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
            <p>
              <span className="text-neutral-400">Rol:</span> {user.role}
            </p>
            <p>
              <span className="text-neutral-400">Correo verificado:</span>{" "}
              {user.emailVerified ? fmt(user.emailVerified) : "Pendiente"}
            </p>
            <p>
              <span className="text-neutral-400">Origen:</span>{" "}
              {planSourceLabel(user.planSource)}
              {user.planSource === "RESELLER"
                ? ` ($${RESELLER_PRICE_CLP.toLocaleString("es-CL")})`
                : ""}
            </p>
            <p>
              <span className="text-neutral-400">Membresía:</span>{" "}
              {subscriptionLabel(user.subscriptionStatus)}
              {user.subscriptionStatus === "PREPAID" && user.prepaidDays
                ? ` · ${user.prepaidDays} días al activar`
                : ""}
            </p>
            <p>
              <span className="text-neutral-400">Vence:</span>{" "}
              {user.subscriptionStatus === "PREPAID"
                ? "Al primer login"
                : fmt(user.currentPeriodEnd)}
            </p>
            <p>
              <span className="text-neutral-400">Inicio membresía:</span>{" "}
              {fmt(user.membershipStartedAt)}
            </p>
            <p>
              <span className="text-neutral-400">MP preapproval:</span>{" "}
              <code className="text-xs text-neutral-300">
                {user.mpPreapprovalId || "—"}
              </code>
            </p>
            <p>
              <span className="text-neutral-400">Alta cuenta:</span>{" "}
              {fmt(user.createdAt)}
            </p>
          </div>

          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          {ok && <p className="mt-4 text-sm text-emerald-300">{ok}</p>}

          <form
            onSubmit={onSetPassword}
            className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <h2 className="text-lg font-bold">Cambiar contraseña</h2>
            <p className="text-sm text-neutral-400">
              Define una nueva clave para este usuario (se notifica por correo
              si SMTP está activo).
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="min-w-[200px] flex-1 rounded-lg border border-white/15 bg-black/60 px-3 py-2"
              />
              <button
                type="submit"
                disabled={busy || newPassword.length < 6}
                className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                Guardar clave
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {!user.emailVerified && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("mark_email_verified")}
                className="rounded-lg border border-emerald-400/40 px-3 py-2 text-sm text-emerald-200 disabled:opacity-60"
              >
                Marcar email verificado
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("activate_manual", { days: 30 })}
              className="rounded-lg bg-[#E50914] px-3 py-2 text-sm font-bold disabled:opacity-60"
            >
              Activar 30 días ya
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("grant_prepaid", { days: 30 })}
              className="rounded-lg bg-amber-600/80 px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Prepago revendedor 30d
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("extend_30")}
              className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold disabled:opacity-60"
            >
              Extender +30 días
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction("revoke")}
              className="rounded-lg border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
            >
              Revocar acceso
            </button>
            <button
              type="button"
              disabled={busy || !user.mpPreapprovalId}
              onClick={() => void runAction("cancel_mp")}
              className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40"
            >
              Cancelar suscripción MP
            </button>
          </div>

          <h2 className="mt-10 text-lg font-bold">Pagos</h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">External ID</th>
                </tr>
              </thead>
              <tbody>
                {user.payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="px-3 py-2 text-neutral-300">
                      {fmt(p.paidAt || p.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      ${Number(p.amount).toLocaleString("es-CL")} {p.currency}
                    </td>
                    <td className="px-3 py-2">{p.status}</td>
                    <td className="px-3 py-2 font-mono text-xs text-neutral-400">
                      {p.externalId || "—"}
                    </td>
                  </tr>
                ))}
                {user.payments.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-neutral-500"
                    >
                      Sin pagos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
