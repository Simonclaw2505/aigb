/**
 * Verify Security PIN Edge Function
 * Server-side verification of admin security PIN
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 * SECURITY: Brute-force protection with lockout after 5 failed attempts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Security headers
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

interface VerifyPinRequest {
  pin: string;
  organization_id: string;
}

serve(async (req) => {
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  const corsHeaders = { ...cors.headers, ...SECURITY_HEADERS };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // SECURITY: Check for brute-force lockout
    const lockoutWindow = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { count: failedAttempts } = await supabase
      .from("pin_attempt_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .eq("success", false)
      .gte("attempted_at", lockoutWindow);

    if ((failedAttempts || 0) >= MAX_ATTEMPTS) {
      // Log the blocked attempt
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        organization_id,
        action: "security_pin_locked_out",
        resource_type: "security_pin",
        metadata: { failed_attempts: failedAttempts, lockout_minutes: LOCKOUT_MINUTES },
      });

      return new Response(
        JSON.stringify({
          error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
          valid: false,
          locked_out: true,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Log the attempt in pin_attempt_logs
    await supabase.from("pin_attempt_logs").insert({
      user_id: user.id,
      organization_id,
      success: !!isValid,
    });

    // Log in audit_logs
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
    console.error("verify-security-pin error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error", valid: false }),
      { status: 500, headers: { ...errorCorsHeaders, ...SECURITY_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
