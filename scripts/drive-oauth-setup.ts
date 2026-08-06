/**
 * OAuth one-shot para obtener GOOGLE_DRIVE_REFRESH_TOKEN.
 *
 * Requisitos previos (Google Cloud Console):
 * 1) Proyecto → APIs → habilitar "Google Drive API"
 * 2) Credenciales → Crear "ID de cliente OAuth" tipo "Aplicación de escritorio"
 * 3) Pantalla de consentimiento → agregar tu correo como usuario de prueba
 * 4) Copiar Client ID y Client Secret a .env.local
 *
 *   npm run mirror:drive-auth
 *
 * Abre el navegador, autorizás, y el script imprime el refresh token.
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exec } from "node:child_process";

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
].join(" ");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = readFileSync(resolve(process.cwd(), file), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, valueRaw] = match;
      if (process.env[key]) continue;
      process.env[key] = valueRaw.trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const clientId = (process.env.GOOGLE_DRIVE_CLIENT_ID || "").trim();
const clientSecret = (process.env.GOOGLE_DRIVE_CLIENT_SECRET || "").trim();

if (!clientId || !clientSecret) {
  console.error(`
Faltan variables en .env.local:

  GOOGLE_DRIVE_CLIENT_ID=...
  GOOGLE_DRIVE_CLIENT_SECRET=...

Cómo obtenerlas:
  1. https://console.cloud.google.com/ → tu proyecto
  2. APIs y servicios → Biblioteca → habilitar "Google Drive API"
  3. Credenciales → Crear credenciales → ID de cliente OAuth
  4. Tipo: "Aplicación de escritorio"
  5. Pegá Client ID y Secret aquí y volvé a correr:
       npm run mirror:drive-auth
`);
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  }).toString();

console.log("\nAbrí esta URL si el navegador no se abre solo:\n");
console.log(authUrl);
console.log(`\nEsperando callback en ${REDIRECT} …\n`);

try {
  exec(`start "" "${authUrl}"`);
} catch {
  /* ignore */
}

const server = createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    if (u.pathname !== "/oauth2callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const err = u.searchParams.get("error");
    if (err) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<h1>Error OAuth: ${err}</h1>`);
      console.error("OAuth error:", err);
      server.close();
      process.exit(1);
    }
    const code = u.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code");
      return;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as {
      refresh_token?: string;
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokens.refresh_token) {
      res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<pre>No se obtuvo refresh_token.\n${JSON.stringify(tokens, null, 2)}</pre>
         <p>Si ya autorizaste antes, revocá el acceso en
         <a href="https://myaccount.google.com/permissions">permisos de cuenta</a>
         y reintentá con prompt=consent.</p>`
      );
      console.error(tokens);
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<h1>OK — ya podés cerrar esta pestaña</h1><p>Revisá la terminal para el refresh token.</p>"
    );

    console.log("\n========== PEGÁ ESTO EN .env.local ==========\n");
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\nTambién necesitás el ID de la carpeta veotv:");
    console.log(
      "  Abrí Drive → carpeta veotv → la URL es …/folders/ESTE_ID"
    );
    console.log("  GOOGLE_DRIVE_FOLDER_ID=ESTE_ID\n");
    console.log("=============================================\n");

    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end("Error");
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
