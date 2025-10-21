import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import makeWASocket, { 
  DisconnectReason, 
  fetchLatestBaileysVersion
} from "https://esm.sh/@whiskeysockets/baileys@6.7.8";
import { Boom } from "https://esm.sh/@hapi/boom@10.0.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store active connections and Baileys sockets
const connections = new Map();
const baileysConnections = new Map();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");

  if (!deviceId) {
    return new Response("Device ID required", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  socket.onopen = async () => {
    console.log(`WebSocket opened for device: ${deviceId}`);
    connections.set(deviceId, socket);

    try {
      // Update device status to connecting
      await supabase
        .from('devices')
        .update({ 
          status: 'connecting',
          server_id: crypto.randomUUID().substring(0, 8)
        })
        .eq('id', deviceId);

      // Get device data for session
      const { data: device } = await supabase
        .from('devices')
        .select('session_data')
        .eq('id', deviceId)
        .single();

      // Initialize Baileys connection
      await initializeBaileysConnection(deviceId, socket, device?.session_data);

    } catch (error) {
      console.error('Error in WebSocket handler:', error);
      socket.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received message:', data);

      switch (data.type) {
        case 'logout':
          const sock = baileysConnections.get(deviceId);
          if (sock) {
            await sock.logout();
            baileysConnections.delete(deviceId);
          }

          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              phone_number: null,
              qr_code: null,
              session_data: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'logged_out',
            timestamp: Date.now()
          }));
          break;

        case 'send_message':
          const baileySock = baileysConnections.get(deviceId);
          if (baileySock && data.to && data.message) {
            try {
              await baileySock.sendMessage(data.to, { text: data.message });
              socket.send(JSON.stringify({
                type: 'message_sent',
                messageId: crypto.randomUUID(),
                timestamp: Date.now()
              }));
            } catch (error) {
              socket.send(JSON.stringify({
                type: 'error',
                error: 'Failed to send message'
              }));
            }
          }
          break;

        case 'clear_session':
          const baileySocket = baileysConnections.get(deviceId);
          if (baileySocket) {
            await baileySocket.logout();
            baileysConnections.delete(deviceId);
          }

          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              session_data: null,
              qr_code: null,
              phone_number: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'session_cleared',
            timestamp: Date.now()
          }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket closed for device: ${deviceId}`);
    connections.delete(deviceId);
    
    // Clean up Baileys connection if exists
    const sock = baileysConnections.get(deviceId);
    if (sock) {
      sock.end();
      baileysConnections.delete(deviceId);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});

// Initialize Baileys connection
async function initializeBaileysConnection(deviceId: string, socket: WebSocket, sessionData: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`Initializing Baileys for device: ${deviceId}`);

    // Create in-memory auth state
    const authState = await createInMemoryAuthState(sessionData);
    
    // Get latest Baileys version
    const { version } = await fetchLatestBaileysVersion();
    
    // Create Baileys socket
    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: authState.state,
      browser: ['WhatsApp Gateway', 'Chrome', '1.0.0'],
    });

    baileysConnections.set(deviceId, sock);

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      console.log(`Connection update for ${deviceId}:`, { connection, qr: !!qr });

      if (qr) {
        // Generate QR code image from QR string
        const qrCode = await generateQRCode(qr);
        
        await supabase
          .from('devices')
          .update({ qr_code: qrCode })
          .eq('id', deviceId);

        socket.send(JSON.stringify({
          type: 'qr',
          qr: qrCode,
          timestamp: Date.now()
        }));
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed, reconnect:', shouldReconnect);

        if (shouldReconnect) {
          await initializeBaileysConnection(deviceId, socket, sessionData);
        } else {
          await supabase
            .from('devices')
            .update({ 
              status: 'disconnected',
              phone_number: null,
              session_data: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'disconnected',
            timestamp: Date.now()
          }));
        }
      } else if (connection === 'open') {
        console.log(`Baileys connected for device: ${deviceId}`);
        
        // Get phone number from Baileys
        const phoneNumber = sock.user?.id?.split(':')[0] || null;

        // Save session
        const session = await authState.saveCreds();
        
        await supabase
          .from('devices')
          .update({ 
            status: 'connected',
            phone_number: phoneNumber ? `+${phoneNumber}` : null,
            last_connected_at: new Date().toISOString(),
            qr_code: null,
            session_data: session
          })
          .eq('id', deviceId);

        socket.send(JSON.stringify({
          type: 'connected',
          phoneNumber: phoneNumber ? `+${phoneNumber}` : null,
          timestamp: Date.now()
        }));
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', async () => {
      const session = await authState.saveCreds();
      await supabase
        .from('devices')
        .update({ session_data: session })
        .eq('id', deviceId);
    });

  } catch (error) {
    console.error('Error initializing Baileys:', error);
    socket.send(JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to initialize'
    }));
  }
}

// Create in-memory auth state
async function createInMemoryAuthState(savedSession: any) {
  const creds = savedSession?.creds || {};
  const keys = savedSession?.keys || {};

  const saveCreds = async () => {
    return {
      creds: creds,
      keys: keys
    };
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type: string, ids: string[]) => {
          const data: any = {};
          for (const id of ids) {
            const key = `${type}-${id}`;
            if (keys[key]) {
              data[id] = keys[key];
            }
          }
          return data;
        },
        set: async (data: any) => {
          for (const category in data) {
            for (const id in data[category]) {
              const key = `${category}-${id}`;
              const value = data[category][id];
              if (value) {
                keys[key] = value;
              } else {
                delete keys[key];
              }
            }
          }
        }
      }
    },
    saveCreds
  };
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to generate QR code
async function generateQRCode(data: string): Promise<string> {
  try {
    // Generate QR code using an external API service
    const size = 300;
    const encodedData = encodeURIComponent(data);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=png`;
    
    // Fetch the QR code image
    const response = await fetch(qrUrl);
    const blob = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = arrayBufferToBase64(blob);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    // Fallback to simple SVG-based QR
    return generateSimpleSVGQR(data);
  }
}

// Fallback: Simple SVG-based visual QR (not scannable, just placeholder)
function generateSimpleSVGQR(data: string): string {
  const svg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="20" y="20" width="40" height="40" fill="black"/>
      <rect x="240" y="20" width="40" height="40" fill="black"/>
      <rect x="20" y="240" width="40" height="40" fill="black"/>
      <rect x="130" y="130" width="40" height="40" fill="black"/>
      <text x="150" y="180" text-anchor="middle" font-size="12" fill="gray">
        Scan with WhatsApp
      </text>
      <text x="150" y="200" text-anchor="middle" font-size="8" fill="gray">
        ${data.substring(0, 30)}...
      </text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}