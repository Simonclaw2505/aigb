import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
