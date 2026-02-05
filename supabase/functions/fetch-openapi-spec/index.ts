/**
 * Fetch OpenAPI Spec Edge Function
 * Proxy for fetching OpenAPI specifications from external URLs
 * This bypasses CORS restrictions by fetching server-side
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { validateCors } from "../_shared/cors.ts";

const MAX_CONTENT_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 30000; // 30 seconds

Deno.serve(async (req) => {
  // CORS validation
  const cors = validateCors(req);
  if (cors.response) return cors.response;

  const corsHeaders = cors.headers;

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
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
          JSON.stringify({ 
            error: `Failed to fetch: ${response.status} ${response.statusText}` 
          }),
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
      
      if (fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Request timeout (30s)" }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Fetch failed: ${fetchError.message}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
