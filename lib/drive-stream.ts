/**
 * Stream de archivos públicos de Google Drive (enlace “cualquiera”).
 * Maneja aviso de virus/confirm en archivos grandes y reenvía Range.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cookieHeader(setCookies: string[]): string {
  const parts: string[] = [];
  for (const raw of setCookies) {
    const first = raw.split(";")[0]?.trim();
    if (first) parts.push(first);
  }
  return parts.join("; ");
}

function collectSetCookie(res: Response): string[] {
  // undici / Node fetch: getSetCookie si existe
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function extractConfirmFromHtml(html: string): string | null {
  const patterns = [
    /confirm=([0-9A-Za-z_-]+)/,
    /name="confirm"\s+value="([^"]+)"/,
    /&amp;confirm=([0-9A-Za-z_-]+)/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1] && m[1] !== "t") return m[1];
  }
  if (/confirm=t\b/.test(html) || /export=download/.test(html)) {
    return "t";
  }
  return null;
}

function looksLikeHtml(res: Response, buf?: ArrayBuffer): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  if (!buf || buf.byteLength < 16) return false;
  const head = Buffer.from(buf.slice(0, 64)).toString("utf8").trimStart();
  return head.startsWith("<!DOCTYPE") || head.startsWith("<html");
}

export type DriveUpstream = {
  response: Response;
  contentType: string;
};

/**
 * Abre el stream de descarga de Drive (con confirm si hace falta).
 * `range` opcional: header Range del navegador (bytes=…).
 */
export async function openGoogleDriveStream(opts: {
  fileId: string;
  range?: string | null;
}): Promise<DriveUpstream> {
  const fileId = opts.fileId.trim();
  if (!/^[\w-]+$/.test(fileId)) {
    throw new Error("fileId inválido");
  }

  const base = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  let url = `${base}&confirm=t`;
  let cookies = "";

  const commonHeaders = (): Record<string, string> => {
    const h: Record<string, string> = {
      "User-Agent": UA,
      Accept: "*/*",
      Referer: `https://drive.google.com/file/d/${fileId}/view`,
    };
    if (cookies) h.Cookie = cookies;
    if (opts.range) h.Range = opts.range;
    return h;
  };

  // 1ª petición
  let res = await fetch(url, {
    headers: commonHeaders(),
    redirect: "follow",
    cache: "no-store",
  });

  const set1 = collectSetCookie(res);
  if (set1.length) {
    cookies = cookieHeader(set1);
  }

  // Si Google devolvió HTML (virus scan), leer confirm y reintentar
  const ct0 = (res.headers.get("content-type") || "").toLowerCase();
  if (ct0.includes("text/html") && res.ok) {
    const html = await res.text();
    const confirm = extractConfirmFromHtml(html) || "t";
    url = `${base}&confirm=${encodeURIComponent(confirm)}`;
    res = await fetch(url, {
      headers: commonHeaders(),
      redirect: "follow",
      cache: "no-store",
    });
    const set2 = collectSetCookie(res);
    if (set2.length) {
      cookies = [cookies, cookieHeader(set2)].filter(Boolean).join("; ");
    }
  }

  // Aún HTML → fallo
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok && res.status !== 206) {
    throw new Error(`Drive upstream ${res.status}`);
  }
  if (ct.includes("text/html")) {
    // Peek pequeño sin consumir todo: clonar y leer
    const clone = res.clone();
    const peek = await clone.arrayBuffer();
    if (looksLikeHtml(res, peek)) {
      throw new Error(
        "Drive bloqueó la descarga (archivo privado o aviso de virus). Comparte como «Cualquiera con el enlace»."
      );
    }
  }

  const contentType =
    ct && !ct.includes("text/html")
      ? ct
      : "video/mp4";

  return { response: res, contentType };
}
