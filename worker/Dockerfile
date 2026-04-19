FROM node:20-alpine
WORKDIR /app

# Install deps first (layer-cached unless package.json changes)
COPY worker/package.json worker/package-lock.json* ./
RUN npm ci --omit=dev

# Copy worker source
COPY worker/index.ts ./

# Copy shared DB schema used by the worker
COPY src/lib/db/ ./src/lib/db/

CMD ["node_modules/.bin/tsx", "index.ts"]
