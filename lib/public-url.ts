/** URL pública de la app (Coolify AUTH_URL / NEXTAUTH_URL). */
export function publicBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function isLoopbackHost(host: string) {
  const h = host.toLowerCase().split(":")[0];
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1";
}

/**
 * Origen que ve el navegador (Coolify/proxy).
 * Evita armar iframes/HLS con http://localhost:3000 dentro del contenedor.
 */
export function requestPublicOrigin(request: Request): string {
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const xfProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const rawHost =
    xfHost || request.headers.get("host")?.split(",")[0]?.trim() || "";

  if (rawHost && !isLoopbackHost(rawHost)) {
    const proto =
      xfProto ||
      (rawHost.includes("localhost") || rawHost.startsWith("127.")
        ? "http"
        : "https");
    return `${proto}://${rawHost}`.replace(/\/$/, "");
  }

  const env = publicBaseUrl();
  try {
    if (env && !isLoopbackHost(new URL(env).host)) return env;
  } catch {
    /* ignore */
  }

  if (rawHost) {
    return `${xfProto || "http"}://${rawHost}`.replace(/\/$/, "");
  }

  try {
    return new URL(request.url).origin;
  } catch {
    return env;
  }
}

export function contactEmail() {
  return (
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "soporte@veotv.cloud"
  );
}
