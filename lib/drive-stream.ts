/**
 * Stream de archivos públicos de Google Drive.
 * Preferencia: Drive API (GOOGLE_DRIVE_API_KEY) → usercontent download → uc?export=download.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cookieHeader(setCookies: string[]): string {
  return setCookies
    .map((raw) => raw.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function collectSetCookie(res: Response): string[] {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(prev: string, setCookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of prev.split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const raw of setCookies) {
    const first = raw.split(";")[0]?.trim();
    if (!first) continue;
    const i = first.indexOf("=");
    if (i > 0) map.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function extractDownloadParams(html: string): {
  confirm?: string;
  uuid?: string;
  action?: string;
} {
  const confirm =
    html.match(/name="confirm"\s+value="([^"]+)"/i)?.[1] ||
    html.match(/confirm=([0-9A-Za-z_-]+)/)?.[1] ||
    undefined;
  const uuid =
    html.match(/name="uuid"\s+value="([^"]+)"/i)?.[1] ||
    html.match(/uuid=([0-9A-Za-z_-]+)/)?.[1] ||
    undefined;
  const action =
    html.match(/action="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+)"/i)?.[1]?.replace(
      /&amp;/g,
      "&"
    ) || undefined;
  return { confirm, uuid, action };
}

function isHtmlBytes(buf: Uint8Array): boolean {
  if (buf.length < 8) return false;
  const head = Buffer.from(buf.subarray(0, 80)).toString("utf8").trimStart();
  return (
    head.startsWith("<!DOCTYPE") ||
    head.startsWith("<html") ||
    head.startsWith("<HTML") ||
    head.startsWith("{\\\"error\\\"") ||
    head.startsWith('{"error"')
  );
}

/** Detecta contenedor de video por magic bytes. */
export function sniffVideoMime(buf: Uint8Array): string | null {
  if (buf.length < 12) return null;
  // ISO BMFF (mp4/m4v/mov): ....ftyp
  if (
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  ) {
    return "video/mp4";
  }
  // WebM / Matroska EBML
  if (
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  ) {
    return "video/webm";
  }
  // Ogg
  if (
    buf[0] === 0x4f &&
    buf[1] === 0x67 &&
    buf[2] === 0x67 &&
    buf[3] === 0x53
  ) {
    return "video/ogg";
  }
  return null;
}

export type DriveUpstream = {
  body: ReadableStream<Uint8Array>;
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
};

function buildHeaders(opts: {
  cookies?: string;
  range?: string | null;
}): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
  };
  if (opts.cookies) h.Cookie = opts.cookies;
  if (opts.range) h.Range = opts.range;
  return h;
}

async function fetchDriveApiMedia(opts: {
  fileId: string;
  apiKey: string;
  range?: string | null;
}): Promise<Response> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    opts.fileId
  )}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(opts.apiKey)}`;
  return fetch(url, {
    headers: buildHeaders({ range: opts.range }),
    redirect: "follow",
    cache: "no-store",
  });
}

async function resolvePublicDownloadUrl(
  fileId: string
): Promise<{ url: string; cookies: string }> {
  let cookies = "";
  const probeUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(
    fileId
  )}`;

  const probe = await fetch(probeUrl, {
    headers: buildHeaders({}),
    redirect: "follow",
    cache: "no-store",
  });
  cookies = mergeCookies(cookies, collectSetCookie(probe));
  const ct = (probe.headers.get("content-type") || "").toLowerCase();

  // Ya es binario (archivo chico)
  if (!ct.includes("text/html") && (probe.ok || probe.status === 206)) {
    // Consumir no: necesitamos URL estable. Preferir usercontent con confirm=t
    probe.body?.cancel().catch(() => undefined);
    return {
      url: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
        fileId
      )}&export=download&confirm=t`,
      cookies,
    };
  }

  const html = await probe.text();
  const params = extractDownloadParams(html);
  if (params.action) {
    return { url: params.action, cookies };
  }

  const qs = new URLSearchParams({
    id: fileId,
    export: "download",
    confirm: params.confirm || "t",
  });
  if (params.uuid) qs.set("uuid", params.uuid);

  return {
    url: `https://drive.usercontent.google.com/download?${qs.toString()}`,
    cookies,
  };
}

async function toVerifiedUpstream(
  res: Response,
  fallbackMime = "video/mp4"
): Promise<DriveUpstream> {
  if (!res.body) {
    throw new Error("Drive no devolvió cuerpo de video.");
  }
  if (!res.ok && res.status !== 206) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Drive respondió ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ""}`
    );
  }

  const reader = res.body.getReader();
  const first = await reader.read();
  const chunk = first.value || new Uint8Array();

  if (isHtmlBytes(chunk)) {
    reader.cancel().catch(() => undefined);
    throw new Error(
      "Google devolvió HTML en vez de video (archivo privado, captcha o bloqueo al servidor). Comprueba el enlace público."
    );
  }

  const sniffed = sniffVideoMime(chunk);
  const upstreamCt = (res.headers.get("content-type") || "").toLowerCase();
  let contentType = fallbackMime;
  if (sniffed) contentType = sniffed;
  else if (
    upstreamCt.startsWith("video/") ||
    upstreamCt === "application/octet-stream"
  ) {
    contentType = upstreamCt === "application/octet-stream" ? "video/mp4" : upstreamCt;
  } else if (upstreamCt && !upstreamCt.includes("text/html")) {
    contentType = upstreamCt;
  }

  if (!sniffed && chunk.length >= 12) {
    // No parece video conocido
    const head = Buffer.from(chunk.subarray(0, 40)).toString("utf8");
    if (/^\s*</.test(head) || head.includes("Sign in")) {
      reader.cancel().catch(() => undefined);
      throw new Error(
        "No se pudo obtener el MP4. El archivo debe ser público y en formato MP4/WebM."
      );
    }
  }

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (chunk.length) controller.enqueue(chunk);
        if (first.done) {
          controller.close();
          return;
        }
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return {
    body,
    status: res.status === 206 ? 206 : 200,
    contentType,
    contentLength: res.headers.get("content-length"),
    contentRange: res.headers.get("content-range"),
    acceptRanges: res.headers.get("accept-ranges") || "bytes",
  };
}

/**
 * Abre stream verificando magic bytes (evita servir HTML como video/mp4).
 */
export async function openGoogleDriveStream(opts: {
  fileId: string;
  range?: string | null;
}): Promise<DriveUpstream> {
  const fileId = opts.fileId.trim();
  if (!/^[\w-]+$/.test(fileId)) {
    throw new Error("fileId inválido");
  }

  const apiKey = (
    process.env.GOOGLE_DRIVE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ""
  ).trim();

  if (apiKey) {
    try {
      const apiRes = await fetchDriveApiMedia({
        fileId,
        apiKey,
        range: opts.range,
      });
      return await toVerifiedUpstream(apiRes);
    } catch (err) {
      console.warn("[drive] API key path failed, fallback uc", err);
    }
  }

  const { url, cookies } = await resolvePublicDownloadUrl(fileId);
  const res = await fetch(url, {
    headers: buildHeaders({ cookies, range: opts.range }),
    redirect: "follow",
    cache: "no-store",
  });

  return toVerifiedUpstream(res);
}
