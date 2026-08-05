"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";

type StreamItem = {
  id: string;
  mediaType: string;
  tmdbId: number;
  season: number | null;
  episode: number | null;
  title: string | null;
  embedUrl: string;
  label: string;
  enabled: boolean;
  priority: number;
  notes: string | null;
  updatedAt: string;
};

type FormState = {
  mediaType: "movie" | "tv";
  tmdbId: string;
  season: string;
  episode: string;
  title: string;
  embedUrl: string;
  label: string;
  priority: string;
  notes: string;
  enabled: boolean;
};

const emptyForm: FormState = {
  mediaType: "movie",
  tmdbId: "",
  season: "",
  episode: "",
  title: "",
  embedUrl: "",
  label: "VeoTV",
  priority: "10",
  notes: "",
  enabled: true,
};

export default function AdminStreamsClient() {
  const [items, setItems] = useState<StreamItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/streams?${params}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudieron cargar los links.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Error de red al cargar links.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(item: StreamItem) {
    setEditingId(item.id);
    setForm({
      mediaType: item.mediaType === "tv" ? "tv" : "movie",
      tmdbId: String(item.tmdbId),
      season: item.season != null ? String(item.season) : "",
      episode: item.episode != null ? String(item.episode) : "",
      title: item.title || "",
      embedUrl: item.embedUrl,
      label: item.label || "VeoTV",
      priority: String(item.priority ?? 10),
      notes: item.notes || "",
      enabled: item.enabled,
    });
    setMsg("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");

    const tmdbId = Number(form.tmdbId);
    if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
      setError("El ID TMDB debe ser un número positivo.");
      setBusy(false);
      return;
    }

    const payload = {
      mediaType: form.mediaType,
      tmdbId,
      season:
        form.mediaType === "tv" && form.season.trim()
          ? Number(form.season)
          : null,
      episode:
        form.mediaType === "tv" && form.episode.trim()
          ? Number(form.episode)
          : null,
      title: form.title.trim() || null,
      embedUrl: form.embedUrl.trim(),
      label: form.label.trim() || "VeoTV",
      priority: Number(form.priority) || 10,
      notes: form.notes.trim() || null,
      enabled: form.enabled,
    };

    try {
      const res = await fetch(
        editingId ? `/api/admin/streams/${editingId}` : "/api/admin/streams",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo guardar.");
        return;
      }
      setMsg(editingId ? "Link actualizado." : "Link creado.");
      resetForm();
      await load(query);
    } catch {
      setError("Error de red al guardar.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(item: StreamItem) {
    try {
      const res = await fetch(`/api/admin/streams/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo cambiar el estado.");
        return;
      }
      await load(query);
    } catch {
      setError("Error de red.");
    }
  }

  async function remove(item: StreamItem) {
    if (
      !confirm(
        `¿Eliminar link de ${item.title || `TMDB ${item.tmdbId}`}?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/streams/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo eliminar.");
        return;
      }
      if (editingId === item.id) resetForm();
      setMsg("Link eliminado.");
      await load(query);
    } catch {
      setError("Error de red al eliminar.");
    }
  }

  return (
    <AdminShell
      title="Links propios"
      subtitle="Sube embeds o reproductores por ID de TMDB. Estos links tienen prioridad al reproducir."
    >
      <form
        onSubmit={onSubmit}
        className="surface-panel mb-8 space-y-5 rounded-3xl p-6 md:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-teal-300" />
            <h2 className="text-lg font-bold">
              {editingId ? "Editar link" : "Nuevo link"}
            </h2>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-slate-400 underline hover:text-white"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tipo
            </span>
            <select
              value={form.mediaType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  mediaType: e.target.value as "movie" | "tv",
                }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
            >
              <option value="movie">Película</option>
              <option value="tv">Serie / Anime</option>
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              ID TMDB *
            </span>
            <input
              required
              inputMode="numeric"
              value={form.tmdbId}
              onChange={(e) =>
                setForm((f) => ({ ...f, tmdbId: e.target.value }))
              }
              placeholder="ej. 1081003"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Título (opcional)
            </span>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="Supergirl"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Etiqueta en player
            </span>
            <input
              value={form.label}
              onChange={(e) =>
                setForm((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="VeoTV"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
            />
          </label>
        </div>

        {form.mediaType === "tv" && (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Temporada (vacío = todo el título)
              </span>
              <input
                inputMode="numeric"
                value={form.season}
                onChange={(e) =>
                  setForm((f) => ({ ...f, season: e.target.value }))
                }
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Episodio (vacío = toda la temporada)
              </span>
              <input
                inputMode="numeric"
                value={form.episode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, episode: e.target.value }))
                }
                placeholder="1"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
              />
            </label>
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            URL del embed / reproductor (https) *
          </span>
          <input
            required
            type="url"
            value={form.embedUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, embedUrl: e.target.value }))
            }
            placeholder="https://…"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Prioridad
            </span>
            <input
              inputMode="numeric"
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value }))
              }
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
            />
          </label>
          <label className="flex items-end gap-3 pb-2 md:col-span-2">
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, enabled: !f.enabled }))
              }
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              {form.enabled ? (
                <ToggleRight className="h-7 w-7 text-teal-300" />
              ) : (
                <ToggleLeft className="h-7 w-7 text-slate-500" />
              )}
              {form.enabled ? "Activo (se usa al reproducir)" : "Desactivado"}
            </button>
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Notas internas
          </span>
          <input
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            placeholder="Origen del archivo, calidad, etc."
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/50"
          />
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {msg && <p className="text-sm text-emerald-300">{msg}</p>}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3 text-sm font-bold text-[#07111d] transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editingId ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {busy
            ? "Guardando…"
            : editingId
              ? "Guardar cambios"
              : "Agregar link"}
        </button>
      </form>

      <div className="surface-panel rounded-3xl p-6 md:p-7">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold">
            Links guardados{" "}
            <span className="text-sm font-normal text-slate-400">
              ({items.length})
            </span>
          </h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void load(query);
            }}
          >
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ID, título o URL…"
                className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-300/50"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              Buscar
            </button>
          </form>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400">
            Todavía no hay links propios. Agrega el primero con el ID TMDB del
            título (el mismo que ves en la URL del catálogo).
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        item.enabled
                          ? "bg-teal-300/15 text-teal-200"
                          : "bg-white/5 text-slate-500"
                      }`}
                    >
                      {item.enabled ? "Activo" : "Off"}
                    </span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {item.mediaType === "tv" ? "Serie" : "Película"}
                    </span>
                    <p className="truncate font-semibold text-white">
                      {item.title || `TMDB ${item.tmdbId}`}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    ID {item.tmdbId}
                    {item.season != null
                      ? ` · S${String(item.season).padStart(2, "0")}`
                      : ""}
                    {item.episode != null
                      ? `E${String(item.episode).padStart(2, "0")}`
                      : ""}
                    {" · "}
                    {item.label} · prioridad {item.priority}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                    {item.embedUrl}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleEnabled(item)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                  >
                    {item.enabled ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Borrar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
