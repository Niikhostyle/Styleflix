import { Suspense } from "react";
import { auth } from "@/auth";
import HomeClient from "@/components/HomeClient";
import LandingHero from "@/components/LandingHero";
import { getHomeCatalog, getPopularCatalogPosters } from "@/lib/catalog";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function HomeShell() {
  const session = await auth();

  if (!session?.user) {
    const posterUrls = await getPopularCatalogPosters(16).catch(() => [] as string[]);
    return <LandingHero posterUrls={posterUrls} />;
  }

  if (!session.user.membershipActive) {
    redirect("/onboarding/planes");
  }

  const { featured, rows, activeSources } = await getHomeCatalog();

  if (!featured.length) {
    return (
      <div className="app-page flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">No hay títulos disponibles</p>
        <p className="max-w-md text-sm text-neutral-400">
          Ninguna fuente respondió. Revisa las API keys en Coolify.
        </p>
      </div>
    );
  }

  return (
    <HomeClient
      featured={featured[0]}
      rows={rows}
      activeSources={activeSources}
    />
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="app-page flex min-h-screen items-center justify-center text-slate-400">
          Cargando VeoTV…
        </div>
      }
    >
      <HomeShell />
    </Suspense>
  );
}
