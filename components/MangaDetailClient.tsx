"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { mediaImageUrl } from "@/lib/media-links";

type Chapter = {
  id: string;
  chapter: string;
  title: string | null;
  pages: number | null;
};

type MangaPayload = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  poster: string | null;
  status: string | null;
  year: number | null;
  genres: string[];
  chapters: Chapter[];
};

type WidthMode = "narrow" | "medium" | "wide";

export default function MangaDetailClient({ manga }: { manga: MangaPayload }) {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const canRead = Boolean(
    session?.user?.catalogAccess ||
      session?.user?.membershipActive ||
      session?.user?.role === "SUPER_ADMIN"
  );

  const chapters = useMemo(
    () =>
      [...manga.chapters].sort((a, b) => {
        const na = Number(a.chapter);
        const nb = Number(b.chapter);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a.chapter).localeCompare(String(b.chapter), undefined, {
          numeric: true,
        });
      }),
    [manga.chapters]
  );

  const [chapterId, setChapterId] = useState(chapters[0]?.id || "");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [widthMode, setWidthMode] = useState<WidthMode>("medium");
  const [scrollPct, setScrollPct] = useState(0);
  const readerRef = useRef<HTMLDivElement>(null);
  const lastSaveRef = useRef(0);

  const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const current = chapters[chapterIndex];

  const saveProgress = useCallback(
    (pageIndex: number, progressPct: number) => {
      if (!canRead || !current) return;
      const now = Date.now();
      if (now - lastSaveRef.current < 8_000 && progressPct < 95) return;
      lastSaveRef.current = now;
      void fetch("/api/manga/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          mangaSlug: manga.slug,
          title: manga.title,
          poster: manga.poster,
          chapterId: current.id,
          chapterNum: current.chapter,
          pageIndex,
          progressPct,
        }),
        keepalive: true,
      }).catch(() => undefined);
    },
    [canRead, current, manga]
  );

  const loadPages = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/manga/pages?chapterId=${encodeURIComponent(id)}&seriesId=${encodeURIComponent(manga.id)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "No se pudo cargar el capítulo.");
          setImages([]);
          return;
        }
        setImages(data.images || []);
        setScrollPct(0);
      } catch {
        setError("Error de red.");
        setImages([]);
      } finally {
        setLoading(false);
      }
    },
    [manga.id]
  );

  useEffect(() => {
    if (!reading || !chapterId || !canRead) return;
    void loadPages(chapterId);
  }, [reading, chapterId, canRead, loadPages]);

  useEffect(() => {
    if (!reading || !current) return;
    saveProgress(0, 5);
  }, [reading, current, saveProgress]);

  // Continuar desde historial / ?play=1
  useEffect(() => {
    if (!canRead || !chapters.length) return;
    const auto = searchParams.get("play") === "1";
    if (!auto) return;

    void fetch("/api/manga/progress")
      .then((r) => r.json())
      .then((data) => {
        const hit = (data.items || []).find(
          (i: { mangaId: string }) => i.mangaId === manga.id
        );
        if (hit?.chapterId && chapters.some((c) => c.id === hit.chapterId)) {
          setChapterId(hit.chapterId);
        }
        setReading(true);
      })
      .catch(() => {
        setReading(true);
      });
  }, [canRead, chapters, manga.id, searchParams]);

  useEffect(() => {
    if (!reading) return;
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
      setScrollPct(pct);
      const pageIndex = Math.floor((pct / 100) * Math.max(0, images.length - 1));
      saveProgress(pageIndex, Math.min(100, Math.max(5, pct)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reading, images.length, saveProgress]);

  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goChapter(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goChapter(1);
      } else if (e.key === "Escape") {
        setReading(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, chapterIndex, chapters]);

  function openChapter(id: string) {
    setChapterId(id);
    setReading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goChapter(delta: number) {
    const next = chapters[chapterIndex + delta];
    if (!next) return;
    openChapter(next.id);
  }

  const poster = mediaImageUrl(manga.poster);
  const widthClass =
    widthMode === "narrow"
      ? "max-w-xl"
      : widthMode === "wide"
        ? "max-w-5xl"
        : "max-w-3xl";

  if (reading) {
    return (
      <div ref={readerRef} className="min-h-screen bg-[#05070c] pb-20">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-[#05070c]/92 backdrop-blur-md">
          <div className={`mx-auto flex ${widthClass} items-center gap-2 px-3 py-2`}>
            <button
              type="button"
              onClick={() => setReading(false)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Salir del lector"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {manga.title}
              </p>
              <p className="truncate text-xs text-white/45">
                Cap. {current?.chapter || "—"}
                {current?.title ? ` · ${current.title}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setWidthMode((m) =>
                  m === "narrow" ? "medium" : m === "medium" ? "wide" : "narrow"
                )
              }
              className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white"
              title="Ancho de página"
            >
              {widthMode === "wide" ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              disabled={chapterIndex <= 0}
              onClick={() => goChapter(-1)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={chapterIndex >= chapters.length - 1}
              onClick={() => goChapter(1)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="h-0.5 w-full bg-white/10">
            <div
              className="h-full bg-orange-400 transition-[width] duration-150"
              style={{ width: `${scrollPct}%` }}
            />
          </div>
        </div>

        <div className={`mx-auto ${widthClass} px-0 py-0 md:px-2`}>
          {loading && (
            <p className="py-24 text-center text-white/45">
              Cargando páginas…
            </p>
          )}
          {error && (
            <p className="px-4 py-12 text-center text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="space-y-0">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${chapterId}-${i}`}
                src={src}
                alt={`Página ${i + 1}`}
                className="mx-auto block w-full bg-black"
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
              />
            ))}
          </div>
          {!loading && images.length > 0 && (
            <div className="flex justify-center gap-3 px-4 py-10">
              <button
                type="button"
                disabled={chapterIndex <= 0}
                onClick={() => goChapter(-1)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm disabled:opacity-40"
              >
                Cap. anterior
              </button>
              <button
                type="button"
                disabled={chapterIndex >= chapters.length - 1}
                onClick={() => {
                  saveProgress(images.length, 100);
                  goChapter(1);
                }}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40"
              >
                Cap. siguiente
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-page relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,146,60,0.14),transparent_45%)]" />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-8">
        <Link
          href="/mangas"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 hover:text-orange-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Mangas
        </Link>

        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <div>
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={manga.title}
                className="w-full rounded-2xl border border-white/10 shadow-2xl"
              />
            ) : (
              <div className="aspect-[2/3] rounded-2xl bg-white/5" />
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300/90">
              Manga · Español
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold text-white md:text-4xl">
              {manga.title}
            </h1>
            <p className="mt-2 text-sm text-white/45">
              {[manga.year, manga.status, `${chapters.length} capítulos`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {manga.genres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {manga.genres.slice(0, 8).map((g) => (
                  <span
                    key={g}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              {manga.synopsis || "Sin sinopsis."}
            </p>

            {!canRead ? (
              <p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                Inicia sesión con demo o plan para leer capítulos.{" "}
                <Link href="/onboarding/planes" className="underline">
                  Ver planes
                </Link>
              </p>
            ) : chapters[0] ? (
              <button
                type="button"
                onClick={() => openChapter(chapters[0].id)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-black shadow-lg shadow-orange-500/20"
              >
                <BookOpen className="h-4 w-4" />
                Empezar por el cap. {chapters[0].chapter}
              </button>
            ) : (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
                MangaDex no tiene capítulos en español disponibles para este
                título ahora (a veces el catálogo marca ES sin feed). Probá otro
                manga del listado.
              </p>
            )}
          </div>
        </div>

        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Capítulos en español
          </h2>
          <div className="max-h-[32rem] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
            {chapters.length === 0 && (
              <p className="p-6 text-sm text-white/40">
                Sin capítulos en español en MangaDex para este título.
              </p>
            )}
            <ul>
              {chapters.map((c) => (
                <li
                  key={c.id}
                  className="border-t border-white/[0.06] first:border-0"
                >
                  <button
                    type="button"
                    disabled={!canRead}
                    onClick={() => openChapter(c.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm transition hover:bg-orange-400/5 disabled:opacity-50"
                  >
                    <span className="font-medium text-white/90">
                      Capítulo {c.chapter}
                      {c.title ? (
                        <span className="font-normal text-white/45">
                          {" "}
                          — {c.title}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs font-semibold text-orange-300/90">
                      Leer
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
