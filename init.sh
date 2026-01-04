#!/bin/sh
# 📦 Copy providers.json if it exists in the mounted volume
if [ -f /config/providers.json ]; then
  echo "📦 Copying providers.json from /config to /app/prisma..."
  ln -sf /config/providers.json /app/prisma/providers.json
else
  echo "⚠️ No providers.json found in /config, skipping copy"
fi

if [ ! -f /config/dev.db ]; then
  echo "🆕 No DB found, initializing directly in /config..."
  
  mkdir -p /config
  touch /config/dev.db
  ln -sf /config/dev.db /app/prisma/dev.db

  prisma generate
  prisma migrate deploy

  # Run repair to fix any corrupted JSON from crashes/miners
  if [ -f /app/prisma/repair.js ]; then
    echo "🔧 Running DB repair..."
    node /app/prisma/repair.js
  fi

  if [ -f /app/prisma/seed.js ]; then
    echo "🌱 Running seed..."
    node /app/prisma/seed.js
  else
    echo "⚠️ No seed.js found"
  fi
else
  echo "✅ DB exists, linking to /app/prisma..."
  ln -sf /config/dev.db /app/prisma/dev.db
  export DATABASE_URL="file:/app/prisma/dev.db"
  prisma generate
  prisma generate
  prisma migrate deploy
  
  if [ -f /app/prisma/repair.js ]; then
    echo "🔧 Running DB repair..."
    node /app/prisma/repair.js
  fi
fi

# Start the application
exec node server.js