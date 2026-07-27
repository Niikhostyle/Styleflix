"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Bell, Search, User, LogOut, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  IMAGE_BASE_URL,
  getDisplayTitle,
  getReleaseYear,
  type MediaItem,
  type MediaType,
} from "@/lib/tmdb";

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
  const [results, setResults] = useState<MediaItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
        setResults([]);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
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
        .then((data) => setResults(data.items ?? []))
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
    setSearchOpen(false);
    router.push(`/buscar?q=${encodeURIComponent(q)}`);
  }

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-colors duration-300 ${
        isScrolled
          ? "bg-[#141414]/95 shadow-lg shadow-black/40 backdrop-blur-sm"
          : "bg-gradient-to-b from-black/80 to-transparent"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 md:px-12">
        <div className="flex items-center gap-6 md:gap-10">
          <Link
            href="/"
            className="text-2xl font-black tracking-tighter text-[#E50914] md:text-[1.85rem]"
          >
            STYLEFLIX
          </Link>

          <ul className="hidden items-center gap-5 text-[0.9rem] md:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`transition-colors ${
                      active
                        ? "font-semibold text-white"
                        : "text-neutral-300 hover:text-neutral-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3 text-white md:gap-4">
          <div className="flex gap-3 text-xs font-medium text-neutral-300 md:hidden">
            {links.slice(1).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname.startsWith(link.href)
                    ? "text-white"
                    : "hover:text-white"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div ref={searchWrapRef} className="relative flex items-center">
            {searchOpen ? (
              <form
                onSubmit={onSearchSubmit}
                className="flex items-center gap-2 rounded border border-white/40 bg-black/80 px-2 py-1.5"
              >
                <Search className="h-4 w-4 shrink-0 text-neutral-300" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Títulos, géneros..."
                  className="w-[140px] bg-transparent text-sm text-white outline-none placeholder:text-neutral-500 sm:w-[220px] md:w-[280px]"
                  aria-label="Buscar títulos"
                />
                <button
                  type="button"
                  aria-label="Cerrar búsqueda"
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
                onClick={openSearch}
                className="transition hover:text-neutral-300"
              >
                <Search className="h-5 w-5" />
              </button>
            )}

            {searchOpen && query.trim().length >= 2 && (
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(92vw,360px)] overflow-y-auto rounded-md border border-white/10 bg-[#181818] shadow-2xl">
                {searching && (
                  <p className="px-3 py-3 text-sm text-neutral-400">
                    Buscando...
                  </p>
                )}
                {!searching && results.length === 0 && (
                  <p className="px-3 py-3 text-sm text-neutral-400">
                    Sin resultados para “{query.trim()}”
                  </p>
                )}
                {!searching &&
                  results.slice(0, 8).map((item) => {
                    const type = (item.media_type ?? "movie") as MediaType;
                    const name = getDisplayTitle(item);
                    const year = getReleaseYear(item);
                    return (
                      <Link
                        key={`${type}-${item.id}`}
                        href={`/titulo/${type}/${item.id}`}
                        onClick={closeSearch}
                        className="flex items-center gap-3 border-b border-white/5 px-3 py-2.5 transition hover:bg-white/5 last:border-0"
                      >
                        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
                          {item.poster_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${IMAGE_BASE_URL}${item.poster_path}`}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {name}
                          </p>
                          <p className="text-xs text-neutral-400">
                            {type === "movie" ? "Película" : "Serie"}
                            {year ? ` · ${year}` : ""}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                {!searching && results.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const q = query.trim();
                      closeSearch();
                      router.push(`/buscar?q=${encodeURIComponent(q)}`);
                    }}
                    className="block w-full px-3 py-2.5 text-left text-sm font-medium text-neutral-200 hover:bg-white/5"
                  >
                    Ver todos los resultados
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="Notificaciones"
            className="hidden transition hover:text-neutral-300 md:block"
          >
            <Bell className="h-5 w-5" />
          </button>

          {status === "authenticated" ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded bg-[#E50914]/90 px-2 py-1.5 transition hover:bg-[#E50914]"
              >
                <User className="h-4 w-4" />
                <span className="hidden max-w-[100px] truncate text-xs font-medium sm:inline">
                  {session.user.name || "Cuenta"}
                </span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-md border border-white/10 bg-[#181818] shadow-xl">
                  <div className="border-b border-white/10 px-3 py-2 text-xs text-neutral-400">
                    {session.user.role === "SUPER_ADMIN"
                      ? "Super Admin"
                      : session.user.email}
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded px-2 py-1.5 text-sm text-neutral-200 transition hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="rounded bg-[#E50914] px-3 py-1.5 text-sm font-semibold transition hover:bg-[#f6121d]"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
