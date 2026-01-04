# syntax=docker.io/docker/dockerfile:1
FROM node:23.11.0-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the prisma models
RUN npx prisma generate


ENV NODE_ENV=production
ENV NEXT_PRIVATE_STANDALONE=true

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Compile the seed.ts file to seed.js if it exists
RUN if [ -f prisma/seed.ts ]; then \
      echo "🔨 Compiling seed.ts to seed.js..."; \
      cd prisma && npx tsc seed.ts --target ES2020 --module commonjs --skipLibCheck --moduleResolution node --esModuleInterop --outDir ./; \
      echo "✅ Compilation complete. Files in prisma:"; \
      ls -la .; \
    else \
      echo "No seed.ts file found, skipping compilation."; \
      echo "No seed.ts file found, skipping compilation."; \
    fi

# Compile repair.ts
RUN if [ -f prisma/repair.ts ]; then \
      echo "🔨 Compiling repair.ts to repair.js..."; \
      npx tsc prisma/repair.ts --target ES2020 --module commonjs --skipLibCheck --moduleResolution node --esModuleInterop --outDir ./prisma/; \
    fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Uncomment the following line in case you want to disable telemetry during runtime.
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma schema and migrations
COPY --from=builder /app/prisma/seed.js ./prisma/
COPY --from=builder /app/prisma/repair.js ./prisma/
COPY --from=builder /app/prisma/schema.prisma ./prisma/
COPY --from=builder /app/prisma/migrations ./prisma/migrations

# Create directory for config and Prisma
RUN npm install -g prisma@6.7.0
RUN mkdir -p /config /app/prisma

# Copy start script
COPY init.sh /app/init.sh
RUN chmod +x /app/init.sh

EXPOSE 3000
ENV PORT=3000
ENV DATABASE_URL="file:/app/prisma/dev.db"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["/app/init.sh"]