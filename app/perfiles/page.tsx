import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PerfilesClient from "./PerfilesClient";

export const dynamic = "force-dynamic";

export default async function PerfilesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/perfiles");
  }
  if (!session.user.catalogAccess && !session.user.membershipActive) {
    redirect(
      session.user.demoExpiresAt
        ? "/onboarding/planes?demo=expired"
        : "/onboarding/bienvenida"
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070b14] text-white/50">
          Cargando…
        </div>
      }
    >
      <PerfilesClient />
    </Suspense>
  );
}
