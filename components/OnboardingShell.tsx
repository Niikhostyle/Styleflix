import BrandMark from "@/components/BrandMark";
import OnboardingBackLink from "@/components/OnboardingBackLink";

export default function OnboardingShell({
  step,
  total = 4,
  title,
  subtitle,
  children,
  backHref,
  backLabel = "Volver",
  signOutOnBack = false,
  wide = false,
}: {
  step: number;
  total?: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  /** Cierra sesión antes de navegar (evita rebote a /onboarding/planes). */
  signOutOnBack?: boolean;
  /** Layout ancho para pasos como planes */
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent text-white">
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 md:px-10">
        <BrandMark className="text-2xl" />
        {backHref && (
          <OnboardingBackLink
            href={backHref}
            label={backLabel}
            signOutFirst={signOutOnBack}
          />
        )}
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
        </div>
      </main>
    </div>
  );
}
