import { Suspense } from "react";
import OnboardingBienvenidaClient from "@/components/OnboardingBienvenidaClient";

export default function OnboardingBienvenidaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-white/50">Cargando…</div>}>
      <OnboardingBienvenidaClient />
    </Suspense>
  );
}
