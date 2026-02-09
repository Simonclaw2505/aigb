/**
 * Test API Connection Edge Function
 * Proxies a test request to an external API to verify connectivity
 */

import { validateCors } from "../_shared/cors.ts";

const FETCH_TIMEOUT = 15000;

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
      if (fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Timeout (15s)", success: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: fetchError.message, success: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
