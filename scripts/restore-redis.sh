#!/bin/bash
# ========================================
# HalloWa.id - Redis Restore Script
# ========================================
# Purpose: Restore Redis from backup
# Usage: bash restore-redis.sh <backup-file>
# Example: bash restore-redis.sh /root/backups/redis/redis_backup_20250117_020000.tar.gz
# ========================================

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check argument
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: bash restore-redis.sh <backup-file>${NC}"
    echo ""
    echo "Available backups:"
    ls -lh /root/backups/redis/redis_backup_*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will restore Redis data from backup!${NC}"
echo "  Backup file: $BACKUP_FILE"
echo "  Current data will be overwritten!"
echo ""
read -p "Are you sure? (type 'yes' to continue): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Load password
if [ -f /root/.hallowa/redis-password.txt ]; then
    REDIS_PASSWORD=$(cat /root/.hallowa/redis-password.txt)
else
    echo -e "${RED}❌ Redis password not found!${NC}"
    exit 1
fi

# Stop Redis
echo "🛑 Stopping Redis..."
systemctl stop redis-server

# Find Redis data directory
REDIS_DIR=$(grep "^dir " /etc/redis/redis.conf | awk '{print $2}')
if [ -z "$REDIS_DIR" ]; then
    REDIS_DIR="/var/lib/redis"
fi

# Backup current data (just in case)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "💾 Backing up current data..."
mkdir -p /root/backups/redis/pre-restore
tar -czf "/root/backups/redis/pre-restore/pre_restore_$TIMESTAMP.tar.gz" \
    -C "$REDIS_DIR" dump.rdb appendonly.aof 2>/dev/null

# Extract backup
echo "📦 Extracting backup..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Restore data files
echo "🔄 Restoring data files..."
if [ -f "$TEMP_DIR/dump.rdb" ]; then
    cp "$TEMP_DIR/dump.rdb" "$REDIS_DIR/dump.rdb"
    chown redis:redis "$REDIS_DIR/dump.rdb"
    echo "  ✅ dump.rdb restored"
fi

if [ -f "$TEMP_DIR/appendonly.aof" ]; then
    cp "$TEMP_DIR/appendonly.aof" "$REDIS_DIR/appendonly.aof"
    chown redis:redis "$REDIS_DIR/appendonly.aof"
    echo "  ✅ appendonly.aof restored"
fi

# Restore config (optional, with confirmation)
if [ -f "$TEMP_DIR/redis.conf" ]; then
    echo ""
    read -p "Restore redis.conf as well? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp /etc/redis/redis.conf "/etc/redis/redis.conf.backup_$TIMESTAMP"
        cp "$TEMP_DIR/redis.conf" /etc/redis/redis.conf
        echo "  ✅ redis.conf restored (old config backed up)"
    fi
fi

# Cleanup temp
rm -rf "$TEMP_DIR"

# Start Redis
echo "▶️  Starting Redis..."
systemctl start redis-server

# Wait for Redis to start
sleep 2

# Verify
echo "🧪 Verifying Redis..."
if redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ Restore completed successfully!${NC}"

    # Show key count
    KEY_COUNT=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning DBSIZE)
    echo "  Keys restored: $KEY_COUNT"
else
    echo -e "${RED}❌ Restore failed! Redis is not responding.${NC}"
    echo "  Attempting to restore from pre-restore backup..."
    systemctl stop redis-server
    tar -xzf "/root/backups/redis/pre-restore/pre_restore_$TIMESTAMP.tar.gz" -C "$REDIS_DIR"
    chown redis:redis "$REDIS_DIR"/*
    systemctl start redis-server
    exit 1
fi

echo ""
echo "✅ Restore process completed!"
echo "  Pre-restore backup saved to: /root/backups/redis/pre-restore/pre_restore_$TIMESTAMP.tar.gz"
