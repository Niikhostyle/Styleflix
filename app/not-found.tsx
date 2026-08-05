import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-page flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow mb-2">
        VeoTV
      </p>
      <h1 className="mb-3 text-4xl font-black md:text-5xl">
        Título no encontrado
      </h1>
      <p className="mb-8 max-w-md text-neutral-400">
        No pudimos encontrar este contenido. Puede que ya no esté disponible.
      </p>
      <Link
        href="/"
        className="rounded bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-white/85"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
