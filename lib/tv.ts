/** Detección y helpers para Android TV / mando remoto. */

export function isTvEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/StyleFlixTV/i.test(ua)) return true;
  if (/Android.*TV|SMART-TV|AppleTV|GoogleTV|AFT[A-Z]|BRAVIA|MIBOX|MiBOX/i.test(ua)) {
    return true;
  }
  // Capacitor en TV leanback a menudo no dice "TV"; coarse + sin hover
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    const wide = window.innerWidth >= 960;
    if (coarse && noHover && wide) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export const TV_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [data-tv-focus]';

export function getFocusables(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TV_FOCUSABLE)).filter(
    (el) => {
      if (el.closest("[data-tv-ignore]")) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
  );
}

type Dir = "up" | "down" | "left" | "right";

function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

/** Elige el candidato más cercano en la dirección del D-pad. */
export function findSpatialTarget(
  current: HTMLElement,
  dir: Dir,
  candidates: HTMLElement[]
): HTMLElement | null {
  const from = center(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    if (el === current) continue;
    const to = center(el);
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    let primary = 0;
    let secondary = 0;
    let ok = false;

    if (dir === "left") {
      ok = dx < -8;
      primary = -dx;
      secondary = Math.abs(dy);
    } else if (dir === "right") {
      ok = dx > 8;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (dir === "up") {
      ok = dy < -8;
      primary = -dy;
      secondary = Math.abs(dx);
    } else {
      ok = dy > 8;
      primary = dy;
      secondary = Math.abs(dx);
    }

    if (!ok) continue;
    // Penaliza desviación lateral para preferir alineados
    const score = primary + secondary * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export function focusElement(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: "smooth",
  });
}

export function arrowKeyToDir(key: string): Dir | null {
  switch (key) {
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "ArrowLeft":
      return "left";
    case "ArrowRight":
      return "right";
    default:
      return null;
  }
}

/** Códigos típicos de Back en Android / TV browsers. */
export function isBackKey(e: KeyboardEvent): boolean {
  if (e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack") {
    return true;
  }
  // Android KEYCODE_BACK = 4; algunos WebViews envían keyCode
  const code = (e as KeyboardEvent & { keyCode?: number }).keyCode;
  return code === 4 || code === 461;
}
