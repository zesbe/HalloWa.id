#!/bin/bash
# ========================================
# HalloWa.id - Redis Backup Script
# ========================================
# Purpose: Backup Redis data and configuration
# Usage: bash backup-redis.sh
# Cron: 0 2 * * * /root/scripts/backup-redis.sh (daily at 2 AM)
# ========================================

# Configuration
BACKUP_DIR="/root/backups/redis"
RETENTION_DAYS=7  # Keep backups for 7 days
DATE=$(date +%Y%m%d_%H%M%S)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔄 Starting Redis backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load password
if [ -f /root/.hallowa/redis-password.txt ]; then
    REDIS_PASSWORD=$(cat /root/.hallowa/redis-password.txt)
else
    echo -e "${RED}❌ Redis password not found!${NC}"
    exit 1
fi

# Check if Redis is running
if ! systemctl is-active --quiet redis-server; then
    echo -e "${RED}❌ Redis is not running!${NC}"
    exit 1
fi

# Trigger Redis save
echo "💾 Triggering Redis BGSAVE..."
redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE

# Wait for save to complete
sleep 2
while [ "$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)" == "$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)" ]; do
    sleep 1
done

# Find Redis data directory
REDIS_DIR=$(grep "^dir " /etc/redis/redis.conf | awk '{print $2}')
if [ -z "$REDIS_DIR" ]; then
    REDIS_DIR="/var/lib/redis"
fi

# Backup files
BACKUP_FILE="$BACKUP_DIR/redis_backup_$DATE.tar.gz"

echo "📦 Creating backup archive..."
tar -czf "$BACKUP_FILE" \
    -C "$REDIS_DIR" dump.rdb appendonly.aof \
    -C /etc/redis redis.conf \
    2>/dev/null

# Check if backup was successful
if [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✅ Backup created successfully!${NC}"
    echo "  Location: $BACKUP_FILE"
    echo "  Size: $BACKUP_SIZE"

    # Save backup info
    echo "$DATE|$BACKUP_FILE|$BACKUP_SIZE" >> "$BACKUP_DIR/backup_log.txt"
else
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Cleanup old backups
echo "🗑️  Cleaning up old backups (older than $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "redis_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

REMAINING=$(find "$BACKUP_DIR" -name "redis_backup_*.tar.gz" | wc -l)
echo -e "${GREEN}✅ Cleanup complete. $REMAINING backup(s) remaining.${NC}"

# Display recent backups
echo ""
echo "📋 Recent backups:"
ls -lh "$BACKUP_DIR"/redis_backup_*.tar.gz 2>/dev/null | tail -5 | awk '{print "  " $9 " - " $5}'

echo ""
echo "✅ Backup process completed!"
