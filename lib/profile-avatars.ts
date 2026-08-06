/** Catálogo de avatares de perfil (keys estables en DB). */

export const PROFILE_AVATAR_KEYS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;

export type ProfileAvatarKey = (typeof PROFILE_AVATAR_KEYS)[number];

export function normalizeAvatarKey(raw: string | null | undefined): ProfileAvatarKey {
  const k = String(raw || "1").trim();
  if ((PROFILE_AVATAR_KEYS as readonly string[]).includes(k)) {
    return k as ProfileAvatarKey;
  }
  return "1";
}

export function nextAvatarKey(used: string[]): ProfileAvatarKey {
  const set = new Set(used.map((u) => normalizeAvatarKey(u)));
  const free = PROFILE_AVATAR_KEYS.find((k) => !set.has(k));
  return free || PROFILE_AVATAR_KEYS[used.length % PROFILE_AVATAR_KEYS.length];
}
