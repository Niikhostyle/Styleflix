import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { getDownloadsEnabled } from "@/lib/settings";

export default async function Footer() {
  const downloadsEnabled = await getDownloadsEnabled();

  return (
    <footer className="px-4 pb-8 pt-12 text-slate-500 md:px-8 lg:px-12">
      <div className="surface-panel mx-auto max-w-[1440px] rounded-3xl px-6 py-8 md:px-8">
        <div className="grid gap-8 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <BrandMark />
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              Tu espacio para descubrir películas, series y anime en una
              experiencia hecha para disfrutar.
            </p>
            <p className="mt-4 text-sm">
              Soporte:{" "}
              <span className="text-slate-300">ayuda@veotv.com</span>
            </p>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Explorar
            </p>
            <div className="grid gap-2.5 text-sm">
              <Link href="/peliculas" className="hover:text-teal-200">
                Películas
              </Link>
              <Link href="/series" className="hover:text-teal-200">
                Series
              </Link>
              <Link href="/animes" className="hover:text-teal-200">
                Animes
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
              Tu cuenta
            </p>
            <div className="grid gap-2.5 text-sm">
              <Link href="/cuenta" className="hover:text-teal-200">
                Perfil
              </Link>
              <Link href="/membresia" className="hover:text-teal-200">
                Membresía
              </Link>
              {downloadsEnabled && (
                <Link href="/descargar" className="hover:text-teal-200">
                  Descargar app
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-white/[0.07] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} VeoTV.</p>
          <p>Información de catálogo proporcionada por TMDB.</p>
        </div>
      </div>
    </footer>
  );
}
