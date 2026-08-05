"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { KeyRound, Shield, UserRound } from "lucide-react";
import { subscriptionLabel } from "@/lib/access";

export default function AccountClient() {
  const { data: session, update } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [subStatus, setSubStatus] = useState("NONE");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPass, setBusyPass] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/account/profile");
        const data = await res.json();
        if (res.ok && data.user) {
          setName(data.user.name || "");
          setEmail(data.user.email || "");
          setRole(data.user.role || "");
          setSubStatus(data.user.subscriptionStatus || "NONE");
          setPeriodEnd(data.user.currentPeriodEnd);
          setEmailVerified(data.user.emailVerified);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusyProfile(true);
    setProfileErr("");
    setProfileMsg("");
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProfileErr(data.error || "No se pudo guardar.");
        return;
      }
      setProfileMsg("Perfil actualizado.");
      await update();
    } catch {
      setProfileErr("Error de red.");
    } finally {
      setBusyProfile(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusyPass(true);
    setPassErr("");
    setPassMsg("");
    if (newPassword !== confirmPassword) {
      setPassErr("Las contraseñas nuevas no coinciden.");
      setBusyPass(false);
      return;
    }
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPassErr(data.error || "No se pudo cambiar la contraseña.");
        return;
      }
      setPassMsg(data.message || "Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPassErr("Error de red.");
    } finally {
      setBusyPass(false);
    }
  }

  const isAdmin = role === "SUPER_ADMIN" || session?.user?.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-24 md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#E50914]">
          Cuenta
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Mi perfil</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Administra tu nombre y contraseña de forma segura.
        </p>

        {loading ? (
          <p className="mt-10 text-neutral-400">Cargando…</p>
        ) : (
          <div className="mt-10 space-y-6">
            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6">
              <div className="mb-5 flex items-center gap-2">
                <UserRound className="h-5 w-5 text-[#E50914]" />
                <h2 className="text-lg font-bold">Datos personales</h2>
              </div>
              <form onSubmit={saveProfile} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">
                    Nombre
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">
                    Correo
                  </label>
                  <input
                    value={email}
                    disabled
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-neutral-400"
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    {emailVerified
                      ? "Correo verificado"
                      : "Correo pendiente de verificación"}
                  </p>
                </div>
                {!isAdmin && (
                  <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-3 text-sm text-neutral-300">
                    <p>
                      Membresía:{" "}
                      <span className="font-semibold text-white">
                        {subscriptionLabel(subStatus)}
                      </span>
                    </p>
                    {periodEnd && (
                      <p className="mt-1 text-xs text-neutral-500">
                        Vigencia:{" "}
                        {new Date(periodEnd).toLocaleDateString("es-CL")}
                      </p>
                    )}
                    <Link
                      href="/membresia"
                      className="mt-2 inline-block text-sm text-[#E50914] underline"
                    >
                      Gestionar membresía
                    </Link>
                  </div>
                )}
                {profileErr && (
                  <p className="text-sm text-red-300">{profileErr}</p>
                )}
                {profileMsg && (
                  <p className="text-sm text-emerald-300">{profileMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={busyProfile}
                  className="rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black transition hover:bg-neutral-200 disabled:opacity-60"
                >
                  {busyProfile ? "Guardando…" : "Guardar perfil"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-6">
              <div className="mb-5 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#E50914]" />
                <h2 className="text-lg font-bold">Cambiar contraseña</h2>
              </div>
              <form onSubmit={changePassword} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm text-neutral-400">
                    Contraseña actual
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-neutral-400">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-neutral-400">
                      Confirmar nueva
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
                    />
                  </div>
                </div>
                {passErr && <p className="text-sm text-red-300">{passErr}</p>}
                {passMsg && (
                  <p className="text-sm text-emerald-300">{passMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={busyPass}
                  className="rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
                >
                  {busyPass ? "Actualizando…" : "Actualizar contraseña"}
                </button>
              </form>
            </section>

            {isAdmin && (
              <section className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <Shield className="h-4 w-4 text-[#E50914]" />
                  Acceso de super administrador.
                  <Link href="/admin" className="text-[#E50914] underline">
                    Ir al panel
                  </Link>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
