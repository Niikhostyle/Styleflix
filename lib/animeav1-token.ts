import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "veotv-animeav1-stream"
  )
    .trim()
    .replace(/^["']|["']$/g, "");
}

/** Token corto para m3u8/segs (evita auth()+redirect HTML en cada fragmento). */
export function signAnimeAv1StreamToken(opts: {
  hash: string;
  userId: string;
  ttlSec?: number;
}): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSec ?? 60 * 60 * 6);
  const payload = `${opts.hash}.${opts.userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyAnimeAv1StreamToken(
  token: string | null | undefined,
  expectedHash?: string
): { ok: true; hash: string; userId: string } | { ok: false } {
  if (!token) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false };
  const [hash, userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!hash || !userId || !Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return { ok: false };
  }
  if (expectedHash && hash !== expectedHash) return { ok: false };
  const payload = `${hash}.${userId}.${expStr}`;
  const expect = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }
  return { ok: true, hash, userId };
}
