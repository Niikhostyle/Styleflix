"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSession, signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { APP_NAME_UPPER, MEMBERSHIP_HINT } from "@/lib/brand-ui";

function safeCallback(callbackUrl: string) {
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/";
}

export default function LoginForm() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const modeParam = searchParams.get("mode");

  const [mode, setMode] = useState<"login" | "register">(
    modeParam === "register" ? "register" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const dest = safeCallback(callbackUrl);
    const t = window.setTimeout(() => {
      window.location.replace(dest);
    }, 50);
    return () => window.clearTimeout(t);
  }, [status, callbackUrl]);

  async function afterAuth() {
    const dest = safeCallback(callbackUrl);
    window.location.assign(dest);
  }

  async function onLogin(e: FormEvent) {
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
      await getSession();
      await afterAuth();
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta.");
        setLoading(false);
        return;
      }

      const sign = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (sign?.error) {
        setError("Cuenta creada. Inicia sesión con tus datos.");
        setMode("login");
        setLoading(false);
        return;
      }
      await afterAuth();
    } catch {
      setError("No se pudo crear la cuenta.");
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
          {APP_NAME_UPPER}
        </p>
        <h1 className="mb-2 text-3xl font-black">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="mb-6 text-sm text-neutral-400">{MEMBERSHIP_HINT}</p>

        <div className="mb-6 flex gap-2">
          <button
            type="button"
            data-tv-focus
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 rounded py-2 text-sm font-semibold ${
              mode === "login"
                ? "bg-white text-black"
                : "bg-white/10 text-neutral-300"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            data-tv-focus
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`flex-1 rounded py-2 text-sm font-semibold ${
              mode === "register"
                ? "bg-white text-black"
                : "bg-white/10 text-neutral-300"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form
          onSubmit={mode === "login" ? onLogin : onRegister}
          className="space-y-4"
        >
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Nombre
              </label>
              <input
                type="text"
                required
                minLength={2}
                autoComplete="name"
                data-tv-autofocus={mode === "register" ? true : undefined}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/50 px-3 py-3 text-base outline-none ring-[#E50914] focus:ring-2"
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus={mode === "login"}
              data-tv-autofocus={mode === "login" ? true : undefined}
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
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
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
            {loading
              ? mode === "login"
                ? "Entrando..."
                : "Creando..."
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-500">
          <a href="/descargar" data-tv-focus className="text-neutral-300 underline">
            Descargar apps Android (celular o TV)
          </a>
        </p>
      </div>
    </div>
  );
}
