"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import AdminShell from "@/components/AdminShell";

type FeedbackItem = {
  id: string;
  category: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

const LABELS: Record<string, string> = {
  DUDA: "Duda",
  QUEJA: "Queja",
  SUGERENCIA: "Sugerencia",
  OTRO: "Otro",
};

export default function AdminFeedbackClient() {
  const [status, setStatus] = useState("NEW");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (st: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/feedback?status=${st}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el feedback.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  async function setItemStatus(
    id: string,
    next: "NEW" | "READ" | "RESOLVED"
  ) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo actualizar.");
        return;
      }
      await load(status);
    } catch {
      setError("Error de red.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell
      title="Feedback"
      subtitle="Dudas, quejas y sugerencias enviadas desde /feedback."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: "NEW", label: "Nuevos" },
          { id: "READ", label: "Leídos" },
          { id: "RESOLVED", label: "Resueltos" },
          { id: "ALL", label: "Todos" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === t.id
                ? "bg-teal-300 text-[#07111d]"
                : "border border-white/10 text-slate-300 hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="surface-panel rounded-3xl p-6 md:p-7">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-teal-300" />
          <h2 className="text-lg font-bold">
            {loading ? "Cargando…" : `${items.length} mensaje(s)`}
          </h2>
        </div>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        {!loading && items.length === 0 ? (
          <p className="text-sm text-slate-400">
            No hay mensajes en este filtro.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-teal-300/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-teal-200">
                    {LABELS[item.category] || item.category}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString("es-CL")}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-slate-400">
                    {item.email}
                    {item.user ? ` · cuenta: ${item.user.email}` : " · visitante"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                    {item.message}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.status !== "READ" && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void setItemStatus(item.id, "READ")}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-60"
                    >
                      {busyId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Marcar leído"
                      )}
                    </button>
                  )}
                  {item.status !== "RESOLVED" && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void setItemStatus(item.id, "RESOLVED")}
                      className="rounded-lg bg-teal-300/90 px-3 py-1.5 text-xs font-bold text-[#07111d] disabled:opacity-60"
                    >
                      Resuelto
                    </button>
                  )}
                  {item.status !== "NEW" && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void setItemStatus(item.id, "NEW")}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500 hover:bg-white/5 disabled:opacity-60"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
