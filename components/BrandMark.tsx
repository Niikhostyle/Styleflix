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
        <span className="font-[family-name:var(--font-display)] text-[1.35rem] font-extrabold leading-none tracking-[0.02em] text-white sm:text-2xl md:text-[1.65rem]">
          VEO
          <span className="bg-[linear-gradient(110deg,var(--tv-from)_0%,var(--tv-via)_45%,var(--tv-to)_100%)] bg-clip-text text-transparent">
            TV
          </span>
        </span>
      )}
      {compact && (
        <span className="font-[family-name:var(--font-display)] text-lg font-extrabold text-white">
          V
          <span className="bg-[linear-gradient(110deg,var(--tv-from),var(--tv-to))] bg-clip-text text-transparent">
            TV
          </span>
        </span>
      )}
    </Link>
  );
}
