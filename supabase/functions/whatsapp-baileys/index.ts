import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store active connections
const connections = new Map();

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

      // Simulate Baileys QR generation
      // In production, this would use actual Baileys library
      setTimeout(async () => {
        const qrData = `baileys-${deviceId}-${Date.now()}`;
        
        // Generate QR code data (in production, Baileys generates this)
        const qrCode = await generateQRCode(qrData);
        
        // Update device with QR code
        await supabase
          .from('devices')
          .update({ qr_code: qrCode })
          .eq('id', deviceId);

        // Send QR to client
        socket.send(JSON.stringify({
          type: 'qr',
          qr: qrCode,
          timestamp: Date.now()
        }));

        // Simulate successful connection after 5 seconds
        setTimeout(async () => {
          await supabase
            .from('devices')
            .update({ 
              status: 'connected',
              phone_number: '+62' + Math.floor(Math.random() * 1000000000),
              last_connected_at: new Date().toISOString(),
              qr_code: null
            })
            .eq('id', deviceId);

          socket.send(JSON.stringify({
            type: 'connected',
            timestamp: Date.now()
          }));
        }, 5000);
      }, 2000);

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
          // Handle message sending
          socket.send(JSON.stringify({
            type: 'message_sent',
            messageId: crypto.randomUUID(),
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
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return response;
});

// Helper function to generate QR code
async function generateQRCode(data: string): Promise<string> {
  // This is a simplified version. In production, use actual QR generation
  // For now, we'll create a data URL that represents a QR code
  const canvas = {
    width: 300,
    height: 300
  };
  
  // Simulate QR code generation
  // In production, you would use a proper QR library or Baileys' built-in QR
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" fill="black" font-size="12">
        QR: ${data.substring(0, 20)}...
      </text>
    </svg>
  `)}`;
}