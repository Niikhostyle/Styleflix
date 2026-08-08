"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import BrandMark from "@/components/BrandMark";

const DEFAULT_LINES = [
  "Afinando la señal…",
  "Preparando tu catálogo…",
  "Casi listo para el show…",
  "Cargando estrenos…",
  "Un instante mágico…",
];

/**
 * Pantalla de carga moderna (estilo 21st.dev): marca + anillo + frases rotativas.
 */
export default function LoadingScreen({
  label,
  lines = DEFAULT_LINES,
  className,
  compact = false,
}: {
  label?: string;
  lines?: string[];
  className?: string;
  compact?: boolean;
}) {
  const phrases = label ? [label, ...lines.slice(0, 2)] : lines;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (phrases.length < 2) return;
    const t = window.setInterval(() => {
      setI((n) => (n + 1) % phrases.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [phrases.length]);

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#050508] px-6 text-center",
        compact && "min-h-0 py-16",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(94,234,212,0.12),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl"
      />

      {!compact && <BrandMark className="relative z-10 mb-10 text-3xl" />}

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative h-14 w-14">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-teal-300/25"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-teal-300 border-r-violet-300"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-[6px] rounded-full bg-[linear-gradient(135deg,rgba(94,234,212,0.2),rgba(194,153,255,0.2))]" />
        </div>

        <div className="relative h-7 w-[min(90vw,20rem)] overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={phrases[i]}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="font-[family-name:var(--font-display)] text-sm font-medium tracking-wide text-white/75 sm:text-base"
            >
              {phrases[i]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <motion.span
              key={d}
              className="h-1.5 w-1.5 rounded-full bg-teal-300/80"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: d * 0.18,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
