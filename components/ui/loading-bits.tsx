"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Spinner inline para botones (21st.dev-ish). */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin", className)}
      aria-hidden
    />
  );
}

/** Chip de estado “en progreso” bajo formularios. */
export function LoadingChip({
  children = "Preparando tu sesión…",
}: {
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/65 backdrop-blur-sm">
      <ButtonSpinner className="text-teal-300" />
      <span>{children}</span>
    </div>
  );
}
