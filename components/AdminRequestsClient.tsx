"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Loader2 } from "lucide-react";
import AdminShell from "@/components/AdminShell";

type RequestItem = {
  id: string;
  mediaType: string;
  tmdbId: number;
  title: string;
  year: number | null;
  note: string | null;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

export default function AdminRequestsClient() {
  const [status, setStatus] = useState("PENDING");
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (st: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/requests?status=${st}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar las solicitudes.");
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

  async function setItemStatus(id: string, next: "DONE" | "REJECTED" | "PENDING") {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/requests", {
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
      title="Solicitudes"
      subtitle="Cuando un usuario con plan Premium/Plus pide un título, aparece aquí y te llega un correo (si Resend/SMTP está configurado)."
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: "PENDING", label: "Pendientes" },
          { id: "DONE", label: "Resueltas" },
          { id: "REJECTED", label: "Rechazadas" },
          { id: "ALL", label: "Todas" },
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
          <Inbox className="h-5 w-5 text-teal-300" />
          <h2 className="text-lg font-bold">
            {loading ? "Cargando…" : `${items.length} solicitud(es)`}
          </h2>
        </div>

        {error && <p className="mb-4 text-sm text-red-300">{error}</p>}

        {!loading && items.length === 0 ? (
          <p className="text-sm text-slate-400">
            No hay solicitudes en este filtro.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => {
              const href =
                item.mediaType === "tv"
                  ? `/titulo/tv/${item.tmdbId}`
                  : `/titulo/movie/${item.tmdbId}`;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {item.title}
                      {item.year ? ` (${item.year})` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.mediaType === "tv" ? "Serie" : "Película"} · TMDB{" "}
                      {item.tmdbId} ·{" "}
                      {new Date(item.createdAt).toLocaleString("es-CL")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.user.name} · {item.user.email}
                    </p>
                    {item.note && (
                      <p className="mt-1 text-sm text-slate-300">{item.note}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={href}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                    >
                      Ver ficha
                    </Link>
                    <Link
                      href={`/admin/streams`}
                      className="rounded-lg border border-teal-300/30 px-3 py-1.5 text-xs text-teal-200 hover:bg-teal-300/10"
                    >
                      Subir link
                    </Link>
                    {item.status !== "DONE" && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void setItemStatus(item.id, "DONE")}
                        className="rounded-lg bg-teal-300/90 px-3 py-1.5 text-xs font-bold text-[#07111d] disabled:opacity-60"
                      >
                        {busyId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Marcar lista"
                        )}
                      </button>
                    )}
                    {item.status === "PENDING" && (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void setItemStatus(item.id, "REJECTED")}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
