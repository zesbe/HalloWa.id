/**
 * Universal Redis Client for HalloWa.id
 *
 * Auto-detects and supports:
 * 1. Redis Local (TCP via ioredis) - RECOMMENDED for VPS
 * 2. Upstash Redis (REST API) - for serverless/cloud
 *
 * Priority: TCP > REST API
 */

const Redis = require('ioredis');

// Environment variables
const REDIS_TCP_URL = process.env.UPSTASH_REDIS_URL; // Works for both Upstash & local Redis
const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

class UniversalRedisClient {
  constructor() {
    this.mode = null;
    this.client = null;
    this.enabled = false;

    // Priority 1: Try TCP connection (local or Upstash TCP)
    if (REDIS_TCP_URL) {
      this.initTCPClient();
    }
    // Priority 2: Fallback to REST API (Upstash only)
    else if (REDIS_REST_URL && REDIS_REST_TOKEN) {
      this.initRESTClient();
    }
    // No Redis configured
    else {
      console.warn('⚠️  No Redis configured - Redis features will be disabled');
      console.warn('💡 Set UPSTASH_REDIS_URL for Redis local/TCP');
      console.warn('💡 Or set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for REST API');
    }
  }

  /**
   * Initialize TCP client (ioredis)
   * Works for both local Redis and Upstash TCP
   */
  initTCPClient() {
    try {
      this.client = new Redis(REDIS_TCP_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
        retryStrategy: (times) => {
          const delay = Math.min(times * 100, 10000);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
          return targetErrors.some(e => err.message.includes(e));
        },
        // TLS for rediss:// URLs (Upstash)
        tls: REDIS_TCP_URL.startsWith('rediss://') ? {
          rejectUnauthorized: true,
        } : undefined,
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('✅ Redis connected via TCP (ioredis)');
        const isLocal = REDIS_TCP_URL.includes('127.0.0.1') || REDIS_TCP_URL.includes('localhost');
        console.log(`   Mode: ${isLocal ? 'LOCAL' : 'REMOTE'} Redis`);
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready for operations');
        this.enabled = true;
        this.mode = 'TCP';
      });

      this.client.on('error', (err) => {
        // Security: Don't log connection strings
        const safeMessage = err.message.replace(/redis[s]?:\/\/[^@]*@/, 'redis://***:***@');
        console.error('❌ Redis TCP error:', safeMessage);
      });

      this.client.on('close', () => {
        console.log('⚠️  Redis TCP connection closed');
        this.enabled = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

    } catch (error) {
      console.error('❌ Failed to initialize TCP Redis:', error.message);
      this.client = null;
    }
  }

  /**
   * Initialize REST API client (Upstash only)
   */
  initRESTClient() {
    this.baseUrl = REDIS_REST_URL;
    this.token = REDIS_REST_TOKEN;
    this.mode = 'REST';
    this.enabled = true;
    console.log('✅ Redis initialized via REST API (Upstash)');
  }

  /**
   * Execute Redis command
   * Auto-routes to TCP or REST based on mode
   */
  async execute(command) {
    if (!this.enabled) {
      return null;
    }

    try {
      if (this.mode === 'TCP') {
        return await this.executeTCP(command);
      } else if (this.mode === 'REST') {
        return await this.executeREST(command);
      }
    } catch (error) {
      console.error('Redis execute error:', error.message);
      return null;
    }
  }

  /**
   * Execute command via TCP (ioredis)
   */
  async executeTCP(command) {
    if (!this.client || !this.client.status || this.client.status !== 'ready') {
      console.warn('Redis TCP not ready');
      return null;
    }

    const [cmd, ...args] = command;
    return await this.client[cmd.toLowerCase()](...args);
  }

  /**
   * Execute command via REST API
   */
  async executeREST(command) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis REST error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  // ========================================
  // QR Code Management
  // ========================================
  async setQRCode(deviceId, qrCode, ttl = 600) {
    if (!this.enabled) return false;
    try {
      const key = `qr:${deviceId}`;
      const result = await this.execute(['SET', key, qrCode, 'EX', ttl]);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setQRCode error:', error);
      return false;
    }
  }

  async getQRCode(deviceId) {
    if (!this.enabled) return null;
    const key = `qr:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deleteQRCode(deviceId) {
    if (!this.enabled) return;
    const key = `qr:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // ========================================
  // Pairing Code Management
  // ========================================
  async setPairingCode(deviceId, pairingCode, ttl = 600) {
    if (!this.enabled) return false;
    try {
      const key = `pairing:${deviceId}`;
      const result = await this.execute(['SET', key, pairingCode, 'EX', ttl]);
      return result === 'OK';
    } catch (error) {
      console.error('Redis setPairingCode error:', error);
      return false;
    }
  }

  async getPairingCode(deviceId) {
    if (!this.enabled) return null;
    const key = `pairing:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deletePairingCode(deviceId) {
    if (!this.enabled) return;
    const key = `pairing:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // ========================================
  // Device Cleanup
  // ========================================
  async cleanupDevice(deviceId) {
    if (!this.enabled) return;
    await Promise.all([
      this.deleteQRCode(deviceId),
      this.deletePairingCode(deviceId),
    ]);
  }

  // ========================================
  // Rate Limiting (Distributed)
  // ========================================
  async checkRateLimit(identifier, maxRequests = 100, windowSeconds = 60) {
    if (!this.enabled) {
      console.warn('Redis disabled - rate limiting skipped');
      return true;
    }

    try {
      const key = `ratelimit:${identifier}`;

      // INCR is atomic in both TCP and REST
      const count = await this.execute(['INCR', key]);

      if (count === 1) {
        await this.execute(['EXPIRE', key, windowSeconds]);
      }

      if (count > maxRequests) {
        console.log(`⚠️  Rate limit exceeded for ${identifier}: ${count}/${maxRequests}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Redis rate limit error:', error);
      return true; // Fail open
    }
  }

  async getRateLimitCount(identifier) {
    if (!this.enabled) return 0;
    try {
      const key = `ratelimit:${identifier}`;
      const count = await this.execute(['GET', key]);
      return parseInt(count) || 0;
    } catch (error) {
      console.error('Redis get rate limit error:', error);
      return 0;
    }
  }

  async resetRateLimit(identifier) {
    if (!this.enabled) return;
    try {
      const key = `ratelimit:${identifier}`;
      await this.execute(['DEL', key]);
      console.log(`Rate limit reset for ${identifier}`);
    } catch (error) {
      console.error('Redis reset rate limit error:', error);
    }
  }

  // ========================================
  // Cache Management
  // ========================================
  async cacheSet(key, value, ttl = 3600) {
    if (!this.enabled) return false;
    try {
      const cacheKey = `cache:${key}`;
      const serialized = JSON.stringify(value);
      const result = await this.execute(['SET', cacheKey, serialized, 'EX', ttl]);
      return result === 'OK';
    } catch (error) {
      console.error('Redis cacheSet error:', error);
      return false;
    }
  }

  async cacheGet(key) {
    if (!this.enabled) return null;
    try {
      const cacheKey = `cache:${key}`;
      const cached = await this.execute(['GET', cacheKey]);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (error) {
      console.error('Redis cacheGet error:', error);
      return null;
    }
  }

  async cacheDelete(key) {
    if (!this.enabled) return;
    try {
      const cacheKey = `cache:${key}`;
      await this.execute(['DEL', cacheKey]);
    } catch (error) {
      console.error('Redis cacheDelete error:', error);
    }
  }

  async cacheExists(key) {
    if (!this.enabled) return false;
    try {
      const cacheKey = `cache:${key}`;
      const exists = await this.execute(['EXISTS', cacheKey]);
      return exists === 1;
    } catch (error) {
      console.error('Redis cacheExists error:', error);
      return false;
    }
  }

  async cacheClearPattern(pattern) {
    if (!this.enabled) return;
    try {
      const cachePattern = `cache:${pattern}`;

      if (this.mode === 'TCP') {
        // Use SCAN for safer operation on production
        const stream = this.client.scanStream({
          match: cachePattern,
          count: 100
        });

        const keys = [];
        stream.on('data', (resultKeys) => {
          keys.push(...resultKeys);
        });

        stream.on('end', async () => {
          if (keys.length > 0) {
            await this.client.del(...keys);
            console.log(`🗑️  Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
          }
        });
      } else {
        // REST API uses KEYS (less efficient but works)
        const keys = await this.execute(['KEYS', cachePattern]);
        if (keys && keys.length > 0) {
          await this.execute(['DEL', ...keys]);
          console.log(`🗑️  Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
        }
      }
    } catch (error) {
      console.error('Redis cacheClearPattern error:', error);
    }
  }

  // ========================================
  // Health Check
  // ========================================
  async ping() {
    if (!this.enabled) return false;
    try {
      const result = await this.execute(['PING']);
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async getInfo() {
    if (!this.enabled) return null;
    try {
      if (this.mode === 'TCP') {
        return await this.client.info();
      } else {
        // REST API may not support INFO command
        return 'INFO not available in REST mode';
      }
    } catch (error) {
      return null;
    }
  }

  // ========================================
  // Graceful Shutdown
  // ========================================
  async disconnect() {
    if (this.mode === 'TCP' && this.client) {
      console.log('Disconnecting Redis TCP...');
      await this.client.quit();
    }
    this.enabled = false;
  }
}

// Export singleton instance
module.exports = new UniversalRedisClient();
