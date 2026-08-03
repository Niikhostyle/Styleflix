"use client";

import { useEffect, useRef } from "react";
import {
  arrowKeyToDir,
  findSpatialTarget,
  focusElement,
  getFocusables,
  isBackKey,
  isTvEnvironment,
} from "@/lib/tv";

/**
 * Activa modo TV: clase en <html>, navegación espacial D-pad y Back.
 * Se monta una sola vez desde Providers.
 */
export default function TvRemoteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const tvRef = useRef(false);

  useEffect(() => {
    const tv = isTvEnvironment();
    tvRef.current = tv;
    document.documentElement.classList.toggle("tv-mode", tv);
    if (tv) {
      document.documentElement.classList.add("tv-ready");
    }

    // Primer foco útil al cargar (hero / login)
    if (tv) {
      const boot = window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && active.tagName !== "HTML") {
          return;
        }
        const preferred =
          document.querySelector<HTMLElement>("[data-tv-autofocus]") ||
          getFocusables()[0];
        focusElement(preferred);
      }, 400);
      return () => {
        window.clearTimeout(boot);
        document.documentElement.classList.remove("tv-mode", "tv-ready");
      };
    }

    return () => {
      document.documentElement.classList.remove("tv-mode", "tv-ready");
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!tvRef.current && !document.documentElement.classList.contains("tv-mode")) {
        // Re-detectar por si el UA llega tarde
        if (isTvEnvironment()) {
          tvRef.current = true;
          document.documentElement.classList.add("tv-mode", "tv-ready");
        } else {
          return;
        }
      }

      // Inputs: flechas izquierda/derecha para cursor; Up/Down espaciales fuera
      const tag = (e.target as HTMLElement)?.tagName;
      const isField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (isBackKey(e)) {
        const playerOpen = document.querySelector('[data-tv-player="open"]');
        if (playerOpen) {
          // ModalPlayer escucha popstate / custom; no interferir si ya maneja Escape
          return;
        }
        // Menús abiertos: Escape cierra sin salir de la app
        const dismiss = document.querySelector<HTMLElement>("[data-tv-dismiss]");
        if (dismiss) {
          e.preventDefault();
          dismiss.click();
          return;
        }
        return;
      }

      const dir = arrowKeyToDir(e.key);
      if (!dir) return;
      if (isField && (dir === "left" || dir === "right")) return;

      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body) {
        e.preventDefault();
        focusElement(
          document.querySelector<HTMLElement>("[data-tv-autofocus]") ||
            getFocusables()[0]
        );
        return;
      }

      // Si el foco está en un campo, Up/Down salen al siguiente control
      const candidates = getFocusables();
      const next = findSpatialTarget(active, dir, candidates);
      if (next) {
        e.preventDefault();
        focusElement(next);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return <>{children}</>;
}
