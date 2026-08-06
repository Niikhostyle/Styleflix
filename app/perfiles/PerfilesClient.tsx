"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Pencil, Plus, Shield, Trash2, Users } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { AvatarPicker, ProfileAvatar } from "@/components/ProfileAvatar";
import {
  nextAvatarKey,
  normalizeAvatarKey,
  type ProfileAvatarKey,
} from "@/lib/profile-avatars";

type ProfileRow = {
  id: string;
  name: string;
  avatarKey: string;
  isKids: boolean;
};

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState<ProfileAvatarKey>("1");
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/profiles", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfiles(data.profiles || []);
      setMaxProfiles(Math.max(1, Number(data.maxProfiles) || 1));
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

  function openCreate() {
    setEditingId(null);
    setNewName("");
    setNewAvatar(nextAvatarKey(profiles.map((p) => p.avatarKey)));
    setCreating(true);
    setManaging(true);
  }

  function openEdit(p: ProfileRow) {
    setEditingId(p.id);
    setNewName(p.name);
    setNewAvatar(normalizeAvatarKey(p.avatarKey));
    setCreating(true);
    setManaging(true);
  }

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

  async function saveProfile() {
    if (!newName.trim()) return;
    setBusy(editingId || "create");
    setError("");
    try {
      if (editingId) {
        const res = await fetch("/api/account/profiles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            name: newName.trim(),
            avatarKey: newAvatar,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "No se pudo guardar.");
          return;
        }
      } else {
        const res = await fetch("/api/account/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName.trim(),
            avatarKey: newAvatar,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "No se pudo crear.");
          return;
        }
      }
      setCreating(false);
      setEditingId(null);
      setNewName("");
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
  const slotsLeft = Math.max(0, maxProfiles - profiles.length);
  const planLabel =
    session?.user?.planTier === "standard"
      ? "Estándar"
      : session?.user?.planTier === "premium"
        ? "Premium"
        : session?.user?.planTier === "plus"
          ? "Plus"
          : session?.user?.role === "SUPER_ADMIN"
            ? "Admin"
            : "Demo";

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
          Plan <span className="text-white/80">{planLabel}</span>:{" "}
          <strong className="text-teal-200">
            {profiles.length}/{maxProfiles}
          </strong>{" "}
          perfil{maxProfiles === 1 ? "" : "es"}
          {slotsLeft > 0 ? (
            <>
              {" "}
              · puedes agregar {slotsLeft} más
            </>
          ) : null}
          .{" "}
          <span className="text-cyan-200/90">
            Cada perfil = 1 reproducción a la vez
          </span>
          .
        </p>

        {loading ? (
          <p className="mt-16 text-white/45">Cargando perfiles…</p>
        ) : (
          <ul className="mt-12 flex flex-wrap items-start justify-center gap-5 md:gap-8">
            {profiles.map((p) => (
              <li key={p.id} className="group relative w-[6.5rem] md:w-36">
                <button
                  type="button"
                  disabled={busy !== null || creating}
                  onClick={() =>
                    managing ? openEdit(p) : void selectProfile(p.id)
                  }
                  className="w-full text-center disabled:opacity-60"
                >
                  <span className="mx-auto block transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-teal-300/50 rounded-2xl">
                    <ProfileAvatar
                      avatarKey={p.avatarKey}
                      name={p.name}
                      size="xl"
                      className="mx-auto"
                    />
                  </span>
                  <span className="mt-3 block truncate text-sm font-medium text-white/85">
                    {busy === p.id
                      ? managing
                        ? "…"
                        : "Entrando…"
                      : p.name}
                  </span>
                  {p.isKids && (
                    <span className="text-[10px] uppercase tracking-wide text-amber-300">
                      Kids
                    </span>
                  )}
                </button>
                {managing && (
                  <div className="absolute -right-1 -top-1 flex flex-col gap-1">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => openEdit(p)}
                      className="rounded-full border border-white/20 bg-black/80 p-1.5 text-white/70 hover:text-teal-200"
                      title="Editar avatar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null || profiles.length <= 1}
                      onClick={() => void removeProfile(p.id)}
                      className="rounded-full border border-white/20 bg-black/80 p-1.5 text-white/70 hover:text-red-300 disabled:opacity-40"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}

            {canAdd && !creating && (
              <li className="w-[6.5rem] md:w-36">
                <button
                  type="button"
                  onClick={openCreate}
                  className="w-full text-center"
                >
                  <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 text-white/40 transition hover:border-teal-300/50 hover:text-teal-200 md:h-32 md:w-32">
                    <Plus className="h-9 w-9" />
                  </span>
                  <span className="mt-3 block text-sm text-white/50">
                    Agregar
                  </span>
                  {slotsLeft > 1 && (
                    <span className="mt-0.5 block text-[10px] text-white/35">
                      {slotsLeft} disponibles
                    </span>
                  )}
                </button>
              </li>
            )}
          </ul>
        )}

        {creating && (
          <div className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border border-white/10 bg-black/40 p-5 text-left">
            <p className="text-center text-sm font-semibold text-white/80">
              {editingId ? "Editar perfil" : "Nuevo perfil"}
            </p>
            <AvatarPicker
              value={newAvatar}
              onChange={setNewAvatar}
              usedKeys={profiles
                .filter((p) => p.id !== editingId)
                .map((p) => p.avatarKey)}
            />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del perfil"
              maxLength={40}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-teal-300/40"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null || !newName.trim()}
                onClick={() => void saveProfile()}
                className="brand-button flex-1 rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-60"
              >
                {editingId ? "Guardar" : "Crear perfil"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditingId(null);
                  setNewName("");
                }}
                className="rounded-xl px-3 py-2.5 text-sm text-white/55 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-6 text-sm text-red-300">{error}</p>}

        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setManaging((v) => !v);
              setCreating(false);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-white/70 hover:border-white/30 hover:text-white"
          >
            <Users className="h-4 w-4" />
            {managing ? "Listo" : "Administrar perfiles"}
          </button>
          {canAdd && !creating && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-300/30 bg-teal-300/10 px-4 py-2 text-teal-100 hover:bg-teal-300/15"
            >
              <Plus className="h-4 w-4" />
              Nuevo perfil ({slotsLeft} restan)
            </button>
          )}
          <p className="inline-flex items-center gap-1.5 text-xs text-white/40">
            <Shield className="h-3.5 w-3.5 text-cyan-300/80" />
            1 pantalla por perfil
          </p>
        </div>
      </div>
    </div>
  );
}
