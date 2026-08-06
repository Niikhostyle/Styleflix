import { redirect } from "next/navigation";
import { auth } from "@/auth";
import OnboardingShell from "@/components/OnboardingShell";
import PlanPicker from "@/components/PlanPicker";

export const dynamic = "force-dynamic";

export default async function OnboardingPlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/onboarding/planes");
  }
  if (session.user.membershipActive) {
    redirect("/");
  }

  const sp = await searchParams;
  const failed = sp.status === "failure";

  return (
    <OnboardingShell
      step={2}
      title="Elige tu plan"
      subtitle="Sin compromisos. Cancela cuando quieras. Cambia de plan en cualquier momento."
      backHref="/login"
      signOutOnBack
      wide
    >
      {failed && (
        <p className="mb-6 text-center text-sm text-red-300">
          El pago no se completó. Puedes elegir otro plan e intentarlo de nuevo.
        </p>
      )}
      <PlanPicker />
    </OnboardingShell>
  );
}
