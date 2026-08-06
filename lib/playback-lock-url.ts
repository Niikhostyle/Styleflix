/** Helpers de URL para el lock de reproducción (seguros para client components). */

export function withPlaybackLockQuery(
  pathOrUrl: string,
  lock: { profileId: string; deviceId: string; lockToken: string }
): string {
  try {
    const absolute = /^https?:\/\//i.test(pathOrUrl);
    const u = absolute
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, "http://veotv.local");
    u.searchParams.set("pid", lock.profileId);
    u.searchParams.set("did", lock.deviceId);
    u.searchParams.set("ltk", lock.lockToken);
    if (absolute) return u.toString();
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    const sep = pathOrUrl.includes("?") ? "&" : "?";
    return (
      `${pathOrUrl}${sep}` +
      `pid=${encodeURIComponent(lock.profileId)}` +
      `&did=${encodeURIComponent(lock.deviceId)}` +
      `&ltk=${encodeURIComponent(lock.lockToken)}`
    );
  }
}

/** Prefijo de query para proxies HLS que deben conservar el lock en cada segmento. */
export function playbackLockQueryPrefix(lock: {
  profileId: string;
  deviceId: string;
  lockToken: string;
}): string {
  return (
    `pid=${encodeURIComponent(lock.profileId)}` +
    `&did=${encodeURIComponent(lock.deviceId)}` +
    `&ltk=${encodeURIComponent(lock.lockToken)}&`
  );
}
