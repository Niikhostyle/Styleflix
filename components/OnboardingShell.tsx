import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function OnboardingShell({
  step,
  total = 4,
  title,
  subtitle,
  children,
  backHref,
  wide = false,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  /** Layout ancho para pasos como planes */
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[url('https://image.tmdb.org/t/p/w1280/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg')] bg-cover bg-center opacity-25 blur-sm" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/85 to-[#050508]" />

      <header className="relative z-10 px-5 py-5 md:px-10">
        <BrandMark className="text-2xl" />
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full flex-col px-4 pb-16 pt-4 ${
          wide ? "max-w-6xl" : "max-w-lg md:max-w-5xl"
        }`}
      >
        <div
          className={`mx-auto w-full rounded-3xl border border-white/10 bg-[#0b0b12]/92 shadow-2xl backdrop-blur-md ${
            wide
              ? "max-w-6xl px-5 py-8 md:px-10 md:py-10"
              : "max-w-lg p-6 md:p-8"
          }`}
        >
          <div className={`mb-6 flex flex-col text-center ${wide ? "mb-8" : "mb-5"} items-center`}>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-teal-300/50 text-teal-300">
              ✓
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">
              Paso {step} de {total}
            </p>
            <h1
              className={`mt-2 font-[family-name:var(--font-display)] font-bold ${
                wide
                  ? "text-3xl md:text-5xl tracking-tight"
                  : "text-2xl md:text-3xl"
              }`}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className={`mt-3 text-white/55 ${
                  wide ? "max-w-2xl text-base md:text-lg" : "text-sm"
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>
          {children}
          {backHref && (
            <div className="mt-8 text-center">
              <Link href={backHref} className="text-sm text-white/45 hover:text-white">
                Volver
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
