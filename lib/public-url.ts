/** URL pública de la app (Coolify AUTH_URL / NEXTAUTH_URL). */
export function publicBaseUrl() {
  return (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function contactEmail() {
  return (
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "soporte@veotv.cloud"
  );
}
