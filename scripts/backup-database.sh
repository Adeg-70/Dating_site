#!/bin/bash

# MongoDB Backup Script
set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mongo"
RETENTION_DAYS=7

# Create backup
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/$DATE"

# Compress backup
tar -czf "$BACKUP_DIR/$DATE.tar.gz" -C "$BACKUP_DIR" "$DATE"
rm -rf "$BACKUP_DIR/$DATE"

# Upload to S3 (if AWS credentials available)
if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
  aws s3 cp "$BACKUP_DIR/$DATE.tar.gz" "s3://your-backup-bucket/mongo/$DATE.tar.gz"
fi

# Clean up old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup completed: $BACKUP_DIR/$DATE.tar.gz"