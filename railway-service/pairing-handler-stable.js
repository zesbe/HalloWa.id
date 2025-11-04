/**
 * Stable Pairing Handler
 * Simplified and reliable pairing code implementation
 */

const redis = require('./redis-client');

class StablePairingHandler {
  constructor() {
    this.activeSessions = new Map();
  }

  /**
   * Generate pairing code
   */
  async generatePairingCode(sock, device, supabase) {
    const deviceId = device.id;
    const deviceName = device.device_name || 'Unknown';
    
    try {
      // Check if already has active session
      if (this.hasActiveSession(deviceId)) {
        console.log(`⏱️ [${deviceName}] Already has active pairing session`);
        return false;
      }
      
      // Mark session as active
      this.activeSessions.set(deviceId, Date.now());
      
      // Get phone number
      const { data, error } = await supabase
        .from('devices')
        .select('phone_for_pairing, connection_method')
        .eq('id', deviceId)
        .single();
        
      if (error || !data || data.connection_method !== 'pairing' || !data.phone_for_pairing) {
        console.log(`❌ [${deviceName}] No pairing phone configured`);
        this.activeSessions.delete(deviceId);
        return false;
      }
      
      // Format phone number
      const phone = this.formatPhoneNumber(data.phone_for_pairing);
      if (!phone) {
        console.error(`❌ [${deviceName}] Invalid phone format: ${data.phone_for_pairing}`);
        this.activeSessions.delete(deviceId);
        return false;
      }
      
      console.log(`📱 [${deviceName}] Requesting pairing code for: ${phone}`);
      
      // Wait for socket to be ready
      await this.waitForSocket(sock, 3000);
      
      // Request pairing code
      let pairingCode;
      try {
        // Use proper timeout
        const codePromise = sock.requestPairingCode(phone);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 20000)
        );
        
        pairingCode = await Promise.race([codePromise, timeoutPromise]);
        
      } catch (err) {
        console.error(`❌ [${deviceName}] Failed to get pairing code:`, err.message);
        
        // Handle rate limit
        if (err.message?.includes('rate') || err.output?.statusCode === 429) {
          await this.storePairingError(deviceId, 'Rate limited. Wait 60 seconds.', supabase);
        } else {
          await this.storePairingError(deviceId, err.message || 'Failed to generate code', supabase);
        }
        
        // Cleanup and allow retry after delay
        setTimeout(() => this.activeSessions.delete(deviceId), 60000);
        return false;
      }
      
      // Validate and format code
      if (!pairingCode) {
        console.error(`❌ [${deviceName}] No pairing code received`);
        this.activeSessions.delete(deviceId);
        return false;
      }
      
      // Format the code properly
      const formattedCode = this.formatPairingCode(pairingCode);
      console.log(`✅ [${deviceName}] Pairing code: ${formattedCode}`);
      
      // Store in Redis
      try {
        await redis.setPairingCode(deviceId, formattedCode, 600); // 10 min TTL
        console.log(`📦 [${deviceName}] Code stored in Redis`);
      } catch (err) {
        console.error(`❌ [${deviceName}] Redis error:`, err);
      }
      
      // Update database
      await supabase
        .from('devices')
        .update({
          pairing_code: formattedCode,
          status: 'waiting_pairing',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
      
      // Print instructions
      this.printInstructions(deviceName, phone, formattedCode);
      
      // Auto cleanup after 2 minutes
      setTimeout(() => {
        this.activeSessions.delete(deviceId);
        console.log(`🧹 [${deviceName}] Pairing session cleared`);
      }, 120000);
      
      return true;
      
    } catch (error) {
      console.error(`❌ [${deviceName}] Unexpected error:`, error);
      this.activeSessions.delete(deviceId);
      return false;
    }
  }

  /**
   * Check if device has active session
   */
  hasActiveSession(deviceId) {
    const session = this.activeSessions.get(deviceId);
    if (!session) return false;
    
    // Session expires after 60 seconds
    const age = Date.now() - session;
    if (age > 60000) {
      this.activeSessions.delete(deviceId);
      return false;
    }
    
    return true;
  }

  /**
   * Format phone number to WhatsApp format
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digits
    let digits = String(phone).replace(/\D/g, '');
    
    // Handle Indonesian numbers
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8') && digits.length <= 12) {
      digits = '62' + digits;
    } else if (!digits.startsWith('62') && digits.length <= 12) {
      digits = '62' + digits;
    }
    
    // Validate length
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code for display
   */
  formatPairingCode(code) {
    if (!code) return null;
    
    // Clean the code
    const cleaned = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Format as XXXX-XXXX for 8 chars
    if (cleaned.length === 8) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    }
    
    // Return as-is for other lengths
    return cleaned;
  }

  /**
   * Wait for socket to be ready
   */
  async waitForSocket(sock, maxWait = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < maxWait) {
      if (sock && typeof sock.requestPairingCode === 'function') {
        // Socket is ready
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error('Socket not ready');
  }

  /**
   * Store error message
   */
  async storePairingError(deviceId, message, supabase) {
    try {
      await supabase
        .from('devices')
        .update({
          status: 'error',
          error_message: message,
          pairing_code: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId);
    } catch (err) {
      console.error('Failed to store error:', err);
    }
  }

  /**
   * Print pairing instructions
   */
  printInstructions(deviceName, phone, code) {
    console.log('\n' + '='.repeat(50));
    console.log(`📱 DEVICE: ${deviceName}`);
    console.log(`📞 PHONE: ${phone}`);
    console.log(`🔑 CODE: ${code}`);
    console.log('='.repeat(50));
    console.log('Instructions:');
    console.log('1. Open WhatsApp on phone number above');
    console.log('2. Go to Settings → Linked Devices');
    console.log('3. Tap "Link a Device"');
    console.log('4. Select "Link with phone number"'); 
    console.log('5. Enter the code above');
    console.log('='.repeat(50) + '\n');
  }

  /**
   * Clear all sessions
   */
  clearAll() {
    const count = this.activeSessions.size;
    this.activeSessions.clear();
    if (count > 0) {
      console.log(`🧹 Cleared ${count} pairing sessions`);
    }
  }

  /**
   * Clear specific device session
   */
  clearDevice(deviceId) {
    if (this.activeSessions.delete(deviceId)) {
      console.log(`🧹 Cleared pairing session for device: ${deviceId}`);
    }
  }
}

// Export singleton instance
module.exports = new StablePairingHandler();