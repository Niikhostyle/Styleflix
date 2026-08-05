import Link from "next/link";
import { Play } from "lucide-react";

export default function BrandMark({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="VeoTV — Inicio"
      data-tv-focus
      className={`focus-ring inline-flex items-center gap-2.5 rounded-xl ${className}`}
    >
      <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-teal-200/20 bg-teal-300 text-[#07111d] shadow-[0_8px_26px_rgba(45,212,191,0.24)]">
        <span className="absolute inset-0 bg-gradient-to-br from-white/35 to-transparent" />
        <Play className="relative h-4 w-4 fill-current" strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="text-xl font-black tracking-[-0.055em] text-white md:text-[1.35rem]">
          VEO
          <span className="text-teal-300">TV</span>
        </span>
      )}
    </Link>
  );
}
