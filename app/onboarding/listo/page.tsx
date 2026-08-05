import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import OnboardingListoClient from "@/components/OnboardingListoClient";

export const dynamic = "force-dynamic";

export default async function OnboardingListoPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/onboarding/listo");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OnboardingListoClient />
    </Suspense>
  );
}
