# AnimeAV1 — scrape + descarga

Script: `scripts/scrape-animeav1.ts`  
Fuente: [animeav1.com](https://animeav1.com/) vía `animeav1-api` + HLS Zilla.

## Orden

1. **En emisión** (`status=emision`, orden popular)
2. **Populares** (`order=popular`)
3. **Resto** (`order=latest_added`, sin duplicados)

## Comandos

```powershell
cd "C:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone"

# Solo inventario → data/animeav1/catalog.json
npm run animeav1:catalog -- --pages 8

# Series completas (todos los capítulos) — rápido
npm run animeav1:full -- --out "G:\Mi unidad\veotv" --limit 10

# Solo en emisión, series enteras
npm run animeav1:full -- --only-airing --out "G:\Mi unidad\veotv"

# Un anime completo por slug
npm run animeav1:full -- --slug one-piece --out "G:\Mi unidad\veotv"
```

Sin `--max-episodes` (o con `--all-episodes` / `max-episodes 0`) baja **todos** los capítulos. Reanudable si se corta.

## Watcher automático (todo el día)

Escucha animes **en emisión**, prioriza los recién actualizados y solo baja **capítulos que falten** (tope red 150 Mbps por defecto).

```powershell
# Dejar corriendo (revisa cada 15 min)
npm run animeav1:watch -- --out "G:\Mi unidad\veotv" --interval 15

# Una pasada (útil para Programador de tareas diario)
npm run animeav1:watch:once -- --out "G:\Mi unidad\veotv"

# Atajo Windows: doble clic
.\scripts\animeav1-watch.cmd

# Arranque al iniciar sesión (una vez)
powershell -ExecutionPolicy Bypass -File .\scripts\register-animeav1-watch-task.ps1
```

| Flag watch | Default | Qué hace |
|------------|---------|----------|
| `--watch` | — | Modo daemon (emisión + new-only) |
| `--interval N` | 15 | Minutos entre revisiones |
| `--once` | — | Un ciclo y sale |
| `--new-only` | (implícito en watch) | Solo caps que no están en disco |
| `--verbose` | — | Loguea también los que ya están al día |

## Flags útiles

| Flag | Qué hace |
|------|----------|
| `--catalog-only` | Solo scrapea catálogo JSON |
| `--out PATH` | Destino (default `G:\Mi unidad\veotv`) |
| `--limit N` | Máx. animes a procesar |
| `--all-episodes` | Todos los capítulos (default si no hay `--max-episodes`) |
| `--max-episodes N` | Tope por anime (`0` = todos) |
| `--new-only` | Solo episodios faltantes en disco |
| `--watch` | Daemon: emisión + new-only en loop |
| `--fast` | Preset velocidad: segs×24, eps×2, animes×2 |
| `--max-mbps N` | Techo de red en **Mbps** (default **150** ≈ 18.8 MB/s; `0` = sin límite). Deja ~350 Mbps libres en un plan de 500. |
| `--max-mbs N` | Techo en **MB/s** (alternativa; si lo pasás, pisa `--max-mbps`) |
| `--seg-concurrency N` | Segmentos HLS en paralelo (default 12; con `--fast` 24) |
| `--ep-concurrency N` | Episodios del mismo anime en paralelo |
| `--concurrency N` | Animes distintos en paralelo |
| `--only-airing` | Solo bucket emisión |
| `--only-popular` | Solo populares |
| `--pages N` | Páginas por bucket (default 8 ≈ 160 ítems/bucket) |
| `--category tv-anime` | Filtrar categoría |
| `--posters-only` | Meta + póster, sin video |
| `--ffmpeg` | Remux con ffmpeg si está en PATH |
| `--force` | Re-descargar aunque exista |

**Tip 500 Mbps:** empezá con `--fast` / `animeav1:full`. Si ves muchos `FAIL`/403, bajá a `--seg-concurrency 16 --ep-concurrency 1`. Si va estable, subí a `32` / `3`.

Si usás `--max-episodes N` (>0): en **emisión** baja los últimos N; en el resto, los primeros N. Sin tope: serie completa en orden.

## Salida

```
G:\Mi unidad\veotv\
  anime\
    av1-12345 - Titulo\
      meta.json
      poster.jpg
      E001.mp4
      E002.mp4
  _state\
    animeav1-manifest.json
    animeav1-progress.json

data\animeav1\
  catalog.json
  by-slug\*.json
```

Los MP4 son **fMP4** (init + segmentos HLS). Abren en VLC / players modernos. Con `--ffmpeg` se remuxean a MP4 “clásico”.

## Notas

- Reanudable: vuelve a lanzar el mismo comando.
- One Piece y similares: series largas = cientos de GB. Empezá con `--limit 5` o un `--slug` concreto.
- El registro Drive actual (`mirror:register`) espera carpetas `tmdb-…`; estos `av1-…` quedan listos en disco para un registro futuro por slug/malId.
