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

  npx prisma generate
  npx prisma migrate deploy

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
  npx prisma generate
  npx prisma migrate deploy
fi

# Start the application
exec node server.js