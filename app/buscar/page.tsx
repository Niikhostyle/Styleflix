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

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const items = query.length >= 2 ? await searchMulti(query) : [];

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <Navbar />

      <main className="px-4 pb-16 pt-24 md:px-12">
        <h1 className="mb-2 text-2xl font-bold md:text-3xl">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
            {items.map((item) => {
              const type = (item.media_type ?? "movie") as MediaType;
              const name = getDisplayTitle(item);
              const year = getReleaseYear(item);

              return (
                <Link
                  key={`${type}-${item.id}`}
                  href={`/titulo/${type}/${item.id}`}
                  className="group overflow-hidden rounded-sm bg-zinc-900 transition hover:scale-[1.03]"
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
                  <div className="p-2">
                    <p className="truncate text-sm font-medium group-hover:text-white">
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
