"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  CheckCircle2,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Tv,
  Zap,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import PosterCollageBackground from "@/components/PosterCollageBackground";

type Props = {
  enabled: boolean;
  celularOk: boolean;
  tvOk: boolean;
  posterUrls: string[];
  celularVersion?: string;
  tvVersion?: string;
};

function DownloadCard({
  href,
  available,
  icon,
  title,
  subtitle,
  badge,
  accent,
}: {
  href?: string;
  available: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  accent: "mobile" | "tv";
}) {
  const base =
    "group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 text-left transition duration-300 sm:p-7";

  if (!available) {
    return (
      <div
        className={`${base} border-red-400/25 bg-red-950/35`}
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 text-red-300">
          {icon}
        </div>
        <p className="text-lg font-bold tracking-tight">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-red-200/85">
          APK no disponible en el servidor. Redeploy pendiente.
        </p>
      </div>
    );
  }

  const accentClass =
    accent === "mobile"
      ? "border-teal-300/25 bg-gradient-to-br from-teal-500/20 via-[#0c1220]/90 to-violet-500/15 hover:border-teal-300/50 hover:shadow-[0_0_40px_rgba(94,234,212,0.12)]"
      : "border-violet-300/25 bg-gradient-to-br from-violet-500/20 via-[#0c1220]/90 to-teal-500/10 hover:border-violet-300/50 hover:shadow-[0_0_40px_rgba(194,153,255,0.12)]";

  return (
    <motion.a
      href={href}
      download
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.985 }}
      className={`${base} ${accentClass} backdrop-blur-xl`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10"
      />
      <div className="relative mb-5 flex items-start justify-between gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            accent === "mobile"
              ? "border-teal-300/35 bg-teal-400/10 text-teal-200"
              : "border-violet-300/35 bg-violet-400/10 text-violet-200"
          }`}
        >
          {icon}
        </div>
        <span className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          {badge}
        </span>
      </div>
      <p className="relative text-xl font-bold tracking-tight">{title}</p>
      <p className="relative mt-2 text-sm leading-relaxed text-white/55">
        {subtitle}
      </p>
      <div className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-white">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 ${
            accent === "mobile"
              ? "bg-[linear-gradient(110deg,var(--tv-from),var(--tv-to))] text-[#07111d]"
              : "border border-white/20 bg-white/10 text-white"
          }`}
        >
          <ArrowDownToLine className="h-4 w-4" />
          Descargar APK
        </span>
      </div>
    </motion.a>
  );
}

export default function DescargarAppsClient({
  enabled,
  celularOk,
  tvOk,
  posterUrls,
  celularVersion = "1.5.0",
  tvVersion = "1.3.0",
}: Props) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <PosterCollageBackground images={posterUrls} />

      <div className="relative z-10 px-4 pb-16 pt-8 sm:px-6 sm:pb-20 sm:pt-12 md:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-10 flex items-center justify-between gap-4 sm:mb-14">
            <BrandMark className="text-2xl sm:text-3xl" />
            <Link
              href="/login"
              className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-semibold text-white/75 backdrop-blur-sm transition hover:border-white/30 hover:text-white sm:text-sm"
            >
              Ir al login web
            </Link>
          </header>

          {!enabled ? (
            <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-black/55 p-8 text-center backdrop-blur-xl sm:p-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300/85">
                Apps Android
              </p>
              <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl font-black tracking-tight sm:text-5xl">
                Próximamente
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60 sm:text-base">
                Las apps para celular y Android TV todavía no están públicas.
                Mientras tanto usa VeoTV desde el navegador.
              </p>
            </section>
          ) : (
            <>
              <section className="mx-auto max-w-3xl text-center">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                >
                  <p className="inline-flex items-center gap-2 rounded-full border border-teal-300/25 bg-teal-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200">
                    <MonitorSmartphone className="h-3.5 w-3.5" />
                    VeoTV en tus pantallas
                  </p>
                  <h1 className="mt-5 font-[family-name:var(--font-display)] text-[2.35rem] font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                    Lleva VeoTV
                    <br />
                    <span className="bg-[linear-gradient(110deg,var(--tv-from)_0%,var(--tv-via)_45%,var(--tv-to)_100%)] bg-clip-text text-transparent">
                      a tu bolsillo y a tu TV
                    </span>
                  </h1>
                  <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
                    Instalación directa, sin Google Play. Elige la build según tu
                    dispositivo e inicia sesión con tu misma cuenta.
                  </p>
                </motion.div>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {[
                    { icon: ShieldCheck, text: "Sideload seguro" },
                    { icon: Zap, text: "Misma cuenta web" },
                    { icon: CheckCircle2, text: "Sin tienda intermediaria" },
                  ].map(({ icon: Icon, text }) => (
                    <span
                      key={text}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-black/45 px-3 py-1.5 text-xs text-white/70 backdrop-blur-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-teal-300" />
                      {text}
                    </span>
                  ))}
                </div>
              </section>

              <section className="mx-auto mt-10 grid max-w-4xl gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2">
                <DownloadCard
                  available={celularOk}
                  href="/downloads/veotv-celular.apk"
                  icon={<Smartphone className="h-6 w-6" />}
                  title="Celular y tablet"
                  subtitle={`Android táctil · veotv-celular.apk · v${celularVersion}`}
                  badge="Móvil"
                  accent="mobile"
                />
                <DownloadCard
                  available={tvOk}
                  href="/downloads/veotv-tv.apk"
                  icon={<Tv className="h-6 w-6" />}
                  title="Android TV / Google TV"
                  subtitle={`Control remoto · veotv-tv.apk · v${tvVersion}`}
                  badge="TV"
                  accent="tv"
                />
              </section>

              <section className="mx-auto mt-12 max-w-4xl sm:mt-16">
                <div className="rounded-3xl border border-white/10 bg-black/55 p-6 backdrop-blur-xl sm:p-8">
                  <h2 className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight sm:text-2xl">
                    Cómo instalar en 4 pasos
                  </h2>
                  <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                    {[
                      "Descarga el APK correcto (móvil o TV).",
                      "Permite instalar apps desconocidas en el navegador o gestor de archivos.",
                      "Abre el archivo e instala VeoTV.",
                      "Inicia sesión con tu cuenta. Necesitas plan o demo para el catálogo.",
                    ].map((step, idx) => (
                      <li
                        key={step}
                        className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(110deg,var(--tv-from),var(--tv-to))] text-sm font-extrabold text-[#07111d]">
                          {idx + 1}
                        </span>
                        <p className="pt-1 text-sm leading-relaxed text-white/70">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section className="mx-auto mt-6 max-w-4xl sm:mt-8">
                <details className="group rounded-2xl border border-white/10 bg-black/45 open:bg-black/60">
                  <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-white/80 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      Tip ADB (avanzado)
                      <span className="text-xs font-normal text-white/40 group-open:hidden">
                        Mostrar
                      </span>
                      <span className="hidden text-xs font-normal text-white/40 group-open:inline">
                        Ocultar
                      </span>
                    </span>
                  </summary>
                  <pre className="overflow-x-auto border-t border-white/10 px-5 py-4 text-xs leading-relaxed text-teal-100/80">{`adb install -r veotv-celular.apk
adb install -r veotv-tv.apk`}</pre>
                </details>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
