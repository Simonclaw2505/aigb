/**
 * Permissions hooks for MCP Foundry
 * Manages agent capabilities and user permission rules
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type AgentCapabilityPolicy = Database["public"]["Enums"]["agent_capability_policy"];
type PolicyEffect = Database["public"]["Enums"]["policy_effect"];
type AppRole = Database["public"]["Enums"]["app_role"];
type EnvironmentType = Database["public"]["Enums"]["environment_type"];

export interface AgentCapability {
  id: string;
  project_id: string;
  action_template_id: string | null;
  action_name: string | null;
  policy: AgentCapabilityPolicy;
  approval_roles: AppRole[];
  max_executions_per_hour: number | null;
  max_executions_per_day: number | null;
  allowed_environments: EnvironmentType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  action_template?: {
    id: string;
    name: string;
    description: string;
    risk_level: string;
  };
}

export interface UserPermissionRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  subject_role: AppRole | null;
  subject_user_id: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  effect: PolicyEffect;
  conditions: Record<string, unknown>;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PermissionEvaluation {
  id: string;
  user_id: string | null;
  agent_session_id: string | null;
  action_template_id: string | null;
  resource_type: string;
  resource_id: string | null;
  requested_action: string;
  evaluation_result: PolicyEffect;
  matched_rules: string[];
  evaluation_details: Record<string, unknown> | null;
  requires_confirmation: boolean;
  requires_approval: boolean;
  evaluated_at: string;
}

export function useAgentCapabilities(projectId: string | null) {
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCapabilities = useCallback(async () => {
    if (!projectId) {
      setCapabilities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("agent_capabilities")
        .select(`
          *,
          action_template:action_templates(id, name, description, risk_level)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setCapabilities((data || []) as unknown as AgentCapability[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch capabilities");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  const createCapability = async (
    capability: Omit<AgentCapability, "id" | "created_at" | "updated_at" | "action_template">
  ) => {
    try {
      const { data, error: insertError } = await supabase
        .from("agent_capabilities")
        .insert({
          project_id: capability.project_id,
          action_template_id: capability.action_template_id,
          action_name: capability.action_name,
          policy: capability.policy,
          approval_roles: capability.approval_roles,
          max_executions_per_hour: capability.max_executions_per_hour,
          max_executions_per_day: capability.max_executions_per_day,
          allowed_environments: capability.allowed_environments,
          is_active: capability.is_active,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      toast({ title: "Capability created", description: "Agent capability has been configured" });
      await fetchCapabilities();
      return data;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create capability",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateCapability = async (id: string, updates: Partial<AgentCapability>) => {
    try {
      const { error: updateError } = await supabase
        .from("agent_capabilities")
        .update({
          policy: updates.policy,
          approval_roles: updates.approval_roles,
          max_executions_per_hour: updates.max_executions_per_hour,
          max_executions_per_day: updates.max_executions_per_day,
          allowed_environments: updates.allowed_environments,
          is_active: updates.is_active,
        })
        .eq("id", id);

      if (updateError) throw updateError;
      toast({ title: "Capability updated" });
      await fetchCapabilities();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update capability",
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteCapability = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("agent_capabilities")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      toast({ title: "Capability deleted" });
      await fetchCapabilities();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete capability",
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    capabilities,
    loading,
    error,
    createCapability,
    updateCapability,
    deleteCapability,
    refetch: fetchCapabilities,
  };
}

export function useUserPermissionRules(organizationId: string | null) {
  const [rules, setRules] = useState<UserPermissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchRules = useCallback(async () => {
    if (!organizationId) {
      setRules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("user_permission_rules")
        .select("*")
        .eq("organization_id", organizationId)
        .order("priority", { ascending: false });

      if (fetchError) throw fetchError;
      setRules((data || []).map(rule => ({
        ...rule,
        conditions: (rule.conditions || {}) as Record<string, unknown>,
      })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rules");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = async (
    rule: Omit<UserPermissionRule, "id" | "created_at" | "updated_at">
  ) => {
    try {
      const { data, error: insertError } = await supabase
        .from("user_permission_rules")
        .insert({
          organization_id: rule.organization_id,
          name: rule.name,
          description: rule.description,
          subject_role: rule.subject_role,
          subject_user_id: rule.subject_user_id,
          resource_type: rule.resource_type,
          resource_id: rule.resource_id,
          action: rule.action,
          effect: rule.effect,
          conditions: JSON.parse(JSON.stringify(rule.conditions)),
          priority: rule.priority,
          is_active: rule.is_active,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      toast({ title: "Rule created", description: "Permission rule has been added" });
      await fetchRules();
      return data;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create rule",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateRule = async (id: string, updates: Partial<UserPermissionRule>) => {
    try {
      const { error: updateError } = await supabase
        .from("user_permission_rules")
        .update({
          name: updates.name,
          description: updates.description,
          subject_role: updates.subject_role,
          resource_type: updates.resource_type,
          resource_id: updates.resource_id,
          action: updates.action,
          effect: updates.effect,
          conditions: updates.conditions ? JSON.parse(JSON.stringify(updates.conditions)) : undefined,
          priority: updates.priority,
          is_active: updates.is_active,
        })
        .eq("id", id);

      if (updateError) throw updateError;
      toast({ title: "Rule updated" });
      await fetchRules();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update rule",
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("user_permission_rules")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      toast({ title: "Rule deleted" });
      await fetchRules();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete rule",
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    rules,
    loading,
    error,
    createRule,
    updateRule,
    deleteRule,
    refetch: fetchRules,
  };
}

export function usePermissionEvaluations(organizationId: string | null) {
  const [evaluations, setEvaluations] = useState<PermissionEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvaluations = useCallback(async () => {
    if (!organizationId) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("permission_evaluations")
        .select("*")
        .eq("organization_id", organizationId)
        .order("evaluated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setEvaluations((data || []).map(e => ({
        ...e,
        matched_rules: (e.matched_rules || []) as string[],
        evaluation_details: (e.evaluation_details || null) as Record<string, unknown> | null,
      })));
    } catch {
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchEvaluations();
  }, [fetchEvaluations]);

  return { evaluations, loading, refetch: fetchEvaluations };
}
