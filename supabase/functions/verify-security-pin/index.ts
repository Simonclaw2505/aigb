/**
 * Verify Security PIN Edge Function
 * Server-side verification of admin security PIN
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

interface VerifyPinRequest {
  pin: string;
  organization_id: string;
}

serve(async (req) => {
  // SECURITY: Validate CORS
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token", valid: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: VerifyPinRequest = await req.json();
    const { pin, organization_id } = body;

    if (!pin || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      return new Response(
        JSON.stringify({ error: "PIN must be 6 digits", valid: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get stored PIN hash for this user
    const { data: pinData, error: pinError } = await supabase
      .from("admin_security_pins")
      .select("pin_hash")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (pinError || !pinData) {
      return new Response(
        JSON.stringify({ error: "PIN not configured", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify using database function
    const { data: isValid, error: verifyError } = await supabase
      .rpc("verify_security_pin", { pin, stored_hash: pinData.pin_hash });

    if (verifyError) {
      console.error("PIN verification error:", verifyError);
      return new Response(
        JSON.stringify({ error: "Verification failed", valid: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the verification attempt
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      organization_id,
      action: isValid ? "security_pin_verified" : "security_pin_failed",
      resource_type: "security_pin",
      metadata: { success: isValid },
    });

    return new Response(
      JSON.stringify({ valid: isValid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error", valid: false }),
      { status: 500, headers: { ...errorCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
