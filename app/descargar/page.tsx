import Link from "next/link";

export const metadata = {
  title: "Descargar app | StyleFlix",
  description: "Instala StyleFlix en celular Android o Android TV",
};

export default function DescargarPage() {
  return (
    <div className="min-h-screen bg-[#141414] px-4 py-16 text-white md:px-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-2xl font-black tracking-tight text-[#E50914]">
          STYLEFLIX
        </p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">Descargar apps</h1>
        <p className="mt-3 text-neutral-300">
          Elige la versión según tu dispositivo. Sin Google Play.
        </p>

        <div className="mt-10 space-y-4">
          <a
            href="/downloads/styleflix-celular.apk"
            download
            className="flex w-full flex-col gap-1 rounded bg-[#E50914] px-6 py-4 text-left transition hover:bg-[#f6121d]"
          >
            <span className="text-lg font-bold">Celular / tablet Android</span>
            <span className="text-sm font-medium text-white/85">
              styleflix-celular.apk · táctil
            </span>
          </a>

          <a
            href="/downloads/styleflix-tv.apk"
            download
            className="flex w-full flex-col gap-1 rounded border border-white/25 bg-white/10 px-6 py-4 text-left transition hover:bg-white/15"
          >
            <span className="text-lg font-bold">Android TV / Google TV</span>
            <span className="text-sm font-medium text-neutral-300">
              styleflix-tv.apk · control remoto
            </span>
          </a>
        </div>

        <ol className="mt-10 list-decimal space-y-3 pl-5 text-sm text-neutral-200 md:text-base">
          <li>Descarga el APK correcto (celular o TV).</li>
          <li>
            Permite <strong>instalar apps desconocidas</strong> para el navegador
            o el gestor de archivos.
          </li>
          <li>Abre el archivo e instala.</li>
          <li>
            Inicia sesión con la cuenta que te creó el administrador.
          </li>
        </ol>

        <div className="mt-8 rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-neutral-400">
          <p className="font-semibold text-neutral-200">Tip ADB (avanzado)</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-300">{`adb install -r styleflix-celular.apk
adb install -r styleflix-tv.apk`}</pre>
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
