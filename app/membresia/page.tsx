import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MembershipClient from "@/components/MembershipClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { hasActiveMembership } from "@/lib/access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Membresía | VeoTV",
  description: "Activa tu membresía mensual VeoTV con Mercado Pago",
};

export default async function MembresiaPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment_id?: string;
    collection_id?: string;
    collection_status?: string;
    external_reference?: string;
    preference_id?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/membresia");
  }

  const params = await searchParams;
  const paymentId =
    params.payment_id ||
    (params.collection_id && params.collection_id !== "null"
      ? params.collection_id
      : undefined);

  let flash: string | null = null;
  if (params.status === "failure" || params.collection_status === "rejected") {
    flash = "El pago no se completó. Puedes intentar de nuevo cuando quieras.";
  } else if (
    params.status === "pending" ||
    params.collection_status === "pending"
  ) {
    flash =
      "Pago en revisión en Mercado Pago. En unos segundos pulsa «Actualizar estado».";
  } else if (params.status === "ok" || paymentId) {
    flash =
      "Verificando tu pago con Mercado Pago… Si no se activa solo, pulsa «Actualizar estado».";
  }

  const active = hasActiveMembership({
    role: session.user.role,
    subscriptionStatus: session.user.subscriptionStatus,
    currentPeriodEnd: session.user.currentPeriodEnd,
  });

  return (
    <div className="app-page">
      <Navbar />
      <MembershipClient
        status={session.user.subscriptionStatus || "NONE"}
        currentPeriodEnd={session.user.currentPeriodEnd}
        membershipActive={active}
        isAdmin={session.user.role === "SUPER_ADMIN"}
        flash={flash}
        returnPaymentId={paymentId || null}
      />
      <Footer />
    </div>
  );
}
