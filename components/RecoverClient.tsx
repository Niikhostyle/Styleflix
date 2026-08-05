"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/BrandMark";

type Tab = "password" | "email";

export default function RecoverClient() {
  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onForgotPassword(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo procesar la solicitud.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function onResendVerify(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo reenviar.");
        return;
      }
      setMessage(data.message);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-page">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <BrandMark className="mb-8" />
        <p className="eyebrow mb-2">Seguridad de cuenta</p>
        <h1 className="text-4xl font-black tracking-[-0.045em]">
          Recuperar acceso
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Restablece tu contraseña o solicita ayuda si olvidaste el correo.
        </p>

        <div className="mt-7 flex gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-1.5">
          <button
            type="button"
            onClick={() => {
              setTab("password");
              setError("");
              setMessage("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "password"
                ? "bg-teal-300 text-[#07111d]"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            Olvidé mi clave
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("email");
              setError("");
              setMessage("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "email"
                ? "bg-teal-300 text-[#07111d]"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            Olvidé mi correo
          </button>
        </div>

        <div className="glass-panel mt-4 rounded-3xl p-6">
          {tab === "password" ? (
            <form onSubmit={onForgotPassword} className="space-y-4">
              <p className="text-sm text-neutral-400">
                Te enviaremos un enlace seguro a tu correo registrado.
              </p>
              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Email de la cuenta
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
                  placeholder="tu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="brand-button w-full rounded-xl py-3 text-sm font-bold disabled:opacity-60"
              >
                {loading ? "Enviando…" : "Enviar enlace"}
              </button>
              <button
                type="button"
                disabled={loading || !email}
                onClick={(e) => void onResendVerify(e as unknown as FormEvent)}
                className="w-full text-sm text-neutral-400 underline hover:text-neutral-200 disabled:opacity-40"
              >
                Reenviar correo de confirmación
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-neutral-400">
                Por seguridad no podemos mostrar el email de una cuenta desde
                aquí. Escribe a soporte con tu nombre y algún dato de la
                membresía (fecha aproximada de pago o ID de pedido).
              </p>
              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Tu nombre (opcional, para el mensaje)
                </label>
                <input
                  value={nameHint}
                  onChange={(e) => setNameHint(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
                  placeholder="Nombre en la cuenta"
                />
              </div>
              <a
                href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || "soporte@veotv.cloud"}?subject=${encodeURIComponent(
                  "Olvidé mi correo VeoTV"
                )}&body=${encodeURIComponent(
                  `Hola, olvidé el correo de mi cuenta VeoTV.\nNombre: ${nameHint || "(indicar)"}\nDetalles adicionales:\n`
                )}`}
                className="flex w-full items-center justify-center rounded-lg bg-white py-3 text-sm font-bold text-black hover:bg-neutral-200"
              >
                Contactar soporte
              </a>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-4 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300">
              {message}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link href="/login" className="text-neutral-300 underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
