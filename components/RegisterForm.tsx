"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "No se pudo registrar.");
      return;
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (login?.error) {
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="app-page">
      <Navbar />
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-28">
        <p className="eyebrow mb-2">Únete a VeoTV</p>
        <h1 className="mb-2 text-4xl font-black tracking-[-0.045em]">
          Crear cuenta
        </h1>
        <p className="mb-8 text-sm text-neutral-400">
          Regístrate gratis para guardar progreso, capítulos y recomendaciones.
          Puedes ver todo sin cuenta.
        </p>

        <form onSubmit={onSubmit} className="glass-panel space-y-4 rounded-3xl p-6">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Nombre</label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#08101d]/75 px-3.5 py-3 outline-none focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/15"
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
            className="brand-button w-full rounded-xl py-3 font-bold transition disabled:opacity-60"
          >
            {loading ? "Creando cuenta..." : "Registrarme"}
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-400">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-white hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
