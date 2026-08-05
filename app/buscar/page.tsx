import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  IMAGE_BASE_URL,
  getDisplayTitle,
  getReleaseYear,
  searchMulti,
  type MediaType,
} from "@/lib/tmdb";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const items = query.length >= 2 ? await searchMulti(query) : [];

  return (
    <div className="app-page">
      <Navbar />

      <main className="mx-auto max-w-[1520px] px-4 pb-16 pt-32 md:px-8 lg:px-12">
        <p className="eyebrow mb-2">Descubrir</p>
        <h1 className="mb-2 text-3xl font-black tracking-[-0.04em] md:text-4xl">
          {query ? (
            <>
              Resultados para{" "}
              <span className="text-neutral-300">“{query}”</span>
            </>
          ) : (
            "Buscar"
          )}
        </h1>
        <p className="mb-8 text-sm text-neutral-400">
          {query.length < 2
            ? "Escribe al menos 2 caracteres en la lupa del menú."
            : items.length
              ? `${items.length} título${items.length === 1 ? "" : "s"}`
              : "No encontramos coincidencias."}
        </p>

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => {
              const type = (item.media_type ?? "movie") as MediaType;
              const name = getDisplayTitle(item);
              const year = getReleaseYear(item);

              return (
                <Link
                  key={`${type}-${item.id}`}
                  href={`/titulo/${type}/${item.id}`}
                  className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101827] shadow-lg transition hover:-translate-y-1 hover:border-teal-300/25"
                >
                  <div className="aspect-[2/3] bg-zinc-800">
                    {item.poster_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${IMAGE_BASE_URL}${item.poster_path}`}
                        alt={name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-2 text-center text-xs text-neutral-500">
                        {name}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-bold group-hover:text-teal-100">
                      {name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {type === "movie" ? "Película" : "Serie"}
                      {year ? ` · ${year}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
