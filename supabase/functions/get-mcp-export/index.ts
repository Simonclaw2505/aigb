/**
 * Get MCP Export Edge Function
 * Returns MCP manifest for a project in JSON or YAML format
 * 
 * SECURITY: Requires JWT authentication — only project members can access manifests
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // SECURITY: Validate CORS - reject requests from non-allowed origins
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SECURITY: Require authentication
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

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");
    const version = url.searchParams.get("version");
    const format = url.searchParams.get("format") || "json";

    if (!projectId) {
      return new Response(JSON.stringify({ error: "project_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: Verify user has access to this project
    const { data: accessResult } = await supabase.rpc("can_access_project", {
      _user_id: user.id,
      _project_id: projectId,
    });

    if (!accessResult) {
      return new Response(
        JSON.stringify({ error: "Access denied to project" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("mcp_exports").select("*").eq("project_id", projectId);
    query = version ? query.eq("version", version) : query.eq("is_latest", true);

    const { data, error } = await query.single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Export not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const manifest = data.mcp_manifest;

    if (format === "yaml") {
      return new Response(toYaml(manifest), {
        headers: { ...corsHeaders, "Content-Type": "text/yaml" },
      });
    }

    return new Response(JSON.stringify(manifest, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-MCP-Version": data.version,
      },
    });
  } catch (err) {
    console.error("Error:", err);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...errorCorsHeaders, "Content-Type": "application/json" },
    });
  }
});

function toYaml(obj: unknown, indent = 0): string {
  const sp = "  ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "string") return obj.includes(":") ? `"${obj}"` : obj;
  if (typeof obj !== "object") return String(obj);
  if (Array.isArray(obj)) {
    return obj.length === 0 ? "[]" : obj.map((i) => `${sp}- ${toYaml(i, indent + 1).trimStart()}`).join("\n");
  }
  return Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => {
      const val = toYaml(v, indent + 1);
      return typeof v === "object" && v ? `${sp}${k}:\n${val}` : `${sp}${k}: ${val}`;
    })
    .join("\n");
}
