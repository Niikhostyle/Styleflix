import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="app-page flex min-h-screen items-center justify-center">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
