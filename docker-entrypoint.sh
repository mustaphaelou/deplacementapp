#!/bin/sh
set -e

echo "==> Running database migrations..."
npx prisma migrate deploy

echo "==> Seeding reference data..."
node prisma/seed-production.js

echo "==> Starting application..."
node server.js
