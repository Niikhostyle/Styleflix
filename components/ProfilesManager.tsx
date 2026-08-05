"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type ProfileRow = {
  id: string;
  name: string;
  avatarKey: string;
  isKids: boolean;
};

export default function ProfilesManager() {
  const { data: session } = useSession();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [maxProfiles, setMaxProfiles] = useState(1);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/profiles", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfiles(data.profiles || []);
      setMaxProfiles(data.maxProfiles || 1);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/account/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo crear el perfil.");
        return;
      }
      setName("");
      setMsg("Perfil creado.");
      await load();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = profiles.length < maxProfiles;

  return (
    <section className="surface-panel rounded-3xl p-6 md:p-7">
      <h2 className="text-lg font-bold">Perfiles de visionado</h2>
      <p className="mt-1 text-sm text-slate-400">
        Plan {session?.user?.planTier || "—"}: hasta {maxProfiles} perfil
        {maxProfiles === 1 ? "" : "es"} · resolución{" "}
        {session?.user?.planMaxResolution || "—"}p
        {session?.user?.planCanDownload ? " · descargas" : ""}
      </p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {profiles.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm"
          >
            <span className="font-semibold">{p.name}</span>
            {p.isKids && (
              <span className="ml-2 text-xs text-amber-300">Kids</span>
            )}
          </li>
        ))}
      </ul>
      {canAdd ? (
        <form onSubmit={addProfile} className="mt-4 flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del perfil"
            required
            className="rounded-xl border border-white/10 bg-[#08101d]/70 px-3 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "…" : "Agregar"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-white/45">
          Límite de perfiles alcanzado.{" "}
          <a href="/onboarding/planes" className="underline">
            Mejorar plan
          </a>
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
    </section>
  );
}
