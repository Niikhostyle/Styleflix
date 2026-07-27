import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Iniciar sesión",
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#141414] text-white">
          Cargando...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
