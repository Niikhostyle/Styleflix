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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onStart(e: FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo verificar el email.");
        setLoading(false);
        return;
      }

      const q = `?email=${encodeURIComponent(normalized)}`;
      if (data.exists) {
        router.push(`/login${q}`);
      } else {
        router.push(`/onboarding/cuenta${q}`);
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
      setLoading(false);
    }
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
            disabled={loading}
            className="min-h-12 flex-1 rounded-full border border-white/20 bg-black/55 px-5 text-base text-white outline-none placeholder:text-white/40 focus:border-teal-300/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className="brand-button min-h-12 rounded-full px-7 text-base font-semibold disabled:opacity-60"
          >
            {loading ? "…" : "Comenzar"}
          </button>
        </div>
        {error && (
          <p className="text-center text-sm text-red-300">{error}</p>
        )}
        <p className="text-center text-xs text-white/35">{APP_NAME}</p>
      </form>
    </AnimatedMarqueeHero>
  );
}
