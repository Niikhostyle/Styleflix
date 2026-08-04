import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MembershipClient from "@/components/MembershipClient";
import { hasActiveMembership } from "@/lib/access";

export const metadata = {
  title: "Membresía | Naseros",
  description: "Activa tu membresía mensual Naseros con Mercado Pago",
};

export default async function MembresiaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/membresia");
  }

  const params = await searchParams;
  const flash =
    params.status === "ok"
      ? "Si ya autorizaste el pago, espera unos segundos y pulsa «Actualizar estado»."
      : null;

  const active = hasActiveMembership({
    role: session.user.role,
    subscriptionStatus: session.user.subscriptionStatus,
    currentPeriodEnd: session.user.currentPeriodEnd,
  });

  return (
    <div className="min-h-screen bg-[#141414]">
      <MembershipClient
        status={session.user.subscriptionStatus || "NONE"}
        currentPeriodEnd={session.user.currentPeriodEnd}
        membershipActive={active}
        isAdmin={session.user.role === "SUPER_ADMIN"}
        flash={flash}
      />
    </div>
  );
}
