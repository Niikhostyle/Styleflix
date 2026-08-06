"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import PosterBackdrop from "@/components/PosterBackdrop";

export default function LandingHero({
  posterPaths = [],
}: {
  posterPaths?: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function onStart(e: FormEvent) {
    e.preventDefault();
    const q = email.trim()
      ? `?email=${encodeURIComponent(email.trim().toLowerCase())}`
      : "";
    router.push(`/onboarding/cuenta${q}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-white">
      <PosterBackdrop posterPaths={posterPaths} />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-10">
        <BrandMark className="text-2xl md:text-3xl" />
        <Link
          href="/login"
          className="rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-2 text-sm font-semibold shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110"
        >
          Iniciar sesión
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[75vh] max-w-3xl flex-col items-center justify-center px-5 pb-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl md:text-6xl">
          Películas y series sin límites
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/85 md:text-xl">
          Cancela cuando quieras. Empieza eligiendo tu plan.
        </p>
        <p className="mt-6 text-sm text-white/70 md:text-base">
          ¿Listo para ver? Ingresa tu email para crear o reingresar a tu cuenta.
        </p>
        <form
          onSubmit={onStart}
          className="mt-5 flex w-full max-w-xl flex-col gap-3 sm:flex-row"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="min-h-12 flex-1 rounded-md border border-white/35 bg-black/55 px-4 text-base text-white outline-none placeholder:text-white/45 focus:border-fuchsia-400/70"
          />
          <button
            type="submit"
            className="min-h-12 rounded-md bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 text-lg font-semibold transition hover:brightness-110"
          >
            Comenzar ›
          </button>
        </form>
      </main>
    </div>
  );
}
