# StyleFlix

Streaming (películas, series, animes) con Next.js, TMDB, Vimeus y auth.

## Local

```bash
cp .env.example .env.local
# Completa TMDB + Vimeus + AUTH_SECRET

# Postgres local (Docker Desktop abierto):
npm run db:up
npm run db:setup

npm run dev
```

## Vercel

Sigue **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)**:

1. Variables: `NEXT_PUBLIC_TMDB_API_KEY`, Vimeus, `AUTH_SECRET`, `AUTH_URL`, `DATABASE_URL` (Neon Postgres)
2. Redeploy

Sin `DATABASE_URL` Postgres el catálogo puede desplegarse; login/historial requieren Neon.
