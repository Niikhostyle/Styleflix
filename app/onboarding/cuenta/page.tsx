import { Suspense } from "react";
import OnboardingCuentaClient from "@/components/OnboardingCuentaClient";

export const dynamic = "force-dynamic";

export default function OnboardingCuentaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OnboardingCuentaClient />
    </Suspense>
  );
}
