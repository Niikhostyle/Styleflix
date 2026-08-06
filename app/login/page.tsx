import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { getHomeCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Iniciar sesión",
};

async function LoginWithPosters() {
  let posters: string[] = [];
  try {
    const { featured, rows } = await getHomeCatalog();
    posters = [
      ...featured.map((f) => f.poster_path).filter(Boolean),
      ...rows.flatMap((r) => r.items.map((i) => i.poster_path).filter(Boolean)),
    ]
      .filter((p): p is string => Boolean(p))
      .slice(0, 18);
  } catch {
    posters = [];
  }
  return <LoginForm posterPaths={posters} />;
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
