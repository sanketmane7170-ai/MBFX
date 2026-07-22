# MoneyBank FX — API (NestJS). Build context = repo root (pnpm workspace).
FROM node:20-bookworm-slim

WORKDIR /app
# Prisma needs OpenSSL at runtime (slim image omits it).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@9.15.9

# Copy the whole workspace (node_modules/dist/.env excluded via .dockerignore).
COPY . .

# Install (pnpm 9 runs native build scripts by default: argon2, prisma engine).
RUN pnpm install --no-frozen-lockfile \
 && pnpm --filter @tcp/api exec prisma generate \
 && pnpm --filter @tcp/api build

WORKDIR /app/apps/api
EXPOSE 3000

# Apply migrations, then start. Super admin is seeded on first boot from env.
CMD ["sh", "-lc", "pnpm exec prisma migrate deploy && node dist/main.js"]
