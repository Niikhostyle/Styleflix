"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, Shield, Trash2, Users } from "lucide-react";
import BrandMark from "@/components/BrandMark";

type ProfileRow = {
  id: string;
  name: string;
  avatarKey: string;
  isKids: boolean;
};

const AVATARS = ["1", "2", "3", "4", "5"];

function avatarGradient(key: string) {
  const map: Record<string, string> = {
    "1": "from-cyan-400 to-teal-600",
    "2": "from-violet-400 to-fuchsia-600",
    "3": "from-amber-300 to-orange-600",
    "4": "from-emerald-300 to-green-700",
    "5": "from-rose-300 to-red-600",
  };
  return map[key] || map["1"];
}

export default function PerfilesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const next = searchParams.get("next") || "/";

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/profiles", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfiles(data.profiles || []);
      setMaxProfiles(data.maxProfiles || 1);
    } else {
      setError(data.error || "No se pudieron cargar los perfiles.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login?callbackUrl=/perfiles");
      return;
    }
    if (status === "authenticated") void load();
  }, [status, load, router]);

  async function selectProfile(id: string) {
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/account/profiles/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo seleccionar.");
        return;
      }
      const dest =
        next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.assign(dest);
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(null);
    }
  }

  async function createProfile() {
    if (!newName.trim()) return;
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/account/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          avatarKey: AVATARS[profiles.length % AVATARS.length],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo crear.");
        return;
      }
      setNewName("");
      setCreating(false);
      await load();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(null);
    }
  }

  async function removeProfile(id: string) {
    if (!confirm("¿Eliminar este perfil?")) return;
    setBusy(id);
    setError("");
    try {
      const res = await fetch("/api/account/profiles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar.");
        return;
      }
      await load();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(null);
    }
  }

  const canAdd = profiles.length < maxProfiles;
  const planLabel = session?.user?.planTier || "demo";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#070b14] px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(45,212,191,0.12),transparent_55%)]" />
      <div className="relative z-10 w-full max-w-4xl text-center">
        <div className="mb-8 flex justify-center">
          <BrandMark />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-white md:text-5xl">
          ¿Quién está viendo?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-white/55 md:text-base">
          Plan {planLabel}: hasta {maxProfiles} perfil
          {maxProfiles === 1 ? "" : "es"}.{" "}
          <span className="text-cyan-200/90">
            Cada perfil permite 1 sola reproducción a la vez
          </span>{" "}
          — no se pueden compartir pantallas en el mismo perfil.
        </p>

        {loading ? (
          <p className="mt-16 text-white/45">Cargando perfiles…</p>
        ) : (
          <ul className="mt-12 flex flex-wrap items-start justify-center gap-6 md:gap-8">
            {profiles.map((p) => (
              <li key={p.id} className="group relative w-28 md:w-36">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    managing ? undefined : void selectProfile(p.id)
                  }
                  className="w-full text-center disabled:opacity-60"
                >
                  <span
                    className={`mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl font-bold text-white shadow-lg transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-cyan-300/60 md:h-28 md:w-28 ${avatarGradient(p.avatarKey)}`}
                  >
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="mt-3 block truncate text-sm font-medium text-white/85">
                    {busy === p.id ? "Entrando…" : p.name}
                  </span>
                  {p.isKids && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-300">
                      Kids
                    </span>
                  )}
                </button>
                {managing && (
                  <button
                    type="button"
                    disabled={busy !== null || profiles.length <= 1}
                    onClick={() => void removeProfile(p.id)}
                    className="absolute -right-1 -top-1 rounded-full border border-white/20 bg-black/80 p-1.5 text-white/70 hover:text-red-300 disabled:opacity-40"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}

            {canAdd && !creating && (
              <li className="w-28 md:w-36">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="w-full text-center"
                >
                  <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 text-white/40 transition hover:border-cyan-300/50 hover:text-cyan-200 md:h-28 md:w-28">
                    <Plus className="h-8 w-8" />
                  </span>
                  <span className="mt-3 block text-sm text-white/50">
                    Agregar
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}

        {creating && (
          <div className="mx-auto mt-8 flex max-w-sm flex-col gap-2 sm:flex-row">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del perfil"
              maxLength={40}
              className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-cyan-300/40"
            />
            <button
              type="button"
              disabled={busy !== null || !newName.trim()}
              onClick={() => void createProfile()}
              className="brand-button rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="rounded-xl px-3 py-2.5 text-sm text-white/55 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        )}

        {error && (
          <p className="mt-6 text-sm text-red-300">{error}</p>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-white/70 hover:border-white/30 hover:text-white"
          >
            <Users className="h-4 w-4" />
            {managing ? "Listo" : "Administrar perfiles"}
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs text-white/40">
            <Shield className="h-3.5 w-3.5 text-cyan-300/80" />
            1 pantalla por perfil · anti-compartir
          </p>
        </div>
      </div>
    </div>
  );
}
