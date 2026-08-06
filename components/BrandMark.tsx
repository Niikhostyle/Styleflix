import Link from "next/link";

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
      className={`focus-ring inline-flex items-center rounded-lg ${className}`}
    >
      {!compact && (
        <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-[0.04em] text-white md:text-2xl">
          VEO
          <span className="bg-gradient-to-r from-teal-300 to-violet-400 bg-clip-text text-transparent">
            TV
          </span>
        </span>
      )}
      {compact && (
        <span className="font-[family-name:var(--font-display)] text-lg font-extrabold text-white">
          V
        </span>
      )}
    </Link>
  );
}
