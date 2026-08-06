"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import OnboardingShell from "@/components/OnboardingShell";

export default function OnboardingCuentaClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: (name.trim() || email.split("@")[0] || "Usuario").slice(0, 60),
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
        setInfo(
          "Te enviamos un correo para confirmar tu cuenta. Luego inicia sesión y elige tu plan."
        );
        setLoading(false);
        return;
      }

      const login = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (login?.error) {
        setError("Cuenta creada. Inicia sesión para continuar.");
        setLoading(false);
        return;
      }
      router.replace("/onboarding/planes");
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
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
            <span className="text-fuchsia-400">✓</span>
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
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-fuchsia-400/50"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (opcional)"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-fuchsia-400/50"
        />
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Crea una contraseña (mínimo 8 caracteres)"
          className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-3 text-sm outline-none focus:border-fuchsia-400/50"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        {info && <p className="text-sm text-emerald-300">{info}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-bold disabled:opacity-60"
        >
          {loading ? "Creando…" : "Siguiente"}
        </button>
      </form>
    </OnboardingShell>
  );
}
