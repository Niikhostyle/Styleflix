import { SOURCE_LABELS, type SourceId } from "@/lib/sources/types";

/** Muestra de qué fuentes se armó el catálogo visible. */
export default function SourceLegend({ sources }: { sources: SourceId[] }) {
  if (!sources.length) return null;

  return (
    <section className="px-4 pt-4 md:px-8 lg:px-12">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.06] bg-[#0b1424]/50 px-4 py-3 text-[11px] text-slate-500">
        <span className="font-semibold uppercase tracking-widest text-slate-400">
          Fuentes
        </span>
        {sources.map((id) => (
          <span
            key={id}
            className="rounded-full border border-white/[0.08] px-2.5 py-1 text-slate-300"
          >
            {SOURCE_LABELS[id]}
          </span>
        ))}
        <span className="ml-auto">
          Los títulos marcados con «Ficha» aún no tienen stream: puedes ver su
          información y tráiler.
        </span>
      </div>
    </section>
  );
}
