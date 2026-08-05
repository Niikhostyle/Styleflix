"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { APP_NAME } from "@/lib/brand";

const POSTER_SEEDS = [
  "/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
  "/t/p/w342/qNBAXBIQlnOThrvvHzXXrh2tQsY.jpg",
  "/t/p/w342/d5NXSklXo0qyIYkgV94aAgLgVYN.jpg",
  "/t/p/w342/62HCnUTziyWcpDaBO2i1DX17ljH.jpg",
  "/t/p/w342/1E5baAaEse26fej7uHcjOgEE2t2.jpg",
  "/t/p/w342/rktDFPBFUhFhEb5AEHKk6m8ZYnS.jpg",
  "/t/p/w342/7WsyChQLEftFiDOVTGkv3hFvsB8.jpg",
  "/t/p/w342/9Gtg2DzBhmYcPBp1aS8usIw9fXJ.jpg",
  "/t/p/w342/5YZbUmjbMa3CltaOm1LFUW5Zzpk.jpg",
  "/t/p/w342/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
  "/t/p/w342/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg",
  "/t/p/w342/qhb1HQCBp7uBes6yeYvU1G6lZWn.jpg",
];

export default function LandingHero({
  posterPaths = [],
}: {
  posterPaths?: string[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const paths =
    posterPaths.length >= 8
      ? posterPaths.slice(0, 18)
      : POSTER_SEEDS.map((p) => `https://image.tmdb.org${p}`);

  function onStart(e: FormEvent) {
    e.preventDefault();
    const q = email.trim()
      ? `?email=${encodeURIComponent(email.trim().toLowerCase())}`
      : "";
    router.push(`/onboarding/cuenta${q}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-white">
      <div className="pointer-events-none absolute inset-0 grid grid-cols-3 gap-1 opacity-40 sm:grid-cols-4 md:grid-cols-6">
        {paths.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="aspect-[2/3] overflow-hidden"
            style={{
              animation: `landingFade 12s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src.startsWith("http") ? src : `https://image.tmdb.org/t/p/w342${src}`}
              alt=""
              className="h-full w-full object-cover"
              loading={i < 6 ? "eager" : "lazy"}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/80 to-[#050508]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(5,5,8,0.55)_70%)]" />

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

      <div className="absolute bottom-6 left-0 right-0 z-10 flex flex-col items-center gap-2 text-xs font-semibold tracking-[0.25em] text-white/55">
        <span>DESCUBRE MÁS</span>
        <span className="animate-bounce text-base">⌄</span>
        <div className="mt-2 h-px w-40 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent" />
        <p className="mt-2 tracking-normal text-white/40">{APP_NAME}</p>
      </div>

      <style jsx>{`
        @keyframes landingFade {
          from {
            transform: scale(1);
            filter: brightness(0.75);
          }
          to {
            transform: scale(1.04);
            filter: brightness(0.95);
          }
        }
      `}</style>
    </div>
  );
}
