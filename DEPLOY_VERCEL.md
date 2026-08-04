# Deploy VeoTV en Vercel

## 1. Base de datos (obligatoria)

SQLite ya no se usa. Crea Postgres gratis:

1. Entra en https://neon.tech → crea proyecto
2. Copia la connection string (`postgresql://...`)
3. En Vercel → Settings → **Environment Variables** pégala como `DATABASE_URL`
   (Production + Preview + Development)

Local (opcional):

```bash
npm run db:up
# luego en .env.local:
# DATABASE_URL="postgresql://styleflix:styleflix@localhost:5432/styleflix"
npm run db:setup
```

## 2. Variables en Vercel

| Variable | Ejemplo |
|----------|---------|
| `NEXT_PUBLIC_TMDB_API_KEY` | tu key TMDB |
| `NEXT_PUBLIC_VIMEUS_VIEW_KEY` | view key |
| `VIMEUS_API_KEY` | api key |
| `AUTH_SECRET` | secreto largo |
| `AUTH_URL` | `https://TU-APP.vercel.app` |
| `DATABASE_URL` | `postgresql://...` (Neon) |

El repo **ya es** la app Next (no pongas Root Directory `netflix-clone` si el GitHub es `Styleflix` con el código en la raíz).

## 3. Redeploy

Tras guardar las variables: **Deployments → Redeploy** (o push a `master`).

El build ejecuta `prisma db push` + seed del admin automáticamente.
