import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";
import { getHomeCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

async function HomeShell() {
  const { featured, rows, activeSources } = await getHomeCatalog();

  if (!featured.length) {
    return (
      <div className="app-page flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg font-semibold">No hay títulos disponibles</p>
        <p className="max-w-md text-sm text-neutral-400">
          Ninguna fuente respondió. Revisa{" "}
          <code className="text-neutral-200">NEXT_PUBLIC_TMDB_API_KEY</code> y{" "}
          <code className="text-neutral-200">VIMEUS_API_KEY</code> en Coolify
          (runtime) y vuelve a desplegar.
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
