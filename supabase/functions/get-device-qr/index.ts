import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Get QR code or pairing code from Supabase for a device
 * This edge function provides a secure way to fetch temporary codes
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get deviceId from POST body (preferred) or URL query param fallback
    let deviceId: string | null = null;
    try {
      if (req.method === 'POST') {
        const body = await req.json().catch(() => null);
        deviceId = body?.deviceId ?? null;
      }
    } catch (_) {
      // ignore parse error and fallback to query param
    }
    if (!deviceId) {
      const url = new URL(req.url);
      deviceId = url.searchParams.get('deviceId');
    }

    if (!deviceId) {
      return new Response(
        JSON.stringify({ error: 'deviceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this device
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch device with QR and pairing codes from Supabase
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, user_id, qr_code, pairing_code')
      .eq('id', deviceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (deviceError || !device) {
      console.error('Device error:', deviceError);
      return new Response(
        JSON.stringify({ error: 'Device not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetched codes for device ${deviceId}: QR=${!!device.qr_code}, Pairing=${!!device.pairing_code}`);

    return new Response(
      JSON.stringify({
        qrCode: device.qr_code,
        pairingCode: device.pairing_code,
        deviceId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
