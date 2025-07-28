#!/bin/sh
# 📦 Copy providers.json if it exists in the mounted volume
if [ -f /config/providers.json ]; then
  echo "📦 Copying providers.json from /config to /app/prisma..."
  ln -sf /config/providers.json /app/prisma/providers.json
else
  echo "⚠️ No providers.json found in /config, skipping copy"
fi

if [ ! -f /config/dev.db ]; then
  echo "Database not found in volume, initializing..."
  npx prisma generate
  npx prisma migrate deploy
  ln -sf /app/prisma/dev.db /config/dev.db
  
  # Use the compiled JavaScript seed file
  if [ -f /app/prisma/seed.js ]; then
    echo "🌱 Running database seed..."
    node /app/prisma/seed.js
  else
    echo "⚠️ No seed.js file found, skipping seeding"
  fi
else
  ln -sf /config/dev.db /app/prisma/dev.db
  npx prisma generate
  npx prisma migrate deploy
fi

# Start the application
exec node server.js