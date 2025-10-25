/**
 * Redis Upstash Client for WhatsApp Session Management
 * Handles session data, QR codes, and pairing codes
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

class RedisClient {
  constructor() {
    if (!REDIS_URL || !REDIS_TOKEN) {
      throw new Error('Redis credentials not configured');
    }
    this.baseUrl = REDIS_URL;
    this.token = REDIS_TOKEN;
  }

  async execute(command) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`Redis error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  // Session Management
  async setSession(deviceId, sessionData, ttl = 86400) {
    // TTL default 24 hours
    const key = `session:${deviceId}`;
    await this.execute(['SET', key, JSON.stringify(sessionData), 'EX', ttl]);
  }

  async getSession(deviceId) {
    const key = `session:${deviceId}`;
    const data = await this.execute(['GET', key]);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(deviceId) {
    const key = `session:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // QR Code Management
  async setQRCode(deviceId, qrCode, ttl = 300) {
    // TTL 5 minutes for QR codes
    const key = `qr:${deviceId}`;
    await this.execute(['SET', key, qrCode, 'EX', ttl]);
  }

  async getQRCode(deviceId) {
    const key = `qr:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deleteQRCode(deviceId) {
    const key = `qr:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Pairing Code Management
  async setPairingCode(deviceId, pairingCode, ttl = 300) {
    // TTL 5 minutes for pairing codes
    const key = `pairing:${deviceId}`;
    await this.execute(['SET', key, pairingCode, 'EX', ttl]);
  }

  async getPairingCode(deviceId) {
    const key = `pairing:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  async deletePairingCode(deviceId) {
    const key = `pairing:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Connection Status
  async setConnectionStatus(deviceId, status, ttl = 3600) {
    // TTL 1 hour for status
    const key = `status:${deviceId}`;
    await this.execute(['SET', key, status, 'EX', ttl]);
  }

  async getConnectionStatus(deviceId) {
    const key = `status:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  // Pairing Request Tracking
  async setPairingRequest(deviceId, timestamp) {
    const key = `pairing_req:${deviceId}`;
    await this.execute(['SET', key, timestamp.toString(), 'EX', 60]);
  }

  async getPairingRequest(deviceId) {
    const key = `pairing_req:${deviceId}`;
    const data = await this.execute(['GET', key]);
    return data ? parseInt(data) : null;
  }

  async deletePairingRequest(deviceId) {
    const key = `pairing_req:${deviceId}`;
    await this.execute(['DEL', key]);
  }

  // Device Phone Number Cache
  async setDevicePhone(deviceId, phoneNumber, ttl = 86400) {
    const key = `phone:${deviceId}`;
    await this.execute(['SET', key, phoneNumber, 'EX', ttl]);
  }

  async getDevicePhone(deviceId) {
    const key = `phone:${deviceId}`;
    return await this.execute(['GET', key]);
  }

  // Cleanup all device data
  async cleanupDevice(deviceId) {
    await Promise.all([
      this.deleteSession(deviceId),
      this.deleteQRCode(deviceId),
      this.deletePairingCode(deviceId),
      this.deletePairingRequest(deviceId),
    ]);
  }
}

module.exports = new RedisClient();
