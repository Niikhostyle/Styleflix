"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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

export default function MangaDetailClient({ manga }: { manga: MangaPayload }) {
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

  const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const current = chapters[chapterIndex];

  const loadPages = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/manga/pages?chapterId=${encodeURIComponent(id)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo cargar el capítulo.");
        setImages([]);
        return;
      }
      setImages(data.images || []);
    } catch {
      setError("Error de red.");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!reading || !chapterId || !canRead) return;
    void loadPages(chapterId);
  }, [reading, chapterId, canRead, loadPages]);

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

  if (reading) {
    return (
      <div className="min-h-screen bg-[#070b14] pb-16">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-[#070b14]/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setReading(false)}
              className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
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
        </div>

        <div className="mx-auto max-w-3xl px-2 py-4">
          {loading && (
            <p className="py-20 text-center text-white/45">Cargando páginas…</p>
          )}
          {error && (
            <p className="py-10 text-center text-sm text-red-300">{error}</p>
          )}
          <div className="space-y-1">
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${chapterId}-${i}`}
                src={src}
                alt={`Página ${i + 1}`}
                className="mx-auto w-full max-w-full bg-black"
                loading={i < 3 ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
              />
            ))}
          </div>
          {!loading && images.length > 0 && (
            <div className="mt-8 flex justify-center gap-3">
              <button
                type="button"
                disabled={chapterIndex <= 0}
                onClick={() => goChapter(-1)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
              >
                Cap. anterior
              </button>
              <button
                type="button"
                disabled={chapterIndex >= chapters.length - 1}
                onClick={() => goChapter(1)}
                className="brand-button rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
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
    <div className="app-page mx-auto max-w-5xl px-4 pb-16 pt-8 md:px-8">
      <Link
        href="/mangas"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 hover:text-cyan-200"
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
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
            <p className="mt-2 text-xs text-white/40">
              {manga.genres.slice(0, 8).join(" · ")}
            </p>
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
              className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            >
              <BookOpen className="h-4 w-4" />
              Leer desde el cap. {chapters[0].chapter}
            </button>
          ) : (
            <p className="mt-6 text-sm text-white/45">
              Aún no hay capítulos en español indexados.
            </p>
          )}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Capítulos en español
        </h2>
        <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-white/10">
          {chapters.length === 0 && (
            <p className="p-6 text-sm text-white/40">Sin capítulos.</p>
          )}
          <ul>
            {chapters.map((c) => (
              <li key={c.id} className="border-t border-white/8 first:border-0">
                <button
                  type="button"
                  disabled={!canRead}
                  onClick={() => openChapter(c.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-white/[0.04] disabled:opacity-50"
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
                  <span className="text-xs text-cyan-300/80">Leer</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
