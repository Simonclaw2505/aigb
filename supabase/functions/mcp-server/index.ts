import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, x-operator-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcOk(id: string | number | null, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function rpcErr(id: string | number | null, code: number, message: string, status = 200): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const rawKey =
    req.headers.get("X-API-Key") ||
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!rawKey) return rpcErr(null, -32001, "Unauthorized: provide X-API-Key header", 401);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: keyRecord } = await supabase
    .from("agent_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (!keyRecord) return rpcErr(null, -32001, "Invalid or revoked API key", 401);
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date())
    return rpcErr(null, -32001, "API key expired", 401);

  supabase.from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString(), usage_count: (keyRecord.usage_count || 0) + 1 })
    .eq("id", keyRecord.id).then(() => {});

  const projectId: string = keyRecord.project_id;
  const orgId: string = keyRecord.organization_id;
  const callerUserId: string = keyRecord.created_by || "agent";

  let body: JsonRpcRequest;
  try { body = await req.json(); }
  catch { return rpcErr(null, -32700, "Parse error: invalid JSON"); }

  const { id, method, params } = body;

  switch (method) {
    case "initialize": {
      await supabase.from("audit_logs").insert({
        user_id: callerUserId, organization_id: orgId,
        action: "mcp_initialized", resource_type: "agent", resource_id: projectId,
        metadata: { client_info: params?.clientInfo, protocol_version: params?.protocolVersion },
      });
      return rpcOk(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "AIGB MCP Server", version: "1.0.0" },
      });
    }

    case "notifications/initialized":
      return new Response("", { status: 204, headers: CORS_HEADERS });

    case "ping":
      return rpcOk(id, {});

    case "tools/list": {
      const { data: actions } = await supabase
        .from("action_templates")
        .select("id, name, description, input_schema, risk_level, requires_approval, agent_policy")
        .eq("project_id", projectId)
        .eq("is_enabled", true)
        .eq("status", "active");

      const { data: capabilities } = await supabase
        .from("agent_capabilities")
        .select("action_template_id, policy")
        .eq("project_id", projectId)
        .eq("is_active", true);

      const capMap = new Map((capabilities || []).map((c) => [c.action_template_id, c.policy]));

      const tools = (actions || [])
        .filter((a) => capMap.get(a.id) !== "deny" && a.agent_policy !== "deny")
        .map((a) => {
          let desc = a.description || a.name;
          if (a.risk_level && a.risk_level !== "read_only") desc += ` ⚠️ Risk: ${a.risk_level}`;
          if (a.requires_approval) desc += " — requires human approval.";
          if (capMap.get(a.id) === "require_confirmation") desc += " — requires confirmation.";
          return {
            name: a.name,
            description: desc,
            inputSchema: (a.input_schema as Record<string, unknown>) || { type: "object", properties: {} },
          };
        });

      return rpcOk(id, { tools });
    }

    case "tools/call": {
      const toolName = params?.name as string | undefined;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};
      if (!toolName) return rpcErr(id, -32602, "Missing tool name");

      const { data: action } = await supabase
        .from("action_templates")
        .select("id, name, agent_policy, requires_approval")
        .eq("project_id", projectId)
        .eq("name", toolName)
        .eq("is_enabled", true)
        .single();

      if (!action) return rpcErr(id, -32602, `Tool not found: ${toolName}`);

      const { data: cap } = await supabase
        .from("agent_capabilities")
        .select("policy")
        .eq("project_id", projectId)
        .eq("action_template_id", action.id)
        .eq("is_active", true)
        .single();

      const effectivePolicy = cap?.policy || action.agent_policy || "allow";

      if (effectivePolicy === "deny") {
        return rpcOk(id, { content: [{ type: "text", text: `Action "${toolName}" is denied for this agent.` }], isError: true });
      }

      if (effectivePolicy === "require_approval") {
        const { data: approvalReq } = await supabase.from("approval_requests").insert({
          organization_id: orgId,
          policy_id: orgId,
          resource_id: action.id,
          resource_type: "action_template",
          action_type: "execute",
          requested_by: callerUserId,
          request_data: { inputs: toolArgs, mcp_call: true },
          status: "pending",
        }).select("id").single();
        return rpcOk(id, {
          content: [{ type: "text", text: `Action "${toolName}" requires approval. Request submitted (ID: ${approvalReq?.id}). Ask a human approver to review in the AIGB dashboard.` }],
        });
      }

      const runnerRes = await fetch(`${supabaseUrl}/functions/v1/action-runner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": rawKey,
          ...(req.headers.get("X-Operator-Key") ? { "X-Operator-Key": req.headers.get("X-Operator-Key")! } : {}),
        },
        body: JSON.stringify({ action_template_id: action.id, inputs: toolArgs }),
      });

      const result = await runnerRes.json();

      await supabase.from("audit_logs").insert({
        user_id: callerUserId, organization_id: orgId,
        action: "mcp_tool_called", resource_type: "action_template", resource_id: action.id,
        metadata: { tool: toolName, execution_id: result.execution_id, success: result.success },
      });

      if (!result.success) {
        return rpcOk(id, { content: [{ type: "text", text: `Error: ${result.error || "Action failed"}` }], isError: true });
      }

      return rpcOk(id, {
        content: [{ type: "text", text: typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2) }],
      });
    }

    default:
      return rpcErr(id, -32601, `Method not found: ${method}`);
  }
});
