/**
 * Test API Connection Edge Function
 * Proxies a test request to an external API to verify connectivity
 * 
 * SECURITY: Requires JWT authentication to prevent SSRF abuse
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors } from "../_shared/cors.ts";

const FETCH_TIMEOUT = 15000;

// Block internal/private network ranges to prevent SSRF
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,  // AWS metadata
  /^\[::1\]$/,
  /^metadata\.google\.internal$/i,
];

function isBlockedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return BLOCKED_HOSTS.some(pattern => pattern.test(url.hostname));
  } catch {
    return true; // Block unparseable URLs
  }
}

Deno.serve(async (req) => {
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  const corsHeaders = cors.headers;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // SECURITY: Require authentication
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { base_url, path, method, headers } = await req.json();

    if (!base_url || typeof base_url !== "string") {
      return new Response(
        JSON.stringify({ error: "base_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullUrl = path ? `${base_url.replace(/\/$/, "")}/${path.replace(/^\//, "")}` : base_url;

    try {
      new URL(fullUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Block internal/private network addresses (SSRF prevention)
    if (isBlockedUrl(fullUrl)) {
      return new Response(
        JSON.stringify({ error: "Blocked: internal/private network addresses are not allowed", success: false }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Only allow HTTPS in production
    const url = new URL(fullUrl);
    if (url.protocol !== "https:") {
      return new Response(
        JSON.stringify({ error: "Only HTTPS URLs are allowed", success: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const fetchHeaders: Record<string, string> = {
        "Accept": "application/json, */*",
        ...(headers || {}),
      };

      const response = await fetch(fullUrl, {
        method: method || "GET",
        signal: controller.signal,
        headers: fetchHeaders,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText.slice(0, 2000);
      }

      return new Response(
        JSON.stringify({
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          body: responseBody,
          headers: Object.fromEntries(response.headers.entries()),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if ((fetchError as Error).name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Timeout (15s)", success: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: (fetchError as Error).message, success: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
