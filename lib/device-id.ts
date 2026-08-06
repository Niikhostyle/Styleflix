/** ID estable del navegador/dispositivo para el lock de reproducción. */
const KEY = "veotv_device_id";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (id && id.length >= 16) return id;
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `d_${Date.now().toString(36)}`;
  }
}
