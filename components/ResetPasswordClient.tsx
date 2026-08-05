"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { APP_NAME_UPPER } from "@/lib/brand-ui";

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
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <p className="mb-2 text-2xl font-black text-[#E50914]">
          {APP_NAME_UPPER}
        </p>
        <h1 className="text-3xl font-black">Nueva contraseña</h1>

        {done ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <p className="text-emerald-200">
              Contraseña actualizada. Ya puedes iniciar sesión.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-bold"
            >
              Ir a entrar
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6"
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
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-3 outline-none ring-[#E50914] focus:ring-2"
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
                className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-3 outline-none ring-[#E50914] focus:ring-2"
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
              className="w-full rounded-lg bg-[#E50914] py-3 font-bold disabled:opacity-60"
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
        <div className="flex min-h-screen items-center justify-center bg-[#0c0c0c] text-neutral-400">
          Cargando…
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
