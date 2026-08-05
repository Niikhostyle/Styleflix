import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function OnboardingShell({
  step,
  total = 4,
  title,
  subtitle,
  children,
  backHref,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[url('https://image.tmdb.org/t/p/w1280/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg')] bg-cover bg-center opacity-25 blur-sm" />
      <div className="absolute inset-0 bg-black/80" />

      <header className="relative z-10 px-5 py-5 md:px-10">
        <BrandMark className="text-2xl" />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-col px-4 pb-16 pt-4 md:max-w-5xl">
        <div className="mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b12]/92 p-6 shadow-2xl backdrop-blur-md md:p-8">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/50 text-fuchsia-300">
              ✓
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/45">
              Paso {step} de {total}
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-bold md:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-white/55">{subtitle}</p>
            )}
          </div>
          {children}
          {backHref && (
            <div className="mt-6 text-center">
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
