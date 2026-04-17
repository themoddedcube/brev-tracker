# --- Build stage ---------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Build deps for better-sqlite3 native module
RUN apt-get update -y && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install all deps (including dev) — needed for tsc + vite
COPY package.json package-lock.json* ./
RUN npm ci

# Copy sources and build both client (Vite → dist/client) and server (tsc → dist/server)
COPY tsconfig.json tsconfig.server.json ./
COPY server ./server
COPY client ./client
RUN npm run build

# Prune dev dependencies for a smaller runtime image
RUN npm prune --omit=dev

# --- Runtime stage -------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# better-sqlite3 ships prebuilt binaries for glibc Linux — no compiler needed
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Persistent SQLite lives in /app/data.
# On Railway: attach a volume in the service UI with mount path /app/data.
# On plain docker run: pass `-v brev_data:/app/data`.
RUN mkdir -p /app/data

# Railway sets $PORT; default for local docker run
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/server/index.js"]
