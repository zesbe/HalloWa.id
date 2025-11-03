const { delay } = require('@whiskeysockets/baileys');

/**
 * Fixed Pairing Implementation
 * Handles the pairing code flow correctly with WhatsApp
 */
class PairingFix {
  constructor(redis) {
    this.redis = redis;
    this.activePairings = new Map();
  }

  /**
   * Initialize pairing mode for socket BEFORE connection starts
   */
  async initPairingMode(sock, device, supabase) {
    try {
      // Check if device is configured for pairing
      const { data: deviceData } = await supabase
        .from('devices')
        .select('connection_method, phone_for_pairing')
        .eq('id', device.id)
        .single();

      if (!deviceData || deviceData.connection_method !== 'pairing' || !deviceData.phone_for_pairing) {
        console.log('📱 Device not configured for pairing mode');
        return false;
      }

      const phoneNumber = this.formatPhoneNumber(deviceData.phone_for_pairing);
      if (!phoneNumber) {
        console.error('❌ Invalid phone number:', deviceData.phone_for_pairing);
        return false;
      }

      console.log(`🔑 Initializing pairing mode for: ${phoneNumber}`);

      // Store pairing config
      sock.pairingConfig = {
        mode: 'pairing',
        phone: phoneNumber,
        deviceId: device.id,
        attempts: 0,
        maxAttempts: 3
      };

      return true;
    } catch (error) {
      console.error('❌ Error initializing pairing mode:', error);
      return false;
    }
  }

  /**
   * Handle pairing code generation when socket is ready
   */
  async handlePairing(sock, device, supabase, update) {
    try {
      // Check if we should generate pairing code
      const config = sock.pairingConfig;
      if (!config || config.mode !== 'pairing') {
        return { handled: false };
      }

      // Check if already registered
      if (sock.authState?.creds?.registered) {
        console.log('✅ Already registered, skipping pairing');
        return { handled: false };
      }

      // Check if we already tried
      if (config.attempts >= config.maxAttempts) {
        console.log(`❌ Max pairing attempts reached (${config.maxAttempts})`);
        return { handled: false, error: 'max_attempts' };
      }

      // Check if we have an active pairing
      const existingPairing = this.activePairings.get(device.id);
      if (existingPairing) {
        const age = (Date.now() - existingPairing.timestamp) / 1000;
        if (age < 60) {
          console.log(`⏱️ Using existing pairing code (${age.toFixed(0)}s old): ${existingPairing.code}`);
          return { handled: true, code: existingPairing.code };
        }
      }

      // Conditions to trigger pairing
      const shouldRequestCode = (
        update.connection === 'connecting' ||
        update.qr ||
        (!update.connection && !sock.authState?.creds?.registered)
      );

      if (!shouldRequestCode) {
        console.log('⏳ Waiting for right conditions to request pairing code...');
        return { handled: false };
      }

      console.log('🔐 Requesting pairing code from WhatsApp...');
      config.attempts++;

      try {
        // Small delay to ensure socket is ready
        await delay(1000);

        // Request pairing code
        const pairingCode = await sock.requestPairingCode(config.phone);
        
        if (!pairingCode) {
          throw new Error('No pairing code received');
        }

        // Format code
        const formattedCode = this.formatPairingCode(pairingCode);
        
        // Store pairing info
        const pairingInfo = {
          code: pairingCode,
          formattedCode: formattedCode,
          phone: config.phone,
          timestamp: Date.now()
        };
        
        this.activePairings.set(device.id, pairingInfo);

        // Store in Redis
        await this.redis.setPairingCode(device.id, formattedCode, 300);

        // Update database
        await supabase
          .from('devices')
          .update({
            pairing_code: formattedCode,
            status: 'connecting',
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);

        // Print instructions
        this.printInstructions(config.phone, formattedCode);

        // Set up completion monitoring
        this.monitorCompletion(sock, device, supabase);

        return { handled: true, code: formattedCode };

      } catch (error) {
        console.error('❌ Pairing request failed:', error.message);
        
        // Check for rate limit
        if (error.message?.includes('428') || error.message?.includes('too many')) {
          console.log('⏳ Rate limited - wait 60 seconds before retry');
          await supabase
            .from('devices')
            .update({
              status: 'error',
              error_message: 'Rate limited - please wait 1 minute',
              updated_at: new Date().toISOString()
            })
            .eq('id', device.id);
        }
        
        return { handled: false, error: error.message };
      }

    } catch (error) {
      console.error('❌ Unexpected error in handlePairing:', error);
      return { handled: false, error: error.message };
    }
  }

  /**
   * Monitor for pairing completion
   */
  monitorCompletion(sock, device, supabase) {
    let checkCount = 0;
    const maxChecks = 150; // 5 minutes

    const interval = setInterval(async () => {
      checkCount++;

      // Check if registered
      if (sock.authState?.creds?.registered && sock.user) {
        console.log('');
        console.log('🎉 ══════════════════════════════════');
        console.log('🎉 PAIRING SUCCESSFUL!');
        console.log(`🎉 Device: ${sock.user.id}`);
        console.log('🎉 ══════════════════════════════════');
        console.log('');

        clearInterval(interval);
        
        // Clean up
        this.activePairings.delete(device.id);
        
        // Update database
        try {
          await supabase
            .from('devices')
            .update({
              status: 'connected',
              phone_number: sock.user.id.split(':')[0],
              pairing_code: null,
              error_message: null,
              last_connected_at: new Date().toISOString()
            })
            .eq('id', device.id);
        } catch (error) {
          console.error('Failed to update device:', error);
        }
      }

      if (checkCount >= maxChecks) {
        console.log('⏰ Pairing timeout - 5 minutes elapsed');
        clearInterval(interval);
        this.activePairings.delete(device.id);
      }
    }, 2000);

    // Auto-clear after 5 minutes
    setTimeout(() => clearInterval(interval), 300000);
  }

  /**
   * Print pairing instructions
   */
  printInstructions(phone, code) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  📱 PAIRING CODE READY                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Phone Number: ${phone.padEnd(45)}║`);
    console.log(`║ Pairing Code: ${code.padEnd(45)}║`);
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ INSTRUCTIONS:                                              ║');
    console.log('║                                                            ║');
    console.log('║ Option 1: Via Notification (Recommended)                   ║');
    console.log('║ • Check WhatsApp for notification on the phone number      ║');
    console.log('║ • Tap the notification to auto-link                        ║');
    console.log('║                                                            ║');
    console.log('║ Option 2: Manual Entry                                     ║');
    console.log('║ 1. Open WhatsApp on your phone                            ║');
    console.log('║ 2. Go to Settings → Linked Devices                        ║');
    console.log('║ 3. Tap "Link a Device"                                    ║');
    console.log('║ 4. Tap "Link with phone number instead"                   ║');
    console.log(`║ 5. Enter phone: ${phone.padEnd(42)}║`);
    console.log(`║ 6. Enter code: ${code.padEnd(43)}║`);
    console.log('║                                                            ║');
    console.log('║ ⏱️ Code expires in 5 minutes                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  /**
   * Format phone number
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    let digits = String(phone).replace(/\D/g, '');
    
    // Indonesian number handling
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    } else if (digits.startsWith('8')) {
      digits = '62' + digits;
    }
    
    if (digits.length <= 12 && !digits.startsWith('62')) {
      digits = '62' + digits;
    }
    
    // Validate
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    
    return digits;
  }

  /**
   * Format pairing code
   */
  formatPairingCode(code) {
    if (!code) return code;
    const clean = code.replace(/[^A-Z0-9]/g, '');
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return clean;
  }
}

module.exports = PairingFix;