/** Quita comillas/espacios que Coolify a veces deja en el valor. */
export function stripEnv(value: string | undefined | null): string {
  let v = (value || "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  // BOM / saltos raros
  return v.replace(/^\uFEFF/, "").trim();
}

export function envFlag(name: string): boolean {
  const v = stripEnv(process.env[name]).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
