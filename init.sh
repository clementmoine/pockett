#!/bin/sh
# Persist volume: /config/{dev.db,klarna-refresh-token,providers.json?}

if [ -f /config/klarna-refresh-token ]; then
  echo "🔑 Klarna refresh token found in /config"
  export KLARNA_REFRESH_TOKEN="$(tr -d '\n\r' </config/klarna-refresh-token)"
fi

# Optional pre-seeded providers dump
if [ -f /config/providers.json ]; then
  echo "📦 Linking providers.json from /config…"
  ln -sf /config/providers.json /app/prisma/providers.json
else
  echo "ℹ️  No providers.json in /config — sync via /setup or API"
fi

if [ ! -f /config/dev.db ]; then
  echo "🆕 No DB found, initializing in /config…"

  mkdir -p /config
  touch /config/dev.db
  ln -sf /config/dev.db /app/prisma/dev.db

  prisma generate
  prisma migrate deploy

  if [ -f /app/prisma/repair.js ]; then
    echo "🔧 Running DB repair…"
    node /app/prisma/repair.js
  fi

  if [ -f /app/prisma/seed.js ]; then
    echo "🌱 Running seed…"
    node /app/prisma/seed.js
  else
    echo "⚠️ No seed.js found"
  fi
else
  echo "✅ DB exists, linking to /app/prisma…"
  ln -sf /config/dev.db /app/prisma/dev.db
  export DATABASE_URL="file:/app/prisma/dev.db"
  prisma generate
  prisma migrate deploy

  if [ -f /app/prisma/repair.js ]; then
    echo "🔧 Running DB repair…"
    node /app/prisma/repair.js
  fi
fi

exec node server.js
