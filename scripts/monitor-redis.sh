#!/bin/bash
# ========================================
# HalloWa.id - Redis Monitoring Script
# ========================================
# Purpose: Monitor Redis health and performance
# Usage: bash monitor-redis.sh
#        bash monitor-redis.sh --watch (continuous monitoring)
# ========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load password from saved config
if [ -f /root/.hallowa/redis-password.txt ]; then
    REDIS_PASSWORD=$(cat /root/.hallowa/redis-password.txt)
else
    echo -e "${RED}❌ Redis password not found!${NC}"
    echo "Please run setup-redis-vps.sh first or set REDIS_PASSWORD environment variable"
    exit 1
fi

# Function to display Redis info
show_redis_info() {
    clear
    echo -e "${BLUE}=========================================="
    echo "HalloWa.id - Redis Monitor"
    echo "==========================================${NC}"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    # Check if Redis is running
    if ! systemctl is-active --quiet redis-server; then
        echo -e "${RED}❌ Redis is NOT running!${NC}"
        echo ""
        echo "Start Redis with: sudo systemctl start redis-server"
        return 1
    fi

    echo -e "${GREEN}✅ Redis is running${NC}"
    echo ""

    # Get Redis info
    REDIS_INFO=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning INFO)

    # Parse important metrics
    VERSION=$(echo "$REDIS_INFO" | grep "^redis_version:" | cut -d':' -f2 | tr -d '\r')
    UPTIME=$(echo "$REDIS_INFO" | grep "^uptime_in_seconds:" | cut -d':' -f2 | tr -d '\r')
    CONNECTED_CLIENTS=$(echo "$REDIS_INFO" | grep "^connected_clients:" | cut -d':' -f2 | tr -d '\r')
    USED_MEMORY=$(echo "$REDIS_INFO" | grep "^used_memory_human:" | cut -d':' -f2 | tr -d '\r')
    USED_MEMORY_PEAK=$(echo "$REDIS_INFO" | grep "^used_memory_peak_human:" | cut -d':' -f2 | tr -d '\r')
    TOTAL_COMMANDS=$(echo "$REDIS_INFO" | grep "^total_commands_processed:" | cut -d':' -f2 | tr -d '\r')
    KEYSPACE_HITS=$(echo "$REDIS_INFO" | grep "^keyspace_hits:" | cut -d':' -f2 | tr -d '\r')
    KEYSPACE_MISSES=$(echo "$REDIS_INFO" | grep "^keyspace_misses:" | cut -d':' -f2 | tr -d '\r')
    EVICTED_KEYS=$(echo "$REDIS_INFO" | grep "^evicted_keys:" | cut -d':' -f2 | tr -d '\r')

    # Calculate uptime in human readable format
    UPTIME_DAYS=$((UPTIME / 86400))
    UPTIME_HOURS=$(((UPTIME % 86400) / 3600))
    UPTIME_MINS=$(((UPTIME % 3600) / 60))

    # Calculate hit rate
    if [ "$KEYSPACE_HITS" != "" ] && [ "$KEYSPACE_MISSES" != "" ]; then
        TOTAL_HITS=$((KEYSPACE_HITS + KEYSPACE_MISSES))
        if [ $TOTAL_HITS -gt 0 ]; then
            HIT_RATE=$(awk "BEGIN {printf \"%.2f\", ($KEYSPACE_HITS / $TOTAL_HITS) * 100}")
        else
            HIT_RATE="0.00"
        fi
    else
        HIT_RATE="N/A"
    fi

    # Display metrics
    echo -e "${BLUE}📊 General Info:${NC}"
    echo "  Version: $VERSION"
    echo "  Uptime: ${UPTIME_DAYS}d ${UPTIME_HOURS}h ${UPTIME_MINS}m"
    echo ""

    echo -e "${BLUE}👥 Connections:${NC}"
    if [ "$CONNECTED_CLIENTS" -gt 10 ]; then
        echo -e "  Connected Clients: ${YELLOW}$CONNECTED_CLIENTS${NC} (high)"
    else
        echo -e "  Connected Clients: ${GREEN}$CONNECTED_CLIENTS${NC}"
    fi
    echo ""

    echo -e "${BLUE}💾 Memory:${NC}"
    echo "  Used Memory: $USED_MEMORY"
    echo "  Peak Memory: $USED_MEMORY_PEAK"
    echo ""

    echo -e "${BLUE}⚡ Performance:${NC}"
    echo "  Total Commands: $TOTAL_COMMANDS"
    echo "  Cache Hits: $KEYSPACE_HITS"
    echo "  Cache Misses: $KEYSPACE_MISSES"
    if [ "$HIT_RATE" != "N/A" ]; then
        if (( $(echo "$HIT_RATE < 50" | bc -l) )); then
            echo -e "  Hit Rate: ${RED}${HIT_RATE}%${NC} (low - consider optimizing)"
        elif (( $(echo "$HIT_RATE < 80" | bc -l) )); then
            echo -e "  Hit Rate: ${YELLOW}${HIT_RATE}%${NC} (medium)"
        else
            echo -e "  Hit Rate: ${GREEN}${HIT_RATE}%${NC} (good)"
        fi
    fi
    echo "  Evicted Keys: $EVICTED_KEYS"
    echo ""

    # Show key count per database
    echo -e "${BLUE}🗄️  Database Keys:${NC}"
    DB_INFO=$(echo "$REDIS_INFO" | grep "^db[0-9]:")
    if [ -z "$DB_INFO" ]; then
        echo "  No keys stored"
    else
        echo "$DB_INFO" | while read -r line; do
            DB_NUM=$(echo "$line" | cut -d':' -f1)
            KEY_COUNT=$(echo "$line" | cut -d'=' -f2 | cut -d',' -f1)
            echo "  $DB_NUM: $KEY_COUNT keys"
        done
    fi
    echo ""

    # Show recent keys (sample)
    echo -e "${BLUE}🔑 Sample Keys (last 10):${NC}"
    redis-cli -a "$REDIS_PASSWORD" --no-auth-warning --scan --count 10 | head -10 | while read -r key; do
        KEY_TYPE=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning TYPE "$key" | tr -d '\r')
        KEY_TTL=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning TTL "$key" | tr -d '\r')
        if [ "$KEY_TTL" == "-1" ]; then
            TTL_STR="no expiry"
        elif [ "$KEY_TTL" == "-2" ]; then
            TTL_STR="expired"
        else
            TTL_STR="${KEY_TTL}s"
        fi
        echo "  - $key ($KEY_TYPE, TTL: $TTL_STR)"
    done
    echo ""

    # Health check
    echo -e "${BLUE}🏥 Health Status:${NC}"
    PING_RESULT=$(redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping)
    if [ "$PING_RESULT" == "PONG" ]; then
        echo -e "  Status: ${GREEN}✅ Healthy${NC}"
    else
        echo -e "  Status: ${RED}❌ Unhealthy${NC}"
    fi
    echo ""

    # System resource usage
    echo -e "${BLUE}🖥️  System Resources:${NC}"
    CPU_USAGE=$(ps aux | grep redis-server | grep -v grep | awk '{print $3}')
    MEM_USAGE=$(ps aux | grep redis-server | grep -v grep | awk '{print $4}')
    echo "  CPU Usage: ${CPU_USAGE}%"
    echo "  Memory Usage: ${MEM_USAGE}%"
    echo ""

    echo -e "${BLUE}==========================================${NC}"
}

# Main script
if [ "$1" == "--watch" ]; then
    echo "Starting continuous monitoring (Ctrl+C to exit)..."
    sleep 2
    while true; do
        show_redis_info
        echo "Refreshing in 5 seconds... (Ctrl+C to exit)"
        sleep 5
    done
else
    show_redis_info
    echo ""
    echo "💡 Tip: Use 'bash monitor-redis.sh --watch' for continuous monitoring"
    echo ""
fi
