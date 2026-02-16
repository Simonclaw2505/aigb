/**
 * Permission evaluation edge function
 * Server-side enforcement of permissions before action execution
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

interface EvaluateRequest {
  action_template_id?: string;
  resource_type: string;
  resource_id?: string;
  action: string;
  context?: Record<string, unknown>;
}

serve(async (req) => {
  // SECURITY: Validate CORS - reject requests from non-allowed origins
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", allowed: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token", allowed: false }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EvaluateRequest = await req.json();
    const { action_template_id, resource_type, resource_id, action, context = {} } = body;

    // Get the organization for the resource
    let organizationId: string | null = null;

    if (action_template_id) {
      // Get org from action template's project
      const { data: template } = await supabase
        .from("action_templates")
        .select("project_id")
        .eq("id", action_template_id)
        .single();

      if (template?.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("organization_id")
          .eq("id", template.project_id)
          .single();
        
        organizationId = project?.organization_id || null;
      }
    } else if (resource_id && resource_type === "project") {
      const { data: project } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", resource_id)
        .single();

      organizationId = project?.organization_id || null;
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Could not determine organization", allowed: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check agent capabilities first (if action_template_id provided)
    let agentPolicy = "allow";
    let requiresConfirmation = false;
    let requiresApproval = false;
    let approvalRoles: string[] = [];

    if (action_template_id) {
      const { data: capability } = await supabase
        .from("agent_capabilities")
        .select("*")
        .eq("action_template_id", action_template_id)
        .eq("is_active", true)
        .single();

      if (capability) {
        agentPolicy = capability.policy;

        if (agentPolicy === "deny") {
          // Log the denial
          await supabase.from("permission_evaluations").insert({
            organization_id: organizationId,
            user_id: user.id,
            action_template_id,
            resource_type,
            resource_id,
            requested_action: action,
            evaluation_result: "deny",
            matched_rules: [],
            evaluation_details: { reason: "Agent capability denied", capability_id: capability.id },
            requires_confirmation: false,
            requires_approval: false,
          });

          return new Response(
            JSON.stringify({
              allowed: false,
              reason: "Action is denied by agent capability policy",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (agentPolicy === "require_confirmation") {
          requiresConfirmation = true;
        }

        if (agentPolicy === "require_approval") {
          requiresApproval = true;
          approvalRoles = capability.approval_roles || ["owner", "admin"];
        }

        // Check rate limits
        if (capability.max_executions_per_hour || capability.max_executions_per_day) {
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

          if (capability.max_executions_per_hour) {
            const { count } = await supabase
              .from("execution_runs")
              .select("*", { count: "exact", head: true })
              .eq("action_template_id", action_template_id)
              .gte("created_at", hourAgo);

            if ((count || 0) >= capability.max_executions_per_hour) {
              return new Response(
                JSON.stringify({
                  allowed: false,
                  reason: "Hourly rate limit exceeded",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }

          if (capability.max_executions_per_day) {
            const { count } = await supabase
              .from("execution_runs")
              .select("*", { count: "exact", head: true })
              .eq("action_template_id", action_template_id)
              .gte("created_at", dayAgo);

            if ((count || 0) >= capability.max_executions_per_day) {
              return new Response(
                JSON.stringify({
                  allowed: false,
                  reason: "Daily rate limit exceeded",
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
    }

    // Evaluate user permissions using the database function
    const { data: evaluation, error: evalError } = await supabase.rpc("evaluate_permission", {
      _user_id: user.id,
      _organization_id: organizationId,
      _resource_type: resource_type,
      _resource_id: resource_id || null,
      _action: action,
      _context: context,
    });

    if (evalError) {
      console.error("Permission evaluation error:", evalError);
      return new Response(
        JSON.stringify({ error: "Permission evaluation failed", allowed: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = evaluation?.[0] || { allowed: false, denial_reason: "No evaluation result" };

    // Log the evaluation
    await supabase.from("permission_evaluations").insert({
      organization_id: organizationId,
      user_id: user.id,
      action_template_id: action_template_id || null,
      resource_type,
      resource_id: resource_id || null,
      requested_action: action,
      evaluation_result: result.allowed ? "allow" : "deny",
      matched_rules: result.matched_rule_ids || [],
      evaluation_details: {
        agent_policy: agentPolicy,
        user_evaluation: result,
        context,
      },
      requires_confirmation: requiresConfirmation,
      requires_approval: requiresApproval,
    });

    return new Response(
      JSON.stringify({
        allowed: result.allowed,
        requires_confirmation: requiresConfirmation,
        requires_approval: requiresApproval,
        approval_roles: requiresApproval ? approvalRoles : undefined,
        denial_reason: result.allowed ? undefined : result.denial_reason,
        matched_rules: result.matched_rule_ids || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("evaluate-permission error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: "Internal server error", allowed: false }),
      { status: 500, headers: { ...errorCorsHeaders, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Content-Type": "application/json" } }
    );
  }
});
