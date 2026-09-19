#!/bin/bash
set -e

echo "Starting TraceForge deployment..."

# Ensure we are in the right directory
cd "$(dirname "$0")"

# Build and start the containers in detached mode
docker compose -f docker-compose.yml up -d --build

# Wait for database to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 15

# Run Prisma migrations using the backend container
echo "Running database migrations..."
docker compose exec -T backend npm run prisma:migrate:deploy

echo "Deployment complete! TraceForge is now running."
