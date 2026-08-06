"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSession, signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { membershipHint } from "@/lib/brand-ui";
import { useMembershipPrice } from "@/components/PricingProvider";
import BrandMark from "@/components/BrandMark";
import { AnimatedMarqueeHero } from "@/components/ui/hero-3";

function safeCallback(callbackUrl: string) {
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
    ? callbackUrl
    : "/";
}

export default function LoginForm({
  posterUrls = [],
}: {
  posterUrls?: string[];
}) {
  const { status } = useSession();
  const { clp: membershipPriceClp } = useMembershipPrice();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const modeParam = searchParams.get("mode");
  const verified = searchParams.get("verified");

  const [mode, setMode] = useState<"login" | "register">(
    modeParam === "register" ? "register" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    verified === "1"
      ? "Correo confirmado. Ya puedes iniciar sesión."
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = window.setTimeout(async () => {
      const session = await getSession();
      const dest = session?.user?.membershipActive
        ? safeCallback(callbackUrl)
        : "/onboarding/planes";
      window.location.replace(dest);
    }, 50);
    return () => window.clearTimeout(t);
  }, [status, callbackUrl]);

  async function afterAuth() {
    const session = await getSession();
    const dest = session?.user?.membershipActive
      ? safeCallback(callbackUrl)
      : "/onboarding/planes";
    window.location.assign(dest);
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerify(false);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        const code = (res as { code?: string }).code || "";
        if (
          code === "email_not_verified" ||
          String(res.error).includes("email_not_verified")
        ) {
          setNeedsVerify(true);
          setError(
            "Debes confirmar tu correo antes de entrar. Revisa tu bandeja o reenvía el enlace."
          );
        } else {
          setError("Email o contraseña incorrectos.");
        }
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
    setInfo("");
    setNeedsVerify(false);
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

      if (data.needsVerification) {
        setMode("login");
        setInfo(
          data.message ||
            "Te enviamos un correo de confirmación. Ábrelo y luego inicia sesión."
        );
        setNeedsVerify(true);
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

  async function resendVerification() {
    if (!email.trim()) {
      setError("Escribe tu email para reenviar la confirmación.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo reenviar.");
      } else {
        setInfo(data.message);
      }
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-fuchsia-400/50";

  if (status === "authenticated" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] text-white/70">
        {status === "loading" ? "Cargando…" : "Entrando…"}
      </div>
    );
  }

  return (
    <AnimatedMarqueeHero
      tagline="Lo más visto en VeoTV"
      title={
        mode === "login" ? (
          <>
            Inicia sesión
            <br />
            y sigue viendo
          </>
        ) : (
          <>
            Crea tu cuenta
            <br />
            en minutos
          </>
        )
      }
      description={membershipHint(membershipPriceClp)}
      images={posterUrls}
      header={
        <div className="flex items-center justify-between">
          <BrandMark className="text-2xl md:text-3xl" />
          <Link
            href="/"
            className="text-sm text-white/55 underline hover:text-white"
          >
            Inicio
          </Link>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/10 bg-[#0b0b12]/90 p-4 shadow-2xl backdrop-blur-md md:p-5">
        <div className="mb-3 flex gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
          <button
            type="button"
            data-tv-focus
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "login"
                ? "bg-red-500 text-white"
                : "text-white/50 hover:text-white"
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
              setInfo("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "register"
                ? "bg-red-500 text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form
          onSubmit={mode === "login" ? onLogin : onRegister}
          className="space-y-3"
        >
          {mode === "register" && (
            <input
              type="text"
              required
              minLength={2}
              autoComplete="name"
              data-tv-autofocus={mode === "register" ? true : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Nombre"
            />
          )}
          <input
            type="email"
            required
            autoComplete="email"
            autoFocus={mode === "login"}
            data-tv-autofocus={mode === "login" ? true : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="Email"
          />
          <div>
            {mode === "login" && (
              <div className="mb-1 flex justify-end">
                <Link
                  href="/recuperar"
                  className="text-xs text-white/45 underline hover:text-white"
                >
                  ¿Olvidaste tu clave?
                </Link>
              </div>
            )}
            <input
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Contraseña"
            />
          </div>

          {info && (
            <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300">
              {info}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
          {needsVerify && (
            <button
              type="button"
              onClick={() => void resendVerification()}
              disabled={loading}
              className="w-full text-xs text-white/60 underline hover:text-white"
            >
              Reenviar correo de confirmación
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            data-tv-focus
            className="w-full rounded-full bg-red-500 py-3 text-sm font-extrabold transition hover:bg-red-600 disabled:opacity-60"
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

        <p className="mt-3 text-center text-xs text-white/40">
          <a href="/descargar" className="underline hover:text-white">
            Apps Android
          </a>
        </p>
      </div>
    </AnimatedMarqueeHero>
  );
}
