# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package.json package-lock.json ./
RUN npm ci --registry="$NPM_REGISTRY" --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
# Only so modules can be evaluated while prerendering; the runtime image reads the real secret from its environment.
ENV NEXT_TELEMETRY_DISABLED=1 \
    BETTER_AUTH_SECRET=build-stage-only-not-a-runtime-secret
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/pglite \
    MIGRATIONS_PATH=/app/drizzle
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
