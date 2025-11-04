// Polyfill untuk crypto (fix error "crypto is not defined")
const { webcrypto } = require('crypto');
if (!global.crypto) {
  global.crypto = webcrypto;
}

const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, Browsers, initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const redis = require('./redis-client');

// Import handlers for QR and Pairing code
const { handleQRCode } = require('./qr-handler');
const stablePairingHandler = require('./pairing-handler-stable');

// Supabase config dari environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      'x-my-custom-header': 'whatsapp-baileys-service'
    }
  }
});

// Store active WhatsApp sockets
const activeSockets = new Map();

// Track broadcasts currently being processed to prevent duplicates
const processingBroadcasts = new Set();

// Polling mechanism - lebih reliable daripada realtime untuk Railway
async function startService() {
  console.log('🚀 WhatsApp Baileys Service Started');
  console.log('📡 Using polling mechanism (optimized intervals)');
  console.log('🔗 Supabase URL:', supabaseUrl);
  
  // Clear any stale pairing sessions on startup
  stablePairingHandler.clearAll();

  // Function to check devices
  async function checkDevices() {
    try {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('*')
        .in('status', ['connecting', 'connected']);

      if (error) {
        console.error('❌ Error fetching devices:', error);
        return;
      }

      // Ensure sockets for devices that should be online
      const needSockets = devices?.filter(d => ['connecting', 'connected'].includes(d.status)) || [];
      for (const device of needSockets) {
        const sock = activeSockets.get(device.id);
        
        // Check if device stuck in connecting for too long (different timeout for pairing vs QR)
        if (device.status === 'connecting' && device.updated_at) {
          const lastUpdate = new Date(device.updated_at).getTime();
          const now = Date.now();
          const stuckTime = (now - lastUpdate) / 1000; // seconds
          
          // Different timeout for pairing vs QR
          const timeout = device.connection_method === 'pairing' ? 180 : 120; // 3 min for pairing, 2 min for QR
          
          if (stuckTime > timeout) {
            console.log(`⚠️ Device ${device.device_name} stuck in connecting for ${Math.round(stuckTime)}s - resetting`);
            
            // Clear pairing session if exists
            if (device.connection_method === 'pairing') {
              stablePairingHandler.clearDevice(device.id);
            }
            
            // Clear persisted session in DB
            await supabase.from('devices').update({ 
              status: 'disconnected',
              qr_code: null,
              pairing_code: null,
              session_data: null,
              error_message: 'Connection timeout - silakan coba lagi'
            }).eq('id', device.id);
            
            continue;
          }
        }
        
        if (!sock) {
          // No socket exists, create new connection
          // Check if we have valid session data for recovery
          const hasSessionData = device.session_data?.creds?.registered;
          
          if (device.status === 'connected' && hasSessionData) {
            // Railway restart detected - try to recover session
            console.log(`🔄 Recovering session for: ${device.device_name} (Railway restart detected)`);
            await connectWhatsApp(device, true); // Pass recovery flag
          } else {
            console.log(`🔄 Connecting device: ${device.device_name} [status=${device.status}]`);
            await connectWhatsApp(device);
          }
        } else if (device.status === 'connected' && !sock.user) {
          // Socket exists but not authenticated, try session recovery first
          const hasSessionData = device.session_data?.creds?.registered;
          
          console.log(`⚠️ Socket exists but not authenticated for ${device.device_name}`);
          sock.end();
          activeSockets.delete(device.id);
          
          if (hasSessionData) {
            console.log(`🔄 Attempting session recovery for ${device.device_name}`);
            setTimeout(() => connectWhatsApp(device, true).catch(() => {}), 500);
          } else {
            console.log(`🔄 No session data - will generate QR/pairing code`);
            await supabase.from('devices').update({ status: 'connecting' }).eq('id', device.id);
            setTimeout(() => connectWhatsApp(device).catch(() => {}), 500);
          }
        }
      }

      // Disconnect devices that should be disconnected
      for (const [deviceId, sock] of activeSockets) {
        const device = devices?.find(d => d.id === deviceId);
        if (!device || device.status === 'disconnected') {
          console.log(`❌ Disconnecting device: ${deviceId}`);
          sock?.end();
          activeSockets.delete(deviceId);
          // Clean auth on explicit disconnect
          try {
            // Filesystem auth removed. Clear session in DB on explicit disconnect
            if (device) {
              await supabase.from('devices').update({ qr_code: null, pairing_code: null, session_data: null }).eq('id', deviceId);
            }
          } catch (e) {
            console.error('❌ Error cleaning auth on disconnect:', e);
          }
        }
      }

      console.log(`✅ Active connections: ${activeSockets.size}`);
    } catch (error) {
      console.error('❌ Error in checkDevices:', error);
    }
  }

  // Initial check
  console.log('🔍 Initial check for pending connections...');
  await checkDevices();

  // Poll every 10 seconds (reduced from 5s to save resources)
  setInterval(checkDevices, 10000);
  console.log('⏱️ Polling started (every 10 seconds)');

  // Check scheduled broadcasts every 30 seconds (reduced from 10s)
  setInterval(checkScheduledBroadcasts, 30000);
  console.log('⏰ Scheduled broadcast check started (every 30 seconds)');

  // Process broadcasts every 10 seconds (reduced from 3s)
  setInterval(processBroadcasts, 10000);
  console.log('📤 Broadcast processing started (every 10 seconds)');

  // Health check ping every 60 seconds (reduced from 30s)
  setInterval(healthCheckPing, 60000);
  console.log('💓 Health check ping started (every 60 seconds)');
  
  // Optional: Pairing status monitoring (for debugging)
  // Uncomment the next line if you want to monitor pairing status
  // setInterval(checkPairingStatus, 60000);
}

// Auth state persisted in Supabase ONLY (Redis removed to save resources)
async function useSupabaseAuthState(deviceId) {
  let creds, keys;
  try {
    // Load from Supabase
    const { data } = await supabase
      .from('devices')
      .select('session_data')
      .eq('id', deviceId)
      .maybeSingle();

    const stored = data?.session_data || {};
    creds = stored.creds ? JSON.parse(JSON.stringify(stored.creds), BufferJSON.reviver) : initAuthCreds();
    keys = stored.keys ? JSON.parse(JSON.stringify(stored.keys), BufferJSON.reviver) : {};
  } catch (e) {
    console.error('❌ Failed loading session:', e);
    creds = initAuthCreds();
    keys = {};
  }

  const persist = async () => {
    const sessionData = {
      creds: JSON.parse(JSON.stringify(creds, BufferJSON.replacer)),
      keys: JSON.parse(JSON.stringify(keys, BufferJSON.replacer)),
      saved_at: new Date().toISOString(),
    };
    
    // Save to Supabase only
    await supabase
      .from('devices')
      .update({ session_data: sessionData })
      .eq('id', deviceId)
      .then(({ error }) => {
        if (error) console.error('❌ Supabase save error:', error);
      });
  };

  return {
    state: {
      creds,
      keys,
      get: (key) => {
        if (key === 'creds') return creds;
        if (key.startsWith('app-state-sync-key') || key.startsWith('session')) {
          return keys[key];
        }
        return undefined;
      },
      set: (data) => {
        Object.assign(creds, data.creds || {});
        Object.assign(keys, data.keys || {});
        persist();
      }
    },
    saveCreds: persist
  };
}

// Connect to WhatsApp with improved pairing handling
async function connectWhatsApp(device, isRecovery = false) {
  const browser = device.browser_name ? [device.browser_name] : Browsers.appropriate('Chrome');
  
  // Get auth state
  const { state, saveCreds } = await useSupabaseAuthState(device.id);
  
  // Fetch version
  const { version } = await fetchLatestBaileysVersion();
  
  console.log(`🔌 Creating socket for: ${device.device_name} [recovery=${isRecovery}]`);
  
  // Create socket  
  const sock = makeWASocket({
    version,
    auth: state,
    browser,
    printQRInTerminal: false,
    qrTimeout: 60000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    emitOwnEvents: true,
    fireInitQueries: false,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined
  });

  // Handle connection updates with improved pairing support
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log(`🔌 Connection update [${device.device_name}]:`, connection);
    
    if (connection === 'open') {
      console.log(`✅ WhatsApp connected: ${device.device_name}`);
      activeSockets.set(device.id, sock);
      
      // IMPORTANT: Clear pairing session on successful connection
      if (device.connection_method === 'pairing') {
        stablePairingHandler.onPairingSuccess(device.id);
      }
      
      // Get user info
      const user = sock.user;
      
      // Update device status to connected
      await supabase
        .from('devices')
        .update({ 
          status: 'connected',
          qr_code: null,
          pairing_code: null, // Clear pairing code on success
          error_message: null,
          phone_number: user?.id?.split(':')[0] || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id);
        
      console.log(`📱 Device connected: ${user?.name || 'Unknown'} (${user?.id || 'Unknown'})`);
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`❌ Connection closed [${device.device_name}]:`, lastDisconnect?.error?.message || 'Unknown reason');
      
      // Handle pairing failure
      if (device.connection_method === 'pairing' && lastDisconnect?.error) {
        stablePairingHandler.onPairingFailure(device.id);
      }
      
      if (shouldReconnect) {
        console.log(`🔄 Will attempt to reconnect ${device.device_name}...`);
        activeSockets.delete(device.id);
        
        // Update status
        await supabase
          .from('devices')
          .update({ 
            status: 'disconnected',
            qr_code: null,
            pairing_code: null, // Clear on disconnect
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);
          
        // Wait before reconnecting
        setTimeout(() => {
          connectWhatsApp(device);
        }, 5000);
      } else {
        console.log(`🚫 Device ${device.device_name} logged out`);
        activeSockets.delete(device.id);
        
        // Clear session data and mark as disconnected
        await supabase
          .from('devices')
          .update({ 
            status: 'disconnected',
            qr_code: null,
            pairing_code: null,
            session_data: null,
            phone_number: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', device.id);
      }
    }
    
    // QR Code handling
    if (qr && device.connection_method === 'qr') {
      console.log(`🔲 QR Code generated for: ${device.device_name}`);
      await handleQRCode(device.id, qr, supabase);
    }
    
    // PAIRING CODE handling (IMPROVED)
    if (connection === 'connecting' && !qr && device.connection_method === 'pairing') {
      // Check if we should generate new pairing code
      const sessionInfo = stablePairingHandler.getSessionInfo(device.id);
      console.log(`📊 Pairing session info for ${device.device_name}:`, sessionInfo);
      
      if (!sessionInfo.hasSession && !sessionInfo.inCooldown) {
        // Generate new pairing code
        console.log(`🔑 Generating new pairing code for ${device.device_name}...`);
        const success = await stablePairingHandler.generatePairingCode(sock, device, supabase);
        
        if (!success) {
          console.log(`❌ Failed to generate pairing code for ${device.device_name}`);
        }
      } else if (sessionInfo.inCooldown) {
        console.log(`⏱️ ${device.device_name} in cooldown: ${Math.ceil(sessionInfo.cooldownRemaining/1000)}s remaining`);
      }
    }
  });

  // Handle credentials update
  sock.ev.on('creds.update', async () => {
    console.log(`🔐 Credentials updated for: ${device.device_name}`);
    await saveCreds();
  });

  // Handle incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        // Ignore messages from self or status broadcasts
        if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;
        
        const messageText = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || '';
        
        if (!messageText) continue;
        
        const from = msg.key.remoteJid;
        const pushName = msg.pushName || 'Unknown';
        
        console.log(`📩 Message from ${pushName} (${from}): ${messageText}`);
        
        // Store incoming message
        await supabase
          .from('messages')
          .insert({
            device_id: device.id,
            phone_number: from.split('@')[0],
            message: messageText,
            sender_name: pushName,
            type: 'incoming',
            created_at: new Date().toISOString()
          });
          
        // Check for auto-reply
        const { data: autoReply } = await supabase
          .from('auto_replies')
          .select('*')
          .eq('device_id', device.id)
          .eq('is_active', true)
          .or(`trigger.ilike.%${messageText}%,trigger.eq.*`)
          .single();
          
        if (autoReply) {
          // Send auto-reply
          await sock.sendMessage(from, { text: autoReply.response });
          console.log(`↩️ Auto-reply sent to ${from}`);
          
          // Store outgoing message
          await supabase
            .from('messages')
            .insert({
              device_id: device.id,
              phone_number: from.split('@')[0],
              message: autoReply.response,
              type: 'outgoing',
              is_auto_reply: true,
              created_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error('❌ Error processing message:', error);
      }
    }
  });

  // Store socket reference
  activeSockets.set(device.id, sock);
  
  // Update device status
  if (!isRecovery) {
    await supabase
      .from('devices')
      .update({ 
        status: 'connecting',
        updated_at: new Date().toISOString()
      })
      .eq('id', device.id);
  }
}

// Helper function for debugging pairing status (OPTIONAL)
async function checkPairingStatus() {
  console.log('\n📊 === PAIRING STATUS CHECK ===');
  
  const { data: devices } = await supabase
    .from('devices')
    .select('id, device_name, status, connection_method, pairing_code, updated_at')
    .eq('connection_method', 'pairing');
    
  for (const device of devices || []) {
    const sessionInfo = stablePairingHandler.getSessionInfo(device.id);
    console.log(`Device: ${device.device_name}`);
    console.log(`  Status: ${device.status}`);
    console.log(`  Has Code: ${!!device.pairing_code}`);
    console.log(`  Session Info:`, sessionInfo);
  }
  
  console.log('=========================\n');
}

// Health check function
async function healthCheckPing() {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  console.log(`💓 Health: Memory=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, Uptime=${Math.round(uptime)}s, Sockets=${activeSockets.size}`);
  
  // Update health status in database
  await supabase
    .from('system_health')
    .upsert({
      id: os.hostname(),
      memory_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
      uptime_seconds: Math.round(uptime),
      active_connections: activeSockets.size,
      updated_at: new Date().toISOString()
    });
}

// Check and process scheduled broadcasts
async function checkScheduledBroadcasts() {
  try {
    const now = new Date();
    
    // Find broadcasts that should be sent now
    const { data: scheduled, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .order('scheduled_at', { ascending: true });
    
    if (error) {
      console.error('❌ Error fetching scheduled broadcasts:', error);
      return;
    }
    
    if (!scheduled || scheduled.length === 0) return;
    
    console.log(`⏰ Found ${scheduled.length} scheduled broadcasts to process`);
    
    // Update status to pending so they will be processed
    for (const broadcast of scheduled) {
      await supabase
        .from('broadcasts')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', broadcast.id);
    }
    
  } catch (error) {
    console.error('❌ Error in checkScheduledBroadcasts:', error);
  }
}

// Process pending broadcasts
async function processBroadcasts() {
  try {
    // Fetch pending broadcasts
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching broadcasts:', error);
      return;
    }

    if (!broadcasts || broadcasts.length === 0) return;

    for (const broadcast of broadcasts) {
      // Skip if already being processed
      if (processingBroadcasts.has(broadcast.id)) {
        console.log(`⏭️ Broadcast ${broadcast.id} already being processed, skipping...`);
        continue;
      }
      
      // Mark as processing
      processingBroadcasts.add(broadcast.id);
      
      // Check if device is connected
      const sock = activeSockets.get(broadcast.device_id);
      if (!sock || !sock.user) {
        console.log(`⚠️ Device not connected for broadcast ${broadcast.id}`);
        processingBroadcasts.delete(broadcast.id);
        continue;
      }

      try {
        console.log(`📤 Processing broadcast ${broadcast.id} for device ${broadcast.device_id}`);

        // Update status to processing
        await supabase
          .from('broadcasts')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);

        // Send messages
        let sentCount = 0;
        let failedCount = 0;
        
        // Get delay settings
        const minDelay = broadcast.min_delay || 3000;
        const maxDelay = broadcast.max_delay || 8000;
        const batchSize = broadcast.batch_size || 20;
        const pauseBetweenBatches = broadcast.batch_pause || 30000;
        
        // Adaptive delay based on message count
        const messageCount = broadcast.target_contacts.length;
        let adaptiveDelayMs = minDelay;
        
        if (messageCount > 100) {
          adaptiveDelayMs = Math.max(minDelay, 5000);
        } else if (messageCount > 50) {
          adaptiveDelayMs = Math.max(minDelay, 4000);
        }
        
        // Helper function for random delay
        const calculateDelay = (baseDelay) => {
          const variance = 0.2;
          const min = baseDelay * (1 - variance);
          const max = Math.min(baseDelay * (1 + variance), maxDelay);
          return Math.floor(Math.random() * (max - min + 1)) + min;
        };
        
        for (let i = 0; i < broadcast.target_contacts.length; i++) {
          try {
            const contact = broadcast.target_contacts[i];
            
            // Handle different contact formats
            let phoneNumber;
            let contactInfo = { name: '' };
            let contactData = {};
            
            if (typeof contact === 'object' && contact !== null) {
              phoneNumber = contact.phone || contact.number || contact.phoneNumber;
              contactInfo.name = contact.name || contact.nama || '';
              contactData = contact; // Store all contact data for variables
            } else {
              phoneNumber = String(contact);
            }
            
            // Clean phone number format
            phoneNumber = phoneNumber.replace(/\D/g, '');
            if (phoneNumber.startsWith('0')) {
              phoneNumber = '62' + phoneNumber.substring(1);
            } else if (phoneNumber.startsWith('8')) {
              phoneNumber = '62' + phoneNumber;
            }
            
            // Process message variables
            let processedMessage = broadcast.message;
            
            // Only process variables if message contains them
            if (processedMessage.includes('{')) {
              // Get contact name from WhatsApp if not provided
              if (!contactInfo.name && phoneNumber) {
                try {
                  const [result] = await sock.onWhatsApp(phoneNumber + '@s.whatsapp.net');
                  if (result?.exists) {
                    const profile = await sock.profilePictureUrl(result.jid, 'image').catch(() => null);
                    contactInfo.name = result.notify || result.verifiedName || 'Kak';
                  }
                } catch (e) {
                  contactInfo.name = 'Kak';
                }
              }
              
              // Replace {nama} and {{nama}} with contact name
              processedMessage = processedMessage.replace(/\{\{?nama\}\}?/g, contactInfo.name || phoneNumber);
              
              // Replace {nomor} with phone number
              processedMessage = processedMessage.replace(/\{nomor\}/g, phoneNumber);
              
              // Replace custom variables {var1}, {var2}, {var3}
              if (contactData?.var1) {
                processedMessage = processedMessage.replace(/\{var1\}/g, contactData.var1);
              }
              if (contactData?.var2) {
                processedMessage = processedMessage.replace(/\{var2\}/g, contactData.var2);
              }
              if (contactData?.var3) {
                processedMessage = processedMessage.replace(/\{var3\}/g, contactData.var3);
              }
              
              // Replace time/date variables
              const now = new Date();
              const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              
              processedMessage = processedMessage.replace(/\{\{?waktu\}\}?/g, 
                now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
              );
              
              processedMessage = processedMessage.replace(/\{\{?tanggal\}\}?/g, 
                now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })
              );
              
              processedMessage = processedMessage.replace(/\{\{?hari\}\}?/g, days[now.getDay()]);
            }
            
            if (!phoneNumber) {
              console.error('❌ Invalid contact:', contact);
              failedCount++;
              continue;
            }
            
            // Format phone number (ensure it has @s.whatsapp.net suffix)
            const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
            
            // Prepare message content
            let messageContent;
            
            if (broadcast.media_url) {
              // Send media message with retry logic
              let mediaLoaded = false;
              let retryCount = 0;
              const maxRetries = 3;
              
              while (!mediaLoaded && retryCount < maxRetries) {
                try {
                  const mediaType = getMediaType(broadcast.media_url);
                  console.log(`📥 Downloading media (attempt ${retryCount + 1}/${maxRetries}): ${broadcast.media_url}`);
                  
                  const response = await fetch(broadcast.media_url, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                  });
                  
                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }
                  
                  const buffer = await response.arrayBuffer();
                  
                  if (buffer.byteLength === 0) {
                    throw new Error('Downloaded file is empty (0 bytes)');
                  }
                  
                  console.log(`✅ Media downloaded: ${buffer.byteLength} bytes`);
                  
                  if (mediaType === 'image') {
                    messageContent = {
                      image: Buffer.from(buffer),
                      caption: processedMessage || ''
                    };
                  } else if (mediaType === 'video') {
                    messageContent = {
                      video: Buffer.from(buffer),
                      caption: processedMessage || ''
                    };
                  } else if (mediaType === 'audio') {
                    messageContent = {
                      audio: Buffer.from(buffer),
                      mimetype: 'audio/mp4'
                    };
                  } else if (mediaType === 'document') {
                    messageContent = {
                      document: Buffer.from(buffer),
                      caption: processedMessage || '',
                      mimetype: 'application/pdf'
                    };
                  } else {
                    // Fallback to text message
                    messageContent = { text: processedMessage };
                  }
                  
                  mediaLoaded = true;
                } catch (mediaError) {
                  retryCount++;
                  console.error(`❌ Error loading media (attempt ${retryCount}/${maxRetries}):`, mediaError.message);
                  
                  if (retryCount >= maxRetries) {
                    console.error('❌ Max retries reached, sending text only');
                    // Fallback to text only after max retries
                    messageContent = { text: broadcast.message };
                    mediaLoaded = true;
                  } else {
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                  }
                }
              }
            } else {
              // Text only message
              messageContent = { text: processedMessage };
            }
            
            // Send message
            await sock.sendMessage(jid, messageContent);
            
            sentCount++;
            console.log(`✅ Sent to ${phoneNumber} (${i + 1}/${broadcast.target_contacts.length})`);
            
            // Batch pause logic
            if ((i + 1) % batchSize === 0 && i < broadcast.target_contacts.length - 1) {
              console.log(`⏸️ Batch complete (${i + 1} messages). Pausing for ${pauseBetweenBatches / 1000}s...`);
              
              // Update progress during pause
              await supabase
                .from('broadcasts')
                .update({
                  sent_count: sentCount,
                  failed_count: failedCount,
                  updated_at: new Date().toISOString()
                })
                .eq('id', broadcast.id);
              
              await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches));
            } else if (i < broadcast.target_contacts.length - 1) {
              // Regular delay between messages
              const delayMs = calculateDelay(adaptiveDelayMs);
              console.log(`⏱️ Waiting ${delayMs}ms before next message...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
            
          } catch (sendError) {
            failedCount++;
            console.error(`❌ Failed to send to ${contact}:`, sendError.message);
            
            // Small delay even on error
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update broadcast with results
        await supabase
          .from('broadcasts')
          .update({
            status: 'completed',
            sent_count: sentCount,
            failed_count: failedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);

        console.log(`✅ Broadcast completed: ${sentCount} sent, ${failedCount} failed`);

      } catch (broadcastError) {
        console.error(`❌ Error processing broadcast ${broadcast.id}:`, broadcastError);
        
        // Update broadcast status to failed
        await supabase
          .from('broadcasts')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', broadcast.id);
      } finally {
        // Remove from processing set when done
        processingBroadcasts.delete(broadcast.id);
      }
    }
  } catch (error) {
    console.error('❌ Error in processBroadcasts:', error);
  }
}

// Helper function to determine media type from URL
function getMediaType(url) {
  const ext = url.toLowerCase().split('.').pop().split('?')[0];
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  } else if (['mp4', 'mov', 'avi'].includes(ext)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return 'audio';
  } else if (['pdf', 'doc', 'docx'].includes(ext)) {
    return 'document';
  }
  
  return 'document';
}

// Start the service
startService().catch(console.error);
