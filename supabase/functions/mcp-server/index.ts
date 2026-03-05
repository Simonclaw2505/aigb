/**
 * MCP Server Edge Function - AIGB
 * MCP JSON-RPC 2.0 over HTTP
 * Auth: X-API-Key -> SHA-256 -> agent_api_keys.key_hash lookup
 *
 * Security hardening v2:
 *   - 100 KB body size limit
 *   - Method allowlist (405 for unknown methods)
 *   - API key format validation (must start with mcpf_)
 *   - JSON-RPC 2.0 envelope validation
 *   - 50 KB argument size limit for tools/call
 *   - ping health-check method
 *   - POST-only (405 for other verbs)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Maximum allowed request body size (100 KB). */
const MAX_BODY_BYTES = 102_400;

/** Maximum allowed JSON-serialised arguments for tools/call (50 KB). */
const MAX_ARGS_BYTES = 51_200;

/** JSON-RPC methods this server handles. Anything else -> -32601. */
const ALLOWED_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "tools/list",
  "tools/call",
  "ping",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function rpcOk(id: unknown, result: unknown): Response {
  return jsonResp({ jsonrpc: "2.0", id, result });
}

function rpcErr(id: unknown, code: number, message: string, data?: unknown): Response {
  return jsonResp({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
}

function httpErr(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only POST is accepted
  if (req.method !== "POST") {
    return httpErr("Method Not Allowed — use POST", 405);
  }

  // ── Body size guard ────────────────────────────────────────────────────────
  const clHeader = Number(req.headers.get("content-length") ?? "0");
  if (clHeader > MAX_BODY_BYTES) {
    return rpcErr(null, -32600, `Request body too large (max ${MAX_BODY_BYTES / 1024} KB)`);
  }

  let rawBody: string;
  try {
    // Read with a hard cap to protect against missing Content-Length
    const bytes = await req.arrayBuffer();
    if (bytes.byteLength > MAX_BODY_BYTES) {
      return rpcErr(null, -32600, `Request body too large (max ${MAX_BODY_BYTES / 1024} KB)`);
    }
    rawBody = new TextDecoder().decode(bytes);
  } catch {
    return rpcErr(null, -32700, "Failed to read request body");
  }

  // ── Parse JSON ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return rpcErr(null, -32700, "Parse error — body is not valid JSON");
  }

  const { id = null } = body;

  // ── JSON-RPC 2.0 envelope validation ──────────────────────────────────────
  if (body.jsonrpc !== "2.0") {
    return rpcErr(id, -32600, "Invalid Request — jsonrpc field must be '2.0'");
  }
  if (typeof body.method !== "string" || body.method.trim() === "") {
    return rpcErr(id, -32600, "Invalid Request — method must be a non-empty string");
  }

  const method = body.method as string;

  // ── Method allowlist ───────────────────────────────────────────────────────
  if (!ALLOWED_METHODS.has(method)) {
    return rpcErr(id, -32601, `Method not supported: ${method}`);
  }

  // ── ping (unauthenticated health-check) ────────────────────────────────────
  if (method === "ping") {
    return rpcOk(id, { status: "ok", ts: new Date().toISOString() });
  }

  // ── API key validation ─────────────────────────────────────────────────────
  let rawKey = req.headers.get("x-api-key") ?? "";
  if (!rawKey) {
    const authHeader = req.headers.get("authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      rawKey = authHeader.slice(7);
    }
  }

  if (!rawKey) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32600, message: "Missing API key — send via X-API-Key or Authorization: Bearer header" } }, 401);
  }

  // Format check — all valid keys are prefixed with mcpf_
  if (!rawKey.startsWith("mcpf_")) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid API key format" } }, 401);
  }

  const encoder = new TextEncoder();
  const keyHash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(rawKey)))
  ).map((b) => b.toString(16).padStart(2, "0")).join("");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Look up key
  const { data: keyRow, error: keyError } = await supabase
    .from("agent_api_keys")
    .select("id, project_id, is_active, expires_at, usage_count")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32603, message: "Database error" } }, 500);
  }
  if (!keyRow) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid API key" } }, 401);
  }
  if (!keyRow.is_active) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32600, message: "API key is revoked" } }, 401);
  }
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return jsonResp({ jsonrpc: "2.0", id, error: { code: -32600, message: "API key has expired" } }, 401);
  }

  // Update usage stats (fire-and-forget, non-blocking)
  supabase
    .from("agent_api_keys")
    .update({ usage_count: (keyRow.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => {});

  const projectId: string = keyRow.project_id;

  // ── Route authenticated methods ────────────────────────────────────────────

  if (method === "initialize" || method === "notifications/initialized") {
    return rpcOk(id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "AIGB MCP Gateway", version: "2.0" },
      capabilities: { tools: {} },
    });
  }

  if (method === "tools/list") {
    const { data: capabilities, error: capError } = await supabase
      .from("agent_capabilities")
      .select("action_template_id, policy, action_templates(id, name, description, input_schema)")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .neq("policy", "deny");

    if (capError) return rpcErr(id, -32603, "Failed to load tools");

    const tools = (capabilities ?? []).map((cap: Record<string, unknown>) => {
      const tpl = cap.action_templates as Record<string, unknown>;
      return {
        name: tpl?.name ?? tpl?.id,
        description: `[${cap.policy}] ${tpl?.description ?? tpl?.name}`,
        inputSchema: tpl?.input_schema ?? { type: "object", properties: {} },
      };
    });

    return rpcOk(id, { tools });
  }

  if (method === "tools/call") {
    const params = body.params as Record<string, unknown> ?? {};
    const toolName = params.name as string;
    const toolArgs = params.arguments ?? {};

    if (!toolName) return rpcErr(id, -32602, "Missing params.name");

    // ── Argument size guard ────────────────────────────────────────────────
    const argsJson = JSON.stringify(toolArgs);
    if (argsJson.length > MAX_ARGS_BYTES) {
      return rpcErr(id, -32602, `Tool arguments too large (max ${MAX_ARGS_BYTES / 1024} KB)`);
    }

    // ── Resolve tool name to action_template_id (support both UUID and name) ──
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-/;
    let resolvedTemplateId = toolName;
    if (!uuidRegex.test(toolName)) {
      const { data: tpl } = await supabase
        .from("action_templates")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", toolName)
        .maybeSingle();
      if (tpl) resolvedTemplateId = tpl.id;
    }

    // Verify the tool is allowed for this project
    const { data: capability } = await supabase
      .from("agent_capabilities")
      .select("policy, action_templates(id, name, description, input_schema)")
      .eq("project_id", projectId)
      .eq("action_template_id", resolvedTemplateId)
      .eq("is_active", true)
      .maybeSingle();

    if (!capability) return rpcErr(id, -32602, "Tool not found or not permitted for this project");
    if (capability.policy === "deny") return rpcErr(id, -32602, "Tool denied by policy");
    if (capability.policy === "require_approval") {
      await supabase.from("approval_requests").insert({
        project_id: projectId,
        action_template_id: resolvedTemplateId,
        input_parameters: toolArgs,
        requested_by: "agent",
        status: "pending",
      });
      return rpcOk(id, { content: [{ type: "text", text: JSON.stringify({ status: "pending_approval", message: "Human approval required." }) }] });
    }

    // Forward to action-runner
    const runnerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/action-runner`;
    const runnerResp = await fetch(runnerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-mcp-server-call": "true",
      },
      body: JSON.stringify({ action_template_id: resolvedTemplateId, input_parameters: toolArgs }),
    });

    if (!runnerResp.ok) {
      return rpcErr(id, -32603, `action-runner error: ${runnerResp.status}`);
    }

    const runnerData = await runnerResp.json();
    return rpcOk(id, { content: [{ type: "text", text: JSON.stringify(runnerData) }] });
  }

  // Should never reach here given the ALLOWED_METHODS guard above
  return rpcErr(id, -32601, "Method not found");
});
