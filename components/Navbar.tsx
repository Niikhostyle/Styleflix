"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Search, User, LogOut, X, Crown } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import BrandMark from "@/components/BrandMark";

type SearchHit = {
  key: string;
  kind: "anime" | "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  href: string;
  label: string;
};

const links = [
  { href: "/", label: "Inicio" },
  { href: "/series", label: "Series" },
  { href: "/peliculas", label: "Películas" },
  { href: "/animes", label: "Animes" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => {
      (mobileInputRef.current || inputRef.current)?.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      // En móvil el overlay maneja el cierre; en desktop cerrar al click fuera
      if (window.matchMedia("(max-width: 767px)").matches) return;
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
        setResults([]);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const prev = document.body.style.overflow;
    if (window.matchMedia("(max-width: 767px)").matches) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev;
    };
  }, [searchOpen]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => setResults((data.items ?? []) as SearchHit[]))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query]);

  function openSearch() {
    setSearchOpen(true);
    setMenuOpen(false);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setResults([]);
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    closeSearch();
    router.push(`/buscar?q=${encodeURIComponent(q)}`);
  }

  function ResultList({ compact }: { compact?: boolean }) {
    const list = results.slice(0, compact ? 8 : 16);
    return (
      <>
        {searching && (
          <p className="px-4 py-3 text-sm text-neutral-400">Buscando…</p>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="px-4 py-3 text-sm text-neutral-400">
            Sin resultados para “{query.trim()}”
          </p>
        )}
        {!searching &&
          list.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={closeSearch}
              data-tv-focus
              className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition hover:bg-teal-300/[0.06] last:border-0"
            >
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                {item.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.poster}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {item.title}
                </p>
                <p className="text-xs text-neutral-400">
                  {item.label}
                  {item.year ? ` · ${item.year}` : ""}
                </p>
              </div>
            </Link>
          ))}
        {!searching && results.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const q = query.trim();
              closeSearch();
              router.push(`/buscar?q=${encodeURIComponent(q)}`);
            }}
            className="block w-full px-4 py-3 text-left text-sm font-medium text-neutral-200 hover:bg-white/5"
          >
            Ver todos los resultados
          </button>
        )}
      </>
    );
  }

  return (
    <nav className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 transition-all duration-300 md:px-6 md:pt-4">
      <div
        className={`pointer-events-auto mx-auto flex max-w-[1520px] items-center justify-between rounded-2xl border px-3 py-2.5 transition-all duration-300 md:px-4 ${
          isScrolled
            ? "border-white/10 bg-[#0a1120]/88 shadow-[0_16px_50px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
            : "border-white/[0.08] bg-[#07101d]/55 backdrop-blur-xl"
        }`}
      >
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <BrandMark />

          <ul className="hidden items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.035] p-1 text-[0.84rem] md:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    data-tv-focus
                    className={`rounded-lg px-3 py-2 transition-all ${
                      active
                        ? "bg-white/[0.09] font-semibold text-white shadow-sm"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-white md:gap-3">
          {/* Desktop search */}
          <div
            ref={searchWrapRef}
            className="relative hidden items-center md:flex"
          >
            {searchOpen ? (
              <form
                onSubmit={onSearchSubmit}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b1424]/95 px-3 py-2 shadow-2xl backdrop-blur-xl"
              >
                <Search className="h-4 w-4 shrink-0 text-neutral-300" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Series, películas, animes…"
                  className="w-[240px] bg-transparent text-sm text-white outline-none placeholder:text-slate-500 lg:w-[300px]"
                  aria-label="Buscar títulos"
                />
                <button
                  type="button"
                  aria-label="Cerrar búsqueda"
                  data-tv-dismiss
                  onClick={closeSearch}
                  className="text-neutral-400 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                aria-label="Buscar"
                data-tv-focus
                onClick={openSearch}
                className="focus-ring rounded-xl border border-white/[0.07] bg-white/[0.045] p-2.5 text-slate-200 transition hover:border-teal-300/25 hover:bg-teal-300/10 hover:text-teal-200"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            {searchOpen && query.trim().length >= 2 && (
              <div className="glass-panel absolute right-0 top-full z-50 mt-3 max-h-[70vh] w-[380px] overflow-y-auto rounded-2xl">
                <ResultList compact />
              </div>
            )}
          </div>

          {/* Mobile: solo icono; overlay abajo */}
          <button
            type="button"
            aria-label="Buscar"
            data-tv-focus
            onClick={openSearch}
            className="focus-ring rounded-xl border border-white/[0.07] bg-white/[0.045] p-2.5 text-slate-200 transition hover:border-teal-300/25 hover:bg-teal-300/10 hover:text-teal-200 md:hidden"
          >
            <Search className="h-5 w-5" />
          </button>

          {status === "authenticated" ? (
            <div className="relative">
              <button
                type="button"
                data-tv-focus
                onClick={() => setMenuOpen((v) => !v)}
                className="focus-ring flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.055] px-2.5 py-2 text-slate-100 transition hover:border-teal-300/25 hover:bg-teal-300/10"
              >
                <User className="h-4 w-4" />
                <span className="hidden max-w-[100px] truncate text-xs font-medium sm:inline">
                  {session.user.name || "Cuenta"}
                </span>
              </button>

              {menuOpen && (
                <div className="glass-panel absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl p-1.5">
                  <div className="border-b border-white/10 px-3 py-2 text-xs text-neutral-400">
                    {session.user.role === "SUPER_ADMIN"
                      ? "Super Admin"
                      : session.user.email}
                    {session.user.role !== "SUPER_ADMIN" && (
                      <p className="mt-1 text-[11px] text-neutral-500">
                        {session.user.membershipActive
                          ? `Activa${
                              session.user.currentPeriodEnd
                                ? ` · Vence el ${new Date(
                                    session.user.currentPeriodEnd
                                  ).toLocaleDateString("es-CL")}`
                                : ""
                            }`
                          : "Sin membresía activa"}
                      </p>
                    )}
                  </div>
                  {session.user.role === "USER" && (
                    <Link
                      href="/membresia"
                      data-tv-focus
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[0.06]"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Crown className="h-4 w-4 text-teal-300" />
                      Membresía
                    </Link>
                  )}
                  <Link
                    href="/cuenta"
                    data-tv-focus
                    className="block rounded-xl px-3 py-2.5 text-sm hover:bg-white/[0.06]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Mi cuenta
                  </Link>
                  {session.user.role === "SUPER_ADMIN" && (
                    <Link
                      href="/admin"
                      data-tv-focus
                      className="block rounded-xl px-3 py-2.5 text-sm hover:bg-white/[0.06]"
                      onClick={() => setMenuOpen(false)}
                    >
                      Panel admin
                    </Link>
                  )}
                  <button
                    type="button"
                    data-tv-focus
                    data-tv-dismiss
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-300 hover:bg-white/[0.06]"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              data-tv-focus
              className="brand-button focus-ring rounded-xl px-4 py-2.5 text-sm font-bold transition"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>

      <div className="pointer-events-auto mx-auto mt-2 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0a1120]/88 p-1 shadow-xl backdrop-blur-xl scrollbar-hide md:hidden">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              data-tv-focus
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                active
                  ? "bg-teal-300 text-[#07111d]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>

      {/* Overlay búsqueda móvil */}
      {searchOpen && (
        <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-[#06080f]/97 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <form
              onSubmit={onSearchSubmit}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-3"
            >
              <Search className="h-5 w-5 shrink-0 text-cyan-200/80" />
              <input
                ref={mobileInputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar anime, serie o película…"
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-slate-500"
                aria-label="Buscar títulos"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
              />
            </form>
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              data-tv-dismiss
              onClick={closeSearch}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm font-medium text-white/80"
            >
              Cerrar
            </button>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
            {query.trim().length < 2 ? (
              <p className="px-4 py-6 text-sm text-white/45">
                Escribe al menos 2 caracteres. Los animes salen del catálogo de
                Animes.
              </p>
            ) : (
              <ResultList />
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
