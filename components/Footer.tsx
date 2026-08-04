import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-white/5 px-4 py-12 text-neutral-500 md:px-12">
      <div className="mx-auto max-w-6xl">
        <p className="mb-6 text-sm">
          Preguntas? Contáctanos en{" "}
          <span className="underline">ayuda@naseros.com</span>
        </p>

        <div className="mb-8 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Link href="/peliculas" className="hover:underline">
            Películas
          </Link>
          <Link href="/series" className="hover:underline">
            Series
          </Link>
          <Link href="/animes" className="hover:underline">
            Animes
          </Link>
          <Link href="/" className="hover:underline">
            Inicio
          </Link>
        </div>

        <p className="text-xs text-neutral-600">
          © {new Date().getFullYear()} Naseros. Datos de catálogo proporcionados
          por TMDB.
        </p>
      </div>
    </footer>
  );
}
