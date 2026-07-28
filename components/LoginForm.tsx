"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-24">
        <h1 className="mb-2 text-3xl font-black">Iniciar sesión</h1>
        <p className="mb-8 text-sm text-neutral-400">
          Accede a tu cuenta para reproducir contenido.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-neutral-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-white/10 bg-black/50 px-3 py-2.5 outline-none ring-[#E50914] focus:ring-2"
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
            className="w-full rounded bg-[#E50914] py-2.5 font-bold transition hover:bg-[#f6121d] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-sm text-neutral-400">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-white hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
