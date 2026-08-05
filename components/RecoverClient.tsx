"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { APP_NAME_UPPER } from "@/lib/brand-ui";

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
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <p className="mb-2 text-2xl font-black tracking-tight text-[#E50914]">
          {APP_NAME_UPPER}
        </p>
        <h1 className="text-3xl font-black tracking-tight">
          Recuperar acceso
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Restablece tu contraseña o solicita ayuda si olvidaste el correo.
        </p>

        <div className="mt-6 flex gap-2 rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("password");
              setError("");
              setMessage("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === "password"
                ? "bg-white text-black"
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
                ? "bg-white text-black"
                : "text-neutral-300 hover:text-white"
            }`}
          >
            Olvidé mi correo
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6">
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
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-3 outline-none ring-[#E50914] focus:ring-2"
                  placeholder="tu@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#E50914] py-3 text-sm font-bold hover:bg-[#f6121d] disabled:opacity-60"
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
                  className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-3 outline-none ring-[#E50914] focus:ring-2"
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
