/**
 * Verify Operator Key Edge Function
 * Receives { key, agent_id }, hashes the key, looks up in operator_keys,
 * returns operator identity and role.
 *
 * SECURITY: Uses strict CORS allowlist
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { key, agent_id } = await req.json();

    if (!key || !agent_id) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing key or agent_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the key
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");

    // Look up operator
    const { data: operator } = await supabase
      .from("operator_keys")
      .select("id, name, role, is_active, agent_id")
      .eq("key_hash", keyHash)
      .eq("agent_id", agent_id)
      .single();

    if (!operator) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!operator.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: "Key has been revoked" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update usage stats
    await supabase
      .from("operator_keys")
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: undefined, // handled below
      })
      .eq("id", operator.id);

    // Increment usage_count separately (no SQL increment via client, so read+write)
    const { data: current } = await supabase
      .from("operator_keys")
      .select("usage_count")
      .eq("id", operator.id)
      .single();

    await supabase
      .from("operator_keys")
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: (current?.usage_count || 0) + 1,
      })
      .eq("id", operator.id);

    return new Response(
      JSON.stringify({
        valid: true,
        operator_id: operator.id,
        operator_name: operator.name,
        role: operator.role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-operator-key error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ valid: false, error: "Internal server error" }),
      { status: 500, headers: { ...errorCorsHeaders, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Content-Type": "application/json" } }
    );
  }
});
