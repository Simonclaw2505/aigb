/**
 * Fetch OpenAPI Spec Edge Function
 * Proxy for fetching OpenAPI specifications from external URLs
 * This bypasses CORS restrictions by fetching server-side
 * 
 * SECURITY: Requires JWT authentication to prevent abuse
 * SECURITY: SSRF protection via IP blocklist
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 30000; // 30 seconds

// SECURITY: Block internal/private network ranges to prevent SSRF
const BLOCKED_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./, // AWS metadata
  /^\[::1\]$/,
  /^metadata\.google\.internal$/i,
];

function isBlockedUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return BLOCKED_HOSTS.some(pattern => pattern.test(url.hostname));
  } catch {
    return true;
  }
}

// Security headers added to all responses
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

Deno.serve(async (req) => {
  // CORS validation
  const cors = validateCors(req);
  if (cors.response) return cors.response;

  const corsHeaders = { ...cors.headers, ...SECURITY_HEADERS };

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // SECURITY: Require JWT authentication
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

    const { url } = await req.json();

    // Validate URL
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Must be HTTPS
    if (!url.startsWith("https://")) {
      return new Response(
        JSON.stringify({ error: "Only HTTPS URLs are allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Block internal/private network addresses (SSRF prevention)
    if (isBlockedUrl(url)) {
      return new Response(
        JSON.stringify({ error: "Blocked: internal/private network addresses are not allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json, application/yaml, text/yaml, */*",
          "User-Agent": "MCP-Bridge-OpenAPI-Fetcher/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch: ${response.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check content length
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) {
        return new Response(
          JSON.stringify({ error: "Content too large (max 5MB)" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const content = await response.text();

      // Verify size after reading
      if (content.length > MAX_CONTENT_SIZE) {
        return new Response(
          JSON.stringify({ error: "Content too large (max 5MB)" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          content,
          contentType: response.headers.get("content-type") || "text/plain"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if ((fetchError as Error).name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Request timeout (30s)" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to fetch the specified URL" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("fetch-openapi-spec error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...errorCorsHeaders, ...SECURITY_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
