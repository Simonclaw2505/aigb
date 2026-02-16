/**
 * Agent-centric permission hooks
 * Fetches operator roles, agent tools+actions, and manages permission rules per agent
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type PolicyEffect = Database["public"]["Enums"]["policy_effect"];

/** Distinct roles found in operator_keys for an agent */
export function useAgentRoles(agentId: string | null) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    if (!agentId) {
      setRoles([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("operator_keys")
        .select("role")
        .eq("agent_id", agentId)
        .eq("is_active", true);

      if (error) throw error;

      const distinct = [...new Set((data || []).map((d) => d.role))].sort();
      setRoles(distinct);
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return { roles, loading, refetch: fetchRoles };
}

export interface AgentToolWithActions {
  toolId: string;
  toolName: string;
  actions: { id: string; name: string; description: string; risk_level: string }[];
}

/** Tools linked to the agent + their action_templates */
export function useAgentToolsAndActions(agentId: string | null) {
  const [tools, setTools] = useState<AgentToolWithActions[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!agentId) {
      setTools([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Get tools linked to this agent
      const { data: agentTools, error: atErr } = await supabase
        .from("agent_tools")
        .select("api_source_id, api_sources(id, name)")
        .eq("agent_id", agentId);

      if (atErr) throw atErr;

      // Get action_templates for this agent
      const { data: actions, error: actErr } = await supabase
        .from("action_templates")
        .select("id, name, description, risk_level, endpoint_id, endpoints(api_source_id)")
        .eq("project_id", agentId)
        .eq("is_enabled", true)
        .eq("status", "active");

      if (actErr) throw actErr;

      // Build map: api_source_id -> tool name
      const toolMap = new Map<string, string>();
      for (const at of agentTools || []) {
        const src = at.api_sources as any;
        if (src) toolMap.set(src.id, src.name);
      }

      // Group actions by tool (api_source)
      const grouped = new Map<string, AgentToolWithActions>();

      for (const action of actions || []) {
        const endpoint = action.endpoints as any;
        const sourceId = endpoint?.api_source_id;
        if (!sourceId || !toolMap.has(sourceId)) continue;

        if (!grouped.has(sourceId)) {
          grouped.set(sourceId, {
            toolId: sourceId,
            toolName: toolMap.get(sourceId)!,
            actions: [],
          });
        }
        grouped.get(sourceId)!.actions.push({
          id: action.id,
          name: action.name,
          description: action.description,
          risk_level: action.risk_level,
        });
      }

      setTools(Array.from(grouped.values()));
    } catch {
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { tools, loading, refetch: fetchData };
}

export interface RolePermission {
  ruleId: string | null;
  actionTemplateId: string;
  role: AppRole;
  effect: PolicyEffect;
}

/** Permission rules for a specific agent, indexed by role+actionId */
export function useAgentPermissionRules(agentId: string | null, organizationId: string | null) {
  const [permissions, setPermissions] = useState<Map<string, RolePermission>>(new Map());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const makeKey = (role: AppRole, actionId: string) => `${role}::${actionId}`;

  const fetchRules = useCallback(async () => {
    if (!agentId || !organizationId) {
      setPermissions(new Map());
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_permission_rules")
        .select("*")
        .eq("agent_id", agentId)
        .eq("organization_id", organizationId)
        .eq("resource_type", "action")
        .eq("action", "execute");

      if (error) throw error;

      const map = new Map<string, RolePermission>();
      for (const rule of data || []) {
        if (rule.subject_role && rule.resource_id) {
          const key = makeKey(rule.subject_role, rule.resource_id);
          map.set(key, {
            ruleId: rule.id,
            actionTemplateId: rule.resource_id,
            role: rule.subject_role,
            effect: rule.effect,
          });
        }
      }
      setPermissions(map);
    } catch {
      setPermissions(new Map());
    } finally {
      setLoading(false);
    }
  }, [agentId, organizationId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const isAllowed = (role: AppRole, actionId: string): boolean => {
    const perm = permissions.get(makeKey(role, actionId));
    return perm?.effect === "allow";
  };

  const togglePermission = async (role: AppRole, actionId: string, actionName: string, allowed: boolean) => {
    if (!agentId || !organizationId) return;
    const key = makeKey(role, actionId);
    const existing = permissions.get(key);

    try {
      if (existing?.ruleId) {
        if (allowed) {
          // Update to allow
          await supabase
            .from("user_permission_rules")
            .update({ effect: "allow" as PolicyEffect })
            .eq("id", existing.ruleId);
        } else {
          // Update to deny
          await supabase
            .from("user_permission_rules")
            .update({ effect: "deny" as PolicyEffect })
            .eq("id", existing.ruleId);
        }
      } else {
        // Create new rule
        await supabase.from("user_permission_rules").insert({
          organization_id: organizationId,
          agent_id: agentId,
          name: `${role}:${actionName}`,
          subject_role: role,
          resource_type: "action",
          resource_id: actionId,
          action: "execute",
          effect: (allowed ? "allow" : "deny") as PolicyEffect,
          priority: 0,
          is_active: true,
        });
      }
      await fetchRules();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible de mettre à jour la permission",
        variant: "destructive",
      });
    }
  };

  return { permissions, loading, isAllowed, togglePermission, refetch: fetchRules };
}
