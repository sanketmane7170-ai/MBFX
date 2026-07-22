# MoneyBank FX — Web (Vite/React) built and served by nginx. Context = repo root.
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@9.15.9
COPY . .
RUN pnpm install --no-frozen-lockfile \
 && pnpm --filter @tcp/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
