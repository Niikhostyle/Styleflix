"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import OnboardingShell from "@/components/OnboardingShell";

export default function OnboardingCuentaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = (searchParams.get("email") || "").trim().toLowerCase();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(Boolean(initialEmail));

  useEffect(() => {
    if (!initialEmail) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: initialEmail }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && data.exists) {
          router.replace(
            `/login?email=${encodeURIComponent(initialEmail)}&existing=1`
          );
          return;
        }
      } catch {
        // Si falla el check, dejamos crear cuenta (register igual valida 409)
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialEmail, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: (name.trim() || normalized.split("@")[0] || "Usuario").slice(
            0,
            60
          ),
          email: normalized,
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        router.replace(
          `/login?email=${encodeURIComponent(normalized)}&existing=1`
        );
        return;
      }
      if (!res.ok) {
        setError(data.error || "No se pudo crear la cuenta.");
        setLoading(false);
        return;
      }

      if (data.needsVerification) {
        setInfo(
          "Te enviamos un correo para confirmar tu cuenta. Luego inicia sesión y elige tu plan."
        );
        setLoading(false);
        return;
      }

      const login = await signIn("credentials", {
        email: normalized,
        password,
        redirect: false,
      });
      if (login?.error) {
        setError("Cuenta creada. Inicia sesión para continuar.");
        setLoading(false);
        return;
      }
      router.replace("/onboarding/bienvenida");
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <OnboardingShell
        step={1}
        title="Crea tu cuenta"
        subtitle="Verificando tu email…"
        backHref="/login"
        signOutOnBack
      >
        <p className="text-center text-sm text-white/50">Un momento…</p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={1}
      title="Crea tu cuenta"
      subtitle="Sin compromisos — cancela cuando quieras."
      backHref="/login"
      signOutOnBack
    >
      <ul className="mb-6 space-y-2 text-sm text-white/70">
        {[
          "Sin compromisos, cancela cuando quieras.",
          "Entretenimiento ilimitado a buen precio.",
          "Disfruta VeoTV en todos tus dispositivos.",
        ].map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-teal-300">✓</span>
            {t}
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-teal-300/50"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-teal-300/50"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Crea una contraseña (mínimo 8 caracteres)"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-teal-300/50"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="brand-button w-full rounded-lg py-3 text-sm font-bold disabled:opacity-60"
        >
          {loading ? "Creando…" : "Siguiente"}
        </button>
      </form>
    </OnboardingShell>
  );
}
