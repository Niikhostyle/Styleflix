"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { APP_NAME_UPPER } from "@/lib/brand-ui";

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Enlace incompleto.");
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "No se pudo verificar.");
          return;
        }
        setStatus("ok");
        setMessage(data.message || "Correo confirmado.");
      } catch {
        setStatus("error");
        setMessage("Error de red.");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0c0c0c] text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
        <p className="mb-2 text-2xl font-black text-[#E50914]">
          {APP_NAME_UPPER}
        </p>
        <h1 className="text-3xl font-black">Verificar correo</h1>
        <div
          className={`mt-8 rounded-2xl border p-6 ${
            status === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : status === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-white/10 bg-white/5 text-neutral-300"
          }`}
        >
          <p>
            {status === "loading"
              ? "Confirmando tu correo…"
              : message}
          </p>
          {status !== "loading" && (
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-[#E50914] px-4 py-2.5 text-sm font-bold text-white"
            >
              Ir a iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0c0c0c] text-neutral-400">
          Cargando…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
