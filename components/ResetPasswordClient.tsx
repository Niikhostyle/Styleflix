"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";

function ResetForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!token) {
      setError("Falta el token del enlace. Solicita uno nuevo.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo restablecer.");
        setLoading(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
  }

  return (
    <div className="app-page">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <BrandMark className="mb-8" />
        <p className="eyebrow mb-2">Seguridad de cuenta</p>
        <h1 className="text-4xl font-black tracking-[-0.045em]">
          Nueva contraseña
        </h1>

        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <p className="text-emerald-200">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </p>
            <Link
              href="/login"
              className="brand-button mt-4 inline-block rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              Ir a entrar
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="glass-panel mt-8 space-y-4 rounded-3xl p-6"
          >
            {!token && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                Enlace incompleto.{" "}
                <Link href="/recuperar" className="underline">
                  Solicita uno nuevo
                </Link>
                .
              </p>
            )}
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Nueva contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Confirmar
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !token}
              className="brand-button w-full rounded-xl py-3 font-bold disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordClient() {
  return (
    <Suspense
      fallback={
        <div className="app-page flex min-h-screen items-center justify-center text-slate-400">
          Cargando…
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
