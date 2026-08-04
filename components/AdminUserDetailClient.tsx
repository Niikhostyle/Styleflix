"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
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
  createdAt: string;
  payments: PaymentRow[];
};

export default function AdminUserDetailClient({ userId }: { userId: string }) {
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function runAction(action: string, days?: number) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Falló la acción.");
        setBusy(false);
        return;
      }
      setOk("Acción aplicada.");
      await load();
      router.refresh();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  function fmt(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL");
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-8">
        <Link
          href="/admin"
          className="text-sm text-neutral-400 underline hover:text-white"
        >
          ← Volver al listado
        </Link>

        {!user ? (
          <p className="mt-8 text-neutral-400">{error || "Cargando…"}</p>
        ) : (
          <>
            <h1 className="mt-4 text-3xl font-black">{user.name}</h1>
            <p className="text-neutral-400">{user.email}</p>

            <div className="mt-6 space-y-2 border border-white/10 bg-black/40 p-5 text-sm">
              <p>
                <span className="text-neutral-400">Rol:</span> {user.role}
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

            {error && (
              <p className="mt-4 text-sm text-red-300">{error}</p>
            )}
            {ok && (
              <p className="mt-4 text-sm text-emerald-300">{ok}</p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("activate_manual", 30)}
                className="rounded bg-[#E50914] px-3 py-2 text-sm font-bold disabled:opacity-60"
              >
                Activar 30 días ya
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("grant_prepaid", 30)}
                className="rounded bg-amber-600/80 px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Prepago revendedor 30d
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("extend_30")}
                className="rounded bg-white/15 px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Extender +30 días
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("revoke")}
                className="rounded border border-red-400/40 px-3 py-2 text-sm text-red-200 disabled:opacity-60"
              >
                Revocar acceso
              </button>
              <button
                type="button"
                disabled={busy || !user.mpPreapprovalId}
                onClick={() => void runAction("cancel_mp")}
                className="rounded border border-white/20 px-3 py-2 text-sm disabled:opacity-40"
              >
                Cancelar suscripción MP
              </button>
            </div>

            <h2 className="mt-10 text-lg font-bold">Pagos</h2>
            <div className="mt-3 overflow-x-auto border border-white/10">
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
      </main>
    </div>
  );
}
