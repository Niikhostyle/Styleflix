/**
 * Normaliza URLs de embed para el player (iframe).
 * Google Drive: /open?id=… y /view → /file/d/{id}/preview
 */

const DRIVE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
]);

export function extractGoogleDriveFileId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (!DRIVE_HOSTS.has(u.hostname.replace(/^www\./, ""))) {
      // aún puede ser path file/d/ en query rara
    }
    const fromPath = u.pathname.match(/\/file\/d\/([^/]+)/i);
    if (fromPath?.[1]) return fromPath[1];
    const id = u.searchParams.get("id");
    if (id && /^[\w-]+$/.test(id)) return id;
    const open = raw.match(/[?&]id=([\w-]+)/i);
    if (open?.[1]) return open[1];
  } catch {
    const m =
      raw.match(/\/file\/d\/([^/]+)/i) ||
      raw.match(/[?&]id=([\w-]+)/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function googleDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Convierte links de Drive (y deja el resto intacto). */
export function normalizeEmbedUrl(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return trimmed;

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    // Si ya es /preview, normalizar igual por consistencia
    return googleDrivePreviewUrl(driveId);
  }

  try {
    const u = new URL(trimmed);
    return u.toString();
  } catch {
    return trimmed;
  }
}

export function isGoogleDriveUrl(raw: string): boolean {
  return Boolean(extractGoogleDriveFileId(raw));
}
