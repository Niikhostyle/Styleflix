/**
 * Resuelve el secret de Auth.js y limpia comillas que Coolify a veces pega en el valor.
 */
export function resolveAuthSecret(): string | undefined {
  const raw =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET_KEY ||
    "";
  const cleaned = raw.trim().replace(/^["']|["']$/g, "");
  return cleaned || undefined;
}
