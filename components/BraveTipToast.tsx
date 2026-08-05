"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "veotv_brave_tip_dismissed_at";
/** No volver a mostrar hasta pasadas 12 h. */
const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const SHOW_AFTER_MS = 1800;
const HIDE_AFTER_MS = 9000;

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (document.documentElement.classList.contains("tv-mode")) return false;
    // No sugerir Brave si ya lo usan
    if (/Brave/i.test(navigator.userAgent)) return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return Date.now() - at > COOLDOWN_MS;
  } catch {
    return true;
  }
}

/**
 * Toast que aparece y desaparece: recomienda Brave para mejor experiencia.
 */
export default function BraveTipToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldShow()) return;

    const showT = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    const hideT = window.setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }, SHOW_AFTER_MS + HIDE_AFTER_MS);

    return () => {
      window.clearTimeout(showT);
      window.clearTimeout(hideT);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  if (!visible) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-4 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2 animate-[fadeInUp_0.35s_ease-out] rounded-lg border border-white/15 bg-[#1a1a1a]/95 px-4 py-3 text-sm text-neutral-100 shadow-xl backdrop-blur-md md:bottom-6"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-snug">
          Se recomienda utilizar el navegador{" "}
          <a
            href="https://brave.com/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal-300 underline hover:text-teal-200"
          >
            Brave
          </a>{" "}
          para una mejor experiencia en VeoTV.
        </p>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
