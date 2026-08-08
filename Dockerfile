# Coolify / VPS sin BuildKit — no usa --mount=type=cache (Nixpacks falla ahí).
# Mirror público de la imagen oficial (evita TLS timeout a registry-1.docker.io).
# Host tipico: i5-4460 (4c/4t) + 16 GB RAM.
# Runner: heap Node 6GB + UV_THREADPOOL_SIZE=4.
# En Coolify: VeoTV ~8–10g, Postgres ~2g, dejar ~3–4g a OS/Coolify/proxy.
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_TMDB_API_KEY
ARG NEXT_PUBLIC_VIMEUS_VIEW_KEY
ARG NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
ENV NEXT_PUBLIC_TMDB_API_KEY=$NEXT_PUBLIC_TMDB_API_KEY \
    NEXT_PUBLIC_VIMEUS_VIEW_KEY=$NEXT_PUBLIC_VIMEUS_VIEW_KEY \
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=$NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=6144

RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UV_THREADPOOL_SIZE=4 \
    NODE_OPTIONS=--max-old-space-size=6144

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# Standalone server (mucho más liviano que copiar node_modules completo)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json

# db-setup: solo Prisma CLI (seed es CJS, sin tsx/esbuild)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# bcryptjs para seed.cjs si standalone no lo empaquetó
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Atajos CLI (npx prisma no funciona bien en standalone)
RUN printf '%s\n' '#!/bin/sh' 'exec node /app/node_modules/prisma/build/index.js "$@"' > /usr/local/bin/prisma \
  && chmod +x /usr/local/bin/prisma \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/scripts/db-push.cjs "$@"' > /usr/local/bin/db-push \
  && chmod +x /usr/local/bin/db-push

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS -A "VeoTV-HealthCheck/1.0" http://127.0.0.1:3000/api/health || exit 1
# standalone genera server.js en la raíz del artefacto
CMD ["sh", "-c", "node scripts/db-setup.cjs && node server.js"]
