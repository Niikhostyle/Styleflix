# Espejo nocturno → Google Drive (`G:\Mi unidad\veotv`)

Script: `scripts/mirror-catalog-to-drive.ts`

## Qué descarga ahora

Usa el **mismo botón de descarga del player** Vimeus:

1. Lee `embeds[]` del player (`vimeus.com/e/movie?tmdb=…`)
2. Elige el mejor mirror `vimeos.net/embed-{id}.html` (Full HD)
3. Abre `https://vimeos.net/d/{id}_h`
4. Espera ~5.5s y hace POST `download_orig` (como el botón “Descargar archivo”)
5. Baja el MP4/M4V de `s1.vimeos.net/…` (enlace ~12h ligado a tu IP)

También baja Archive.org cuando hay título PD.

## Comandos

```powershell
cd "C:\Users\NICOLAS FIGUEROA\Documents\styleflix\netflix-clone"

# Inventario
npm run mirror:catalog -- --out "G:\Mi unidad\veotv"

# Prueba 1 película
npm run mirror:download -- --out "G:\Mi unidad\veotv" --only-movies --limit 1 --concurrency 1

# Noche completa (recomendado concurrency 1: archivos ~1–2 GB)
npm run mirror:download -- --out "G:\Mi unidad\veotv" --concurrency 1
```

Flags útiles:

| Flag | Efecto |
|------|--------|
| `--tmdb 1081003` | Solo ese título (rápido para probar) |
| `--title Supergirl` | Nombre de carpeta con `--tmdb` |
| `--category peliculas` | Con `--tmdb`: peliculas\|series\|anime |
| `--only-movies` | Solo películas (sin series/anime) |
| `--only-vimeus` | Sin Archive.org |
| `--no-episodes` | No expandir SxxExx (solo ficha) |
| `--limit N` | Primeros N títulos del inventario |
| `--dl-wait-ms 5500` | Espera antes del POST de descarga |
| `--force` | Re-descarga aunque esté en progress |

### Probar Supergirl (como en el player)

```powershell
npm run mirror:download -- --out "G:\Mi unidad\veotv" --tmdb 1081003 --title Supergirl --only-vimeus --concurrency 1
```

## Estructura

```
G:\Mi unidad\veotv\
  peliculas\tmdb-1081003 - Supergirl\video.mp4
  series\tmdb-XXXX - Titulo\S01\S01E01.mp4
  anime\...
  _state\manifest.json
  _state\progress.json
```

Si se corta: vuelve a lanzar el mismo comando (reanuda).

## Notas

- El enlace directo de Vimeos es **por IP y temporal**; el script lo usa al momento de bajar.
- No satures con `--concurrency` alto: son archivos grandes y el host puede limitar.
- PC despierto + Drive Desktop montado en `G:\Mi unidad`.
