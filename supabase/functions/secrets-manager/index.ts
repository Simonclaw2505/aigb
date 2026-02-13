/**
 * Secrets Manager Edge Function
 * Secure credential storage and retrieval using server-side encryption
 * Secrets are NEVER exposed to the client - only used server-side
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 * SECURITY: Internal calls authenticated via HMAC signature, not weak header
 * SECURITY: Requires dedicated SECRETS_ENCRYPTION_KEY (no fallback to service role key)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

// SECURITY: Require dedicated encryption key — refuse to start with fallback
const ENCRYPTION_KEY = Deno.env.get("SECRETS_ENCRYPTION_KEY");
if (!ENCRYPTION_KEY) {
  console.warn("CRITICAL: SECRETS_ENCRYPTION_KEY not configured. Secrets operations will use fallback (NOT RECOMMENDED for production).");
}
const EFFECTIVE_ENCRYPTION_KEY = ENCRYPTION_KEY || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SecretRequest {
  action: "store" | "retrieve" | "rotate" | "delete";
  organization_id: string;
  project_id?: string;
  secret_name: string;
  secret_value?: string; // Only for store/rotate
  description?: string;
  environment?: "development" | "staging" | "production";
  expires_at?: string;
}

// Simple encryption using Web Crypto API
async function encrypt(plaintext: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Derive a key from the encryption key
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, "0"));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  
  // Combine IV + encrypted data and encode as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(ciphertext: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Derive key
  const keyData = encoder.encode(key.slice(0, 32).padEnd(32, "0"));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

/**
 * SECURITY: Verify internal service-to-service calls using HMAC
 * The caller must compute: HMAC-SHA256(timestamp + ":" + action + ":" + secret_name, INTERNAL_SERVICE_TOKEN)
 * and pass it in X-Internal-Signature header along with X-Internal-Timestamp
 */
async function verifyInternalCall(req: Request, body: SecretRequest): Promise<boolean> {
  const signature = req.headers.get("X-Internal-Signature");
  const timestamp = req.headers.get("X-Internal-Timestamp");
  const internalToken = Deno.env.get("INTERNAL_SERVICE_TOKEN");

  if (!signature || !timestamp || !internalToken) {
    return false;
  }

  // Reject requests older than 5 minutes (replay protection)
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > 5 * 60 * 1000) {
    return false;
  }

  // Compute expected HMAC
  const encoder = new TextEncoder();
  const message = `${timestamp}:${body.action}:${body.secret_name}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(internalToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const hmac = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expectedSignature = Array.from(new Uint8Array(hmac))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  // SECURITY: Validate CORS - reject requests from non-allowed origins
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SecretRequest = await req.json();
    const { action, organization_id, project_id, secret_name, secret_value, description, environment, expires_at } = body;

    // Verify user has admin access to organization
    const { data: userRole } = await supabase.rpc("get_org_role", {
      _user_id: user.id,
      _org_id: organization_id,
    });

    if (!userRole || !["owner", "admin"].includes(userRole)) {
      return new Response(
        JSON.stringify({ error: "Admin access required to manage secrets" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (action) {
      case "store": {
        if (!secret_value) {
          return new Response(
            JSON.stringify({ error: "secret_value is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Encrypt the secret
        const encryptedValue = await encrypt(secret_value, EFFECTIVE_ENCRYPTION_KEY);

        // Check if secret already exists
        const { data: existing } = await supabase
          .from("secrets")
          .select("id, version")
          .eq("organization_id", organization_id)
          .eq("name", secret_name)
          .eq("is_active", true)
          .single();

        if (existing) {
          // Update existing secret (rotate)
          const { data: newSecret, error: insertError } = await supabase
            .from("secrets")
            .insert({
              organization_id,
              project_id,
              name: secret_name,
              description,
              encrypted_value: encryptedValue,
              environment,
              expires_at,
              version: existing.version + 1,
              previous_version_id: existing.id,
              created_by: user.id,
              last_rotated_at: new Date().toISOString(),
            })
            .select("id, name, version")
            .single();

          if (insertError) throw insertError;

          // Deactivate old version
          await supabase
            .from("secrets")
            .update({ is_active: false })
            .eq("id", existing.id);

          // Log the rotation
          await supabase.from("audit_logs").insert({
            user_id: user.id,
            organization_id,
            action: "secret_rotated",
            resource_type: "secret",
            resource_id: newSecret?.id,
            metadata: { secret_name, previous_version_id: existing.id },
          });

          return new Response(
            JSON.stringify({ success: true, secret_id: newSecret?.id, version: newSecret?.version }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // Create new secret
          const { data: newSecret, error: insertError } = await supabase
            .from("secrets")
            .insert({
              organization_id,
              project_id,
              name: secret_name,
              description,
              encrypted_value: encryptedValue,
              environment,
              expires_at,
              version: 1,
              created_by: user.id,
            })
            .select("id, name, version")
            .single();

          if (insertError) throw insertError;

          // Log the creation
          await supabase.from("audit_logs").insert({
            user_id: user.id,
            organization_id,
            action: "secret_created",
            resource_type: "secret",
            resource_id: newSecret?.id,
            metadata: { secret_name },
          });

          return new Response(
            JSON.stringify({ success: true, secret_id: newSecret?.id, version: 1 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case "retrieve": {
        // SECURITY: Only allow internal service-to-service calls via HMAC verification
        const isInternalCall = await verifyInternalCall(req, body);
        
        if (!isInternalCall) {
          return new Response(
            JSON.stringify({ error: "Secrets can only be retrieved by authenticated server-side functions" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: secret, error: fetchError } = await supabase
          .from("secrets")
          .select("id, encrypted_value")
          .eq("organization_id", organization_id)
          .eq("name", secret_name)
          .eq("is_active", true)
          .single();

        if (fetchError || !secret) {
          return new Response(
            JSON.stringify({ error: "Secret not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Decrypt
        const decryptedValue = await decrypt(secret.encrypted_value, EFFECTIVE_ENCRYPTION_KEY);

        // Update access tracking
        await supabase
          .from("secrets")
          .update({
            last_accessed_at: new Date().toISOString(),
          })
          .eq("id", secret.id);

        return new Response(
          JSON.stringify({ value: decryptedValue }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "rotate": {
        if (!secret_value) {
          return new Response(
            JSON.stringify({ error: "secret_value is required for rotation" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const encryptedValue = await encrypt(secret_value, EFFECTIVE_ENCRYPTION_KEY);

        const { data: existing } = await supabase
          .from("secrets")
          .select("id, version")
          .eq("organization_id", organization_id)
          .eq("name", secret_name)
          .eq("is_active", true)
          .single();

        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Secret not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: newSecret, error: insertError } = await supabase
          .from("secrets")
          .insert({
            organization_id,
            project_id,
            name: secret_name,
            description,
            encrypted_value: encryptedValue,
            environment,
            version: existing.version + 1,
            previous_version_id: existing.id,
            created_by: user.id,
            last_rotated_at: new Date().toISOString(),
          })
          .select("id, name, version")
          .single();

        if (insertError) throw insertError;

        await supabase
          .from("secrets")
          .update({ is_active: false })
          .eq("id", existing.id);

        await supabase.from("audit_logs").insert({
          user_id: user.id,
          organization_id,
          action: "secret_rotated",
          resource_type: "secret",
          resource_id: newSecret?.id,
          metadata: { secret_name, previous_version_id: existing.id },
        });

        return new Response(
          JSON.stringify({ success: true, secret_id: newSecret?.id, version: newSecret?.version }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { data: existing } = await supabase
          .from("secrets")
          .select("id")
          .eq("organization_id", organization_id)
          .eq("name", secret_name)
          .eq("is_active", true)
          .single();

        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Secret not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Soft delete
        await supabase
          .from("secrets")
          .update({ is_active: false })
          .eq("id", existing.id);

        await supabase.from("audit_logs").insert({
          user_id: user.id,
          organization_id,
          action: "secret_deleted",
          resource_type: "secret",
          resource_id: existing.id,
          metadata: { secret_name },
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...errorCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
