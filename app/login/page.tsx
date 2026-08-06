import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { getPopularCatalogPosters } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Iniciar sesión",
};

async function LoginWithPosters() {
  const posterUrls = await getPopularCatalogPosters(16).catch(() => [] as string[]);
  return <LoginForm posterUrls={posterUrls} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050508] text-white/60">
          Cargando...
        </div>
      }
    >
      <LoginWithPosters />
    </Suspense>
  );
}
