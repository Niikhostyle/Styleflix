# Mangas en español (MangaDex)

Fuente oficial: **MangaDex** (capítulos `translatedLanguage=es`). Sin API key.

## Script (caché local)

```bash
# Catálogo popular ES (rápido, ~40 títulos)
npm run mangas:scrape

# Con lista de capítulos por manga (más lento)
npm run mangas:scrape:full
```

Salida: `data/mangas-es/catalog.json` + `data/mangas-es/by-slug/*.json`

Si no hay caché, la app consulta MangaDex en vivo (con reintentos y paginación).

## En la app

- Nav: **Mangas**
- `/mangas` — biblioteca con grid de lectura (no player)
- `/manga/[slug]` — ficha + lector vertical (proxy de imágenes, progreso)
- Home: fila «Mangas en español»
- Apagar: `CATALOG_DISABLE=mangadex`
- Activar en Coolify: incluir `mangadex` en `CATALOG_SOURCES` (o dejar vacío)

## Deploy

Tras deploy, `node scripts/db-setup.cjs` aplica el modelo `MangaReadProgress`.
