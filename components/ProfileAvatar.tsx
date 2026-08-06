"use client";

import {
  normalizeAvatarKey,
  type ProfileAvatarKey,
  PROFILE_AVATAR_KEYS,
} from "@/lib/profile-avatars";

const PALETTE: Record<
  ProfileAvatarKey,
  { bg: string; skin: string; hair: string; accent: string }
> = {
  "1": { bg: "#0f766e", skin: "#f5d0a9", hair: "#1e293b", accent: "#5eead4" },
  "2": { bg: "#6d28d9", skin: "#e8b89d", hair: "#4c1d95", accent: "#c4b5fd" },
  "3": { bg: "#c2410c", skin: "#f2c4a0", hair: "#7c2d12", accent: "#fdba74" },
  "4": { bg: "#047857", skin: "#d4a574", hair: "#14532d", accent: "#6ee7b7" },
  "5": { bg: "#be123c", skin: "#f0c9a8", hair: "#881337", accent: "#fda4af" },
  "6": { bg: "#1d4ed8", skin: "#eac086", hair: "#1e3a8a", accent: "#93c5fd" },
  "7": { bg: "#a16207", skin: "#f6d5b5", hair: "#854d0e", accent: "#fde68a" },
  "8": { bg: "#0e7490", skin: "#c68642", hair: "#164e63", accent: "#67e8f9" },
};

/** Avatar ilustrado (SVG) por avatarKey. */
export function ProfileAvatar({
  avatarKey,
  name,
  size = "md",
  className = "",
}: {
  avatarKey: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const key = normalizeAvatarKey(avatarKey);
  const p = PALETTE[key];
  const dim =
    size === "xl"
      ? "h-28 w-28 md:h-32 md:w-32"
      : size === "lg"
        ? "h-24 w-24"
        : size === "sm"
          ? "h-10 w-10"
          : "h-14 w-14";

  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/10 ${dim} ${className}`}
      style={{ background: p.bg }}
      aria-hidden={!name}
      title={name}
    >
      <svg viewBox="0 0 80 80" className="h-full w-full" role="img">
        {name ? <title>{name}</title> : null}
        {/* hombros */}
        <ellipse cx="40" cy="78" rx="28" ry="16" fill={p.accent} opacity="0.35" />
        <ellipse cx="40" cy="82" rx="22" ry="14" fill={p.accent} />
        {/* cabeza */}
        <circle cx="40" cy="36" r="22" fill={p.skin} />
        {/* pelo por variante */}
        {key === "1" && (
          <path
            d="M18 34c2-16 14-24 22-24s20 8 22 24c-4-8-12-12-22-12S22 26 18 34z"
            fill={p.hair}
          />
        )}
        {key === "2" && (
          <path
            d="M16 38c0-18 12-28 24-28s24 10 24 28v6H16v-6z"
            fill={p.hair}
          />
        )}
        {key === "3" && (
          <>
            <ellipse cx="40" cy="22" rx="20" ry="12" fill={p.hair} />
            <path d="M20 28c8 4 32 4 40 0v8c-10 6-30 6-40 0v-8z" fill={p.hair} />
          </>
        )}
        {key === "4" && (
          <path
            d="M18 30c4-14 16-22 22-22s18 8 22 22l-6 4c-4-8-10-12-16-12s-12 4-16 12l-6-4z"
            fill={p.hair}
          />
        )}
        {key === "5" && (
          <path
            d="M15 32c3-16 14-26 25-26s22 10 25 26c-8-4-16-6-25-6s-17 2-25 6z"
            fill={p.hair}
          />
        )}
        {key === "6" && (
          <rect x="18" y="12" width="44" height="22" rx="8" fill={p.hair} />
        )}
        {key === "7" && (
          <path
            d="M20 36c0-14 10-24 20-24s20 10 20 24c-6-10-14-14-20-14s-14 4-20 14z"
            fill={p.hair}
          />
        )}
        {key === "8" && (
          <path
            d="M16 34c6-18 18-26 24-26s18 8 24 26-10 8-24 8-30 0-24-8z"
            fill={p.hair}
          />
        )}
        {/* ojos */}
        <circle cx="32" cy="36" r="3.2" fill="#0f172a" />
        <circle cx="48" cy="36" r="3.2" fill="#0f172a" />
        <circle cx="33" cy="35" r="1" fill="#fff" opacity="0.8" />
        <circle cx="49" cy="35" r="1" fill="#fff" opacity="0.8" />
        {/* sonrisa */}
        <path
          d="M33 46c3 4 11 4 14 0"
          fill="none"
          stroke="#9a3412"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  );
}

export function AvatarPicker({
  value,
  onChange,
  usedKeys = [],
}: {
  value: string;
  onChange: (key: ProfileAvatarKey) => void;
  usedKeys?: string[];
}) {
  const selected = normalizeAvatarKey(value);
  const used = new Set(usedKeys.map(normalizeAvatarKey));

  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {PROFILE_AVATAR_KEYS.map((k) => {
        const taken = used.has(k) && k !== selected;
        return (
          <button
            key={k}
            type="button"
            disabled={taken}
            onClick={() => onChange(k)}
            className={`rounded-2xl p-0.5 transition ${
              selected === k
                ? "ring-2 ring-teal-300 ring-offset-2 ring-offset-[#070b14]"
                : "opacity-90 hover:opacity-100"
            } ${taken ? "opacity-30" : ""}`}
            aria-label={`Avatar ${k}`}
            aria-pressed={selected === k}
          >
            <ProfileAvatar avatarKey={k} size="md" />
          </button>
        );
      })}
    </div>
  );
}
