# VeoTV

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

## Deploy (Coolify)

**Importante:** este servidor Docker **no tiene BuildKit**. Usa el pack **Dockerfile** (no Nixpacks).
Nixpacks genera `RUN --mount=type=cache` y el build se cuelga / falla en `npm ci`.

1. Application → **Build Pack = Dockerfile** (o “Dockerfile” detectado)
2. Branch: `main`
3. Variables: `NEXT_PUBLIC_TMDB_API_KEY`, Vimeus, `AUTH_SECRET`, `AUTH_URL=https://veotv.cloud`, `DATABASE_URL`
4. En Coolify → Domains: `veotv.cloud` (HTTPS) apuntando a esta app
5. Membresía Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`, `MEMBERSHIP_PRICE_CLP=4990`, `RESELLER_PRICE_CLP=2990`
6. Webhook MP → `https://veotv.cloud/api/billing/webhook`

- **Directo** $4.990/mes vía Mercado Pago.
- **Revendedor** $2.990: el admin crea cuentas `PREPAID`; los días corren al **primer login** del cliente.
- Registro público en `/login` → Crear cuenta. Sin membresía: catálogo + **5 min** de preview, luego invitación a pagar.
- `SUPER_ADMIN` bypasea el paywall.
