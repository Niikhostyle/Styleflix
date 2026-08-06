import Link from "next/link";
import BrandMark from "@/components/BrandMark";
import { Smartphone, Tv } from "lucide-react";
import { getDownloadsEnabled } from "@/lib/settings";

export const metadata = {
  title: "Descargar app | VeoTV",
  description: "Instala VeoTV en celular Android o Android TV",
};

export const dynamic = "force-dynamic";

export default async function DescargarPage() {
  const enabled = await getDownloadsEnabled();

  if (!enabled) {
    return (
      <div className="app-page px-4 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <BrandMark className="mb-10" />
          <p className="eyebrow">Apps Android</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-6xl">
            Próximamente
          </h1>
          <p className="mt-3 max-w-xl text-neutral-300">
            Las aplicaciones para celular y Android TV todavía no están
            públicas. Mientras tanto puedes usar VeoTV desde el navegador.
          </p>
          <p className="mt-8 text-sm text-neutral-500">
            <Link href="/login" className="text-neutral-300 underline">
              Ir al login web
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page px-4 py-16 md:px-10">
      <div className="mx-auto max-w-3xl">
        <BrandMark className="mb-10" />
        <p className="eyebrow">VeoTV en todos tus dispositivos</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] md:text-6xl">
          Descargar aplicaciones
        </h1>
        <p className="mt-3 text-neutral-300">
          Elige la versión según tu dispositivo. Sin Google Play.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <a
            href="/downloads/veotv-celular.apk"
            download
            className="brand-button flex w-full flex-col gap-1 rounded-2xl px-6 py-5 text-left transition"
          >
            <Smartphone className="mb-3 h-7 w-7" />
            <span className="text-lg font-bold">Celular / tablet Android</span>
            <span className="text-sm font-medium text-white/85">
              veotv-celular.apk · táctil
            </span>
          </a>

          <a
            href="/downloads/veotv-tv.apk"
            download
            className="surface-panel flex w-full flex-col gap-1 rounded-2xl px-6 py-5 text-left transition hover:border-violet-300/30"
          >
            <Tv className="mb-3 h-7 w-7 text-violet-300" />
            <span className="text-lg font-bold">Android TV / Google TV</span>
            <span className="text-sm font-medium text-neutral-300">
              veotv-tv.apk · control remoto
            </span>
          </a>
        </div>

        <ol className="surface-panel mt-10 list-decimal space-y-3 rounded-3xl p-6 pl-10 text-sm text-slate-200 md:text-base">
          <li>Descarga el APK correcto (celular o TV).</li>
          <li>
            Permite <strong>instalar apps desconocidas</strong> para el navegador
            o el gestor de archivos.
          </li>
          <li>Abre el archivo e instala.</li>
          <li>
            Crea tu cuenta en la app o inicia sesión. Necesitas un plan activo
            para ver el catálogo.
          </li>
        </ol>

        <div className="mt-8 rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-neutral-400">
          <p className="font-semibold text-neutral-200">Tip ADB (avanzado)</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-300">{`adb install -r veotv-celular.apk
adb install -r veotv-tv.apk`}</pre>
        </div>

        <p className="mt-8 text-sm text-neutral-500">
          <Link href="/login" className="text-neutral-300 underline">
            Ir al login web
          </Link>
        </p>
      </div>
    </div>
  );
}
