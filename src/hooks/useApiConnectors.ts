/**
 * API Connectors management hook
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ApiConnector {
  id: string;
  project_id: string;
  api_source_id: string | null;
  name: string;
  description: string | null;
  base_url: string;
  auth_type: string;
  auth_config: Record<string, unknown>;
  credential_secret_id: string | null;
  default_headers: Record<string, unknown>;
  timeout_ms: number;
  retry_config: {
    max_retries: number;
    backoff_ms: number;
    backoff_multiplier: number;
  };
  rate_limit_requests: number | null;
  rate_limit_window_seconds: number;
  is_active: boolean;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useApiConnectors(projectId: string | null) {
  const [connectors, setConnectors] = useState<ApiConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConnectors = useCallback(async () => {
    if (!projectId) {
      setConnectors([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("api_connectors")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      
      setConnectors((data || []).map(c => ({
        ...c,
        auth_config: (c.auth_config || {}) as Record<string, unknown>,
        default_headers: (c.default_headers || {}) as Record<string, unknown>,
        retry_config: (c.retry_config || { max_retries: 3, backoff_ms: 1000, backoff_multiplier: 2 }) as {
          max_retries: number;
          backoff_ms: number;
          backoff_multiplier: number;
        },
      })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch connectors");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const createConnector = async (
    connector: Omit<ApiConnector, "id" | "created_at" | "updated_at" | "last_used_at" | "last_error">
  ) => {
    try {
      const { data, error: insertError } = await supabase
        .from("api_connectors")
        .insert({
          project_id: connector.project_id,
          api_source_id: connector.api_source_id,
          name: connector.name,
          description: connector.description,
          base_url: connector.base_url,
          auth_type: connector.auth_type,
          auth_config: JSON.parse(JSON.stringify(connector.auth_config)),
          credential_secret_id: connector.credential_secret_id,
          default_headers: JSON.parse(JSON.stringify(connector.default_headers)),
          timeout_ms: connector.timeout_ms,
          retry_config: JSON.parse(JSON.stringify(connector.retry_config)),
          rate_limit_requests: connector.rate_limit_requests,
          rate_limit_window_seconds: connector.rate_limit_window_seconds,
          is_active: connector.is_active,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      toast({ title: "Connector created", description: "API connector has been configured" });
      await fetchConnectors();
      return data;
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create connector",
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateConnector = async (id: string, updates: Partial<ApiConnector>) => {
    try {
      const { error: updateError } = await supabase
        .from("api_connectors")
        .update({
          name: updates.name,
          description: updates.description,
          base_url: updates.base_url,
          auth_type: updates.auth_type,
          auth_config: updates.auth_config ? JSON.parse(JSON.stringify(updates.auth_config)) : undefined,
          default_headers: updates.default_headers ? JSON.parse(JSON.stringify(updates.default_headers)) : undefined,
          timeout_ms: updates.timeout_ms,
          retry_config: updates.retry_config ? JSON.parse(JSON.stringify(updates.retry_config)) : undefined,
          rate_limit_requests: updates.rate_limit_requests,
          rate_limit_window_seconds: updates.rate_limit_window_seconds,
          is_active: updates.is_active,
        })
        .eq("id", id);

      if (updateError) throw updateError;
      toast({ title: "Connector updated" });
      await fetchConnectors();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update connector",
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteConnector = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("api_connectors")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      toast({ title: "Connector deleted" });
      await fetchConnectors();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete connector",
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    connectors,
    loading,
    error,
    createConnector,
    updateConnector,
    deleteConnector,
    refetch: fetchConnectors,
  };
}
