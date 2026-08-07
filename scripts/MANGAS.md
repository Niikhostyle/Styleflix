# Mangas en español (YupManga)

Fuente primaria: **[YupManga](https://www.yupmanga.com/)** (español).  
Fallback opcional: MangaDex si YupManga no responde.

Requiere **curl** en el PATH (Cloudflare bloquea el `fetch` de Node).

## Script (caché + descarga)

```bash
# Catálogo popular (rápido)
npm run mangas:scrape

# Con lista de capítulos por manga
npm run mangas:scrape:full

# Descargar páginas a disco
npm run mangas:download -- --out "G:\Mi unidad\veotv" --limit=10 --max-chapters=5
```

Salida:
- `data/mangas-es/catalog.json` (`source: "yupmanga"`)
- `data/mangas-es/by-slug/*.json`
- Con `--download`: `{out}/manga/yup-…/cap-N/001.jpg`

## En la app

- Nav: **Mangas** → `/mangas`
- `/manga/[slug]` — ficha + lector vertical
- Apagar: `CATALOG_DISABLE=yupmanga`
- Coolify: incluir `yupmanga` en `CATALOG_SOURCES` (o dejar el default)

## Deploy

La imagen Docker instala `curl` (necesario para catálogo/proxy YupManga en el VPS).
