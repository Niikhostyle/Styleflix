# Espejo nocturno → Google Drive (`G:\Mi unidad\veotv`)

Script descarga: `scripts/mirror-catalog-to-drive.ts`  
Script registro links: `scripts/register-drive-streams.ts`

## AnimeAV1 (aparte)

Para animes en emisión / populares / resto desde animeav1.com:

ver `scripts/ANIMEAV1.md` → `npm run animeav1:download`

## Qué descarga ahora (Vimeus)

Usa el **mismo botón de descarga del player** Vimeus:

1. Lee `embeds[]` del player (`vimeus.com/e/movie?tmdb=…`)
2. Elige el mejor mirror `vimeos.net/embed-{id}.html` (Full HD)
3. Abre `https://vimeos.net/d/{id}_h`
4. Espera ~5.5s y hace POST `download_orig`
5. Baja el MP4/M4V de `s1.vimeos.net/…`

Solo Vimeus (no Archive.org).

## Comandos descarga

```powershell
cd "C:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone"

npm run mirror:catalog -- --out "G:\Mi unidad\veotv"
npm run mirror:download -- --out "G:\Mi unidad\veotv" --only-movies --cartelera --concurrency 1
npm run mirror:download -- --out "G:\Mi unidad\veotv" --tmdb 1081003 --title Supergirl --concurrency 1

# Series (prioridad: emisión → populares → top/trending → resto)
npm run mirror:series:catalog -- --out "G:\Mi unidad\veotv"
npm run mirror:series -- --out "G:\Mi unidad\veotv"
```

## Registrar links en VeoTV (automático)

Convierte los MP4 de `veotv/` en `StreamOverride` (prioridad sobre Vimeus).

### Lo que necesitás configurar

| Variable | Dónde | Para qué |
|----------|--------|----------|
| `DATABASE_URL` | `.env.local` | Postgres de VeoTV (prod si querés links en vivo) |
| `GOOGLE_DRIVE_FOLDER_ID` | `.env.local` | ID de la carpeta `veotv` (URL `…/folders/ID`) |
| `GOOGLE_DRIVE_CLIENT_ID` | `.env.local` | OAuth escritorio (Google Cloud) |
| `GOOGLE_DRIVE_CLIENT_SECRET` | `.env.local` | idem |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | `.env.local` | sale de `npm run mirror:drive-auth` |
| `GOOGLE_DRIVE_API_KEY` | **Coolify** | playback en el server |

### Setup OAuth (una vez)

1. [Google Cloud Console](https://console.cloud.google.com/) → proyecto
2. Habilitar **Google Drive API**
3. Pantalla de consentimiento OAuth (External) → agregá tu email de prueba
4. Credenciales → **ID de cliente OAuth** → tipo **Aplicación de escritorio**
5. En `.env.local`:

```env
GOOGLE_DRIVE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=...
GOOGLE_DRIVE_FOLDER_ID=pegá_el_id_de_la_carpeta_veotv
DATABASE_URL=postgresql://...  # la de producción Coolify
```

6. Autorizar:

```powershell
npm run mirror:drive-auth
```

Pegá el `GOOGLE_DRIVE_REFRESH_TOKEN=...` que imprime.

### Registrar

```powershell
# Ver qué encontraría (no escribe DB)
npm run mirror:register -- --dry-run

# Crear/actualizar StreamOverride + compartir “cualquiera con el enlace”
npm run mirror:register -- --share

# Solo películas / límite
npm run mirror:register -- --share --only-movies
npm run mirror:register -- --share --limit 5
```

Flags: `--dry-run` · `--share` · `--only-movies` · `--only-series` · `--only-anime` · `--limit N`

## Estructura

```
G:\Mi unidad\veotv\
  peliculas\tmdb-1081003 - Supergirl\video.mp4
  series\tmdb-XXXX - Titulo\S01\S01E01.mp4
  anime\...
  _state\manifest.json
  _state\progress.json
  _state\registered.json   # tras mirror:register
```

## Notas

- El enlace directo de Vimeos es **por IP y temporal**; el script lo usa al momento de bajar.
- `--share` hace el archivo legible con API key (necesario en Coolify).
- Si se corta la descarga: volvé a lanzar el mismo comando (reanuda).
- PC despierto + Drive Desktop montado en `G:\Mi unidad` para **descargar**.
- Para **registrar** no hace falta G: montado: usa la API de Drive.
