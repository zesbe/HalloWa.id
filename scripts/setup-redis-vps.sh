#!/bin/bash
# ========================================
# HalloWa.id - Redis Auto Installation Script
# ========================================
# Purpose: Automated Redis installation and configuration for VPS
# OS Support: Ubuntu 20.04+, Debian 11+
# Usage: bash setup-redis-vps.sh
# ========================================

set -e  # Exit on error

echo "🚀 HalloWa.id - Redis Auto Setup"
echo "=================================="
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root or with sudo"
   echo "   Try: sudo bash setup-redis-vps.sh"
   exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo "❌ Cannot detect OS. Please install Redis manually."
    exit 1
fi

echo "📋 Detected OS: $OS $VER"
echo ""

# Check if Redis already installed
if command -v redis-server &> /dev/null; then
    echo "⚠️  Redis is already installed!"
    redis-server --version
    read -p "Do you want to reconfigure it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Installation cancelled"
        exit 0
    fi
fi

# Update system
echo "📦 Updating package list..."
apt update -qq

# Install Redis
echo "📥 Installing Redis Server..."
apt install redis-server -y -qq

# Backup original config
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
echo "💾 Backing up original config..."
cp /etc/redis/redis.conf /etc/redis/redis.conf.backup_$TIMESTAMP

# Generate strong password (32 characters, URL-safe)
echo "🔐 Generating secure password..."
REDIS_PASSWORD=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-32)

# Get available RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
# Allocate 25% of RAM to Redis (max 2GB)
REDIS_RAM=$((TOTAL_RAM / 4))
if [ $REDIS_RAM -gt 2048 ]; then
    REDIS_RAM=2048
fi
if [ $REDIS_RAM -lt 256 ]; then
    REDIS_RAM=256
fi

echo "💾 Allocating ${REDIS_RAM}MB RAM for Redis (Total RAM: ${TOTAL_RAM}MB)"

# Configure Redis for production
echo "⚙️  Configuring Redis..."

# Bind to localhost only (security)
sed -i "s/^bind .*/bind 127.0.0.1 ::1/" /etc/redis/redis.conf

# Set password
sed -i "s/^# requirepass .*/requirepass $REDIS_PASSWORD/" /etc/redis/redis.conf

# Set max memory
sed -i "s/^# maxmemory .*/maxmemory ${REDIS_RAM}mb/" /etc/redis/redis.conf

# Set eviction policy (LRU for cache)
sed -i "s/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/" /etc/redis/redis.conf

# Disable RDB snapshots (we use PostgreSQL for persistence)
sed -i "s/^save 900 1/# save 900 1/" /etc/redis/redis.conf
sed -i "s/^save 300 10/# save 300 10/" /etc/redis/redis.conf
sed -i "s/^save 60 10000/# save 60 10000/" /etc/redis/redis.conf

# Enable AOF for better durability
sed -i "s/^appendonly no/appendonly yes/" /etc/redis/redis.conf
sed -i "s/^# appendfsync everysec/appendfsync everysec/" /etc/redis/redis.conf

# Set supervised systemd
sed -i "s/^supervised no/supervised systemd/" /etc/redis/redis.conf

# Optimize for performance
echo "# HalloWa.id Performance Optimizations" >> /etc/redis/redis.conf
echo "tcp-backlog 511" >> /etc/redis/redis.conf
echo "timeout 300" >> /etc/redis/redis.conf
echo "tcp-keepalive 60" >> /etc/redis/redis.conf

# Restart Redis
echo "🔄 Restarting Redis..."
systemctl restart redis-server
systemctl enable redis-server

# Wait for Redis to start
sleep 2

# Test connection
echo "🧪 Testing Redis connection..."
if redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping | grep -q "PONG"; then
    echo "✅ Redis connection successful!"
else
    echo "❌ Redis connection failed!"
    exit 1
fi

# Get Redis info
REDIS_VERSION=$(redis-server --version | awk '{print $3}' | cut -d'=' -f2)
REDIS_PORT=$(grep "^port" /etc/redis/redis.conf | awk '{print $2}')

# Display results
echo ""
echo "=========================================="
echo "✅ Redis Installation Completed!"
echo "=========================================="
echo ""
echo "Redis Configuration:"
echo "  Version: $REDIS_VERSION"
echo "  Host: 127.0.0.1"
echo "  Port: $REDIS_PORT"
echo "  Password: $REDIS_PASSWORD"
echo "  Max Memory: ${REDIS_RAM}MB"
echo "  Persistence: AOF (Append-Only File)"
echo ""
echo "=========================================="
echo "For HalloWa.id Backend (.env):"
echo "=========================================="
echo ""
echo "Add this to railway-service/.env:"
echo ""
echo "UPSTASH_REDIS_URL=redis://default:$REDIS_PASSWORD@127.0.0.1:$REDIS_PORT"
echo ""
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT Security Notes:"
echo "  - Password saved to: /root/.redis-password"
echo "  - Backup config: /etc/redis/redis.conf.backup_$TIMESTAMP"
echo "  - Redis only accessible from localhost (secure)"
echo "  - Save the password in a secure location!"
echo ""
echo "📊 Monitor Redis:"
echo "  - Status: systemctl status redis-server"
echo "  - Logs: journalctl -u redis-server -f"
echo "  - CLI: redis-cli -a '$REDIS_PASSWORD'"
echo ""
echo "✅ Done! Redis is ready for HalloWa.id"
echo ""

# Save password to file
mkdir -p /root/.hallowa
echo "$REDIS_PASSWORD" > /root/.hallowa/redis-password.txt
chmod 600 /root/.hallowa/redis-password.txt

# Save full config
cat > /root/.hallowa/redis-config.txt << EOF
HalloWa.id Redis Configuration
==============================
Installed: $(date)
Version: $REDIS_VERSION
Host: 127.0.0.1
Port: $REDIS_PORT
Password: $REDIS_PASSWORD
Max Memory: ${REDIS_RAM}MB

Environment Variable:
UPSTASH_REDIS_URL=redis://default:$REDIS_PASSWORD@127.0.0.1:$REDIS_PORT

Backup Location:
/etc/redis/redis.conf.backup_$TIMESTAMP
EOF

chmod 600 /root/.hallowa/redis-config.txt

echo "💾 Configuration saved to: /root/.hallowa/redis-config.txt"
echo ""
