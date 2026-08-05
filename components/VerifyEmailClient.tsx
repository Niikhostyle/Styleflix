"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import BrandMark from "@/components/BrandMark";

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
    <div className="app-page">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <BrandMark className="mb-8" />
        <p className="eyebrow mb-2">Seguridad de cuenta</p>
        <h1 className="text-4xl font-black tracking-[-0.045em]">
          Verificar correo
        </h1>
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
              className="brand-button mt-4 inline-block rounded-xl px-4 py-2.5 text-sm font-bold"
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
        <div className="app-page flex min-h-screen items-center justify-center text-slate-400">
          Cargando…
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
