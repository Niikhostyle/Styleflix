"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { getSession, signIn, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { membershipHint } from "@/lib/brand-ui";
import { useMembershipPrice } from "@/components/PricingProvider";
import BrandMark from "@/components/BrandMark";
import LoadingScreen from "@/components/LoadingScreen";
import { AnimatedMarqueeHero } from "@/components/ui/hero-3";
import { ButtonSpinner } from "@/components/ui/loading-bits";

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
  const emailParam = (searchParams.get("email") || "").trim().toLowerCase();
  const existingAccount = searchParams.get("existing") === "1";

  const [mode, setMode] = useState<"login" | "register">(
    modeParam === "register" ? "register" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(
    verified === "1"
      ? "Correo confirmado. Ya puedes iniciar sesión."
      : existingAccount
        ? "Ya tienes cuenta con este email. Inicia sesión para continuar."
        : ""
  );
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [downloadsEnabled, setDownloadsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/preview", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && typeof data.downloadsEnabled === "boolean") {
          setDownloadsEnabled(data.downloadsEnabled);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = window.setTimeout(async () => {
      const session = await getSession();
      if (session?.user?.catalogAccess || session?.user?.membershipActive) {
        window.location.replace("/perfiles");
        return;
      }
      if (session?.user?.demoExpiresAt) {
        window.location.replace("/onboarding/planes?demo=expired");
        return;
      }
      window.location.replace("/onboarding/bienvenida");
    }, 50);
    return () => window.clearTimeout(t);
  }, [status, callbackUrl]);

  async function afterAuth() {
    const session = await getSession();
    if (session?.user?.catalogAccess || session?.user?.membershipActive) {
      const dest =
        safeCallback(callbackUrl) === "/"
          ? "/perfiles"
          : `/perfiles?next=${encodeURIComponent(safeCallback(callbackUrl))}`;
      window.location.assign(dest);
      return;
    }
    if (session?.user?.demoExpiresAt) {
      window.location.assign("/onboarding/planes?demo=expired");
      return;
    }
    window.location.assign("/onboarding/bienvenida");
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
        void fetch("/api/auth/login-fail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            reason: code || "login_error",
          }),
        }).catch(() => undefined);
        if (
          code === "email_not_verified" ||
          String(res.error).includes("email_not_verified")
        ) {
          setNeedsVerify(true);
          const msg =
            "Debes confirmar tu correo antes de entrar. Revisa tu bandeja o reenvía el enlace.";
          setError(msg);
          toast.error("Correo sin confirmar", { description: msg });
        } else {
          setError("Email o contraseña incorrectos.");
          toast.error("No pudimos entrar", {
            description: "Revisa tu email y contraseña.",
          });
        }
        setLoading(false);
        return;
      }
      toast.success("¡Bienvenido de nuevo!", {
        description: "Entrando a VeoTV…",
      });
      await getSession();
      await afterAuth();
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
      toast.error("Error de red", {
        description: "Intenta de nuevo en unos segundos.",
      });
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerify(false);
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      toast.error("Contraseñas distintas", {
        description: "Reescribe la misma clave en ambos campos.",
      });
      return;
    }
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
        const msg = data.error || "No se pudo crear la cuenta.";
        setError(msg);
        toast.error("No se creó la cuenta", { description: msg });
        setLoading(false);
        return;
      }

      if (data.needsVerification) {
        setMode("login");
        const msg =
          data.message ||
          "Te enviamos un correo de confirmación. Ábrelo y luego inicia sesión.";
        setInfo(msg);
        setNeedsVerify(true);
        toast.success("Revisa tu bandeja", { description: msg });
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
        toast.success("Cuenta lista", {
          description: "Ahora inicia sesión con tu email.",
        });
        setLoading(false);
        return;
      }
      toast.success("Cuenta creada", { description: "¡A disfrutar VeoTV!" });
      await afterAuth();
    } catch {
      setError("No se pudo crear la cuenta.");
      toast.error("Error de red", {
        description: "Intenta crear la cuenta otra vez.",
      });
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
    "w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-300/50";

  if (status === "authenticated" || status === "loading") {
    return (
      <LoadingScreen
        label={
          status === "loading" ? "Despertando VeoTV…" : "Abriendo tu espacio…"
        }
        lines={[
          "Verificando sesión…",
          "Preparando perfiles…",
          "Casi dentro…",
        ]}
      />
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
        <div className="flex items-center justify-between gap-3">
          <BrandMark className="shrink-0 text-2xl md:text-3xl" />
          <Link
            href="/"
            className="shrink-0 text-sm text-white/55 underline hover:text-white"
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
                ? "bg-teal-300 text-[#07111d]"
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
                ? "bg-teal-300 text-[#07111d]"
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
          {mode === "register" && (
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={inputClass}
              placeholder="Reescribe la contraseña"
            />
          )}

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
            className="brand-button inline-flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-extrabold transition disabled:opacity-60"
          >
            {loading && <ButtonSpinner />}
            {loading
              ? mode === "login"
                ? "Abriendo sesión…"
                : "Creando magia…"
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </button>
        </form>

        {downloadsEnabled && (
          <p className="mt-3 text-center text-xs text-white/40">
            <a href="/descargar" className="underline hover:text-white">
              Apps Android
            </a>
          </p>
        )}
      </div>
    </AnimatedMarqueeHero>
  );
}
