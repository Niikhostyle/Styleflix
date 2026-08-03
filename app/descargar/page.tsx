import Link from "next/link";

export const metadata = {
  title: "Descargar app | StyleFlix",
  description: "Instala StyleFlix en Android y Android TV sin Google Play",
};

export default function DescargarPage() {
  return (
    <div className="min-h-screen bg-[#141414] px-4 py-16 text-white md:px-10">
      <div className="mx-auto max-w-2xl">
        <p className="text-2xl font-black tracking-tight text-[#E50914]">
          STYLEFLIX
        </p>
        <h1 className="mt-3 text-3xl font-black md:text-4xl">
          Descargar para Android TV
        </h1>
        <p className="mt-3 text-neutral-300">
          Instala la app sin Google Play. Funciona en Android TV / Google TV y
          también en móviles Android.
        </p>

        <a
          href="/downloads/styleflix.apk"
          download
          className="mt-8 inline-flex items-center justify-center rounded bg-[#E50914] px-6 py-3 text-base font-bold transition hover:bg-[#f6121d]"
        >
          Descargar StyleFlix (APK)
        </a>

        <ol className="mt-10 list-decimal space-y-3 pl-5 text-sm text-neutral-200 md:text-base">
          <li>
            En la TV: abre este enlace desde el navegador o envía el APK por USB /
            Drive.
          </li>
          <li>
            Permite <strong>instalar apps desconocidas</strong> para el navegador
            o el gestor de archivos.
          </li>
          <li>Abre el archivo <code className="text-neutral-100">styleflix.apk</code> e instala.</li>
          <li>
            Busca <strong>StyleFlix</strong> en el menú de apps de la TV.
          </li>
          <li>
            Inicia sesión con la cuenta que te creó el administrador.
          </li>
        </ol>

        <div className="mt-8 rounded-lg border border-white/10 bg-black/40 p-4 text-sm text-neutral-400">
          <p className="font-semibold text-neutral-200">Tip ADB (avanzado)</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-neutral-300">{`adb connect IP_TV:5555
adb install -r styleflix.apk`}</pre>
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
