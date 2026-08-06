# Mangas en español (MangaDex)

## Script (caché local)

```bash
# Catálogo popular ES (rápido, ~40 títulos)
npm run mangas:scrape

# Con lista de capítulos por manga (más lento)
npm run mangas:scrape:full

# Personalizado
npx tsx scripts/scrape-mangas-es.ts --limit=60 --with-chapters
```

Salida: `data/mangas-es/catalog.json` + `data/mangas-es/by-slug/*.json`

Si no hay caché, la app consulta MangaDex en vivo.

## En la app

- Nav: **Mangas** (junto a Animes)
- Home: fila «Mangas en español»
- `/mangas` · `/manga/[slug]` lector de capítulos
- Apagar fuente: quitar `mangadex` de `CATALOG_SOURCES`
