"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Loader2, MessageSquareHeart } from "lucide-react";

const CATEGORIES = [
  {
    id: "DUDA" as const,
    label: "Duda",
    hint: "Cómo funciona algo o ayuda con tu cuenta",
  },
  {
    id: "QUEJA" as const,
    label: "Queja",
    hint: "Un problema con la app, el stream o el pago",
  },
  {
    id: "SUGERENCIA" as const,
    label: "Sugerencia",
    hint: "Ideas para mejorar VeoTV",
  },
  {
    id: "OTRO" as const,
    label: "Otro",
    hint: "Cualquier otro mensaje",
  },
];

export default function FeedbackClient() {
  const { data: session } = useSession();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>(
    "SUGERENCIA"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    if (session.user.name) setName((n) => n || session.user.name || "");
    if (session.user.email) setEmail((e) => e || session.user.email || "");
  }, [session]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, name, email, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo enviar. Inténtalo de nuevo.");
        return;
      }
      setDone(true);
      setMessage("");
    } catch {
      setError("Error de red. Revisa tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="surface-panel mt-10 rounded-3xl p-8 text-center md:p-10">
        <CheckCircle2 className="mx-auto h-12 w-12 text-teal-300" />
        <h2 className="mt-4 text-2xl font-bold tracking-tight">
          Mensaje enviado
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Gracias. Si necesitamos más datos, te escribiremos al correo
          indicado.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="brand-button mt-6 rounded-xl px-5 py-2.5 text-sm font-bold"
        >
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="surface-panel mt-10 space-y-6 rounded-3xl p-6 md:p-8"
    >
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-slate-200">
          Tipo de mensaje
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                category === c.id
                  ? "border-teal-300/50 bg-teal-300/10 shadow-[0_0_24px_rgba(45,212,191,0.12)]"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
              }`}
            >
              <span className="block text-sm font-bold text-white">
                {c.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-300">
            Nombre
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-3.5 py-2.5 text-white outline-none ring-teal-300/40 focus:ring-2"
            placeholder="Tu nombre"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-300">
            Correo
          </span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={120}
            className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-3.5 py-2.5 text-white outline-none ring-teal-300/40 focus:ring-2"
            placeholder="tu@correo.com"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-300">Mensaje</span>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          minLength={10}
          maxLength={2000}
          rows={6}
          className="w-full resize-y rounded-xl border border-white/10 bg-[#0b1220] px-3.5 py-3 text-white outline-none ring-teal-300/40 focus:ring-2"
          placeholder="Escribe con detalle tu duda, queja o sugerencia…"
        />
        <span className="mt-1 block text-xs text-slate-500">
          {message.length}/2000
        </span>
      </label>

      {error && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="brand-button flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-60 sm:w-auto"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            <MessageSquareHeart className="h-4 w-4" aria-hidden />
            Enviar feedback
          </>
        )}
      </button>
    </form>
  );
}
