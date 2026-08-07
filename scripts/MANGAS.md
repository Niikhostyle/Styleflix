# Mangas en español (YupManga)

Fuente primaria: **[YupManga](https://www.yupmanga.com/)**.

Requiere **curl** en el PATH.

## Catálogo + descarga COMPLETA

```bash
cd netflix-clone

# 1) Indexar TODOS los títulos + capítulos
npm run mangas:scrape

# 2) Descargar TODAS las páginas a disco (horas/días; reanudable)
npm run mangas:download -- --out "G:\Mi unidad\veotv"
```

Equivale a:
`npx tsx scripts/scrape-yupmanga.ts --all --download --out "G:\Mi unidad\veotv"`

- Resume: si existe `cap-N/_done.txt`, salta ese capítulo.
- Catálogo parcial se guarda cada 10 series.

## Rápido (40 títulos)

```bash
npm run mangas:scrape:quick
```

## Salida

- `data/mangas-es/catalog.json`
- `data/mangas-es/by-slug/*.json`
- `{out}/manga/yup-…/cap-N/001.jpg`
