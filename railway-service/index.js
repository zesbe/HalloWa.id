// UPDATE untuk index.js
// Tambahkan kode ini di sekitar line 260-280 (di dalam fungsi connectWhatsApp)

// Di bagian connection update handler, tambahkan:
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
  
  // QR Code handling...
  if (qr && device.connection_method === 'qr') {
    // existing QR code logic
  }
  
  // PAIRING CODE handling
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

// =============================================================
// ADDITIONAL CHANGES untuk bagian checkDevices() di line 76-92
// =============================================================

// Replace bagian stuck checking dengan yang lebih baik:
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

// =============================================================
// ADDITIONAL HELPER FUNCTION untuk monitoring (optional)
// =============================================================

// Tambahkan fungsi ini untuk debug/monitoring
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

// Call this periodically for debugging (optional)
// setInterval(checkPairingStatus, 60000); // Every 1 minute
