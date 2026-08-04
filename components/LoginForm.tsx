"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

function safeCallback(callbackUrl: string) {
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/";
}

function postLoginDestination(
  membershipActive: boolean | undefined,
  callbackUrl: string
) {
  if (!membershipActive) return "/membresia";
  return safeCallback(callbackUrl);
}

export default function LoginForm() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Si ya hay sesión, salir del login (aunque el middleware falle)
  useEffect(() => {
    if (status !== "authenticated") return;
    const dest = postLoginDestination(
      session?.user?.membershipActive,
      callbackUrl
    );
    const t = window.setTimeout(() => {
      window.location.replace(dest);
    }, 50);
    return () => window.clearTimeout(t);
  }, [status, callbackUrl, session?.user?.membershipActive]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setError("Email o contraseña incorrectos.");
        setLoading(false);
        return;
      }

      const fresh = await getSession();
      const dest = postLoginDestination(
        fresh?.user?.membershipActive,
        callbackUrl
      );
      window.location.assign(dest);
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  if (status === "authenticated" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#141414] text-neutral-300">
        {status === "loading" ? "Cargando…" : "Entrando…"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-24">
        <p className="mb-2 text-2xl font-black tracking-tight text-[#E50914]">
          STYLEFLIX
        </p>
        <h1 className="mb-2 text-3xl font-black">Iniciar sesión</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Necesitas una membresía activa ($4.990/mes) para ver el catálogo.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              data-tv-autofocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/50 px-3 py-3 text-base outline-none ring-[#E50914] focus:ring-2"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/50 px-3 py-3 text-base outline-none ring-[#E50914] focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            data-tv-focus
            className="tv-cta w-full rounded bg-[#E50914] py-3 text-base font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-400">
          Las cuentas las crea el administrador. Si no tienes acceso, contacta
          al Super Admin.
        </p>
        <p className="mt-4 text-sm text-neutral-500">
          <a href="/descargar" data-tv-focus className="text-neutral-300 underline">
            Descargar apps Android (celular o TV)
          </a>
        </p>
      </div>
    </div>
  );
}
