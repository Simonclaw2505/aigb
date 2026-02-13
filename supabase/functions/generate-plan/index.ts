/**
 * Plan Generation Edge Function
 * Parses natural language requests and generates structured execution plans
 * Uses Lovable AI Gateway for LLM capabilities
 * 
 * SECURITY: Uses strict CORS allowlist - see _shared/cors.ts for details
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { validateCors, getCorsHeaders } from "../_shared/cors.ts";

interface PlanRequest {
  project_id: string;
  request: string; // Natural language request
  session_id?: string;
}

interface PlanStep {
  step_number: number;
  description: string;
  action_template_id: string;
  action_name: string;
  inputs: Record<string, unknown>;
  depends_on: number[]; // step numbers this depends on
  estimated_impact: string;
}

interface ExecutionPlan {
  session_id: string;
  request: string;
  interpretation: string;
  steps: PlanStep[];
  warnings: string[];
  requires_approval: boolean;
  approval_reasons: string[];
}

serve(async (req) => {
  // SECURITY: Validate CORS - reject requests from non-allowed origins
  const cors = validateCors(req);
  if (cors.response) return cors.response;
  
  const corsHeaders = cors.headers;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
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

    const body: PlanRequest = await req.json();
    const { project_id, request: userRequest, session_id } = body;

    if (!project_id || !userRequest) {
      return new Response(
        JSON.stringify({ error: "project_id and request are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to project
    const { data: accessResult } = await supabase.rpc("can_access_project", {
      _user_id: user.id,
      _project_id: project_id,
    });

    if (!accessResult) {
      return new Response(
        JSON.stringify({ error: "Access denied to project" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch available actions for this project
    const { data: actions, error: actionsError } = await supabase
      .from("action_templates")
      .select("id, name, description, input_schema, risk_level, requires_approval")
      .eq("project_id", project_id)
      .eq("is_enabled", true)
      .eq("status", "active");

    if (actionsError) {
      throw new Error(`Failed to fetch actions: ${actionsError.message}`);
    }

    if (!actions || actions.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No actions available",
          message: "This project has no enabled actions. Import an API and create actions first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agent capabilities for the project
    const { data: capabilities } = await supabase
      .from("agent_capabilities")
      .select("action_template_id, policy")
      .eq("project_id", project_id)
      .eq("is_active", true);

    const capabilityMap = new Map(
      (capabilities || []).map(c => [c.action_template_id, c.policy])
    );

    // Filter out denied actions
    const allowedActions = actions.filter(a => {
      const policy = capabilityMap.get(a.id);
      return policy !== "deny";
    });

    // SECURITY: Sanitise action names and descriptions before injecting into LLM prompt
    // This prevents prompt injection via malicious action names/descriptions
    const sanitiseForPrompt = (text: string): string => {
      return text
        .replace(/[<>{}[\]]/g, "") // Remove brackets that could confuse JSON parsing
        .replace(/\n/g, " ")       // Flatten newlines
        .replace(/```/g, "")       // Remove code blocks
        .replace(/\\/g, "")        // Remove backslashes
        .slice(0, 200);            // Limit length
    };

    // Build the prompt for LLM
    const actionsDescription = allowedActions.map(a => 
      `- ${sanitiseForPrompt(a.name)}: ${sanitiseForPrompt(a.description)}\n  Risk: ${a.risk_level}\n  Inputs: ${JSON.stringify(a.input_schema)}`
    ).join("\n\n");

    const systemPrompt = `You are an AI assistant that converts natural language requests into structured execution plans.

Available actions:
${actionsDescription}

Rules:
1. Only use the actions listed above
2. Break down complex requests into sequential steps
3. Identify dependencies between steps
4. Estimate the impact of each step
5. Flag any risky operations
6. If you cannot accomplish the request with available actions, explain why

Respond with a JSON object (no markdown, just JSON):
{
  "interpretation": "Your understanding of what the user wants",
  "steps": [
    {
      "step_number": 1,
      "description": "What this step does",
      "action_name": "exact_action_name",
      "inputs": {"param": "value"},
      "depends_on": [],
      "estimated_impact": "e.g., 'Affects ~500 customer records'"
    }
  ],
  "warnings": ["Any concerns or risks"],
  "cannot_complete": false,
  "cannot_complete_reason": null
}`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userRequest },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      
      // Handle specific error codes
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Insufficient credits", 
            message: "Your Lovable AI credits have been exhausted. Please add more credits in Settings → Workspace → Usage." 
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limited", 
            message: "Too many requests. Please wait a moment and try again." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate plan from AI");
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse LLM response
    let parsedPlan;
    try {
      // Clean up potential markdown formatting
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedPlan = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse execution plan");
    }

    // Generate session ID
    const newSessionId = session_id || crypto.randomUUID();

    // Map action names to IDs and validate
    const steps: PlanStep[] = [];
    const warnings: string[] = [...(parsedPlan.warnings || [])];
    let requiresApproval = false;
    const approvalReasons: string[] = [];

    for (const step of parsedPlan.steps || []) {
      const action = allowedActions.find(a => a.name === step.action_name);
      
      if (!action) {
        warnings.push(`Step ${step.step_number}: Action "${step.action_name}" not found or not available`);
        continue;
      }

      // Check if action requires approval based on capabilities
      const policy = capabilityMap.get(action.id);
      if (policy === "require_approval" || action.requires_approval) {
        requiresApproval = true;
        approvalReasons.push(`Action "${action.name}" requires approval`);
      }

      // Check risk level
      if (action.risk_level === "irreversible") {
        warnings.push(`Step ${step.step_number}: "${action.name}" is IRREVERSIBLE - proceed with caution`);
      } else if (action.risk_level === "risky_write") {
        warnings.push(`Step ${step.step_number}: "${action.name}" is a risky write operation`);
      }

      steps.push({
        step_number: step.step_number,
        description: step.description,
        action_template_id: action.id,
        action_name: action.name,
        inputs: step.inputs || {},
        depends_on: step.depends_on || [],
        estimated_impact: step.estimated_impact || "Unknown",
      });
    }

    if (parsedPlan.cannot_complete) {
      return new Response(
        JSON.stringify({
          session_id: newSessionId,
          request: userRequest,
          error: "Cannot complete request",
          reason: parsedPlan.cannot_complete_reason,
          available_actions: allowedActions.map(a => a.name),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const plan: ExecutionPlan = {
      session_id: newSessionId,
      request: userRequest,
      interpretation: parsedPlan.interpretation,
      steps,
      warnings,
      requires_approval: requiresApproval,
      approval_reasons: approvalReasons,
    };

    // Log the plan generation
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "plan_generated",
      resource_type: "simulation",
      resource_id: newSessionId,
      metadata: {
        project_id,
        request: userRequest,
        steps_count: steps.length,
        requires_approval: requiresApproval,
      },
    });

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const { headers: errorCorsHeaders } = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...errorCorsHeaders, "Content-Type": "application/json" } }
    );
  }
});
