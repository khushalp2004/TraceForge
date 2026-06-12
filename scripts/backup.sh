#!/bin/bash

# TraceForge Automated Local Backup Script
# This script creates a compressed backup of the database and keeps the last 15 days.

# Change to the directory where docker-compose.yml and .env are located
cd "$(dirname "$0")/.."

# Load environment variables from .env
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "Error: .env file not found!"
  exit 1
fi

# Ensure POSTGRES_USER and POSTGRES_DB are set
DB_USER=${POSTGRES_USER:-postgres}
DB_NAME=${POSTGRES_DB:-traceforge_db}

# Setup backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Generate a timestamped filename
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/traceforge_db_$TIMESTAMP.sql.gz"

echo "Starting backup for database '$DB_NAME'..."

# Execute pg_dump inside the container and compress it
docker exec -t traceforge-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Backup successfully created: $BACKUP_FILE"
else
  echo "Error: Database backup failed!"
  exit 1
fi

# Delete backups older than 15 days to save SSD space
echo "Cleaning up backups older than 15 days..."
find "$BACKUP_DIR" -type f -name "traceforge_db_*.sql.gz" -mtime +15 -exec rm {} \;

echo "Backup process complete!"
