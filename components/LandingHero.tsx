"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { AnimatedMarqueeHero } from "@/components/ui/hero-3";
import { APP_NAME } from "@/lib/brand";

export default function LandingHero({
  posterUrls = [],
}: {
  posterUrls?: string[];
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
    <AnimatedMarqueeHero
      tagline="Lo más popular en tu catálogo VeoTV"
      title={
        <>
          Películas y series
          <br />
          sin límites
        </>
      }
      description="Cancela cuando quieras. Empieza eligiendo tu plan y mira lo que ya está en VeoTV."
      images={posterUrls}
      header={
        <div className="flex items-center justify-between gap-3">
          <BrandMark className="shrink-0 text-2xl md:text-3xl" />
          <Link
            href="/login"
            className="brand-button shrink-0 rounded-full px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
          >
            Iniciar sesión
          </Link>
        </div>
      }
    >
      <form onSubmit={onStart} className="mx-auto flex w-full flex-col gap-3">
        <p className="text-center text-sm font-medium text-teal-200/90">
          Disfruta 15 días gratis al crear tu cuenta.
        </p>
        <p className="text-center text-sm text-white/55">
          ¿Listo para ver? Ingresa tu email para crear o reingresar a tu cuenta.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="min-h-12 flex-1 rounded-full border border-white/20 bg-black/55 px-5 text-base text-white outline-none placeholder:text-white/40 focus:border-teal-300/60"
          />
          <button
            type="submit"
            className="brand-button min-h-12 rounded-full px-7 text-base font-semibold"
          >
            Comenzar
          </button>
        </div>
        <p className="text-center text-xs text-white/35">{APP_NAME}</p>
      </form>
    </AnimatedMarqueeHero>
  );
}
