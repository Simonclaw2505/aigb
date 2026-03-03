/**
 * Action Runner Edge Function
 * Robust execution engine with validation, constraints, retries, idempotency
 * All secrets are handled server-side and never exposed to clients
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

interface RunActionRequest {
  action_template_id: string;
  inputs: Record<string, unknown>;
  idempotency_key?: string;
  environment?: "development" | "staging" | "production";
  dry_run?: boolean;
}

interface ActionResult {
  success: boolean;
  execution_id: string;
  status: "success" | "failed" | "rate_limited" | "idempotent_duplicate";
  data?: unknown;
  error?: string;
  retries_used: number;
  duration_ms: number;
  redacted_request: Record<string, unknown>;
  redacted_response: Record<string, unknown>;
}

// Patterns for redacting sensitive data
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /bearer/i,
  /authorization/i,
  /credential/i,
  /private/i,
  /auth/i,
];

function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 10) return "[MAX_DEPTH]";
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    // Check if it looks like a token/key
    if (obj.length > 20 && /^[A-Za-z0-9_-]+$/.test(obj)) {
      return `[REDACTED:${obj.slice(0, 4)}...${obj.slice(-4)}]`;
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1));
  }
  
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      if (isSensitiveKey && typeof value === "string") {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return result;
  }
  
  return obj;
}

async function decryptIfNeeded(storedValue: string): Promise<string> {
  const encryptionKey = Deno.env.get("SECRETS_ENCRYPTION_KEY");
  if (!encryptionKey) return storedValue;
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const combined = Uint8Array.from(atob(storedValue), (c) => c.charCodeAt(0));
    if (combined.length < 13) throw new Error("too short");
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    const keyData = encoder.encode(encryptionKey.slice(0, 32).padEnd(32, "0"));
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encrypted);
    return decoder.decode(decrypted);
  } catch {
    return storedValue;
  }
}

function validateInputSchema(inputs: Record<string, unknown>, schema: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const schemaProps = (schema.properties || {}) as Record<string, { type?: string; required?: boolean; maxLength?: number; minimum?: number; maximum?: number }>;
  const requiredFields = (schema.required || []) as string[];
  
  // Check required fields
  for (const field of requiredFields) {
    if (inputs[field] === undefined || inputs[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate types and constraints
  const hasDefinedProperties = Object.keys(schemaProps).length > 0;
  
  for (const [field, value] of Object.entries(inputs)) {
    const fieldSchema = schemaProps[field];
    if (!fieldSchema) {
      // Only reject unknown fields if the schema explicitly defines properties
      if (hasDefinedProperties) {
        errors.push(`Unknown field: ${field}`);
      }
      continue;
    }
    
    // Type checking
    if (fieldSchema.type) {
      const actualType = Array.isArray(value) ? "array" : typeof value;
      if (fieldSchema.type !== actualType && value !== null) {
        errors.push(`Field ${field}: expected ${fieldSchema.type}, got ${actualType}`);
      }
    }
    
    // String constraints
    if (typeof value === "string" && fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      errors.push(`Field ${field}: exceeds max length of ${fieldSchema.maxLength}`);
    }
    
    // Number constraints
    if (typeof value === "number") {
      if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
        errors.push(`Field ${field}: below minimum value of ${fieldSchema.minimum}`);
      }
      if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
        errors.push(`Field ${field}: exceeds maximum value of ${fieldSchema.maximum}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function applyConstraints(
  inputs: Record<string, unknown>,
  constraints: Record<string, unknown>
): { valid: boolean; errors: string[]; modified: Record<string, unknown> } {
  const errors: string[] = [];
  const modified = { ...inputs };
  
  // Max rows constraint
  if (constraints.max_rows && typeof modified.limit === "number") {
    const maxRows = constraints.max_rows as number;
    if (modified.limit > maxRows) {
      modified.limit = maxRows;
      errors.push(`Limit reduced to max_rows constraint: ${maxRows}`);
    }
  }
  
  // Allowed fields constraint
  if (constraints.allowed_fields && Array.isArray(constraints.allowed_fields)) {
    const allowedFields = constraints.allowed_fields as string[];
    for (const field of Object.keys(modified)) {
      if (!allowedFields.includes(field) && field !== "limit" && field !== "offset") {
        delete modified[field];
        errors.push(`Field ${field} removed: not in allowed_fields`);
      }
    }
  }
  
  // Blocked values constraint
  if (constraints.blocked_values && typeof constraints.blocked_values === "object") {
    for (const [field, blockedList] of Object.entries(constraints.blocked_values as Record<string, unknown[]>)) {
      if (modified[field] && blockedList.includes(modified[field])) {
        errors.push(`Field ${field} contains blocked value`);
        return { valid: false, errors, modified };
      }
    }
  }
  
  return { valid: true, errors, modified };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryConfig: { max_retries: number; backoff_ms: number; backoff_multiplier: number },
  isReadOnly: boolean
): Promise<{ response: Response; retries: number }> {
  let lastError: Error | null = null;
  let retries = 0;
  
  // Only retry for read-only (safe) operations
  const maxRetries = isReadOnly ? retryConfig.max_retries : 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Don't retry on client errors (4xx) except rate limiting
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { response, retries };
      }
      
      // Retry on server errors or rate limiting
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const backoff = retryConfig.backoff_ms * Math.pow(retryConfig.backoff_multiplier, attempt);
          await sleep(backoff);
          retries++;
          continue;
        }
      }
      
      return { response, retries };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const backoff = retryConfig.backoff_ms * Math.pow(retryConfig.backoff_multiplier, attempt);
        await sleep(backoff);
        retries++;
      }
    }
  }
  
  throw lastError || new Error("Request failed after retries");
}

/**
 * Apply a body_template to transform flat inputs into a nested API payload.
 * Replaces {{field}} placeholders with actual input values.
 */
function applyBodyTemplate(template: unknown, inputs: Record<string, unknown>): unknown {
  if (typeof template === "string") {
    // Check if the entire string is a single placeholder like "{{field}}"
    const match = template.match(/^\{\{(\w+)\}\}$/);
    if (match) {
      return inputs[match[1]] !== undefined ? inputs[match[1]] : template;
    }
    // Replace inline placeholders
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return inputs[key] !== undefined ? String(inputs[key]) : `{{${key}}}`;
    });
  }
  if (Array.isArray(template)) {
    return template.map(item => applyBodyTemplate(item, inputs));
  }
  if (template !== null && typeof template === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
      result[key] = applyBodyTemplate(value, inputs);
    }
    return result;
  }
  return template;
}

serve(async (req) => {
  // SECURITY: Validate CORS - reject requests from non-allowed origins
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  // Helper to create responses with validated CORS headers
  const corsHeaders = cors.headers;

  const startTime = Date.now();
  let executionId = "";

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate: support Bearer token, X-API-Key, and X-Operator-Key
    const apiKey = req.headers.get("X-API-Key");
    const operatorKey = req.headers.get("X-Operator-Key");
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");

    let user: { id: string } | null = null;
    let authenticatedViaApiKey = false;
    let apiKeyProjectId: string | null = null;
    let apiKeyOrgId: string | null = null;
    let operatorKeyHash: string | null = null;

    if (apiKey) {
      // API Key authentication for agents
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");

      const { data: keyRecord, error: keyError } = await supabase
        .from("agent_api_keys")
        .select("*")
        .eq("key_hash", keyHash)
        .eq("is_active", true)
        .single();

      if (keyError || !keyRecord) {
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check expiration
      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "API key expired" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update usage stats
      await supabase
        .from("agent_api_keys")
        .update({
          last_used_at: new Date().toISOString(),
          usage_count: (keyRecord.usage_count || 0) + 1,
        })
        .eq("id", keyRecord.id);

      authenticatedViaApiKey = true;
      apiKeyProjectId = keyRecord.project_id;
      apiKeyOrgId = keyRecord.organization_id;
      user = { id: keyRecord.created_by || "agent" };
    } else if (authHeader) {
      // Bearer token authentication (existing flow)
      const { data: authData, error: authError } = await supabase.auth.getUser(authHeader);
      if (authError || !authData?.user) {
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      user = authData.user;
    } else {
      return new Response(
        JSON.stringify({ error: "Unauthorized — provide Authorization or X-API-Key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If X-Operator-Key is provided, hash it for permission evaluation
    if (operatorKey) {
      const encoder = new TextEncoder();
      const data = encoder.encode(operatorKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      operatorKeyHash = hashArray.map((b: number) => b.toString(16).padStart(2, "0")).join("");
    }

    const body: RunActionRequest = await req.json();
    const { action_template_id, inputs, idempotency_key, environment = "development", dry_run = false } = body;

    // Fetch action template with project and connector info
    const { data: action, error: actionError } = await supabase
      .from("action_templates")
      .select(`
        *,
        project:projects(id, organization_id, name),
        endpoint:endpoints(id, path, method, api_source_id)
      `)
      .eq("id", action_template_id)
      .single();

    if (actionError || !action) {
      return new Response(
        JSON.stringify({ error: "Action not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const project = action.project as { id: string; organization_id: string; name: string };

    // If authenticated via API key, verify project match
    if (authenticatedViaApiKey && apiKeyProjectId !== project.id) {
      return new Response(
        JSON.stringify({ error: "API key not authorized for this project" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify permission (skip for API key auth — key implies permission)
    if (!authenticatedViaApiKey) {
      const { data: permResult } = await supabase.rpc("evaluate_permission", {
        _user_id: user!.id,
        _organization_id: project.organization_id,
        _resource_type: "action",
        _resource_id: action_template_id,
        _action: "execute",
        _context: {},
      });

      if (!permResult?.[0]?.allowed) {
        return new Response(
          JSON.stringify({ error: "Permission denied", reason: permResult?.[0]?.denial_reason }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check idempotency
    if (idempotency_key) {
      const { data: existingRun } = await supabase
        .from("execution_runs")
        .select("id, status, output_data")
        .eq("action_template_id", action_template_id)
        .eq("idempotency_key", idempotency_key)
        .single();

      if (existingRun) {
        return new Response(
          JSON.stringify({
            success: true,
            execution_id: existingRun.id,
            status: "idempotent_duplicate",
            data: existingRun.output_data,
            retries_used: 0,
            duration_ms: Date.now() - startTime,
            redacted_request: redactSensitiveData(inputs) as Record<string, unknown>,
            redacted_response: redactSensitiveData(existingRun.output_data) as Record<string, unknown>,
          } as ActionResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check rate limits from agent capabilities
    const { data: capability } = await supabase
      .from("agent_capabilities")
      .select("*")
      .eq("project_id", project.id)
      .eq("action_template_id", action_template_id)
      .eq("is_active", true)
      .single();

    if (capability?.max_executions_per_hour) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("execution_runs")
        .select("*", { count: "exact", head: true })
        .eq("action_template_id", action_template_id)
        .gte("created_at", hourAgo);

      if ((count || 0) >= capability.max_executions_per_hour) {
        return new Response(
          JSON.stringify({
            success: false,
            execution_id: "",
            status: "rate_limited",
            error: `Rate limit exceeded: ${capability.max_executions_per_hour}/hour`,
            retries_used: 0,
            duration_ms: Date.now() - startTime,
            redacted_request: redactSensitiveData(inputs) as Record<string, unknown>,
            redacted_response: {},
          } as ActionResult),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Validate input schema
    const inputSchema = action.input_schema as Record<string, unknown>;
    const validation = validateInputSchema(inputs, inputSchema);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          execution_id: "",
          status: "failed",
          error: `Validation failed: ${validation.errors.join(", ")}`,
          retries_used: 0,
          duration_ms: Date.now() - startTime,
          redacted_request: redactSensitiveData(inputs) as Record<string, unknown>,
          redacted_response: {},
        } as ActionResult),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply constraints
    const constraints = (action.constraints || {}) as Record<string, unknown>;
    const constraintResult = applyConstraints(inputs, constraints);
    if (!constraintResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          execution_id: "",
          status: "failed",
          error: `Constraint violation: ${constraintResult.errors.join(", ")}`,
          retries_used: 0,
          duration_ms: Date.now() - startTime,
          redacted_request: redactSensitiveData(inputs) as Record<string, unknown>,
          redacted_response: {},
        } as ActionResult),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const modifiedInputs = constraintResult.modified;

    // Fetch connector for API calls
    const endpoint = action.endpoint as { id: string; path: string; method: string; api_source_id: string } | null;
    let connector = null;

    if (endpoint) {
      const { data: connectorData, error: connectorError } = await supabase
        .from("api_connectors")
        .select("*")
        .eq("api_source_id", endpoint.api_source_id)
        .eq("is_active", true)
        .single();

      if (connectorError || !connectorData) {
        console.warn(`No active connector found for api_source_id=${endpoint.api_source_id}, action=${action.name}`);
      }
      connector = connectorData;
    } else {
      console.warn(`Action "${action.name}" has no linked endpoint — will run in simulated mode`);
    }

    // Create execution run record
    const { data: executionRun, error: runError } = await supabase
      .from("execution_runs")
      .insert({
        organization_id: project.organization_id,
        project_id: project.id,
        action_template_id,
        connector_id: connector?.id,
        agent_session_id: crypto.randomUUID(),
        environment,
        triggered_by: authenticatedViaApiKey ? "agent" : "user",
        triggered_by_id: user!.id,
        input_parameters: modifiedInputs,
        idempotency_key,
        status: dry_run ? "success" : "running",
        started_at: new Date().toISOString(),
        redacted_request: redactSensitiveData(modifiedInputs),
      })
      .select()
      .single();

    if (runError || !executionRun) {
      throw new Error("Failed to create execution run");
    }

    executionId = executionRun.id;

    // If dry run, return preview
    if (dry_run) {
      const dryRunResult: ActionResult = {
        success: true,
        execution_id: executionId,
        status: "success",
        data: {
          dry_run: true,
          would_execute: {
            method: endpoint?.method || action.endpoint_method,
            path: endpoint?.path || action.endpoint_path,
            inputs: modifiedInputs,
          },
          constraints_applied: constraintResult.errors,
        },
        retries_used: 0,
        duration_ms: Date.now() - startTime,
        redacted_request: redactSensitiveData(modifiedInputs) as Record<string, unknown>,
        redacted_response: {},
      };

      await supabase
        .from("execution_runs")
        .update({
          status: "success",
          output_data: dryRunResult.data,
          redacted_response: dryRunResult.data,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq("id", executionId);

      return new Response(
        JSON.stringify(dryRunResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute the actual API call
    let apiResponse: unknown;
    let retriesUsed = 0;

    if (connector) {
      // Get credentials from secrets (server-side only)
      let authHeaders: Record<string, string> = {};

      if (connector.credential_secret_id) {
        const { data: secret } = await supabase
          .from("secrets")
          .select("encrypted_value")
          .eq("id", connector.credential_secret_id)
          .eq("is_active", true)
          .single();

        if (secret) {
          const credentialValue = await decryptIfNeeded(secret.encrypted_value);
          const authConfig = connector.auth_config as { header_name?: string; prefix?: string };
          const headerName = authConfig.header_name || "Authorization";
          const prefix = authConfig.prefix || "";
          authHeaders[headerName] = prefix ? `${prefix} ${credentialValue}`.trim() : credentialValue;
        }
      }

      // Build request URL
      const baseUrl = connector.base_url.replace(/\/$/, "");
      const path = (endpoint?.path || action.endpoint_path || "").replace(/^\//, "");
      const url = `${baseUrl}/${path}`;

      // Build request options
      const method = endpoint?.method || action.endpoint_method || "GET";
      const isReadOnly = ["GET", "HEAD", "OPTIONS"].includes(method);

      const requestOptions: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...connector.default_headers as Record<string, string>,
          ...authHeaders,
        },
      };

      if (!isReadOnly && Object.keys(modifiedInputs).length > 0) {
        // Apply body_template transformation if defined in constraints
        const bodyTemplate = (constraints as Record<string, unknown>).body_template;
        if (bodyTemplate && typeof bodyTemplate === "object") {
          // Flatten: if inputs have a nested "body" object, merge its keys to top level
          // so that body_template placeholders like {{from}} can be resolved
          let templateInputs: Record<string, unknown> = { ...modifiedInputs };
          if (modifiedInputs.body && typeof modifiedInputs.body === "object" && !Array.isArray(modifiedInputs.body)) {
            templateInputs = { ...templateInputs, ...(modifiedInputs.body as Record<string, unknown>) };
          }
          // Unwrap simple wrapper objects: e.g. {email: "x"} → "x", so {{from}} resolves to a string
          for (const [k, v] of Object.entries(templateInputs)) {
            if (v && typeof v === "object" && !Array.isArray(v)) {
              const entries = Object.entries(v as Record<string, unknown>);
              if (entries.length === 1 && typeof entries[0][1] === "string") {
                templateInputs[k] = entries[0][1];
              }
            }
          }
          // Extract "to" email from personalizations array if present
          if (Array.isArray(templateInputs.personalizations)) {
            const firstP = (templateInputs.personalizations as Record<string, unknown>[])[0];
            if (firstP?.to && Array.isArray(firstP.to) && (firstP.to as Record<string, unknown>[]).length > 0) {
              templateInputs.to = ((firstP.to as Record<string, unknown>[])[0] as Record<string, unknown>).email || templateInputs.to;
            }
            if (firstP?.subject) {
              templateInputs.subject = templateInputs.subject || firstP.subject;
            }
          }
          // Extract content value
          if (Array.isArray(templateInputs.content)) {
            const firstC = (templateInputs.content as Record<string, unknown>[])[0];
            if (firstC?.value) {
              templateInputs.html_content = templateInputs.html_content || firstC.value;
            }
          }
          // Map 'html' to 'html_content' if needed
          if (templateInputs.html && !templateInputs.html_content) {
            templateInputs.html_content = templateInputs.html;
          }
          const transformedBody = applyBodyTemplate(bodyTemplate, templateInputs);
          requestOptions.body = JSON.stringify(transformedBody);
        } else {
          requestOptions.body = JSON.stringify(modifiedInputs);
        }
      }

      // Execute with retry
      const retryConfig = (connector.retry_config || { max_retries: 3, backoff_ms: 1000, backoff_multiplier: 2 }) as {
        max_retries: number;
        backoff_ms: number;
        backoff_multiplier: number;
      };

      try {
        const { response, retries } = await fetchWithRetry(url, requestOptions, retryConfig, isReadOnly);
        retriesUsed = retries;

        const responseText = await response.text();
        try {
          apiResponse = JSON.parse(responseText);
        } catch {
          apiResponse = { raw: responseText };
        }

        // Update connector last_used_at
        await supabase
          .from("api_connectors")
          .update({ last_used_at: new Date().toISOString(), last_error: null })
          .eq("id", connector.id);

        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${responseText.slice(0, 200)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "API call failed";
        
        // Update connector with error
        await supabase
          .from("api_connectors")
          .update({ last_error: errorMessage })
          .eq("id", connector.id);

        // Update execution run with failure
        await supabase
          .from("execution_runs")
          .update({
            status: "failed",
            error_message: errorMessage,
            retry_count: retriesUsed,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            redacted_response: { error: errorMessage },
          })
          .eq("id", executionId);

        return new Response(
          JSON.stringify({
            success: false,
            execution_id: executionId,
            status: "failed",
            error: errorMessage,
            retries_used: retriesUsed,
            duration_ms: Date.now() - startTime,
            redacted_request: redactSensitiveData(modifiedInputs) as Record<string, unknown>,
            redacted_response: { error: errorMessage },
          } as ActionResult),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // No connector - simulate execution
      apiResponse = {
        simulated: true,
        action: action.name,
        inputs: modifiedInputs,
        timestamp: new Date().toISOString(),
      };
    }

    // Update execution run with success
    const redactedResponse = redactSensitiveData(apiResponse);

    await supabase
      .from("execution_runs")
      .update({
        status: "success",
        output_data: apiResponse,
        redacted_response: redactedResponse,
        retry_count: retriesUsed,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
      })
      .eq("id", executionId);

    // Log the execution
    await supabase.from("audit_logs").insert({
      user_id: user!.id,
      organization_id: project.organization_id,
      action: "action_executed",
      resource_type: "action_template",
      resource_id: action_template_id,
      metadata: {
        execution_id: executionId,
        connector_id: connector?.id,
        retries: retriesUsed,
        duration_ms: Date.now() - startTime,
      },
    });

    const result: ActionResult = {
      success: true,
      execution_id: executionId,
      status: "success",
      data: apiResponse,
      retries_used: retriesUsed,
      duration_ms: Date.now() - startTime,
      redacted_request: redactSensitiveData(modifiedInputs) as Record<string, unknown>,
      redacted_response: redactedResponse as Record<string, unknown>,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);

    // Update execution run if we have one
    if (executionId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from("execution_runs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
        })
        .eq("id", executionId);
    }

    // Get CORS headers for error response
    const { headers: errorCorsHeaders } = getCorsHeaders(req);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        execution_id: executionId,
        status: "failed",
        error: errorMessage,
        debug_info: {
          stage: "action-runner-global-catch",
          error_type: error instanceof Error ? error.constructor.name : typeof error,
        },
        retries_used: 0,
        duration_ms: Date.now() - startTime,
        redacted_request: {},
        redacted_response: {},
      }),
      { status: 500, headers: { ...errorCorsHeaders, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Content-Type": "application/json" } }
    );
  }
});
