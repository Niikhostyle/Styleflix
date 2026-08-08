import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import BrandMark from "@/components/BrandMark";
import PosterCollageBackground from "@/components/PosterCollageBackground";
import { Smartphone, Tv } from "lucide-react";
import { getPopularCatalogPosters } from "@/lib/catalog";
import { getDownloadsEnabled } from "@/lib/settings";

export const metadata = {
  title: "Descargar app | VeoTV",
  description: "Instala VeoTV en celular Android o Android TV",
};

export const dynamic = "force-dynamic";

function apkExists(filename: string) {
  return existsSync(path.join(process.cwd(), "public", "downloads", filename));
}

export default async function DescargarPage() {
  const [enabled, posterUrls] = await Promise.all([
    getDownloadsEnabled(),
    getPopularCatalogPosters(28).catch(() => [] as string[]),
  ]);

  const celularOk = apkExists("veotv-celular.apk");
  const tvOk = apkExists("veotv-tv.apk");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white">
      <PosterCollageBackground images={posterUrls} />

      <div className="relative z-10 px-4 py-10 sm:px-6 sm:py-14 md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl">
          <BrandMark className="mb-8 sm:mb-10" />

          {!enabled ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-300/80">
                Apps Android
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
                Próximamente
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/65 sm:text-base">
                Las aplicaciones para celular y Android TV todavía no están
                públicas. Mientras tanto puedes usar VeoTV desde el navegador.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-300/80">
                VeoTV en todos tus dispositivos
              </p>
              <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
                Descargar
                <br className="sm:hidden" /> aplicaciones
              </h1>
              <p className="mt-3 max-w-xl text-sm text-white/65 sm:text-base">
                Elige la versión según tu dispositivo. Sin Google Play.
              </p>

              <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-2">
                {celularOk ? (
                  <a
                    href="/downloads/veotv-celular.apk"
                    download
                    className="brand-button flex w-full flex-col gap-1 rounded-2xl px-5 py-5 text-left transition sm:px-6"
                  >
                    <Smartphone className="mb-2 h-7 w-7 sm:mb-3" />
                    <span className="text-base font-bold sm:text-lg">
                      Celular / tablet Android
                    </span>
                    <span className="text-sm font-medium text-white/85">
                      veotv-celular.apk · táctil
                    </span>
                  </a>
                ) : (
                  <div className="flex w-full flex-col gap-1 rounded-2xl border border-red-400/30 bg-red-950/40 px-5 py-5 text-left sm:px-6">
                    <Smartphone className="mb-2 h-7 w-7 text-red-300" />
                    <span className="text-base font-bold sm:text-lg">
                      Celular / tablet Android
                    </span>
                    <span className="text-sm text-red-200/90">
                      APK no disponible en el servidor. Redeploy pendiente.
                    </span>
                  </div>
                )}

                {tvOk ? (
                  <a
                    href="/downloads/veotv-tv.apk"
                    download
                    className="flex w-full flex-col gap-1 rounded-2xl border border-white/10 bg-black/55 px-5 py-5 text-left backdrop-blur-sm transition hover:border-violet-300/40 sm:px-6"
                  >
                    <Tv className="mb-2 h-7 w-7 text-violet-300 sm:mb-3" />
                    <span className="text-base font-bold sm:text-lg">
                      Android TV / Google TV
                    </span>
                    <span className="text-sm font-medium text-white/55">
                      veotv-tv.apk · control remoto
                    </span>
                  </a>
                ) : (
                  <div className="flex w-full flex-col gap-1 rounded-2xl border border-red-400/30 bg-red-950/40 px-5 py-5 text-left sm:px-6">
                    <Tv className="mb-2 h-7 w-7 text-red-300" />
                    <span className="text-base font-bold sm:text-lg">
                      Android TV / Google TV
                    </span>
                    <span className="text-sm text-red-200/90">
                      APK no disponible en el servidor. Redeploy pendiente.
                    </span>
                  </div>
                )}
              </div>

              <ol className="mt-8 list-decimal space-y-3 rounded-3xl border border-white/10 bg-black/55 p-5 pl-10 text-sm text-white/75 backdrop-blur-sm sm:mt-10 sm:p-6 sm:text-base">
                <li>Descarga el APK correcto (celular o TV).</li>
                <li>
                  Permite <strong className="text-white">instalar apps desconocidas</strong>{" "}
                  para el navegador o el gestor de archivos.
                </li>
                <li>Abre el archivo e instala.</li>
                <li>
                  Crea tu cuenta en la app o inicia sesión. Necesitas un plan
                  activo para ver el catálogo.
                </li>
              </ol>

              <div className="mt-6 rounded-lg border border-white/10 bg-black/50 p-4 text-sm text-white/45 backdrop-blur-sm sm:mt-8">
                <p className="font-semibold text-white/80">Tip ADB (avanzado)</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-white/55">{`adb install -r veotv-celular.apk
adb install -r veotv-tv.apk`}</pre>
              </div>
            </>
          )}

          <p className="mt-8 text-sm text-white/45">
            <Link href="/login" className="text-white/70 underline hover:text-white">
              Ir al login web
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
