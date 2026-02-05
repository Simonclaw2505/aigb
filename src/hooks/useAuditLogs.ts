import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
type ExecutionRun = Database["public"]["Tables"]["execution_runs"]["Row"];
type ActionTemplate = Database["public"]["Tables"]["action_templates"]["Row"];

export interface EnrichedExecutionRun extends ExecutionRun {
  action_template: Pick<ActionTemplate, "name" | "is_reversible" | "rollback_config" | "risk_level"> | null;
}

export interface AuditLogsFilters {
  resourceType?: string;
  projectId?: string;
  startDate?: Date;
  endDate?: Date;
  searchQuery?: string;
}

export function useAuditLogs(organizationId: string | undefined, filters?: AuditLogsFilters) {
  const auditLogsQuery = useQuery({
    queryKey: ["audit-logs", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters?.resourceType && filters.resourceType !== "all") {
        query = query.eq("resource_type", filters.resourceType);
      }

      if (filters?.searchQuery) {
        query = query.or(`action.ilike.%${filters.searchQuery}%,resource_type.ilike.%${filters.searchQuery}%`);
      }

      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!organizationId,
  });

  const executionRunsQuery = useQuery({
    queryKey: ["execution-runs", organizationId, filters?.projectId],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("execution_runs")
        .select(`
          *,
          action_template:action_templates(name, is_reversible, rollback_config, risk_level)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filters?.projectId) {
        query = query.eq("project_id", filters.projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EnrichedExecutionRun[];
    },
    enabled: !!organizationId,
  });

  return {
    auditLogs: auditLogsQuery.data ?? [],
    executionRuns: executionRunsQuery.data ?? [],
    isLoading: auditLogsQuery.isLoading || executionRunsQuery.isLoading,
    error: auditLogsQuery.error || executionRunsQuery.error,
    refetch: () => {
      auditLogsQuery.refetch();
      executionRunsQuery.refetch();
    },
  };
}
