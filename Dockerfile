# Coolify / VPS sin BuildKit — no usa --mount=type=cache (Nixpacks falla ahí).
# Mirror público de la imagen oficial (evita TLS timeout a registry-1.docker.io).
# Runner usa Next standalone (+ prisma/tsx) para no exportar node_modules gigante.
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:22-bookworm-slim

FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
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
    NODE_OPTIONS=--max-old-space-size=3072

RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS=--max-old-space-size=768

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
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
# standalone genera server.js en la raíz del artefacto
CMD ["sh", "-c", "node scripts/db-setup.cjs && node server.js"]
