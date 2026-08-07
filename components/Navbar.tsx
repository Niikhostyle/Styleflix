"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Clapperboard,
  Crown,
  Film,
  Home,
  LogOut,
  MessageSquare,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import BrandMark from "@/components/BrandMark";

type SearchHit = {
  key: string;
  kind: "anime" | "manga" | "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  href: string;
  label: string;
};

const links = [
  { href: "/", label: "Inicio", short: "Inicio", Icon: Home },
  { href: "/series", label: "Series", short: "Series", Icon: Clapperboard },
  { href: "/peliculas", label: "Películas", short: "Cine", Icon: Film },
  { href: "/animes", label: "Animes", short: "Anime", Icon: Sparkles },
  { href: "/mangas", label: "Mangas", short: "Manga", Icon: BookOpen },
  { href: "/feedback", label: "Feedback", short: "Feedback", Icon: MessageSquare },
] as const;

function linkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

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
  const menuRef = useRef<HTMLDivElement>(null);

  const hideMobileTabs =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/cuenta") ||
    pathname.startsWith("/membresia") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/perfiles") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro");

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
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
    if (!searchOpen && !menuOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (window.matchMedia("(max-width: 767px)").matches && searchOpen) return;
      if (
        searchOpen &&
        searchWrapRef.current &&
        !searchWrapRef.current.contains(target)
      ) {
        setSearchOpen(false);
        setResults([]);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSearch();
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen, menuOpen]);

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
              className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 transition active:bg-teal-300/10 hover:bg-teal-300/[0.06] last:border-0"
            >
              <div className="h-[4.25rem] w-12 shrink-0 overflow-hidden rounded-lg bg-slate-800 sm:h-16 sm:w-11">
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
                <p className="truncate text-[0.95rem] font-medium text-white sm:text-sm">
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
            className="block w-full px-4 py-3.5 text-left text-sm font-semibold text-teal-200/90 hover:bg-white/5"
          >
            Ver todos los resultados
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <header
        className={`veotv-topbar pointer-events-none fixed inset-x-0 z-50 transition-[colors,top] duration-300 ${
          !hideMobileTabs ? "veotv-has-mobile-tabs" : ""
        }`}
        style={{ top: "var(--veotv-demo-offset, 0px)" }}
      >
        <div
          className={`pointer-events-auto border-b transition-all duration-300 ${
            isScrolled
              ? "border-white/[0.08] bg-[#06080f]/92 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
              : "border-transparent bg-gradient-to-b from-[#06080f]/90 via-[#06080f]/55 to-transparent backdrop-blur-md"
          }`}
        >
          <div className="veotv-topbar-inner mx-auto flex h-14 max-w-[1520px] items-center justify-between gap-3 px-3 pt-[env(safe-area-inset-top)] sm:h-16 sm:px-5 md:px-8 lg:px-10">
            <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-10">
              <BrandMark className="shrink-0" />

              <nav
                aria-label="Secciones"
                className="hidden items-center gap-0.5 md:flex"
              >
                {links.map((link) => {
                  const active = linkActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-tv-focus
                      className={`relative rounded-lg px-3 py-2 text-[0.9rem] transition-colors ${
                        active
                          ? "font-semibold text-white"
                          : "font-medium text-slate-400 hover:text-white"
                      }`}
                    >
                      {link.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-[linear-gradient(90deg,var(--tv-from),var(--tv-to))]"
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {/* Desktop search */}
              <div
                ref={searchWrapRef}
                className="relative hidden items-center md:flex"
              >
                {searchOpen ? (
                  <form
                    onSubmit={onSearchSubmit}
                    className="flex items-center gap-2 rounded-xl border border-white/12 bg-[#0b1424]/95 px-3 py-2 shadow-2xl backdrop-blur-xl"
                  >
                    <Search className="h-4 w-4 shrink-0 text-teal-200/80" />
                    <input
                      ref={inputRef}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Series, películas, animes…"
                      className="w-[220px] bg-transparent text-sm text-white outline-none placeholder:text-slate-500 lg:w-[280px]"
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
                    className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/[0.07] hover:text-teal-200"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                )}

                {searchOpen && query.trim().length >= 2 && (
                  <div className="glass-panel absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[380px] overflow-y-auto rounded-2xl">
                    <ResultList compact />
                  </div>
                )}
              </div>

              {/* Mobile search */}
              <button
                type="button"
                aria-label="Buscar"
                data-tv-focus
                onClick={openSearch}
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-xl text-slate-100 transition active:bg-white/10 hover:bg-white/[0.07] md:hidden"
              >
                <Search className="h-5 w-5" />
              </button>

              {status === "authenticated" ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    data-tv-focus
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="focus-ring flex h-11 max-w-[9.5rem] items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-2.5 transition hover:border-teal-300/30 hover:bg-teal-300/10 sm:h-10 sm:px-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--tv-from),var(--tv-to))] text-[0.7rem] font-extrabold text-[#07111d]">
                      {(session.user.name || session.user.email || "U")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <span className="hidden min-w-0 truncate text-xs font-semibold text-slate-100 sm:inline">
                      {session.user.name || "Cuenta"}
                    </span>
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="glass-panel absolute right-0 mt-2 w-[min(17rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-1.5"
                    >
                      <div className="border-b border-white/10 px-3 py-2.5 text-xs text-neutral-400">
                        {session.user.role === "SUPER_ADMIN"
                          ? "Super Admin"
                          : session.user.email}
                        {session.user.role !== "SUPER_ADMIN" && (
                          <p className="mt-1 text-[11px] text-neutral-500">
                            {session.user.membershipActive
                              ? `Activa${
                                  session.user.currentPeriodEnd
                                    ? ` · Vence ${new Date(
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
                          className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm hover:bg-white/[0.06]"
                          onClick={() => setMenuOpen(false)}
                        >
                          <Crown className="h-4 w-4 text-teal-300" />
                          Membresía
                        </Link>
                      )}
                      <Link
                        href="/perfiles"
                        data-tv-focus
                        className="block rounded-xl px-3 py-3 text-sm hover:bg-white/[0.06]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Cambiar perfil
                      </Link>
                      <Link
                        href="/cuenta"
                        data-tv-focus
                        className="block rounded-xl px-3 py-3 text-sm hover:bg-white/[0.06]"
                        onClick={() => setMenuOpen(false)}
                      >
                        Mi cuenta
                      </Link>
                      {session.user.role === "SUPER_ADMIN" && (
                        <Link
                          href="/admin"
                          data-tv-focus
                          className="block rounded-xl px-3 py-3 text-sm hover:bg-white/[0.06]"
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
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/[0.06]"
                      >
                        <LogOut className="h-4 w-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              ) : status !== "loading" ? (
                <Link
                  href="/login"
                  data-tv-focus
                  className="brand-button focus-ring rounded-xl px-3.5 py-2.5 text-sm font-bold transition sm:px-4"
                >
                  Entrar
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Overlay búsqueda móvil */}
        {searchOpen && (
          <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-[#06080f]/98 backdrop-blur-xl md:hidden">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <form
                onSubmit={onSearchSubmit}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-3.5"
              >
                <Search className="h-5 w-5 shrink-0 text-teal-200/80" />
                <input
                  ref={mobileInputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar título…"
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
                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3.5 text-sm font-semibold text-white/85"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
              {query.trim().length < 2 ? (
                <p className="px-4 py-8 text-sm leading-6 text-white/45">
                  Escribe al menos 2 caracteres para buscar series, películas,
                  animes o mangas.
                </p>
              ) : (
                <ResultList />
              )}
            </div>
          </div>
        )}
      </header>

      {/* Tabs inferiores — pulgar / smartphone */}
      {!hideMobileTabs && (
        <nav
          aria-label="Navegación principal"
          className="veotv-mobile-tabs pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#06080f]/94 backdrop-blur-2xl md:hidden"
          style={{
            paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))",
          }}
        >
          <ul className="mx-auto grid max-w-lg grid-cols-6 gap-0 px-0.5 pt-1">
            {links.map(({ href, short, Icon }) => {
              const active = linkActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    data-tv-focus
                    className={`flex min-h-[3.35rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition active:scale-[0.97] ${
                      active
                        ? "text-teal-200"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    <Icon
                      className={`h-[1.35rem] w-[1.35rem] ${
                        active ? "stroke-[2.25px]" : "stroke-[1.75px]"
                      }`}
                      aria-hidden
                    />
                    <span
                      className={`text-[0.65rem] leading-none ${
                        active ? "font-bold" : "font-medium"
                      }`}
                    >
                      {short}
                    </span>
                    {active && (
                      <span
                        aria-hidden
                        className="mt-0.5 h-0.5 w-4 rounded-full bg-teal-300"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
