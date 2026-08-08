import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import LoadingScreen from "@/components/LoadingScreen";
import { getPopularCatalogPosters } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Iniciar sesión",
};

async function LoginWithPosters() {
  const posterUrls = await getPopularCatalogPosters(28).catch(
    () => [] as string[]
  );
  return <LoginForm posterUrls={posterUrls} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <LoadingScreen
          label="Preparando el acceso…"
          lines={["Cargando carteles…", "Un momento…"]}
        />
      }
    >
      <LoginWithPosters />
    </Suspense>
  );
}
