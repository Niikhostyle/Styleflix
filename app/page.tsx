import { Suspense } from "react";
import { auth } from "@/auth";
import HomeClient from "@/components/HomeClient";
import LandingHero from "@/components/LandingHero";
import { getHomeCatalog } from "@/lib/catalog";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

async function HomeShell() {
  const session = await auth();

  if (!session?.user) {
    let posters: string[] = [];
    try {
      const { featured, rows } = await getHomeCatalog();
      posters = [
        ...featured.map((f) => f.poster_path).filter(Boolean),
        ...rows.flatMap((r) => r.items.map((i) => i.poster_path)).filter(Boolean),
      ]
        .filter((p): p is string => Boolean(p))
        .slice(0, 18);
    } catch {
      posters = [];
    }
    return <LandingHero posterPaths={posters} />;
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
