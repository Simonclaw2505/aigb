/**
 * CORS Helper with Strict Origin Allowlist
 * 
 * SECURITY: This module enforces a strict origin allowlist instead of using
 * Access-Control-Allow-Origin: * which would allow any website to call our APIs.
 * 
 * Features:
 * - Reads ALLOWED_ORIGINS from environment (comma-separated)
 * - Allows localhost:3000 only in development mode
 * - Returns 403 for requests from non-allowed origins
 * - Sets Access-Control-Allow-Origin to the specific validated origin (not *)
 * - Sets Vary: Origin to ensure proper caching
 * - Handles OPTIONS preflight requests correctly
 */

// Determine if we're in development mode
// Development is detected via DENO_DEPLOYMENT_ID (absent in local dev) or explicit ENVIRONMENT
const isDevelopment = (): boolean => {
  const deploymentId = Deno.env.get("DENO_DEPLOYMENT_ID");
  const environment = Deno.env.get("ENVIRONMENT");
  
  // If ENVIRONMENT is explicitly set, use that
  if (environment) {
    return environment.toLowerCase() === "development";
  }
  
  // No deployment ID means local development
  return !deploymentId;
};

// Parse allowed origins from environment variable
const getAllowedOrigins = (): Set<string> => {
  const origins = new Set<string>();
  
  // Parse ALLOWED_ORIGINS env var (comma-separated)
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS") || "";
  if (allowedOriginsEnv) {
    allowedOriginsEnv.split(",").forEach(origin => {
      const trimmed = origin.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    });
  }
  
  // Always allow the Supabase project's own origins
  const supabaseProjectId = Deno.env.get("SUPABASE_PROJECT_ID");
  if (supabaseProjectId) {
    origins.add(`https://${supabaseProjectId}.supabase.co`);
  }
  
  // Allow Lovable preview URLs (common pattern)
  // These are dynamically generated so we check the pattern in isOriginAllowed
  
  // In development, also allow localhost
  if (isDevelopment()) {
    origins.add("http://localhost:3000");
    origins.add("http://localhost:5173"); // Vite default
    origins.add("http://localhost:8080");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://127.0.0.1:5173");
    origins.add("http://127.0.0.1:8080");
  }
  
  return origins;
};

// Check if an origin is allowed
const isOriginAllowed = (origin: string): boolean => {
  const allowedOrigins = getAllowedOrigins();
  
  // Direct match
  if (allowedOrigins.has(origin)) {
    return true;
  }
  
  // Check for Lovable preview URLs pattern
  // Pattern: https://*--*.lovable.app or https://*.lovableproject.com
  if (origin.match(/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.lovable\.app$/)) {
    return true;
  }
  
  // Published app URLs (e.g. https://aigb.lovable.app)
  if (origin.match(/^https:\/\/[a-z0-9-]+\.lovable\.app$/)) {
    return true;
  }
  
  if (origin.match(/^https:\/\/[a-z0-9-]+\.lovableproject\.com$/)) {
    return true;
  }
  
  // Check for Supabase function URLs (same project)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl && origin === supabaseUrl) {
    return true;
  }
  
  return false;
};

// Headers that our app sends and needs to be allowed in CORS
const ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
  "x-internal-call", // For internal edge function calls
  "x-api-key", // For agent API key authentication
  "x-operator-key", // For operator key authentication
].join(", ");

// Allowed HTTP methods
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";

// Maximum time browsers can cache preflight response (24 hours)
const MAX_AGE = "86400";

export interface CorsResult {
  allowed: boolean;
  headers: HeadersInit;
}

/**
 * Validates the request origin and returns appropriate CORS headers.
 * 
 * @param request - The incoming request
 * @returns CorsResult with allowed status and headers to apply
 * 
 * SECURITY NOTES:
 * 1. We check the Origin header, which browsers set automatically for cross-origin requests
 * 2. If Origin is absent, this is likely a same-origin or server-to-server request
 * 3. We return the specific validated origin in Access-Control-Allow-Origin, not *
 * 4. Vary: Origin ensures caches don't mix responses for different origins
 */
export function getCorsHeaders(request: Request): CorsResult {
  const origin = request.headers.get("Origin");
  
  // Base headers that are always set
  const baseHeaders: Record<string, string> = {
    // Vary: Origin is critical for proper caching
    // Without it, a cached response for one origin could be served to another
    "Vary": "Origin",
  };
  
  // If no Origin header, this is likely:
  // 1. A same-origin request (browser doesn't send Origin)
  // 2. A server-to-server request (e.g., from another edge function)
  // 3. A tool like curl
  // We allow these but don't set CORS headers since they're not needed
  if (!origin) {
    return {
      allowed: true,
      headers: baseHeaders,
    };
  }
  
  // Check if origin is in our allowlist
  if (!isOriginAllowed(origin)) {
    // SECURITY: Reject requests from non-allowed origins
    // We still set Vary: Origin for caching correctness
    return {
      allowed: false,
      headers: baseHeaders,
    };
  }
  
  // Origin is allowed - return full CORS headers
  return {
    allowed: true,
    headers: {
      ...baseHeaders,
      // SECURITY: Set to the specific validated origin, not *
      // This prevents other websites from accessing our API
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": ALLOWED_HEADERS,
      "Access-Control-Allow-Methods": ALLOWED_METHODS,
      // Allow credentials (cookies, auth headers)
      "Access-Control-Allow-Credentials": "true",
      // How long browsers can cache this preflight response
      "Access-Control-Max-Age": MAX_AGE,
    },
  };
}

/**
 * Handle OPTIONS preflight requests.
 * 
 * Browsers send OPTIONS requests before certain cross-origin requests
 * to check if the actual request is allowed. This is called a "preflight".
 * 
 * @param request - The OPTIONS request
 * @returns Response with appropriate CORS headers or 403 if origin not allowed
 */
export function handlePreflight(request: Request): Response {
  const { allowed, headers } = getCorsHeaders(request);
  
  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      {
        status: 403,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }
  
  // Successful preflight - return 204 No Content with CORS headers
  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Middleware-style function to validate origin and prepare response headers.
 * 
 * Usage:
 *   const cors = validateCors(req);
 *   if (cors.response) return cors.response; // Origin was rejected
 *   // ... handle request ...
 *   return new Response(data, { headers: { ...cors.headers, "Content-Type": "application/json" } });
 * 
 * @param request - The incoming request
 * @returns Object with headers to use, and optional response if origin was rejected
 */
export function validateCors(request: Request): { headers: HeadersInit; response?: Response } {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return { headers: {}, response: handlePreflight(request) };
  }
  
  const { allowed, headers } = getCorsHeaders(request);
  
  if (!allowed) {
    return {
      headers,
      response: new Response(
        JSON.stringify({ error: "Origin not allowed" }),
        {
          status: 403,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      ),
    };
  }
  
  return { headers };
}

/**
 * Helper to add CORS headers to an existing Response.
 * Useful when you need to modify headers on a response that's already been created.
 */
export function addCorsHeaders(response: Response, request: Request): Response {
  const { headers } = getCorsHeaders(request);
  
  const newHeaders = new Headers(response.headers);
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value as string);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
